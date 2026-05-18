/**
 * MyOpenClaw - 我的 OpenClaw 页面
 * Design: 「流动蓝图」Fluid Blueprint
 * - 快速上手引导（始终显示，可手动关闭）
 * - OpenClaw 卡片列表（支持 8 种状态）
 * - 创建 OpenClaw 弹窗
 * - 通知 Bell 图标和面板
 * - 操作确认弹窗（重启、重装、删除）
 * - 自动轮询状态转换
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import TenantLayout from "@/components/TenantLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Bot, Bell, X, AlertCircle, ChevronDown, ChevronUp,
  Copy, Users, Check, ArrowRight, ArrowLeft,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import ChatView from "./ChatView";
import { MOCK_ROLES } from "@/lib/mockData";
import type { Role } from "@/lib/mockData";
import { loadClawList, saveClawList, notifyClawListChange } from "@/lib/openclawStore";
import { HeroBanner } from "@/components/agent/HeroBanner";
import { QuickStartGuide } from "@/components/agent/QuickStartGuide";
import { ViewModeSegmented } from "@/components/agent/ViewModeSegmented";
import { AgentCard } from "@/components/agent/AgentCard";

const DISABLED_TIP = "您的 OpenClaw 已被管理员停用，无法操作";
const LAUNCH_FAILED_TIP = "创建失败，无法操作";

// [006] 列表分页：每页默认 30 条，与后端 GET /openclaw/list 默认 page_size 保持一致
const PAGE_SIZE = 30;

// 8 种状态配置
type OpenClawStatus = "creating" | "createFail" | "running" | "shutdown" | "loading" | "loadFail" | "maintaining" | "pending";

interface OpenClawItem {
  id: string;
  instanceId: string;
  name: string;
  status: OpenClawStatus;
  createdAt: string;
  model: string;
  modelVersion: string;
  channels: any[];
  skills: any[];
  op?: string; // 操作标记：restart, reinstall
  roleName?: string; // 角色名称
  memoryStatus?: 'none' | 'free' | 'pro'; // 记忆状态
  agentType?: "openclaw" | "hermes" | "lightclawace"; // Agent 类型
  groupId?: string;   // 所属分组 ID（多分组模式）
  groupName?: string; // 所属分组名称（多分组模式）
}

interface Notification {
  id: string;
  message: string;
  timestamp: string;
}

// ==================== 多分组模式类型与Mock数据 ====================
type UserGroupMode = "normal" | "multi-group";

interface UserGroup {
  id: string;
  name: string;         // 分组全称
  type: "department" | "custom"; // 部门 / 自定义分组
  isPrimary: boolean;   // 是否主部门
  depth: number;        // 层级深度
  permissions: {
    allowTerminal: boolean;
    allowChatView: boolean;
    agentTypes: ("openclaw" | "hermes" | "lightclawace")[];
    roles: string[];    // 可用角色列表
    panelAccess: "full" | "partial" | "limited"; // 详细配置面板访问级别
  };
}

// Alice 所属的 3 个分组
const MOCK_USER_GROUPS: UserGroup[] = [
  {
    id: "grp-fe",
    name: "A公司 / 技术部 / 前端组",
    type: "department",
    isPrimary: true,
    depth: 3,
    permissions: {
      allowTerminal: true,
      allowChatView: true,
      agentTypes: ["openclaw", "hermes", "lightclawace"],
      roles: ["通用助手", "客服助手", "技术顾问", "运营助手", "数据分析师", "产品经理", "文案创作"],
      panelAccess: "full",
    },
  },
  {
    id: "grp-ai",
    name: "A公司 / 技术部 / AI 组",
    type: "department",
    isPrimary: false,
    depth: 3,
    permissions: {
      allowTerminal: true,
      allowChatView: true,
      agentTypes: ["openclaw", "hermes", "lightclawace"],
      roles: ["通用助手", "技术顾问", "数据分析师"],
      panelAccess: "partial",
    },
  },
  {
    id: "grp-custom",
    name: "前端研发同学",
    type: "custom",
    isPrimary: false,
    depth: 1,
    permissions: {
      allowTerminal: false,
      allowChatView: false,
      agentTypes: ["openclaw"],
      roles: ["通用助手", "客服助手"],
      panelAccess: "limited",
    },
  },
];

// 获取默认选中的分组：优先选主部门，否则选层级最浅的
const getDefaultGroup = (groups: UserGroup[]): UserGroup => {
  const primary = groups.find(g => g.isPrimary);
  if (primary) return primary;
  return [...groups].sort((a, b) => a.depth - b.depth)[0];
};

// 状态视觉配置已迁移到 components/agent/StatusBadge.tsx，本页直接使用 AGENT_STATUS_DISABLED 判定禁用

export default function MyOpenClaw() {
  const [, navigate] = useLocation();
  const [claws, setClawsRaw] = useState<OpenClawItem[]>(() => loadClawList() as OpenClawItem[]);
  // 包装 setClaws，每次更新同步到 store
  const setClaws = (v: OpenClawItem[] | ((prev: OpenClawItem[]) => OpenClawItem[])) => {
    setClawsRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      saveClawList(next);
      notifyClawListChange();
      return next;
    });
  };
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showQuickStart, setShowQuickStart] = useState(true);

  // ===== 点阵装饰层动态测量：测量分页栏在中间内容区中的位置，让点阵下边界紧贴分页栏顶部分割线
  // 设计意图：点阵只在 hero 底线 ~ 分页栏顶线之间显示（四角无点阵）
  // 实现：用 ref callback + ResizeObserver，监听分页栏自身和中间内容区的尺寸变化
  // 计算：用 getBoundingClientRect() 算「分页栏顶部 - 中间内容区顶部」的距离，
  //       再用 middle.offsetHeight 减去它得到 bottom 值。
  //       不能用 pagination.offsetTop —— 那是相对最近 positioned 祖先的距离，
  //       而中间嵌了别的 relative 容器（如卡片网格 wrapper）会让 offsetTop 偏小，导致 bottom 偏大、点阵向上抬过头。
  const roRef = useRef<ResizeObserver | null>(null);
  const middleSectionRef = useRef<HTMLDivElement | null>(null);
  const paginationElRef = useRef<HTMLDivElement | null>(null);
  // 初始值：约 180 = 分页栏典型距底部，避免首次渲染时点阵覆盖到分页栏
  const [dotsBottom, setDotsBottom] = useState(180);
  const recompute = useCallback(() => {
    const middle = middleSectionRef.current;
    const pagination = paginationElRef.current;
    if (!middle) return;
    if (!pagination) {
      // ChatView 模式无分页栏，bottom 直接到中间内容区底部 padding 即可
      setDotsBottom(0);
      return;
    }
    // 用 getBoundingClientRect 跨祖先链计算「分页栏顶部相对中间内容区顶部」的真实距离
    const middleRect = middle.getBoundingClientRect();
    const paginationRect = pagination.getBoundingClientRect();
    const paginationTopInMiddle = paginationRect.top - middleRect.top;
    setDotsBottom(middle.offsetHeight - paginationTopInMiddle);
  }, []);
  const middleRef = useCallback((node: HTMLDivElement | null) => {
    middleSectionRef.current = node;
    recompute();
  }, [recompute]);
  const paginationRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    paginationElRef.current = node;
    if (!node) {
      recompute();
      return;
    }
    recompute();
    // 同时监听分页栏与中间内容区尺寸变化，任一变化都重新计算
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    if (middleSectionRef.current) ro.observe(middleSectionRef.current);
    roRef.current = ro;
  }, [recompute]);

  // ===== 多分组模式 =====
  const [groupMode, setGroupMode] = useState<UserGroupMode>(() => {
    return (localStorage.getItem("openclaw_group_mode") as UserGroupMode) || "normal";
  });
  const handleGroupModeChange = (mode: UserGroupMode) => {
    setGroupMode(mode);
    localStorage.setItem("openclaw_group_mode", mode);
    // 通知同页面其他组件
    window.dispatchEvent(new StorageEvent("storage", { key: "openclaw_group_mode", newValue: mode }));
  };
  // 创建弹窗步骤（多分组模式下用）
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup>(() => getDefaultGroup(MOCK_USER_GROUPS));

  // 视图模式
  const [viewMode, setViewMode] = useState<"card" | "chat">(() => {
    return (localStorage.getItem("openclaw_view_mode") as "card" | "chat") || "chat";
  });
  const handleViewModeChange = (mode: "card" | "chat") => {
    setViewMode(mode);
    localStorage.setItem("openclaw_view_mode", mode);
  };

  // 全屏模式
  const [isFullscreen, setIsFullscreen] = useState(false);
  const handleToggleFullscreen = () => setIsFullscreen(prev => !prev);

  // Agent 类型
  const [agentType, setAgentType] = useState<"openclaw" | "hermes" | "lightclawace">("openclaw");
  const [typeExpanded, setTypeExpanded] = useState(false);

  // 角色选择
  const [roleExpanded, setRoleExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const visibleRoles = MOCK_ROLES.filter((r) => r.visible);



  // 通知相关
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // 确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; status: OpenClawStatus; memoryStatus?: 'none' | 'free' | 'pro' } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [restartConfirm, setRestartConfirm] = useState<{ id: string; name: string } | null>(null);
  const [reinstallConfirm, setReinstallConfirm] = useState<{ id: string; name: string } | null>(null);
  const [reinstallConfirmInput, setReinstallConfirmInput] = useState("");
  const [removeRoleConfirm, setRemoveRoleConfirm] = useState<{ id: string; name: string; roleName: string } | null>(null);

  // 开启面板弹窗
  const [panelDialog, setPanelDialog] = useState<{ id: string; name: string } | null>(null);

  // 卡片视图 Agent 类型子 Tab
  const [activeAgentTab, setActiveAgentTab] = useState<"openclaw" | "hermes" | "lightclawace">("openclaw");

  // [006] 当前分页页码
  const [page, setPage] = useState(1);

  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  
  // 从管控端同步的开关
  const [allowTerminal] = useState(() => {
    return localStorage.getItem("admin_allow_terminal") === "true";
  });

  // 自动轮询
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化通知（模拟）
  useEffect(() => {
    // Mock 通知消息：7 条删除相关通知
    const mockNotifications: Notification[] = [
      // 场景 1: 被管理员在腾讯云控制台删除
      { id: "notif-1", message: "「Noah的分析助手」已被删除", timestamp: "2026-03-26 10:30" },
      { id: "notif-2", message: "「Eve的编程助手」已被删除", timestamp: "2026-03-26 09:15" },
      { id: "notif-3", message: "「Leo的创意助手」已被删除", timestamp: "2026-03-26 08:45" },
      { id: "notif-4", message: "「Alice的工作助手」已被删除", timestamp: "2026-03-26 07:20" },
      // 场景 2: 被管理员在管控端删除
      { id: "notif-5", message: "「Bob的数据分析」已被管理员删除", timestamp: "2026-03-25 18:20" },
      { id: "notif-6", message: "「Carol的内容创作」已被管理员删除", timestamp: "2026-03-25 15:45" },
      { id: "notif-7", message: "「David的代码生成」已被管理员删除", timestamp: "2026-03-25 12:10" },
    ];
    setNotifications(mockNotifications);
    setHasUnread(true);
  }, []);

  // 自动轮询逻辑
  useEffect(() => {
    const startPolling = () => {
      pollingTimerRef.current = setInterval(() => {
        setClaws(prevClaws =>
          prevClaws.map(claw => {
            // creating -> running 或 createFail
            if (claw.status === "creating") {
              const rand = Math.random();
              return rand > 0.1 ? { ...claw, status: "running" } : { ...claw, status: "createFail" };
            }
            // loading -> running 或 loadFail
            if (claw.status === "loading") {
              const rand = Math.random();
              return rand > 0.1 ? { ...claw, status: "running" } : { ...claw, status: "loadFail" };
            }
            // maintaining -> running
            if (claw.status === "maintaining") {
              return { ...claw, status: "running" };
            }
            return claw;
          })
        );
      }, 3000); // 每 3 秒轮询一次
    };

    startPolling();
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const handleRefreshStatus = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (refreshingIds.has(id)) return;
    setRefreshingIds(prev => { const next = new Set(prev); next.add(id); return next; });
    setTimeout(() => {
      setRefreshingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success(`「${name}」状态已刷新`);
    }, 1500);
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("请输入 OpenClaw 名称");
      return;
    }
    const ts = Date.now();
    const newClaw: OpenClawItem = {
      id: `oc-${ts}`,
      instanceId: `ins-${ts.toString(36).slice(-8)}`,
      name: newName.trim(),
      status: "creating",
      agentType: agentType,
      createdAt: new Date().toLocaleString("zh-CN"),
      model: "",
      modelVersion: "",
      channels: [],
      skills: [],
      roleName: selectedRole?.name ?? "通用助手",
      memoryStatus: 'none',
      groupId: groupMode === "multi-group" ? selectedGroup.id : "default",
      groupName: groupMode === "multi-group" ? selectedGroup.name : "默认",
    };
    setClaws([newClaw, ...claws]);
    setNewName("");
    setSelectedRole(null);
    setRoleExpanded(false);
    setShowCreate(false);
    setCreateStep(1);
    setPage(1); // [006] 创建后跳回第 1 页，展示刚创建的实例
    toast.success(`「${newClaw.name}」创建中...`);
  };

  const handleDelete = (id: string, name: string) => {
    setClaws(claws.filter((c) => c.id !== id));
    setDeleteConfirm(null);
    setDeleteConfirmInput("");
    toast.success(`「${name}」已删除`);
  };

  const handleRemoveRole = (id: string, name: string) => {
    setClaws(claws.map((c) => c.id === id ? { ...c, roleName: "通用助手" } : c));
    setRemoveRoleConfirm(null);
    toast.success(`「${name}」已移除角色，回退为通用助手`);
  };

  const handleRestart = (id: string, name: string) => {
    setClaws(claws.map(c => c.id === id ? { ...c, status: "loading" as OpenClawStatus } : c));
    setRestartConfirm(null);
    toast.success(`「${name}」正在重启...`);
  };

  const handleReinstall = (id: string, name: string) => {
    setClaws(claws.map(c => c.id === id ? { ...c, status: "loading" as OpenClawStatus, op: "reinstall" } : c));
    setReinstallConfirm(null);
    setReinstallConfirmInput("");
    toast.success(`「${name}」正在重新安装...`);
  };

  const handleRetry = (id: string, name: string) => {
    setClaws(claws.map(c => c.id === id ? { ...c, status: "loading" as OpenClawStatus } : c));
    toast.success(`「${name}」正在重试...`);
  };

  const handleAddNotification = (message: string) => {
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      message,
      timestamp: new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
    setNotifications(prev => [notification, ...prev]);
    setHasUnread(true);
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleOpenNotificationPanel = () => {
    setShowNotificationPanel(true);
    setHasUnread(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <TenantLayout>
        {/* SKILL §7.4 响应式：min-w-[1200px] 保最低可用宽度 / max-w-[1920px] 大屏限宽
            overflow-x-clip：让顶部/底部贯穿全视口的横线（用 100vw 实现）不触发水平滚动条 */}
        {/* Figma 446:2942 - row flex：[80px 矩阵] + [中间内容区] + [80px 矩阵]，源结构 1:1 还原 */}
        <div className="min-w-[1200px] overflow-x-clip">
          <div className="max-w-[1920px] mx-auto flex items-stretch page-enter">
            {/* 左侧 80px 占位带 - Figma 446:2943
                点阵不再贯穿全高（避免与 hero 段、分页栏段对应的两侧四角重叠），
                由中间内容区的「中段 wrapper」局部延伸 80px 渲染，仅覆盖 hero 底线 ~ 分页栏顶线 */}
            <div aria-hidden className="shrink-0 w-20 self-stretch" />
            {/* 中间内容区 - Figma 446:2944，gap 32px 由各段 mb 控制 / padding-bottom 75px / 子段自带 px-42
                ref={middleRef}：让点阵装饰层基于中间内容区与分页栏的实际几何动态计算 bottom 值 */}
            <div ref={middleRef} className="flex-1 min-w-0 relative" style={{ paddingBottom: "75px" }}>
              {/* 左右两侧点阵装饰层 - 仅覆盖 hero 底线 ~ 分页栏顶线（四角无点阵）
                  - 高度自适应：top: 112px = HeroBanner 高度；bottom: dotsBottom（动态 = 中间内容区高度 - 分页栏 offsetTop）
                    完全摆脱对 pb-32 / mt-6 等常量的依赖，直接读取 DOM 几何
                  - 宽度自适应：用 CSS calc 让点阵从中间内容区两侧外延到视口边缘
                    · left: calc((100% - 100vw) / 2)：父级 100% = 中间内容区宽度 W，
                      该表达式 = (W - 100vw)/2 = 负值，向左延伸 (100vw - W)/2 px 抵达视口左边
                    · right: 100%：紧贴中间内容区左边外侧（点阵不进入中间内容区）
                  - 点阵规格：12×12 网格 / 2×2 圆点（半径 1px）/ #DFE2E5 / pointer-events-none */}
              <div
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  top: "112px",
                  bottom: `${dotsBottom}px`,
                  left: "calc((100% - 100vw) / 2)",
                  right: "100%",
                  backgroundImage:
                    "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                  backgroundSize: "12px 12px",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  top: "112px",
                  bottom: `${dotsBottom}px`,
                  left: "100%",
                  right: "calc((100% - 100vw) / 2)",
                  backgroundImage:
                    "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                  backgroundSize: "12px 12px",
                }}
              />
              {/* 中间内容区左右两条竖向分隔线：紧贴 80px 矩阵带内侧，贯穿全高（对齐 Figma 整页贯穿样式）
                  z-30 用于覆盖 QuickStartGuide 自带的渐变背景（否则会被遮住露不出来）；
                  pointer-events-none 保证不影响内部按钮（如关闭按钮）的点击。 */}
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 left-0 z-30"
                style={{ width: "1px", backgroundColor: "#E2E8F0" }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 right-0 z-30"
                style={{ width: "1px", backgroundColor: "#E2E8F0" }}
              />
          {/* Hero Banner - Figma 358:2325 / 363:5079
              QuickStart 关闭后传入 onShowQuickStart 回调，副文右侧会出现「查看步骤指引」按钮 */}
          <HeroBanner
            onShowQuickStart={
              !showQuickStart ? () => setShowQuickStart(true) : undefined
            }
          />

          {/* Quick Start Guide - Figma 358:2341 */}
          {showQuickStart && (
            <QuickStartGuide onClose={() => setShowQuickStart(false)} />
          )}

          {/* Section Header - Figma 358:2373，左右 42px 段落内边距对齐 446:2976
              QuickStart 展开时，由 QuickStartGuide 自带的 mb-5 提供与 hero 之间的段间距；
              QuickStart 关闭时，QuickStartGuide 不渲染，需在此补 mt-5 让 hero 与 section 之间保持一致段间距 */}
          {/* 标题独占一行 */}
          <div className={`px-[42px] ${!showQuickStart ? "mt-5" : ""}`}>
            <h2 className="text-base font-medium text-foreground mb-3">
              我的 Agent
              <span className="text-muted-foreground font-normal">（{claws.length}）</span>
            </h2>
          </div>
          {/* 操作栏：视图切换（左） + 分组模式 + 创建按钮（右） */}
          <div className="flex items-center justify-between mb-4 px-[42px]">
            <div className="flex items-center gap-3">
              {/* 视图切换：管理视图 / 对话视图 */}
              <ViewModeSegmented value={viewMode} onChange={handleViewModeChange} />
            </div>
            <div className="flex items-center gap-3">
              {/* 双模式 Segmented：保留 OneID / 普通模式逻辑
                  字号/内边距/图标尺寸与 ViewModeSegmented 保持一致 */}
              <div
                className="hidden md:inline-flex items-center gap-1 rounded-[4px] p-1"
                style={{ background: "#F5F5F5" }}
                role="tablist"
                aria-label="用户分组模式切换"
              >
                <button
                  role="tab"
                  aria-selected={groupMode === "normal"}
                  onClick={() => handleGroupModeChange("normal")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-sm font-medium transition-all duration-150 ${
                    groupMode === "normal"
                      ? "bg-white text-[#0A0A0A]"
                      : "text-[#737373] hover:text-[#0A0A0A]"
                  }`}
                  style={
                    groupMode === "normal"
                      ? { boxShadow: "var(--shadow-segment)" }
                      : undefined
                  }
                  title="切换到普通用户模式"
                >
                  普通
                </button>
                <button
                  role="tab"
                  aria-selected={groupMode === "multi-group"}
                  onClick={() => handleGroupModeChange("multi-group")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-sm font-medium transition-all duration-150 ${
                    groupMode === "multi-group"
                      ? "bg-white text-[#0A0A0A]"
                      : "text-[#737373] hover:text-[#0A0A0A]"
                  }`}
                  style={
                    groupMode === "multi-group"
                      ? { boxShadow: "var(--shadow-segment)" }
                      : undefined
                  }
                  title="切换到多分组用户模式"
                >
                  多分组
                </button>
              </div>
              {/* 创建 Agent 按钮：Figma 黑→蓝渐变 */}
              <Button
                onClick={() => {
                  if (groupMode === "multi-group") {
                    setCreateStep(1);
                    setSelectedGroup(getDefaultGroup(MOCK_USER_GROUPS));
                  }
                  setShowCreate(true);
                }}
                variant="claw-primary"
                className="px-5"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                创建 Agent
              </Button>
            </div>
          </div>

          {/* Content Area - 左右 42px 段落内边距对齐 446:2976 */}
          <div className="relative px-[42px]">
            {/* Main Content */}
              {viewMode === "chat" ? (
                <ChatView
                  claws={claws}
                  onDeleteConfirm={(claw) => { setDeleteConfirm({ id: claw.id, name: claw.name, status: claw.status }); setDeleteConfirmInput(""); }}
                  onRestartConfirm={(claw) => setRestartConfirm(claw)}
                  onReinstallConfirm={(claw) => setReinstallConfirm(claw)}
                  onRemoveRoleConfirm={(claw) => setRemoveRoleConfirm(claw)}
                  onRetry={handleRetry}
                  allowTerminal={allowTerminal}
                  refreshingIds={refreshingIds}
                  onRefreshStatus={handleRefreshStatus}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={handleToggleFullscreen}
                  groupMode={groupMode}
                  getClawGroupPermissions={(claw) => {
                    if (groupMode !== "multi-group") return null;
                    // 没有 groupId 的 Agent 默认归属前端组（主部门）
                    const groupId = claw.groupId || "grp-fe";
                    const group = MOCK_USER_GROUPS.find(g => g.id === groupId);
                    if (!group) return null;
                    return {
                      allowTerminal: group.permissions.allowTerminal,
                      allowChatView: group.permissions.allowChatView,
                      panelAccess: group.permissions.panelAccess,
                    };
                  }}
                />
              ) : (() => {
                const allClaws = claws;
                // [006] 分页切片：先按创建时间倒序，再按当前页切出 30 条
                const sortedClaws = [...allClaws].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const totalPages = Math.max(1, Math.ceil(sortedClaws.length / PAGE_SIZE));
                const safePage = Math.min(page, totalPages);
                const paginatedClaws = sortedClaws.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                return (
                  <div>
                    {/* 单页展示所有实例（不按 agent 类型分 Tab） */}
                    {allClaws.length === 0 ? (
                      <div className="text-center py-24">
                        <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">暂无实例</p>
                        <Button onClick={() => setShowCreate(true)} variant="claw-outline">
                          <Plus className="w-4 h-4 mr-1.5" />
                          创建 Agent
                        </Button>
                      </div>
                    ) : (
                      <>
                      {/* Figma 446:2990/446:2994 - 卡片三列布局，gap 20px */}
                      <div className="grid grid-cols-3 gap-5">
                        {paginatedClaws.map((claw) => (
                          <AgentCard
                            key={claw.id}
                            claw={claw}
                            onClickCard={(c) => navigate(`/openclaw/${c.id}`)}
                            onRefresh={(e, id, name) => handleRefreshStatus(e, id, name)}
                            onRestart={(c) => setRestartConfirm({ id: c.id, name: c.name })}
                            onReinstall={(c) => setReinstallConfirm({ id: c.id, name: c.name })}
                            onDelete={(c) => {
                              setDeleteConfirm({
                                id: c.id,
                                name: c.name,
                                status: c.status,
                                memoryStatus: c.memoryStatus,
                              });
                              setDeleteConfirmInput("");
                            }}
                            onRemoveRole={(c) =>
                              setRemoveRoleConfirm({ id: c.id, name: c.name, roleName: c.roleName! })
                            }
                            onRetry={(id, name) => handleRetry(id, name)}
                            onChat={() => setViewMode("chat")}
                            canOpenTerminal={(c) => {
                              const clawGroup =
                                MOCK_USER_GROUPS.find((g) => g.id === (c.groupId || "grp-fe")) ||
                                null;
                              return groupMode === "multi-group" && clawGroup
                                ? clawGroup.permissions.allowTerminal
                                : allowTerminal;
                            }}
                            refreshing={refreshingIds.has(claw.id)}
                            groupMode={groupMode}
                          />
                        ))}
                    </div>
                    {/* [006] 分页控件（对齐管控端-用户管理 MemberManagement.tsx 样式）
                        分割线：用 100vw + calc(50% - 50vw) 让线横跨整个视口宽度，
                        在 >1920px 大屏下也能左右顶到视口边缘（祖先 overflow-x-clip 兜底防止水平滚动）；
                        分页内容本身保留 px-6 py-3 自适应内边距，与 Section Header 段落对齐；
                        ref：用于动态测量自身高度，让中间内容区两侧的点阵装饰层避开分页栏段 */}
                    <div ref={paginationRef} className="relative mt-6 px-6 py-3 flex items-center justify-between">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute"
                        style={{
                          left: "calc(50% - 50vw)",
                          width: "100vw",
                          top: 0,
                          height: "1px",
                          backgroundColor: "#E2E8F0",
                        }}
                      />
                      <span className="text-xs text-muted-foreground">共 {sortedClaws.length} 个实例，第 {safePage} / {totalPages} 页</span>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          {(() => {
                            const pages: (number | string)[] = [];
                            if (totalPages <= 7) {
                              for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                              pages.push(1);
                              if (safePage > 3) pages.push("...");
                              for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
                              if (safePage < totalPages - 2) pages.push("...");
                              pages.push(totalPages);
                            }
                            return pages.map((p, idx) =>
                              typeof p === "string" ? (
                                <span key={`ellipsis-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                              ) : (
                                <button
                                  key={p}
                                  className={`h-7 w-7 rounded-[4px] text-xs font-medium transition-colors ${
                                    p === safePage
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-muted"
                                  }`}
                                  onClick={() => setPage(p as number)}
                                >{p}</button>
                              )
                            );
                          })()}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                  </div>
                );
              })()}
          </div>
            {/* /中间内容区 (flex-1) 闭合 */}
          </div>
            {/* 右侧 80px 占位带 - Figma 446:3001，与左侧同处理：仅留白，点阵由中段 wrapper 延伸渲染 */}
            <div aria-hidden className="shrink-0 w-20 self-stretch" />
          </div>
        </div>

        {/* Notification Panel */}
        {showNotificationPanel && (
          <div className="fixed inset-0 z-50" onClick={() => setShowNotificationPanel(false)}>
            <div className="absolute right-6 top-[150px] w-80 bg-card rounded-[4px] shadow-lg border border-border z-50 flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              {/* Header - Fixed */}
              <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-xs">消息通知</h3>
                  <button
                    onClick={() => handleClearAllNotifications()}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    全部删除
                  </button>
                </div>
              </div>

              {/* Notifications List - Scrollable */}
              <div className="overflow-y-auto" style={{
                maxHeight: notifications.length > 5 ? 'calc(5 * 60px)' : 'auto',
                scrollbarWidth: 'thin',
                paddingRight: '4px'
              }}>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">暂无消息</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="p-3 hover:bg-muted/50 transition-colors" style={{minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-foreground/80 flex-1 line-clamp-2">{notif.message}</p>
                          <button
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1" style={{fontSize: '11px'}}>{notif.timestamp}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Restart Confirm Dialog */}
        <Dialog open={!!restartConfirm} onOpenChange={(open) => { if (!open) setRestartConfirm(null); }}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">确认重启</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">
              重启后该 OpenClaw「{restartConfirm?.name}」将短暂不可用，期间 IM 消息无法回复，确认重启吗？
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="claw-outline" onClick={() => setRestartConfirm(null)}>取消</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => handleRestart(restartConfirm!.id, restartConfirm!.name)}
              >
                确认重启
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reinstall Confirm Dialog */}
        <Dialog open={!!reinstallConfirm} onOpenChange={(open) => { if (!open) setReinstallConfirm(null); }}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">确认重新安装</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">
              将使用最新镜像重新安装「{reinstallConfirm?.name}」，清除当前所有配置且无法恢复，安装完成后需重新配置模型和通道。
            </p>
            <div>
              <label className="text-sm font-medium text-foreground">请输入「重装」以确认</label>
              <Input
                placeholder="输入「重装」"
                value={reinstallConfirmInput}
                onChange={(e) => setReinstallConfirmInput(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="claw-outline" onClick={() => setReinstallConfirm(null)}>取消</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                disabled={reinstallConfirmInput !== "重装"}
                onClick={() => handleReinstall(reinstallConfirm!.id, reinstallConfirm!.name)}
              >
                确认重新安装
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                {deleteConfirm?.status === "createFail" ? "删除记录" : "确认删除"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">
                {deleteConfirm?.status === "createFail"
                ? `此操作将移除「${deleteConfirm?.name}」该创建失败的记录，底层资源将由系统自动回收。`
                : `此操作不可撤销。「${deleteConfirm?.name}」实例及相关数据将被永久删除，已配置的模型、通道和插件将全部清除且无法恢复。`}
            </p>
            {/* 记忆数据清理提示 - 仅当该 OpenClaw 开启了记忆功能时显示 */}
            {deleteConfirm?.status !== "createFail" && deleteConfirm?.memoryStatus && deleteConfirm.memoryStatus !== 'none' && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[4px] px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  该 OpenClaw 已开启 Memory {deleteConfirm.memoryStatus === 'pro' ? 'Pro' : 'Free'}，相关记忆数据也将被一并清理。
                </p>
              </div>
            )}
            {deleteConfirm?.status === "running" && (
              <div>
                <label className="text-sm font-medium text-foreground">请输入「删除」以确认</label>
                <Input
                  placeholder="输入「删除」"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  className="mt-2"
                />
              </div>
            )}
            <DialogFooter className="gap-2 pt-2">
              <Button variant="claw-outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm?.status === "running" && deleteConfirmInput !== "删除"}
                onClick={() => handleDelete(deleteConfirm!.id, deleteConfirm!.name)}
              >
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Role Confirm Dialog */}
        <Dialog open={!!removeRoleConfirm} onOpenChange={(open) => { if (!open) setRemoveRoleConfirm(null); }}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">移除角色</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">
              确定要移除「{removeRoleConfirm?.name}」的角色「{removeRoleConfirm?.roleName}」吗？
            </p>
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-[4px] px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary leading-relaxed">
                移除角色不会删除已有的技能配置，Agent 将回退为「通用助手」。
              </p>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="claw-outline" onClick={() => setRemoveRoleConfirm(null)}>取消</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => handleRemoveRole(removeRoleConfirm!.id, removeRoleConfirm!.name)}
              >
                确认移除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Panel Dialog - 开启面板 */}
        <Dialog open={!!panelDialog} onOpenChange={(open) => { if (!open) setPanelDialog(null); }}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">开启面板</DialogTitle>
            </DialogHeader>
            {/* 安全警告 */}
            <div className="bg-orange-50 border border-orange-100 rounded-[4px] px-4 py-3">
              <p className="text-sm font-semibold text-orange-600 leading-relaxed">
                访问链接已生成，该链接含有您的 API Key 和加密配置，请勿分享给第三方，以防隐私泄露或资产损失。
              </p>
            </div>
            {/* 信息行 */}
            <div className="space-y-3 py-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24 shrink-0">WebSocket URL</span>
                <span className="flex-1 text-sm text-foreground font-mono truncate">
                  http://43.139.137.45:38341/knmnz8?token=8512b8ef...
                </span>
                <button
                  className="p-1.5 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { navigator.clipboard.writeText("http://43.139.137.45:38341/knmnz8?token=8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb"); toast.success("已复制"); }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24 shrink-0">网关令牌</span>
                <span className="flex-1 text-sm text-foreground font-mono truncate">
                  8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb
                </span>
                <button
                  className="p-1.5 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { navigator.clipboard.writeText("8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb"); toast.success("已复制"); }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* 说明文字 */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              用浏览器打开 WebSocket URL，如面板需要填入网关令牌，则将网关令牌复制并粘贴过去，即可进入面板。
            </p>
            <DialogFooter>
              <Button
                variant="claw-primary"
                className="w-full"
                onClick={() => { window.open("http://43.139.137.45:38341/knmnz8?token=8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb", "_blank"); }}
              >
                立即访问
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setTypeExpanded(false); setRoleExpanded(false); setSelectedRole(null); setAgentType("openclaw"); setCreateStep(1); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-[4px] flex items-center justify-center text-base text-white"
                  // allow-inline-gradient: Logo 图标容器（非按钮，SKILL §8.1 白名单）
                  style={{ background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)" }}
                >
                  🦞
                </div>
                创建 Agent
              </DialogTitle>
            </DialogHeader>

            {/* ===== 多分组模式 Step 1: 选择分组 ===== */}
            {groupMode === "multi-group" && createStep === 1 && (
              <div className="py-4 space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  您属于多个分组，不同分组对应不同的 Agent 配置和权限，请先选择要使用的分组：
                </p>
                {MOCK_USER_GROUPS.map((group) => {
                  const isSelected = selectedGroup.id === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className={`w-full text-left px-3.5 py-3 rounded-[4px] border transition-all duration-150 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${isSelected ? "font-medium text-primary" : "text-foreground/70"}`}>
                          {group.name}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ===== Step 2 (多分组模式) 或 普通模式: 填写信息 ===== */}
            {(groupMode === "normal" || (groupMode === "multi-group" && createStep === 2)) && (
            <div className="py-4 space-y-4">
              {/* Name Input */}
              <div>
                <Label htmlFor="claw-name" className="text-sm font-medium text-foreground">
                  Agent 名称
                </Label>
                <Input
                  id="claw-name"
                  placeholder="例如：工作助手、代码助手..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-2"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  创建后可在详细配置页中配置模型、通道和技能
                </p>
              </div>

              {/* Agent Type - Collapsible Row */}
              <div>
                <button
                  type="button"
                  onClick={() => setTypeExpanded(!typeExpanded)}
                  className="w-full flex items-center justify-between py-1 group/type"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Agent 类型</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">可选</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {agentType === "openclaw" ? "OpenClaw" : agentType === "hermes" ? "Hermes Agent" : "Lightclaw ACE"}
                    </span>
                    {typeExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                </button>
                {typeExpanded && (
                  <div className="flex flex-wrap gap-2 pt-2 pb-1">
                    {([["openclaw", "OpenClaw"], ["hermes", "Hermes Agent"], ["lightclawace", "Lightclaw ACE"]] as const)
                      .filter(([value]) => groupMode !== "multi-group" || selectedGroup.permissions.agentTypes.includes(value))
                      .map(([value, label]) => {
                      const isSelected = agentType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setAgentType(value as "openclaw" | "hermes" | "lightclawace");
                            if (value !== "openclaw") {
                              setRoleExpanded(false);
                              setSelectedRole(null);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-all duration-150 ${
                            isSelected
                              ? "bg-foreground/10 text-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Role Selection - Collapsible Row */}
              {(
              <div>
                <button
                  type="button"
                  onClick={() => setRoleExpanded(!roleExpanded)}
                  className="w-full flex items-center justify-between py-1 group/role"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">角色身份</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">可选</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {selectedRole ? selectedRole.name : "通用助手"}
                    </span>
                    {roleExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                </button>

                {roleExpanded && (
                  <div className="pt-2 pb-1">
                    <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                      <div className="flex flex-wrap gap-2">
                        {visibleRoles
                          .filter((role) => groupMode !== "multi-group" || selectedGroup.permissions.roles.includes(role.name))
                          .map((role) => {
                          const isSelected = selectedRole?.id === role.id;
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => { setSelectedRole(isSelected ? null : role); }}
                              className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-all duration-150 ${
                                isSelected
                                  ? "bg-foreground/10 text-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                              }`}
                            >
                              {role.name}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setSelectedRole(null)}
                          className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-all duration-150 ${
                            !selectedRole
                              ? "bg-foreground/10 text-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                          }`}
                        >
                          通用助手（默认）
                        </button>
                      </div>

                      {/* Role Detail */}
                      {selectedRole && (
                        <div className="mt-3 rounded-[4px] overflow-hidden border border-primary/20 bg-primary/5">
                          <div className="px-3.5 py-3 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-primary inline-block" />
                                角色技能
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedRole.skills.map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center text-xs px-2 py-1 rounded-[4px] bg-card text-foreground/70 border border-border"
                                  >
                                    {skill.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-primary inline-block" />
                                角色灵魂
                              </p>
                              <p className="text-sm text-foreground/70 leading-relaxed">
                                {selectedRole.soul}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
            )}

            <DialogFooter>
              {/* 多分组模式 Step 1: 下一步按钮 */}
              {groupMode === "multi-group" && createStep === 1 && (
                <>
                  <Button variant="claw-outline" onClick={() => setShowCreate(false)}>取消</Button>
                  <Button
                    variant="claw-primary"
                    onClick={() => {
                      setCreateStep(2);
                      // 重置 agent 类型为该分组允许的第一个
                      if (!selectedGroup.permissions.agentTypes.includes(agentType)) {
                        setAgentType(selectedGroup.permissions.agentTypes[0]);
                      }
                    }}
                  >
                    下一步
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </>
              )}
              {/* 多分组模式 Step 2: 返回 + 创建 */}
              {groupMode === "multi-group" && createStep === 2 && (
                <>
                  <Button variant="claw-outline" onClick={() => setCreateStep(1)}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    上一步
                  </Button>
                  <Button
                    variant="claw-primary"
                    onClick={handleCreate}
                  >
                    创建
                  </Button>
                </>
              )}
              {/* 普通模式: 取消 + 创建 */}
              {groupMode === "normal" && (
                <>
                  <Button variant="claw-outline" onClick={() => setShowCreate(false)}>取消</Button>
                  <Button
                    variant="claw-primary"
                    onClick={handleCreate}
                  >
                    创建
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CSS for animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 1; }
          }
        `}</style>
      </TenantLayout>
    </TooltipProvider>
  );
}
