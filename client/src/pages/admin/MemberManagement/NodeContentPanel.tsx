/**
 * 右侧节点内容面板：用户列表 Tab + 配置总览 Tab
 *
 * 配置总览（v2）：
 *   - 三大核心初始化检查：可见模型 / 可见通道 / 安全组
 *     每项显示：✅ 正常 / ⚠️ 异常；异常时给出「前往对应页配置」跳转
 *   - 按 12 种配置项聚合展示（模型/通道/安全组/技能/Agent工具/记忆/网盘/镜像/VPC/公网/CLS/平台策略）
 *     每条标注来源：本分组 / 继承自某分组 / 平台默认
 *   - 初始化校验仅模型/通道/安全组三项
 */
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Lock,
  Plus,
  UserMinus,
  Info,
  Brain,
  MessageSquare,
  Puzzle,
  Wrench,
  MemoryStick,
  FolderOpen,
  HardDrive,
  ShieldCheck,
  Gauge,
  Shield,
  ChevronDown,
  X,
  Pencil,
} from "lucide-react";
import { Link } from "wouter";
import type {
  UserOrg,
  UserOverrideInfo,
  UserGroup,
  ConfigCategory,
  ConfigEntry,
} from "./types";
import { getPrimaryDeptPath, getConfigEntries, CONFIG_CATEGORY_META, MOCK_USER_GROUP_AGENTS } from "./mock";
import {
  getGroupHealth,
  getGroupInitHealth,
  MISSING_LABEL,
  INIT_MISSING_LABEL,
  INIT_MISSING_TO_CATEGORY,
} from "./health";

const PAGE_SIZE = 10;

type Tab = "members" | "config";

interface NodeContentPanelProps {
  /** 当前分组 id */
  nodeId: string;
  nodeName: string;
  /** 当前节点所属来源（oneid-dept / oneid-group / manual） */
  nodeSource: "oneid-dept" | "oneid-group" | "manual";
  nodeReadonly: boolean;
  /** 节点所在分组全集（用于祖先继承判定 + 展示主部门路径） */
  groups: UserGroup[];
  /** 本节点路径（面包屑） */
  nodePath: string;
  /** 已过滤到本节点的用户列表 */
  users: UserOrg[];
  /** 保留但当前不在此面板展示（用户列表已精简掉覆盖状态列与查看配置按钮）。
   *  未来需要在此面板恢复冲突裁决入口时可再使用。 */
  overrides?: Record<string, UserOverrideInfo>;
  onResolveConflict?: (userId: string, winnerResourceId: string) => void;
  /** 是否为 OneID 模式 */
  hasOneid?: boolean;
  /** 是否为普通模式 */
  isManualMode?: boolean;
  /** 全部用户（添加用户到分组弹窗用） */
  allUsers?: UserOrg[];
  /** 添加用户到分组的回调 */
  onAddUsersToGroup?: (userIds: string[]) => void;
  /** 从分组中移除用户的回调 */
  onRemoveFromGroup?: (userId: string) => void;
  /** 编辑用户分组的回调 */
  onEditUserGroups?: (userId: string, groupIds: string[]) => void;
  /** 是否为异常分组（配置未解绑，需显示红点+告警条） */
  isAnomalous?: boolean;
  /** 异常分组绑定的配置名称（用于告警条展示） */
  anomalousBoundConfigs?: string[];
  /** 是否初始化未完成（缺少模型/通道/镜像/网络中的某项，需显示橙色点+黄色告警条） */
  isUninitialized?: boolean;
}

// ─── 核心维度 meta（初始化检查卡用） ─────────────────────
const CORE_CHECK_META = {
  model: {
    label: "配置至少一个可见模型",
    path: "/admin/model-config",
    desc: "当前缺失，建议前往配置",
  },
  channel: {
    label: "配置至少一个可见通道",
    path: "/admin/channel-config",
    desc: "当前缺失，建议前往配置",
  },
  securityGroup: {
    label: "配置安全组",
    path: "/admin/security-group",
    desc: "当前缺失，建议前往配置",
  },
} as const;

// ─── 配置项图标映射（与导航栏 icon 一致） ──────────────────
const CATEGORY_ICON: Record<ConfigCategory, React.ComponentType<{ className?: string }>> = {
  model: Brain,
  channel: MessageSquare,
  skill: Puzzle,
  agentTool: Wrench,
  memory: MemoryStick,
  drive: FolderOpen,
  image: HardDrive,
  network: ShieldCheck,
  cls: Gauge,
  aiAgentSecurity: Shield,
  platformPolicy: Shield,
};

// 配置项展示顺序
const CATEGORY_ORDER: ConfigCategory[] = [
  "model", "channel", "skill", "agentTool", "memory",
  "drive", "image", "network",
  "cls", "aiAgentSecurity", "platformPolicy",
];

// 配置项导航短名称
const CATEGORY_NAV_LABEL: Record<ConfigCategory, string> = {
  model: "模型",
  channel: "通道",
  skill: "技能",
  agentTool: "工具",
  memory: "记忆",
  drive: "网盘",
  image: "镜像",
  network: "网络",
  cls: "日志",
  aiAgentSecurity: "安全",
  platformPolicy: "策略",
};

// ─── 分组标签选择器（简化版，用于添加/编辑用户弹窗） ───────
function GroupTagSelect({
  groups,
  selectedIds,
  onChange,
}: {
  groups: UserGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // 只显示 manual 分组（普通模式）
  const manualGroups = useMemo(
    () => groups.filter((g) => g.source === "manual"),
    [groups]
  );
  const groupMap = useMemo(
    () => new Map(manualGroups.map((g) => [g.id, g])),
    [manualGroups]
  );

  // 获取分组全路径
  const getPath = (gId: string): string => {
    const chain: string[] = [];
    let node = groupMap.get(gId);
    while (node) {
      chain.unshift(node.name);
      node = node.parentId ? groupMap.get(node.parentId) : undefined;
    }
    return chain.join(" / ");
  };

  // 搜索过滤
  const filtered = useMemo(() => {
    if (!search.trim()) return manualGroups;
    const q = search.trim().toLowerCase();
    return manualGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || getPath(g.id).toLowerCase().includes(q)
    );
  }, [manualGroups, search]);

  const toggleGroup = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full min-h-[36px] px-2 py-1.5 rounded-[4px] border border-gray-200 bg-white hover:border-blue-300 transition-colors cursor-pointer flex items-center flex-wrap gap-1 pr-7">
          {selectedIds.length === 0 ? (
            <span className="text-xs text-gray-400 px-1">选择分组…</span>
          ) : (
            selectedIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] max-w-full"
              >
                <span className="truncate">{getPath(id)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedIds.filter((x) => x !== id));
                  }}
                  className="text-blue-400 hover:text-blue-700 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center shrink-0"
              title="清空"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
        sideOffset={4}
      >
        <div className="p-2.5 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索分组…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-[4px] bg-gray-50 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">暂无分组</p>
          ) : (
            filtered.map((g) => {
              const isSelected = selectedIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-left text-xs transition-colors ${
                    isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{getPath(g.id)}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 获取用户所有 oneid-dept 类型部门的完整路径 ────────────
function getUserDeptPaths(
  user: UserOrg,
  groups: UserGroup[]
): Array<{ path: string; isPrimary: boolean }> {
  const deptGroupIds = user.groupIds.filter((gid) => {
    const g = groups.find((g) => g.id === gid);
    return g?.source === "oneid-dept";
  });
  if (deptGroupIds.length === 0) return [];
  return deptGroupIds.map((gid) => ({
    path: getPrimaryDeptPath(gid, groups),
    isPrimary: gid === user.primaryGroupId,
  })).sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
}

export default function NodeContentPanel({
  nodeId,
  nodeName,
  nodeSource,
  nodeReadonly,
  groups,
  nodePath,
  users,
  hasOneid = false,
  isManualMode = false,
  allUsers = [],
  onAddUsersToGroup,
  onRemoveFromGroup,
  onEditUserGroups,
  isAnomalous = false,
  anomalousBoundConfigs = [],
  isUninitialized = false,
}: NodeContentPanelProps) {
  const [tab, setTab] = useState<Tab>(isAnomalous ? "config" : "members");
  const [page, setPage] = useState(1);

  // 切换节点时根据是否异常重置默认 tab
  useEffect(() => {
    setTab(isAnomalous ? "config" : "members");
    setPage(1);
  }, [nodeId, isAnomalous]);

  // 添加用户到分组弹窗
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [addGroupIds, setAddGroupIds] = useState<string[]>([]);

  // 编辑用户分组弹窗
  const [editUserDialog, setEditUserDialog] = useState<{ userId: string; displayName: string; groupIds: string[] } | null>(null);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);

  // 从分组中移除确认弹窗
  const [removeDialog, setRemoveDialog] = useState<{
    userId: string;
    groupName: string;
  } | null>(null);

  // 存量 Agent 实例处理弹窗
  const [agentInstanceDialog, setAgentInstanceDialog] = useState<{
    open: boolean;
    userId: string;
    groupName: string;
    instances: Array<{ id: string; name: string }>;
  } | null>(null);
  const [agentInstanceChoice, setAgentInstanceChoice] = useState<"keep" | "delete">("keep");

  React.useEffect(() => {
    setPage(1);
  }, [nodeId]);

  const total = users.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = users.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const health = getGroupHealth(nodeId, groups);

  // 节点来源文案
  const sourceLabel =
    nodeSource === "oneid-dept"
      ? "OneID 部门节点"
      : nodeSource === "oneid-group"
      ? "OneID 用户组"
      : "自建分组";

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const groupName = (id: string) => groupMap.get(id)?.name ?? id;

  // 添加用户弹窗的过滤逻辑
  const addFilteredUsers = useMemo(() => {
    let list = allUsers;
    if (addSearch.trim()) {
      const kw = addSearch.trim().toLowerCase();
      list = list.filter((u) => u.userId.toLowerCase().includes(kw));
    }
    return list;
  }, [allUsers, addSearch]);

  const handleAddConfirm = () => {
    if (addSelected.length === 0) return;
    onAddUsersToGroup?.(addSelected);
    setShowAddDialog(false);
    setAddSearch("");
    setAddSelected([]);
  };

  const handleRemoveConfirm = () => {
    if (!removeDialog) return;
    const { userId } = removeDialog;
    // 检测该用户在当前分组是否有 Agent 实例
    const userAgents = MOCK_USER_GROUP_AGENTS[userId];
    const instances = userAgents?.[nodeId] ?? [];

    if (instances.length > 0) {
      // 有存量实例，弹出二次确认
      setRemoveDialog(null);
      setAgentInstanceDialog({
        open: true,
        userId,
        groupName: getPrimaryDeptPath(nodeId, groups),
        instances,
      });
    } else {
      onRemoveFromGroup?.(userId);
      setRemoveDialog(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 节点头：名称 + 人数 + 分组名称路径 + 添加按钮 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">{nodeName}</h2>
            <span className="text-sm text-gray-400 tabular-nums">
              · {users.length} 人
            </span>
          </div>
          <div className="text-xs text-gray-500">分组名称：{nodePath}</div>
        </div>
        {nodeId !== "__unassigned__" && (isManualMode || nodeSource !== "oneid-dept") && (() => {
          const totalUserCount = allUsers?.length ?? 0;
          const isAtLimit = totalUserCount >= 20;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-gray-200 shrink-0"
                    onClick={() => {
                      setAddGroupIds([nodeId]);
                      setShowAddDialog(true);
                    }}
                    disabled={isAtLimit}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加用户到分组
                  </Button>
                </span>
              </TooltipTrigger>
              {isAtLimit && (
                <TooltipContent className="text-xs">
                  已达用户人数上限（{totalUserCount}/{20}）
                </TooltipContent>
              )}
            </Tooltip>
          );
        })()}
      </div>

      {/* Tab 切换 */}
      <div className="px-6 pt-3">
        <div className="inline-flex items-center rounded-[4px] p-1 gap-0.5 bg-white border border-gray-200 h-9">
          <button
            type="button"
            onClick={() => setTab("members")}
            className={`h-7 px-3 rounded-[4px] text-xs font-medium transition-all duration-200 ${
              tab === "members"
                ? "font-semibold text-gray-900 bg-gray-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            用户列表
          </button>
          <button
            type="button"
            onClick={() => setTab("config")}
            className={`relative h-7 px-3 rounded-[4px] text-xs font-medium transition-all duration-200 ${
              tab === "config"
                ? "font-semibold text-gray-900 bg-gray-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            配置总览
            {isAnomalous && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            )}
            {!isAnomalous && isUninitialized && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab 内容 */}
      <div className={`flex-1 overflow-y-auto px-6 pb-4 ${tab === "config" ? "pt-0" : "pt-4"}`}>
        {tab === "members" && (
          <>
            {/* 卡片 */}
            <div
              className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{
                boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
              }}
            >
              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        用户 ID
                      </th>
                      {hasOneid && (
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          部门
                        </th>
                      )}
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        分组
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        角色
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        状态
                      </th>
                      {isManualMode && nodeId !== "__unassigned__" && (
                        <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            (hasOneid ? 5 : 4) +
                            (isManualMode && nodeId !== "__unassigned__" ? 1 : 0)
                          }
                          className="px-6 py-12 text-center text-sm text-gray-400"
                        >
                          暂无用户
                        </td>
                      </tr>
                    ) : (
                      pagedUsers.map((u) => {
                        const userGroups = u.groupIds
                          .map((gid) => groupMap.get(gid))
                          .filter(Boolean) as UserGroup[];
                        const manualGroups = userGroups.filter((g) => g.source === "manual");
                        const deptPaths = hasOneid ? getUserDeptPaths(u, groups) : [];
                        return (
                          <tr
                            key={u.userId}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            {/* 用户 ID */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {u.userId}
                              </span>
                            </td>

                            {/* 部门（仅 OneID 模式） */}
                            {hasOneid && (
                              <td className="px-4 py-4">
                                {deptPaths.length === 0 ? (
                                  <span className="text-sm text-gray-300">—</span>
                                ) : deptPaths.length === 1 ? (
                                  <span
                                    className="text-sm text-gray-600 truncate block max-w-[180px]"
                                    title={deptPaths[0].path}
                                  >
                                    {deptPaths[0].path}
                                  </span>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-sm text-gray-600 truncate block max-w-[180px] cursor-default">
                                        {deptPaths[0].path}
                                        <span className="text-xs text-gray-400 ml-1">
                                          +{deptPaths.length - 1}
                                        </span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="bottom"
                                      align="start"
                                      className="max-w-[360px] p-0"
                                    >
                                      <div className="py-2">
                                        {deptPaths.map((dp, idx) => (
                                          <div
                                            key={idx}
                                            className="px-3 py-1.5 text-sm"
                                          >
                                            <span className="text-gray-200 mr-1">
                                              {idx + 1}.
                                            </span>
                                            <span className="text-white">
                                              {dp.path}
                                            </span>
                                            {dp.isPrimary && (
                                              <span className="ml-2 inline-flex items-center text-[10px] font-medium text-blue-400 bg-blue-500/20 rounded px-1.5 py-0.5">
                                                主部门
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            )}

                            {/* 分组 */}
                            <td className="px-4 py-4">
                              {(() => {
                                // OneID 模式：显示部门 + 用户组；普通模式：只显示自建分组
                                const displayGroups = hasOneid
                                  ? userGroups.filter((g) => g.source === "oneid-dept" || g.source === "oneid-group")
                                  : manualGroups;
                                if (displayGroups.length === 0)
                                  return <span className="text-sm text-gray-300">—</span>;

                                // 统一使用完整路径（OneID 模式：部门/用户组；普通模式：自建分组层级）
                                const getDisplayName = (g: UserGroup) =>
                                  getPrimaryDeptPath(g.id, groups);

                                const firstName = getDisplayName(displayGroups[0]);

                                return (
                                  <div className="flex items-center gap-1 max-w-[260px]">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 cursor-default max-w-full">
                                          <span className="badge-shutdown max-w-[200px] truncate inline-block align-middle">
                                            {firstName}
                                          </span>
                                          {displayGroups.length > 1 && (
                                            <span className="badge-shutdown whitespace-nowrap">
                                              +{displayGroups.length - 1}
                                            </span>
                                          )}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" align="start" className="max-w-[380px] p-0">
                                        <div className="py-2">
                                          {displayGroups.map((g, idx) => (
                                            <div key={idx} className="px-3 py-1.5 text-sm flex items-center gap-2">
                                              {hasOneid && (
                                                <span
                                                  className={`inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 ${
                                                    g.source === "oneid-dept"
                                                      ? "text-blue-400 bg-blue-500/20"
                                                      : "text-purple-400 bg-purple-500/20"
                                                  }`}
                                                >
                                                  {g.source === "oneid-dept" ? "部门" : "自定义分组"}
                                                </span>
                                              )}
                                              <span className="text-white">{getDisplayName(g)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* 角色 */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={
                                  u.role === "admin"
                                    ? "border-blue-200 text-blue-600 bg-blue-50"
                                    : "border-gray-200 text-gray-500"
                                }
                              >
                                {u.role === "admin" ? "管理员" : "用户"}
                              </Badge>
                            </td>

                            {/* 状态 */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              {u.status === "active" ? (
                                <span className="badge-running text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                  正常
                                </span>
                              ) : (
                                <span className="badge-stopped text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                                  禁用
                                </span>
                              )}
                            </td>

                            {/* 操作（仅普通模式且非未分组） */}
                            {isManualMode && nodeId !== "__unassigned__" && (
                              <td className="px-5 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  {nodeId !== "__unassigned__" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                          onClick={() =>
                                            setRemoveDialog({
                                              userId: u.userId,
                                              groupName: nodeName,
                                            })
                                          }
                                        >
                                          <UserMinus className="w-4 h-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>从分组中移除</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 底部：共 N 名用户 + 分页 */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-50">
                <span className="text-xs text-blue-600">
                  共 {total} 名用户
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                      const isActive = p === page;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(() => p)}
                          className={`w-7 h-7 rounded-[4px] text-xs font-medium transition-colors ${
                            isActive
                              ? "text-white"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "config" && (
          <ConfigOverviewTab
            nodeId={nodeId}
            groups={groups}
            health={health}
            isAnomalous={isAnomalous}
            anomalousBoundConfigs={anomalousBoundConfigs}
            isUninitialized={isUninitialized}
          />
        )}
      </div>

      {/* 添加用户到分组弹窗（普通模式） */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setAddSearch("");
            setAddSelected([]);
            setAddGroupIds([]);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              添加用户到「{nodeName}」
            </DialogTitle>
          </DialogHeader>
          {/* 多分组规则提示 */}
          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-blue-50 border border-blue-100 rounded-[4px]">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-xs text-blue-600">
              一个用户支持加入多个分组，可按分组设置不同的配置与权限
            </span>
          </div>
          <div className="py-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索用户 ID..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9 bg-white border-gray-200"
                autoFocus
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto border border-gray-100 rounded-[4px] divide-y divide-gray-50 bg-white">
              {addFilteredUsers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  没有可添加的用户
                </p>
              ) : (
                addFilteredUsers.map((m) => {
                  const isInCurrentGroup = m.groupIds.includes(nodeId);
                  const isDisabled = isInCurrentGroup;
                  // 部门：用户所有 oneid-dept 分组的完整路径（主部门排首位）
                  const deptPaths = hasOneid
                    ? m.groupIds
                        .filter((gid) => groupMap.get(gid)?.source === "oneid-dept")
                        .map((gid) => ({
                          path: getPrimaryDeptPath(gid, groups),
                          isPrimary: gid === m.primaryGroupId,
                        }))
                        .sort((a, b) =>
                          a.isPrimary ? -1 : b.isPrimary ? 1 : 0
                        )
                        .map((d) => d.path)
                    : [];
                  // 分组：
                  //   OneID 模式：oneid-dept + oneid-group（完整路径）
                  //   普通模式：manual（完整路径）
                  const groupPaths = m.groupIds
                    .filter((gid) => {
                      const g = groupMap.get(gid);
                      if (!g) return false;
                      if (hasOneid) {
                        return g.source === "oneid-dept" || g.source === "oneid-group";
                      }
                      return g.source === "manual";
                    })
                    .map((gid) => getPrimaryDeptPath(gid, groups));
                  const tooltipText = isInCurrentGroup
                    ? "该用户已在当前分组"
                    : "";
                  const row = (
                    <label
                      key={m.userId}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        isDisabled
                          ? "opacity-50 cursor-not-allowed bg-gray-100"
                          : "bg-white hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={isInCurrentGroup || addSelected.includes(m.userId)}
                        disabled={isDisabled}
                        onCheckedChange={() => {
                          if (isDisabled) return;
                          setAddSelected((prev) =>
                            prev.includes(m.userId)
                              ? prev.filter((id) => id !== m.userId)
                              : [...prev, m.userId]
                          );
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 block truncate">
                          {m.userId}
                        </span>
                        {hasOneid && (
                          <span className="text-xs text-gray-400 block break-all">
                            部门：{deptPaths.length > 0 ? deptPaths.join("、") : "—"}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 block break-all">
                          分组：{groupPaths.length > 0 ? groupPaths.join("、") : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={
                            m.role === "admin"
                              ? "border-blue-200 text-blue-600 bg-blue-50 text-xs"
                              : "border-gray-200 text-gray-500 text-xs"
                          }
                        >
                          {m.role === "admin" ? "管理员" : "用户"}
                        </Badge>
                        {m.status === "active" ? (
                          <span className="badge-running text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            正常
                          </span>
                        ) : (
                          <span className="badge-stopped text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                            禁用
                          </span>
                        )}
                      </div>
                    </label>
                  );
                  return isDisabled ? (
                    <Tooltip key={m.userId}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent>{tooltipText}</TooltipContent>
                    </Tooltip>
                  ) : (
                    row
                  );
                })
              )}
            </div>
            {addSelected.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  已选择 {addSelected.length} 名用户
                </span>
                <button
                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                  onClick={() => setAddSelected([])}
                >
                  清除选择
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setAddSearch("");
                setAddSelected([]);
                setAddGroupIds([]);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleAddConfirm}
              disabled={addSelected.length === 0}
            >
              确认添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 从分组中移除确认弹窗 */}
      <Dialog
        open={!!removeDialog}
        onOpenChange={(open) => {
          if (!open) setRemoveDialog(null);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>从分组中移除</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">用户 ID</span>
                <span className="text-sm font-medium text-gray-900">
                  {removeDialog?.userId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">分组名称</span>
                <span className="text-sm font-medium text-gray-900">
                  {removeDialog?.groupName}
                </span>
              </div>
            </div>
            <div className="rounded-[4px] bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-orange-600 leading-relaxed">
              移除后，该用户在此分组下的可见范围和权限将被收回。用户不会被删除，仅解除与该分组的关联。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirm}
            >
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 存量 Agent 实例处理弹窗 */}
      <Dialog open={!!agentInstanceDialog?.open} onOpenChange={(open) => { if (!open) setAgentInstanceDialog(null); }}>
        <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>存量 Agent 实例处理</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-700">
              用户在该分组下创建了 Agent 实例，用户已从该分组中移除，请选择如何处理存量实例：
            </p>
            <div className="rounded-[4px] border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">用户 ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Agent 实例名称 / ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">分组</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {agentInstanceDialog?.instances.map((inst) => (
                    <tr key={inst.id}>
                      <td className="px-3 py-2 text-gray-700">{agentInstanceDialog.userId}</td>
                      <td className="px-3 py-2 text-gray-700">{inst.name}<span className="text-gray-400 ml-1">({inst.id})</span></td>
                      <td className="px-3 py-2 text-gray-700">{agentInstanceDialog.groupName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="py-2 space-y-2">
            <p className="text-xs font-medium text-gray-700 mb-1">处理方式</p>
            {[
              { value: "keep", title: "保留原配置", desc: "存量 Agent 实例保留在原分组名下，可继续使用原分组的配置和权限，但无法在原分组创建新的 Agent" },
              { value: "delete", title: "删除实例", desc: "确认后将跳转到 Agent 列表页面，系统会帮您自动筛选出这些实例，您可以全选并批量删除" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2.5 p-3 rounded-[4px] border cursor-pointer transition-colors ${agentInstanceChoice === opt.value ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => setAgentInstanceChoice(opt.value as "keep" | "delete")}
              >
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${agentInstanceChoice === opt.value ? "border-blue-500" : "border-gray-300"}`}>
                  {agentInstanceChoice === opt.value && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentInstanceDialog(null)}>取消</Button>
            <Button
              onClick={() => {
                if (agentInstanceDialog) {
                  onRemoveFromGroup?.(agentInstanceDialog.userId);
                }
                setAgentInstanceDialog(null);
                if (agentInstanceChoice === "delete") {
                  const ids = agentInstanceDialog?.instances.map(i => i.id).join(",") ?? "";
                  window.location.href = `/admin/openclaw-monitor?filter=pending-delete&ids=${ids}`;
                }
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户分组弹窗 */}
      <Dialog
        open={!!editUserDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditUserDialog(null);
            setEditGroupIds([]);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>编辑用户分组</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">用户 ID</span>
                <span className="text-sm font-medium text-gray-900">
                  {editUserDialog?.userId}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">用户分组</label>
              <GroupTagSelect
                groups={groups}
                selectedIds={editGroupIds}
                onChange={setEditGroupIds}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditUserDialog(null); setEditGroupIds([]); }}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (editUserDialog) {
                  onEditUserGroups?.(editUserDialog.userId, editGroupIds);
                }
                setEditUserDialog(null);
                setEditGroupIds([]);
              }}
              disabled={editGroupIds.length === 0}
            >
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 配置总览 Tab ───────────────────────────────────────
interface ConfigOverviewTabProps {
  nodeId: string;
  groups: UserGroup[];
  health: { healthy: boolean; missing: Array<"model" | "channel" | "securityGroup"> };
  isAnomalous?: boolean;
  anomalousBoundConfigs?: string[];
  /** 是否初始化未完成（缺少模型/通道/镜像/网络中的某项） */
  isUninitialized?: boolean;
}

/** 来源标签 */
function SourceBadge({ source }: { source: ConfigEntry["source"] }) {
  if (source.type === "local") {
    // 本分组 → 蓝色标签
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 shrink-0">
        本分组
      </span>
    );
  }
  if (source.type === "platformDefault") {
    // 全部用户 → 灰色标签
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
        全部用户
      </span>
    );
  }
  if (source.type === "presetPolicy") {
    // 预设策略 → 灰色标签（与全部用户一致）
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
        预设策略
      </span>
    );
  }
  // inherited → 灰色标签
  return (
    <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
      继承自 {source.groupName}
    </span>
  );
}

/** 异常分组：本分组配置条目后的红色提示标签 */
function LocalAnomalyHint() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 shrink-0">
      <span className="w-1 h-1 rounded-full bg-red-500" />
      请前往对应配置页解绑或删除
    </span>
  );
}

/** 公网配置项的特殊展示（三项信息 + 来源标签跟在后面） */
function PublicNetworkDetail({ meta, source }: { meta: Record<string, string | number | boolean>; source: ConfigEntry["source"] }) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
      <span>
        公网 IP：
        <span className={`font-medium ${meta.allocated ? "text-emerald-600" : "text-gray-400"}`}>
          {meta.allocated ? "已分配" : "未分配"}
        </span>
      </span>
      <span className="text-gray-200">|</span>
      <span>计费模式：<span className="font-medium text-gray-700">{String(meta.billingMode)}</span></span>
      <span className="text-gray-200">|</span>
      <span>带宽上限：<span className="font-medium text-gray-700 tabular-nums">{String(meta.bandwidthCap)} Mbps</span></span>
      <SourceBadge source={source} />
    </div>
  );
}

/** 平台策略条目的特殊展示 */
function PolicyEntryValue({ entry }: { entry: ConfigEntry }) {
  if (!entry.meta) return null;
  if ("enabled" in entry.meta) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${entry.meta.enabled ? "text-emerald-600" : "text-gray-400"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${entry.meta.enabled ? "bg-emerald-500" : "bg-gray-300"}`} />
        {entry.meta.enabled ? "已开启" : "已关闭"}
      </span>
    );
  }
  if ("value" in entry.meta) {
    const val = entry.meta.value as number;
    return (
      <span className="text-xs font-medium text-gray-700 tabular-nums">
        {val}
      </span>
    );
  }
  return null;
}

function ConfigOverviewTab({
  nodeId,
  groups,
  health,
  isAnomalous = false,
  anomalousBoundConfigs = [],
  isUninitialized = false,
}: ConfigOverviewTabProps) {
  // 获取当前节点的全部配置条目
  const configEntries = useMemo(() => getConfigEntries(nodeId, groups), [nodeId, groups]);

  // 按 category 分组
  const byCategory = useMemo(() => {
    const map = new Map<ConfigCategory, ConfigEntry[]>();
    configEntries.forEach((e) => {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    });
    return map;
  }, [configEntries]);

  // 异常分组：统计有「本分组」(local) 配置的类别集合，用于显示红点
  const anomalousLocalCategories = useMemo(() => {
    if (!isAnomalous) return new Set<ConfigCategory>();
    const set = new Set<ConfigCategory>();
    configEntries.forEach((e) => {
      if (e.source.type === "local") {
        set.add(e.category);
      }
    });
    return set;
  }, [configEntries, isAnomalous]);

  // 初始化未完成：计算缺失的配置类别集合（用于导航栏+标题橙色点）
  const uninitializedCategories = useMemo(() => {
    if (!isUninitialized || isAnomalous) return new Set<ConfigCategory>();
    const initHealth = getGroupInitHealth(nodeId, groups);
    const set = new Set<ConfigCategory>();
    initHealth.missing.forEach((m) => {
      set.add(INIT_MISSING_TO_CATEGORY[m]);
    });
    return set;
  }, [nodeId, groups, isUninitialized, isAnomalous]);

  // 折叠状态：默认全部展开
  const [collapsed, setCollapsed] = useState<Set<ConfigCategory>>(new Set());
  const toggleCollapse = (cat: ConfigCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // ─── 锚点导航 ───
  const sectionRefs = useRef<Map<ConfigCategory, HTMLDivElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = useState<ConfigCategory>(CATEGORY_ORDER[0]);

  const setSectionRef = useCallback((cat: ConfigCategory, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(cat, el);
    } else {
      sectionRefs.current.delete(cat);
    }
  }, []);

  // 滚动监听：判断哪个 section 在视口中
  useEffect(() => {
    // 找到最近的可滚动祖先容器
    const nav = navRef.current;
    if (!nav) return;
    const scrollContainer = nav.closest<HTMLElement>(".overflow-y-auto");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let current: ConfigCategory = CATEGORY_ORDER[0];
      for (const cat of CATEGORY_ORDER) {
        const el = sectionRefs.current.get(cat);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top - containerTop <= 80) {
            current = cat;
          }
        }
      }
      setActiveCat(current);
    };
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (cat: ConfigCategory) => {
    const el = sectionRefs.current.get(cat);
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "start" });
    }
  };

  // 三大核心检查卡
  const checks: Array<{
    key: "model" | "channel" | "securityGroup";
    status: "ok" | "missing";
  }> = (["model", "channel", "securityGroup"] as const).map((k) => ({
    key: k,
    status: health.missing.includes(k) ? "missing" : "ok",
  }));

  return (
    <div className="relative">
      {/* 锚点导航条 — 时间轴风格 */}
      <div ref={navRef} className="sticky top-0 z-10 bg-white -mx-6 px-6 pt-3 pb-3 border-b border-gray-100">
        <div className="flex items-center w-full">
          {CATEGORY_ORDER.map((cat, idx) => {
            const isActive = activeCat === cat;
            const activeIdx = CATEGORY_ORDER.indexOf(activeCat);
            const isPast = idx < activeIdx;
            const isLast = idx === CATEGORY_ORDER.length - 1;
            const catMeta = CONFIG_CATEGORY_META[cat];
            const hasAnomaly = anomalousLocalCategories.has(cat);
            const hasUninitWarning = uninitializedCategories.has(cat);
            return (
              <React.Fragment key={cat}>
                {/* 导航项：圆点 + 文字 */}
                <button
                  type="button"
                  onClick={() => scrollToSection(cat)}
                  className="flex flex-col items-center gap-1 shrink-0 group"
                >
                  <span
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      isActive
                        ? "bg-blue-600 ring-4 ring-blue-50"
                        : isPast
                        ? "bg-blue-400"
                        : "bg-gray-300 group-hover:bg-gray-400"
                    }`}
                  />
                  <span className="relative inline-flex">
                    <span
                      className={`text-xs font-medium transition-colors duration-200 whitespace-nowrap ${
                        isActive
                          ? "text-blue-600"
                          : isPast
                          ? "text-blue-500"
                          : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    >
                      {CATEGORY_NAV_LABEL[cat]}
                    </span>
                    {hasAnomaly && (
                      <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                    {!hasAnomaly && hasUninitWarning && (
                      <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </span>
                </button>
                {/* 连接线 */}
                {!isLast && (
                  <div
                    className={`flex-1 h-px mx-1 mt-[-14px] transition-colors duration-200 ${
                      idx < activeIdx ? "bg-blue-300" : "bg-gray-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 异常分组告警条 */}
      {isAnomalous && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-[4px] px-4 py-3 mt-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-red-800">
              该分组的专属配置未解绑
            </div>
            <div className="text-xs text-red-700 mt-0.5 leading-relaxed">
              该分组对应的部门已在腾讯统一身份管理平台被删除。请前往对应配置页面将专属于「本分组」的配置与本分组解绑或删除，处理完成后刷新分组列表，分组即可被清除。来自「全部用户」、「继承自上级分组」和「预设策略」的配置项无需处理。
            </div>
          </div>
        </div>
      )}

      {/* 初始化未完成黄色告警条（优先级低于异常分组，不同时展示） */}
      {!isAnomalous && isUninitialized && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-[4px] px-4 py-3 mt-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-amber-800">
              该分组初始化配置未完成
            </div>
            <div className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              当前分组缺少必要的初始化配置（{Array.from(uninitializedCategories).map((cat) => CATEGORY_NAV_LABEL[cat]).join("、")}），可能影响分组内用户在用户端的正常使用，请尽快完成配置。
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-3">
        {CATEGORY_ORDER.map((cat) => {
          const entries = byCategory.get(cat) ?? [];
          const catMeta = CONFIG_CATEGORY_META[cat];
          const IconComp = CATEGORY_ICON[cat];
          const hasAnomaly = anomalousLocalCategories.has(cat);
          const hasUninitWarning = uninitializedCategories.has(cat);
          return (
            <div
              key={cat}
              ref={(el) => setSectionRef(cat, el)}
              className="bg-white rounded-[4px] border border-gray-100 overflow-hidden scroll-mt-[3.75rem]"
              style={{
                boxShadow:
                  "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
              }}
            >
              {/* 配置项 header */}
              <div
                className="flex items-center justify-between px-6 py-3.5 border-b border-gray-50 cursor-pointer select-none hover:bg-gray-50/50 transition-colors"
                onClick={() => toggleCollapse(cat)}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-[4px] ${catMeta.bg} flex items-center justify-center`}>
                    <IconComp className={`w-3.5 h-3.5 ${catMeta.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative inline-flex text-sm font-semibold text-gray-900">
                        {catMeta.label}
                        {hasAnomaly && (
                          <span className="absolute -top-0.5 -right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                        {!hasAnomaly && hasUninitWarning && (
                          <span className="absolute -top-0.5 -right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
                      </span>
                      {/* 仅模型、通道、镜像在标题旁显示数量；技能/Agent工具在子类别显示；其余不显示 */}
                      {(cat === "model" || cat === "channel" || cat === "image") && (
                        <span className="text-xs text-gray-400 tabular-nums">
                          {entries.length} 个
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {catMeta.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={catMeta.path}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    管理 <ExternalLink className="w-3 h-3" />
                  </Link>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                      collapsed.has(cat) ? "-rotate-90" : ""
                    }`}
                  />
                </div>
              </div>

              {/* 条目列表（可折叠） */}
              {!collapsed.has(cat) && (
              <div className="divide-y divide-gray-50">
                {entries.length === 0 ? (
                  <div className="px-6 py-6 text-center">
                    <span className="text-sm text-gray-400">暂未配置</span>
                  </div>
                ) : (cat === "skill" || cat === "agentTool" || cat === "platformPolicy" || cat === "network") ? (
                  (() => {
                    // 按 subLabel 分组
                    const grouped = new Map<string, ConfigEntry[]>();
                    entries.forEach((e) => {
                      const key = e.subLabel || "其他";
                      const list = grouped.get(key) ?? [];
                      list.push(e);
                      grouped.set(key, list);
                    });
                    return Array.from(grouped.entries()).map(([groupLabel, groupEntries]) => (
                      <div key={groupLabel}>
                        {/* 大类标题 */}
                        <div className="px-6 py-2 bg-gray-50/80 border-b border-gray-50 flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {groupLabel}
                          </span>
                          {/* 技能和Agent工具在子类别标题旁显示数量 */}
                          {(cat === "skill" || cat === "agentTool") && (
                            <span className="text-xs text-gray-400 tabular-nums">
                              {groupEntries.length} 个
                            </span>
                          )}
                        </div>
                        {/* 大类下的条目 */}
                        {groupEntries.map((entry) => (
                          <div key={entry.id} className="px-6 py-3 border-b border-gray-50 last:border-b-0">
                            {/* 公网特殊展示 */}
                            {entry.subLabel === "公网" && entry.meta ? (
                              <PublicNetworkDetail meta={entry.meta} source={entry.source} />
                            ) : entry.subLabel === "私有网络与子网" && entry.meta ? (
                              /* VPC + 子网结构化展示 */
                              <div className="space-y-2">
                                {/* 私有网络 */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-gray-500 shrink-0">私有网络：</span>
                                  <span className="text-xs font-semibold text-gray-700">
                                    {String(entry.meta.vpcId)} | {String(entry.meta.vpcName)} | {String(entry.meta.vpcCidr)}
                                  </span>
                                  <SourceBadge source={entry.source} />
                                  {isAnomalous && entry.source.type === "local" && <LocalAnomalyHint />}
                                </div>
                                {/* 子网列表 */}
                                {Array.isArray(entry.meta.subnets) && (entry.meta.subnets as Array<{ zone: string; subnetId: string; subnetCidr: string }>).map((subnet) => (
                                  <div key={subnet.subnetId} className="flex items-center gap-2 flex-wrap pl-4">
                                    <span className="text-xs text-gray-500 shrink-0">子网：</span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-600">{subnet.zone}</span>
                                    <span className="text-xs font-semibold text-gray-700">
                                      {subnet.subnetId} | {subnet.subnetCidr}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {entry.label}
                                    </span>
                                    <SourceBadge source={entry.source} />
                                    {isAnomalous && entry.source.type === "local" && <LocalAnomalyHint />}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {cat === "platformPolicy" && <PolicyEntryValue entry={entry} />}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-6 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {entry.label}
                          </span>
                          <SourceBadge source={entry.source} />
                          {isAnomalous && entry.source.type === "local" && <LocalAnomalyHint />}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {(cat as string) === "platformPolicy" && <PolicyEntryValue entry={entry} />}
                      </div>
                    </div>
                  ))
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
