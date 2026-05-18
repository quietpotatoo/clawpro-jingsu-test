/**
 * AgentList - 管控端 Agent 列表页
 * 4 个模块：状态统计卡片、状态列+列头筛选、操作列、监控抽屉面板
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, Bot, Trash2, ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
  Terminal, Power, MoreHorizontal, RotateCcw, HardDriveDownload,
  Activity, Loader2, ExternalLink, ChevronDown, Filter, HelpCircle, X, Eye, EyeOff,
  Server, CheckCircle2, PowerOff, Layers, ArrowUp, ArrowDown, Zap, BarChart3,
  MessageCircle, RotateCw, Check, ArrowLeftRight, CircleArrowUp, Tag, Info,
  Pencil, Plus,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { MOCK_DEPARTMENTS, MOCK_CLAWS_WITH_DEPT, type DepartmentNode } from "@/lib/mockData";
import { CHANNEL_OPTIONS, type ChannelConfig } from "@/lib/agentConfigConstants";
import { useAdminModels, CUSTOM_PROVIDER_VALUE, type ModelRow } from "@/lib/modelConfigStore";
import {
  loadBuiltinChannelVisibility,
  loadVisibleCustomChannels,
  onBuiltinChannelVisibilityChange,
  onCustomChannelsChange,
  type CustomChannel as AdminCustomChannel,
} from "@/lib/customChannelStore";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { MOCK_GROUPS, MOCK_MANUAL_GROUPS, MOCK_USERS, MOCK_USERS_MANUAL } from "./MemberManagement/mock";
import type { UserGroup, GroupSource } from "./MemberManagement/types";
import { buildGroupTree, type GroupTreeNode } from "./MemberManagement/health";

type ClawStatus = "creating" | "createFail" | "running" | "loading" | "loadFail" | "shutdown" | "maintaining" | "pending" | "upgrading";
const LATEST_VERSION = "2026.4.2";

interface PluginVersions {
  wechat: string;
  dingtalk: string;
  feishu: string;
  wecom: string;
  qq: string;
}

interface Claw {
  id: string;
  instanceId: string;
  name: string;
  creator: string;
  createTime: string;
  status: ClawStatus;
  version: string;
  agentType: 'OpenClaw' | 'Hermes' | 'LightclawACE';
  pluginVersions: PluginVersions;
  department?: string;
  departmentId?: string;
  tags?: { key: string; value: string }[];
}

const STATUS_CONFIG: Record<ClawStatus, {
  label: string;
  badgeClass: string;       // 复用 index.css 中的 badge-* class
  dotColor: string;         // 小圆点颜色
  spinning?: boolean;       // 是否用旋转圆圈替代实心圆点
}> = {
  creating:    { label: "创建中",   badgeClass: "badge-loading",  dotColor: "bg-blue-500" },
  createFail:  { label: "创建失败", badgeClass: "badge-stopped",  dotColor: "bg-red-500" },
  running:     { label: "运行中",   badgeClass: "badge-running",  dotColor: "bg-green-500" },
  loading:     { label: "加载中",   badgeClass: "badge-loading",  dotColor: "bg-blue-500" },
  loadFail:    { label: "加载失败", badgeClass: "badge-stopped",  dotColor: "bg-red-500" },
  shutdown:    { label: "已关机",   badgeClass: "badge-shutdown", dotColor: "bg-gray-400" },
  maintaining: { label: "维护中",   badgeClass: "badge-pending",  dotColor: "bg-orange-500" },
  pending:     { label: "待处理",   badgeClass: "badge-pending",  dotColor: "bg-orange-500" },
  upgrading:   { label: "升级中",   badgeClass: "badge-loading",  dotColor: "bg-blue-500" },
};

const DEFAULT_PLUGIN_VERSIONS: PluginVersions = { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" };

// Agent 类型显示名称映射
const AGENT_TYPE_DISPLAY: Record<string, string> = {
  'OpenClaw':    'OpenClaw',
  'Hermes':      'Hermes Agent',
  'LightclawACE': 'LightClaw ACE',
};

const MOCK_CLAWS: Claw[] = [
  { id: "1",  instanceId: "ins-g71c6vud", name: "Alice的技术助手", tags: [{ key: "所属产品", value: "gpulab" }, { key: "env", value: "production" }],    creator: "alice@acompany.com",  createTime: "2025-12-01 09:12:34", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "2",  instanceId: "ins-h92d7xwe", name: "Bob工作助手",       creator: "bob@acompany.com",    createTime: "2025-12-15 14:05:22", status: "running",     version: "2026.4.2",  agentType: "Hermes",      pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "3",  instanceId: "ins-j14e8yvf", name: "Carol的研究助手",   creator: "carol@acompany.com",  createTime: "2026-01-05 10:33:47", status: "shutdown",   version: "2026.3.28", agentType: "LightclawACE", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "4",  instanceId: "ins-k25f9zwg", name: "Dave的代码助手", tags: [{ key: "test", value: "test2" }],    creator: "dave@acompany.com",   createTime: "2026-01-20 16:48:09", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.1.5", dingtalk: "2.7.2", feishu: "1.4.8", wecom: "2.0.9", qq: "1.0.1" } },
  { id: "5",  instanceId: "ins-l36g0axh", name: "Eve的写作助手",     creator: "eve@acompany.com",    createTime: "2026-02-10 08:21:55", status: "createFail", version: "2026.3.28", agentType: "Hermes",      pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "6",  instanceId: "ins-m47h1byi", name: "Frank的数据助手",   creator: "frank@acompany.com",  createTime: "2026-02-18 11:07:30", status: "running",     version: "2026.4.2",  agentType: "OpenClaw",    pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "7",  instanceId: "ins-n58i2czj", name: "Grace的翻译助手",   creator: "grace@acompany.com",  createTime: "2026-02-25 15:44:18", status: "creating",   version: "2026.3.28", agentType: "LightclawACE", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "8",  instanceId: "ins-o69j3dak", name: "Henry的销售助手", tags: [{ key: "所属产品", value: "gpulab" }, { key: "team", value: "sales" }, { key: "env", value: "staging" }],   creator: "henry@acompany.com",  createTime: "2026-03-01 09:58:03", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "9",  instanceId: "ins-p70k4ebl", name: "Ivy的客服助手",     creator: "ivy@acompany.com",    createTime: "2026-03-05 13:26:41", status: "running",     version: "2026.4.2",  agentType: "Hermes",      pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "10", instanceId: "ins-q81l5fcm", name: "Jack的会议助手",    creator: "jack@acompany.com",   createTime: "2026-03-08 17:02:15", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.0", dingtalk: "2.8.0", feishu: "1.5.2", wecom: "2.1.3", qq: "1.0.2" } },
  { id: "11", instanceId: "ins-r92m6gdn", name: "Karen的报告助手",   creator: "karen@acompany.com",  createTime: "2026-03-09 10:15:50", status: "loadFail",   version: "2026.3.28", agentType: "LightclawACE", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "12", instanceId: "ins-s03n7heo", name: "Leo的项目助手", tags: [{ key: "tencentcloud:autoscaling", value: "asg-1f7z0pa9" }],     creator: "leo@acompany.com",    createTime: "2026-03-10 08:39:27", status: "running",     version: "2026.4.2",  agentType: "OpenClaw",    pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "13", instanceId: "ins-t14o8ipf", name: "Mia的新助手",        creator: "mia@acompany.com",    createTime: "2026-03-12 11:00:00", status: "maintaining", version: "2026.3.28", agentType: "Hermes",      pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "14", instanceId: "ins-u25p9jqg", name: "Noah的分析助手",    creator: "noah@acompany.com",   createTime: "2026-03-13 14:30:00", status: "pending",    version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "15", instanceId: "ins-v36q0krh", name: "Olivia的运营助手",  creator: "olivia@acompany.com",  createTime: "2026-03-14 09:00:00", status: "running",     version: "2026.4.2",  agentType: "LightclawACE", pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "16", instanceId: "ins-w47r1lsi", name: "Peter的财务助手",  creator: "peter@acompany.com",   createTime: "2026-03-15 10:20:00", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "17", instanceId: "ins-x58s2mtj", name: "Quinn的法务助手",  creator: "quinn@acompany.com",   createTime: "2026-03-16 11:45:00", status: "running",     version: "2026.4.2",  agentType: "Hermes",      pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "18", instanceId: "ins-y69t3nuk", name: "Rachel的HR助手",      creator: "rachel@acompany.com",  createTime: "2026-03-17 13:10:00", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "19", instanceId: "ins-z70u4ovl", name: "Sam的产品助手",    creator: "sam@acompany.com",     createTime: "2026-03-18 14:30:00", status: "running",     version: "2026.4.2",  agentType: "LightclawACE", pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "20", instanceId: "ins-a81v5pwm", name: "Tina的客服助手",  creator: "tina@acompany.com",    createTime: "2026-03-19 15:00:00", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "21", instanceId: "ins-b92w6qxn", name: "Uma的设计助手",   creator: "uma@acompany.com",     createTime: "2026-03-20 09:30:00", status: "running",     version: "2026.4.2",  agentType: "Hermes",      pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "22", instanceId: "ins-c03x7ryo", name: "Victor的技术助手", creator: "victor@acompany.com",  createTime: "2026-03-21 10:00:00", status: "running",     version: "2026.3.28", agentType: "OpenClaw",    pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "23", instanceId: "ins-d14y8szp", name: "这是一个名称非常非常长的智能助手用来测试超长文本截断效果", creator: "longname-user@very-long-domain-example.com", createTime: "2026-05-01 09:00:00", status: "running",     version: "2026.4.2",  agentType: "OpenClaw",    pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "24", instanceId: "ins-e25z9taq", name: "GPULab产品线专属AI智能运营分析与决策支持系统", creator: "product-ops-admin@enterprise-acompany.com", createTime: "2026-05-02 10:30:00", status: "running",     version: "2026.4.2",  agentType: "Hermes",      pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
];

const PAGE_SIZE = 10;

// ─── 分组相关工具函数 ─────────────────────────────────────────────────────

/** 获取分组的完整路径（如 "产品组" 或 "研发组 / 前端"） */
function getGroupPath(groupId: string, groups: UserGroup[]): string {
  const map = new Map(groups.map((g) => [g.id, g]));
  const chain: string[] = [];
  let cur = map.get(groupId);
  while (cur) {
    chain.unshift(cur.name);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain.join(" / ");
}

/** 按 source 分桶标题 */
const GROUP_SOURCE_LABELS: Record<GroupSource, string> = {
  "oneid-dept": "部门",
  "oneid-group": "自定义分组",
  manual: "自定义分组",
};

/** 获取某 agent creator 的所有部门路径（OneID 模式，主部门排首位） */
function getCreatorDeptPaths(creator: string): Array<{ path: string; isPrimary: boolean }> {
  const user = MOCK_USERS.find((u) => u.userId === creator);
  if (!user) return [];
  const deptGroupIds = user.groupIds.filter((gid) => {
    const g = MOCK_GROUPS.find((g) => g.id === gid);
    return g?.source === "oneid-dept";
  });
  if (deptGroupIds.length === 0) return [];
  return deptGroupIds
    .map((gid) => ({
      path: getGroupPath(gid, MOCK_GROUPS),
      isPrimary: gid === user.primaryGroupId,
    }))
    .sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
}

/** 获取某 agent creator 对应的分组信息（OneID 模式，只返回一个） */
function getCreatorGroupItemOneid(creator: string): { id: string; path: string; kind: "oneid-dept" | "oneid-group" } | null {
  const user = MOCK_USERS.find((u) => u.userId === creator);
  if (!user) return null;
  // 优先取 oneid-group（自定义分组），其次取 oneid-dept（部门）
  let deptItem: { id: string; path: string; kind: "oneid-dept" | "oneid-group" } | null = null;
  for (const gid of user.groupIds) {
    const g = MOCK_GROUPS.find((g) => g.id === gid);
    if (!g) continue;
    if (g.source === "oneid-group") {
      return { id: gid, path: getGroupPath(gid, MOCK_GROUPS), kind: "oneid-group" };
    }
    if (g.source === "oneid-dept" && !deptItem) {
      deptItem = { id: gid, path: getGroupPath(gid, MOCK_GROUPS), kind: "oneid-dept" };
    }
  }
  return deptItem;
}

/** 获取某 agent creator 对应的分组信息（普通模式，只返回一个） */
function getCreatorGroupItemManual(creator: string): { id: string; path: string } | null {
  const user = MOCK_USERS_MANUAL.find((u) => u.userId === creator);
  if (!user || user.groupIds.length === 0) return null;
  const gid = user.groupIds[0];
  return { id: gid, path: getGroupPath(gid, MOCK_MANUAL_GROUPS) };
}

/** 获取某 agent creator 所属的所有分组 id（含子孙逻辑：选中某分组时，其用户应该被命中） */
function getCreatorAllGroupIds(creator: string, hasOneid: boolean): string[] {
  if (hasOneid) {
    const user = MOCK_USERS.find((u) => u.userId === creator);
    return user ? user.groupIds : [];
  } else {
    const user = MOCK_USERS_MANUAL.find((u) => u.userId === creator);
    return user ? user.groupIds : [];
  }
}

/** 获取节点及其所有子孙 ID */
function getGroupDescendantIds(node: GroupTreeNode): string[] {
  const ids: string[] = [node.id];
  node.children.forEach((c) => ids.push(...getGroupDescendantIds(c)));
  return ids;
}

// ─── 分组筛选树节点（递归） ──────────────────────────────────────────────
function GroupTreeNodeItem({
  node, level, selected, expanded, onToggle, onSelect,
}: {
  node: GroupTreeNode; level: number; selected: string;
  expanded: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${
          isSelected ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}>
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </span>
        )}
        <span className={`text-sm truncate flex-1 ${isSelected ? "text-blue-600 font-medium" : ""}`}>{node.name}</span>
        {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 flex-shrink-0" />}
      </div>
      {hasChildren && isExpanded && node.children.map((child) => (
        <GroupTreeNodeItem key={child.id} node={child} level={level + 1}
          selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── 分组筛选弹出框 ─────────────────────────────────────────────────────
function InstanceGroupFilter({
  groups, value, onChange, hasOneid,
}: {
  groups: UserGroup[]; value: string; onChange: (v: string) => void; hasOneid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { if (open) { setTempValue(value); setSearchQuery(""); } }, [open, value]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleConfirm = () => { onChange(tempValue); setOpen(false); };
  const handleCancel = () => { setTempValue(value); setOpen(false); };

  // 按 source 分桶构建树
  const { activeSources, treesMap } = useMemo(() => {
    if (hasOneid) {
      const buckets: Record<string, UserGroup[]> = { "oneid-dept": [], "oneid-group": [] };
      groups.forEach((g) => { if (buckets[g.source]) buckets[g.source].push(g); });
      const order: GroupSource[] = ["oneid-dept", "oneid-group"];
      const active = order.filter((s) => (buckets[s] || []).length > 0);
      const tMap: Record<string, GroupTreeNode[]> = {};
      active.forEach((s) => { tMap[s] = buildGroupTree(buckets[s]); });
      return { activeSources: active, treesMap: tMap };
    } else {
      const trees = buildGroupTree(groups);
      return { activeSources: ["manual" as GroupSource], treesMap: { manual: trees } };
    }
  }, [groups, hasOneid]);

  // 搜索过滤
  const matchedIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(
      groups.filter((g) => g.name.toLowerCase().includes(q) || getGroupPath(g.id, groups).toLowerCase().includes(q)).map((g) => g.id)
    );
  }, [searchQuery, groups]);

  const isNodeVisible = (node: GroupTreeNode): boolean => {
    if (!matchedIds) return true;
    if (matchedIds.has(node.id)) return true;
    return node.children.some(isNodeVisible);
  };

  // 找到选中节点名称
  const selectedGroup = tempValue ? groups.find((g) => g.id === tempValue) : undefined;
  const triggerGroup = value ? groups.find((g) => g.id === value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox"
          className={`w-[120px] justify-between bg-white text-sm font-normal hover:bg-white data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 ${
            triggerGroup ? "text-foreground" : "text-muted-foreground"
          }`}>
          <span className="truncate">{triggerGroup?.name || "全部分组"}</span>
          <ChevronDown className={`w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {/* 搜索 */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索分组"
              className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto px-2 pb-2">
          {/* 全部分组 */}
          <div className={`flex items-center gap-2 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${
            tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"
          }`} onClick={() => setTempValue("")}>
            <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部分组</span>
            {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          </div>
          {/* 按 source 分区展示 */}
          {activeSources.map((source) => (
            <div key={source}>
              {hasOneid && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {GROUP_SOURCE_LABELS[source]}
                  </span>
                </div>
              )}
              {(treesMap[source] || []).map((root) =>
                isNodeVisible(root) ? (
                  <GroupTreeNodeItem key={root.id} node={root} level={0}
                    selected={tempValue} expanded={expanded} onToggle={toggleExpand} onSelect={setTempValue} />
                ) : null
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 text-xs text-gray-500 truncate">
            {selectedGroup ? getGroupPath(selectedGroup.id, groups) : "全部分组"}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2"
              onClick={handleCancel}>取消</Button>
            <Button size="sm" className="text-xs h-7 px-3"
              onClick={handleConfirm}>确认</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 部门树节点（递归）──────────────────────────────────────────────────────
function InstanceDepartmentTreeNode({
  node, level, selected, expanded, onToggle, onSelect,
}: {
  node: DepartmentNode; level: number; selected: string;
  expanded: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${
          isSelected ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}>
            {isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </span>
        )}
        <span className={`text-sm truncate flex-1 ${isSelected ? "text-blue-600 font-medium" : ""}`}>{node.name}</span>
        {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 flex-shrink-0" />}
      </div>
      {hasChildren && isExpanded && node.children!.map((child) => (
        <InstanceDepartmentTreeNode key={child.id} node={child} level={level + 1}
          selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── 部门筛选弹出框（Agent 列表页用） ──────────────────────────────────────
function InstanceDepartmentFilter({
  departments, value, onChange,
}: {
  departments: DepartmentNode[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { if (open) setTempValue(value); }, [open, value]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleConfirm = () => { onChange(tempValue); setOpen(false); };
  const handleCancel = () => { setTempValue(value); setOpen(false); };

  const findNode = (nodes: DepartmentNode[], id: string): DepartmentNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const found = findNode(n.children, id); if (found) return found; }
    }
    return undefined;
  };
  const selectedNode = tempValue ? findNode(departments, tempValue) : undefined;
  const triggerNode = value ? findNode(departments, value) : undefined;
  const pathParts = selectedNode?.path?.split("/").filter(Boolean) || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox"
          className={`w-[120px] justify-between bg-white text-sm font-normal hover:bg-white data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 ${
            triggerNode ? "text-foreground" : "text-muted-foreground"
          }`}>
          <span className="truncate">{triggerNode?.name || "全部部门"}</span>
          <ChevronDown className={`w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[280px] overflow-y-auto p-2">
          <div className={`flex items-center gap-2 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${
            tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"
          }`} onClick={() => setTempValue("")}>
            <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部部门</span>
            {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          </div>
          {departments.map((dept) => (
            <InstanceDepartmentTreeNode key={dept.id} node={dept} level={0}
              selected={tempValue} expanded={expanded} onToggle={toggleExpand} onSelect={setTempValue} />
          ))}
        </div>
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1 text-xs overflow-hidden">
            {tempValue === "" ? (
              <span className="text-blue-600 font-medium truncate">全部部门</span>
            ) : pathParts.length > 0 ? (
              pathParts.map((part, idx) => (
                <span key={idx} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                  <span className={idx === pathParts.length - 1 ? "text-blue-600 font-medium truncate" : "text-gray-500 truncate"}>
                    {part}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-gray-400 truncate">未选择</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2"
              onClick={handleCancel}>取消</Button>
            <Button size="sm" className="text-xs h-7 px-3"
              onClick={handleConfirm}>确认</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 部门列头筛选面板 ─────────────────────────────────────────────────────
function DepartmentColumnFilter({
  departments, value, onConfirm, onCancel,
}: {
  departments: DepartmentNode[]; value: string; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const isNodeVisible = (node: DepartmentNode): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    return (node.children || []).some(isNodeVisible);
  };

  const renderNode = (node: DepartmentNode, level: number) => {
    if (!isNodeVisible(node)) return null;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = tempValue === node.id;
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${isSelected ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100"}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setTempValue(node.id)}
        >
          {hasChildren ? (
            <button className="w-4 h-4 flex items-center justify-center flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            </button>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" /></span>
          )}
          <span className={`text-sm truncate flex-1 ${isSelected ? "text-blue-600 font-medium" : ""}`}>{node.name}</span>
          {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 flex-shrink-0" />}
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索部门"
            className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>
      <div className="max-h-[280px] overflow-y-auto px-2 pb-2">
        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"}`} onClick={() => setTempValue("")}>
          <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部部门</span>
          {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
        </div>
        {departments.map((d) => renderNode(d, 0))}
      </div>
      <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2" onClick={onCancel}>取消</Button>
        <Button size="sm" className="text-xs h-7 px-3" onClick={() => onConfirm(tempValue)}>确认</Button>
      </div>
    </>
  );
}

// ─── 分组列头筛选面板 ─────────────────────────────────────────────────────
function GroupColumnFilter({
  groups, value, hasOneid, onConfirm, onCancel,
}: {
  groups: UserGroup[]; value: string; hasOneid: boolean; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const { activeSources, treesMap } = useMemo(() => {
    if (hasOneid) {
      const buckets: Record<string, UserGroup[]> = { "oneid-dept": [], "oneid-group": [] };
      groups.forEach((g) => { if (buckets[g.source]) buckets[g.source].push(g); });
      const order: GroupSource[] = ["oneid-dept", "oneid-group"];
      const active = order.filter((s) => (buckets[s] || []).length > 0);
      const tMap: Record<string, GroupTreeNode[]> = {};
      active.forEach((s) => { tMap[s] = buildGroupTree(buckets[s]); });
      return { activeSources: active, treesMap: tMap };
    } else {
      const trees = buildGroupTree(groups);
      return { activeSources: ["manual" as GroupSource], treesMap: { manual: trees } };
    }
  }, [groups, hasOneid]);

  const isNodeVisible = (node: GroupTreeNode): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    return node.children.some(isNodeVisible);
  };

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索分组"
            className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>
      <div className="max-h-[280px] overflow-y-auto px-2 pb-2">
        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"}`} onClick={() => setTempValue("")}>
          <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部分组</span>
          {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
        </div>
        {activeSources.map((source) => (
          <div key={source}>
            {hasOneid && (
              <div className="px-2 pt-3 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {GROUP_SOURCE_LABELS[source]}
                </span>
              </div>
            )}
            {(treesMap[source] || []).map((root) =>
              isNodeVisible(root) ? (
                <GroupTreeNodeItem key={root.id} node={root} level={0}
                  selected={tempValue} expanded={expanded} onToggle={toggleExpand} onSelect={setTempValue} />
              ) : null
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2" onClick={onCancel}>取消</Button>
        <Button size="sm" className="text-xs h-7 px-3" onClick={() => onConfirm(tempValue)}>确认</Button>
      </div>
    </>
  );
}

export default function AgentMonitor() {
  const [, setLocation] = useLocation();
  const { hasOneid } = useAdminMode();
  const [claws, setClaws] = useState<Claw[]>(() => {
    if (hasOneid) {
      // MOCK_CLAWS_WITH_DEPT 缺少 agentType/version/pluginVersions/tags，从 MOCK_CLAWS 补充
      const clawMap = new Map(MOCK_CLAWS.map((c) => [c.id, c]));
      return (MOCK_CLAWS_WITH_DEPT as any[]).map((d) => {
        const base = clawMap.get(d.id);
        return {
          ...d,
          agentType: base?.agentType ?? "OpenClaw",
          version: base?.version ?? "2026.3.28",
          pluginVersions: base?.pluginVersions ?? DEFAULT_PLUGIN_VERSIONS,
          tags: base?.tags,
        } as Claw;
      }).sort((a, b) => b.createTime.localeCompare(a.createTime));
    }
    return [...MOCK_CLAWS].sort((a, b) => b.createTime.localeCompare(a.createTime));
  });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const ALL_AGENT_TYPES = Object.keys(AGENT_TYPE_DISPLAY);
  const [agentTypeFilter, setAgentTypeFilter] = useState<Set<string>>(new Set(ALL_AGENT_TYPES));

  // 列头筛选弹窗状态
  const [deptColFilterOpen, setDeptColFilterOpen] = useState(false);
  const [groupColFilterOpen, setGroupColFilterOpen] = useState(false);
  const [typeColFilterOpen, setTypeColFilterOpen] = useState(false);
  const [tempTypeFilter, setTempTypeFilter] = useState<Set<string>>(new Set());

  // 状态卡片筛选
  const [activeCardFilter, setActiveCardFilter] = useState<"all" | "running" | "shutdown" | "other">("all");

  // 状态列筛选
  const ALL_STATUSES: ClawStatus[] = ["creating", "createFail", "running", "loading", "loadFail", "shutdown", "maintaining", "pending"];
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ClawStatus>>(new Set(ALL_STATUSES));
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null);

  // 表格横向滚动检测
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [isTableScrolled, setIsTableScrolled] = useState(false);
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsTableScrolled(el.scrollLeft > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    // 给 flex 父容器加 min-width:0 防止 table 撑开页面
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.display === 'flex' || style.display === 'inline-flex') {
        // 给 flex 容器的子元素（main）加约束
        const children = parent.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          if (child.tagName === 'MAIN' || getComputedStyle(child).flex !== '0 1 auto') {
            child.style.minWidth = '0';
            child.style.overflow = 'hidden';
          }
        }
        break;
      }
      parent = parent.parentElement;
    }
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // 操作对话框
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [shutdownTarget, setShutdownTarget] = useState<string | null>(null);
  const [reinstallTarget, setReinstallTarget] = useState<string | null>(null);
  const [reinstallInput, setReinstallInput] = useState("");
  const [deleteInput, setDeleteInput] = useState("");

  // 批量更新
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchUpgradeDialog, setShowBatchUpgradeDialog] = useState(false);
  // 批量升级失败结果弹窗
  const [showUpgradeResultDialog, setShowUpgradeResultDialog] = useState(false);
  const [upgradeFailedAgents, setUpgradeFailedAgents] = useState<{ name: string; instanceId: string; agentType: string; reason: string }[]>([]);

  // 配置默认标签
  interface TencentTag { key: string; value: string; }
  // 标签键 -> 可选值列表（模拟腾讯云标签库）
  const DEMO_TAG_KEY_VALUES: Record<string, string[]> = {
    'qcs:tag:thpc:node:creator':      ['alice', 'bob', 'charlie'],
    'qcs:tag:thpc:node:clusterId':    ['cluster-001', 'cluster-002'],
    'qcs:tag:thpc:node:nodeId':       ['node-a1', 'node-b2', 'node-c3'],
    'qcs:tag:thpc:workspace:creator': ['alice', 'dave'],
    'kaijian':                        ['kaijian', 'test'],
    'acs:tag:createdby':              ['system', 'user'],
    'tke_managed_by':                 ['tke', 'manual'],
    'niumengtao':                     ['体验', '正式', '测试'],
    '所属产品':                        ['gpulab', 'openclaw', 'tke'],
    'env':                            ['production', 'staging', 'dev'],
    '负责人':                          ['alice', 'bob', 'charlie'],
    '业务线':                          ['AI', 'Platform', 'Infra'],
  };
  const DEMO_TAG_KEYS = Object.keys(DEMO_TAG_KEY_VALUES);
  const [showTagConfigDialog, setShowTagConfigDialog] = useState(false);
  // 已确认的标签列表（key-value 对）
  const [selectedTags, setSelectedTags] = useState<TencentTag[]>([]);
  // 弹窗内临时状态
  const [pendingTags, setPendingTags] = useState<TencentTag[]>([]);
  // 添加标签行的临时选择
  const [addingKey, setAddingKey] = useState('');
  const [addingValue, setAddingValue] = useState('');
  const [keySearchText, setKeySearchText] = useState('');
  const [keyDropdownOpen, setKeyDropdownOpen] = useState(false);
  const [valueDropdownOpen, setValueDropdownOpen] = useState(false);


  // 版本列筛选

  // 判断某实例是否可更新（仅运行中）
  const isUpgradable = (claw: Claw) => claw.status === "running";

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      // 全选勾选当前筛选结果的所有页所有实例，不限状态
      if (checked) { allFilteredIds.forEach(id => next.add(id)); }
      else { allFilteredIds.forEach(id => next.delete(id)); }
      return next;
    });
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // agentType 映射：Claw 中的 agentType → ImageManagement 中的 agentType
  const CLAW_TO_IMAGE_AGENT_TYPE: Record<string, string> = {
    'OpenClaw':    'OpenClaw',
    'Hermes':      'HermesAgent',
    'LightclawACE': 'LightClawACE',
  };
  const confirmBatchUpgrade = () => {
    const ids = Array.from(selectedIds);
    const selectedClaws = claws.filter(c => ids.includes(c.id));
    // 读取镜像管理中的生效镜像（若 localStorage 为空，使用默认公共镜像，全部生效）
    let images: { agentType: string; active: boolean }[] = [];
    try {
      const raw = localStorage.getItem('admin_images');
      if (raw) {
        images = JSON.parse(raw);
      } else {
        // 默认公共镜像全部生效
        images = [
          { agentType: 'OpenClaw',    active: true },
          { agentType: 'HermesAgent', active: true },
          { agentType: 'LightClawACE', active: true },
        ];
      }
    } catch { /* ignore */ }
    // 统计每种 agentType 是否有生效镜像
    const activeImageTypes = new Set(images.filter(i => i.active).map(i => i.agentType));
    // 分组：可升级 vs 无法升级
    const failed: { name: string; instanceId: string; agentType: string; reason: string }[] = [];
    const upgradableIds: string[] = [];
    for (const c of selectedClaws) {
      const imageAgentType = CLAW_TO_IMAGE_AGENT_TYPE[c.agentType] ?? c.agentType;
      if (!activeImageTypes.has(imageAgentType)) {
        failed.push({ name: c.name, instanceId: c.instanceId, agentType: c.agentType, reason: `当前没有生效的 ${c.agentType} 镜像，以下 agent 无法升级` });
      } else {
        upgradableIds.push(c.id);
      }
    }
    setShowBatchUpgradeDialog(false);
    if (failed.length > 0) {
      setUpgradeFailedAgents(failed);
      setShowUpgradeResultDialog(true);
    }
    if (upgradableIds.length > 0) {
      setClaws(prev => prev.map(c => upgradableIds.includes(c.id) ? { ...c, status: 'upgrading' as ClawStatus } : c));
      setSelectedIds(new Set());
      toast.success(`已开始升级 ${upgradableIds.length} 个实例`);
    } else if (failed.length === 0) {
      setSelectedIds(new Set());
    }
  };

  // 详情抽屉
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // 监控抽屉
  const [showMonitorDrawer, setShowMonitorDrawer] = useState(false);
  const [selectedClaw, setSelectedClaw] = useState<Claw | null>(null);
  const [clsEnabled, setClsEnabled] = useState(() => {
    const stored = localStorage.getItem("globalClsEnabled");
    return stored === "true";
  });

  // 监听 localStorage 变化，实现跨页面同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "globalClsEnabled") {
        setClsEnabled(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 计算统计数据
  const countByStatus = (status: ClawStatus | ClawStatus[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return claws.filter(c => statuses.includes(c.status)).length;
  };

  const totalCount = claws.length;
  const runningCount = countByStatus("running");
  const shutdownCount = countByStatus("shutdown");
  const otherCount = countByStatus(["creating", "loading", "createFail", "loadFail", "maintaining", "pending"]);

  // 根据卡片筛选限制状态列筛选的可选项
  const getAvailableStatuses = (): ClawStatus[] => {
    switch (activeCardFilter) {
      case "running": return ["running"];
      case "shutdown": return ["shutdown"];
      case "other": return ["creating", "loading", "createFail", "loadFail", "maintaining", "pending"];
      case "all": return ["creating", "createFail", "running", "loading", "loadFail", "shutdown", "maintaining", "pending"];
    }
  };

  const handleCardFilterChange = (filter: "all" | "running" | "shutdown" | "other") => {
    setActiveCardFilter(filter);
    setPage(1);
    // 重置状态列筛选为当前卡片允许的全选状态
    const availableStatuses: ClawStatus[] = (() => {
      switch (filter) {
        case "running": return ["running"];
        case "shutdown": return ["shutdown"];
        case "other": return ["creating", "loading", "createFail", "loadFail", "maintaining", "pending"];
        case "all": return ["creating", "createFail", "running", "loading", "loadFail", "shutdown", "maintaining", "pending"];
      }
    })();
    setSelectedStatuses(new Set(availableStatuses));
  };

  const handleStatusFilterChange = (status: ClawStatus, checked: boolean) => {
    const newStatuses = new Set(selectedStatuses);
    if (checked) {
      newStatuses.add(status);
    } else {
      newStatuses.delete(status);
    }
    setSelectedStatuses(newStatuses);
  };

  const handleStatusFilterReset = () => {
    const available = getAvailableStatuses();
    setSelectedStatuses(new Set(available));
  };

  const handleStatusFilterConfirm = () => {
    setShowStatusFilter(false);
    setPage(1);
  };

  // 筛选逻辑
  const timeFiltered = claws.filter((c) => {
    const matchFrom = !dateFrom || c.createTime >= dateFrom;
    const matchTo = !dateTo || c.createTime <= dateTo;
    return matchFrom && matchTo;
  });

  const searchFiltered = timeFiltered.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || c.creator.includes(search) || c.instanceId.includes(search);
    return matchSearch;
  });

  // 部门筛选（OneID 模式）
  const findDeptAndChildren = (nodes: DepartmentNode[], targetId: string): string[] => {
    const ids: string[] = [];
    const collect = (node: DepartmentNode) => {
      ids.push(node.id);
      node.children?.forEach(collect);
    };
    const find = (list: DepartmentNode[]): boolean => {
      for (const n of list) {
        if (n.id === targetId) { collect(n); return true; }
        if (n.children && find(n.children)) return true;
      }
      return false;
    };
    find(nodes);
    return ids;
  };

  const deptFiltered = hasOneid ? searchFiltered.filter((c) => {
    if (!departmentFilter) return true;
    const allowedIds = findDeptAndChildren(MOCK_DEPARTMENTS, departmentFilter);
    return c.departmentId ? allowedIds.includes(c.departmentId) : false;
  }) : searchFiltered;

  // 分组筛选
  const groupFiltered = deptFiltered.filter((c) => {
    if (!groupFilter) return true;
    const currentGroups = hasOneid ? MOCK_GROUPS : MOCK_MANUAL_GROUPS;
    const trees = buildGroupTree(currentGroups);
    // 找到选中分组节点及其所有子孙 id
    const findNode = (nodes: GroupTreeNode[], id: string): GroupTreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const hit = findNode(n.children, id);
        if (hit) return hit;
      }
      return null;
    };
    const targetNode = findNode(trees, groupFilter);
    if (!targetNode) return true;
    const allowedGroupIds = new Set(getGroupDescendantIds(targetNode));
    // 检查 agent 创建者是否属于这些分组
    const creatorGroupIds = getCreatorAllGroupIds(c.creator, hasOneid);
    return creatorGroupIds.some((gid) => allowedGroupIds.has(gid));
  });

  // Agent 类型筛选
  const typeFiltered = groupFiltered.filter((c) => {
    if (agentTypeFilter.size === 0 || agentTypeFilter.size === ALL_AGENT_TYPES.length) return true;
    return agentTypeFilter.has(c.agentType);
  });

  const cardFiltered = typeFiltered.filter((c) => {
    switch (activeCardFilter) {
      case "running": return c.status === "running";
      case "shutdown": return c.status === "shutdown";
      case "other": return ["creating", "loading", "createFail", "loadFail", "maintaining", "pending"].includes(c.status);
      case "all": return true;
    }
  });

  const statusFiltered = cardFiltered.filter((c) => {
    if (selectedStatuses.size === 0 || selectedStatuses.size === ALL_STATUSES.length) return true;
    return selectedStatuses.has(c.status);
  });


  const versionFiltered = statusFiltered;

  const totalPages = Math.max(1, Math.ceil(versionFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = versionFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 当前页所有实例 id
  const pageIds = paginated.map(c => c.id);
  // 全筛选结果的所有 id（全选范围）
  const allFilteredIds = versionFiltered.map(c => c.id);
  // 全选状态：当前筛选结果所有实例全部被勾选
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  // 部分勾选：有且仅有部分实例被勾选（不显示 indeterminate，直接显示未勾选）
  const isIndeterminate = false;

  // 批量更新按钮禁用逻辑
  const selectedCount = selectedIds.size;
  const selectedClaws = claws.filter(c => selectedIds.has(c.id));
  const hasNonRunning = selectedClaws.some(c => !isUpgradable(c));
  const hasNonAgent = selectedClaws.some(c => c.agentType !== 'OpenClaw');
  const batchDisabled = selectedCount === 0 || selectedCount > 20 || hasNonRunning || hasNonAgent;
  const batchDeleteDisabled = selectedCount === 0;
  const batchTooltip = selectedCount === 0
    ? '请先选择实例'
    : selectedCount > 20
    ? '批量更新数量不可大丠20'
    : hasNonAgent
    ? '仅OpenClaw支持更新'
    : hasNonRunning
    ? '仅运行中的实例支持更新'
    : '';

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success("列表已刷新");
    }, 1000);
  };

  const handleOpenTerminal = (claw: Claw) => {
    window.open(`/terminal/${claw.id}`, "_blank");
  };

  const handleRestart = (claw: Claw) => {
    toast.success(`正在重启 ${claw.name}...`);
  };

  const handleReinstallClick = (claw: Claw) => {
    setReinstallTarget(claw.id);
    setReinstallInput("");
  };

  const confirmReinstall = () => {
    if (!reinstallTarget) return;
    const claw = claws.find(c => c.id === reinstallTarget);
    setClaws(claws.map(c => c.id === reinstallTarget ? { ...c, status: "running" as ClawStatus } : c));
    setReinstallTarget(null);
    setReinstallInput("");
    toast.success(`正在重新安装 ${claw?.name}...`);
  };

  const confirmShutdown = () => {
    if (!shutdownTarget) return;
    const claw = claws.find(c => c.id === shutdownTarget);
    setClaws(claws.map(c => c.id === shutdownTarget ? { ...c, status: "shutdown" as ClawStatus } : c));
    setShutdownTarget(null);
    toast.success(`已关机 ${claw?.name}`);
  };

  const handleDeleteClick = (claw: Claw) => {
    setDeleteTarget(claw.id);
    setDeleteInput("");
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const claw = claws.find(c => c.id === deleteTarget);
    setClaws(claws.filter(c => c.id !== deleteTarget));
    setDeleteTarget(null);
    setDeleteInput("");
    toast.success(`已删除 ${claw?.name}`);
  };

  // ── Agent 详情抽屉数据（可编辑） ─────────────────────────────────────────
  // 每个 claw 一份独立详情，编辑后保留在内存（管控端 demo 不持久化）。

  /** 已接入通道：除了基本展示字段，还保留一份凭证录入值 */
  interface ConnectedChannel {
    /** 通道展示名，与 CHANNEL_OPTIONS.label 对应，作为唯一标识 */
    name: string;
    /** 通道 value（CHANNEL_OPTIONS.value），便于反查 fields 定义 */
    value: string;
    /** 凭证字段值：按 ChannelField.key 存储 */
    fieldValues: Record<string, string>;
    bots: string[];
  }

  /**
   * 单条已应用模型：对应"模型配置"页中的一条记录。
   * - modelConfigId：关联管控端模型表 id；被删除/隐藏时按 Q3(c) 完全无感处理，仍用冗余字段展示
   * - providerLabel / versionLabel：展示态冗余，避免管控端模型变更后失去展示文案
   * - isCustom：是否自定义模型（展示"自定义模型"一级文案 + 小字为模型名）
   * - primary：是否主模型；整个列表至多一条 primary=true
   */
  interface AppliedModelItem {
    id: number;
    modelConfigId: string;
    providerLabel: string;
    versionLabel: string;
    isCustom: boolean;
    primary: boolean;
    addedAt: number;
  }

  interface ClawDetail {
    /** 已应用模型列表：可能为空（无模型）、只主、主+备 */
    appliedModels: AppliedModelItem[];
    /** 已接入通道列表 */
    connectedChannels: ConnectedChannel[];
    installedSkills: string[];
  }

  /** 基于 clawId 稳定分布，模拟三种场景：hash%3 → 0=空 / 1=只主 / 2=主+备 */
  const hashClawId = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  const buildDefaultClawDetail = (clawId: string): ClawDetail => {
    const scenario = hashClawId(clawId) % 3;
    const baseTs = Date.now();
    const appliedModels: AppliedModelItem[] =
      scenario === 0
        ? []
        : scenario === 1
        ? [
            {
              id: 1,
              modelConfigId: "1",
              providerLabel: "腾讯云 DeepSeek",
              versionLabel: "DeepSeek V3 0324",
              isCustom: false,
              primary: true,
              addedAt: baseTs,
            },
          ]
        : [
            {
              id: 1,
              modelConfigId: "1",
              providerLabel: "腾讯云 DeepSeek",
              versionLabel: "DeepSeek V3 0324",
              isCustom: false,
              primary: true,
              addedAt: baseTs,
            },
            {
              id: 2,
              modelConfigId: "2",
              providerLabel: "腾讯混元",
              versionLabel: "Hunyuan Turbo",
              isCustom: false,
              primary: false,
              addedAt: baseTs - 60_000,
            },
          ];
    return {
      appliedModels,
      connectedChannels: [
        { name: "飞书", value: "feishu", fieldValues: { appId: "cli_a1b2c3", appSecret: "fsk_xxxxxx" }, bots: [] },
      ],
      installedSkills: [
        "feishu-doc", "feishu-drive", "feishu-perm", "feishu-wiki",
        "feishu-calendar", "feishu-message", "feishu-task",
      ],
    };
  };

  const [clawDetailMap, setClawDetailMap] = useState<Record<string, ClawDetail>>({});

  /** 读取某个 claw 的详情（不存在则按 clawId hash 生成默认快照，不写入 map 以避免 render 期间 setState） */
  const getClawDetail = (clawId: string): ClawDetail => {
    return clawDetailMap[clawId] ?? buildDefaultClawDetail(clawId);
  };

  /** 用 updater 形式更新某个 claw 的详情，缺失时基于默认值初始化 */
  const updateClawDetail = (
    clawId: string,
    updater: (prev: ClawDetail) => ClawDetail,
  ) => {
    setClawDetailMap(prev => {
      const current = prev[clawId] ?? buildDefaultClawDetail(clawId);
      return { ...prev, [clawId]: updater(current) };
    });
  };

  /** 生成下一个模型 entry id：取当前列表最大 id + 1 */
  const nextModelEntryId = (list: AppliedModelItem[]): number => {
    return list.reduce((max, m) => (m.id > max ? m.id : max), 0) + 1;
  };

  // ── 订阅"模型配置"页的数据（仅 visible=true 的对外可见） ───────────────────
  const adminModels = useAdminModels();
  const visibleAdminModels = useMemo(() => adminModels.filter(m => m.visible), [adminModels]);

  /**
   * 把可见模型按"厂商"分组：
   *   - 普通厂商：按 provider 分组，组 key = provider，组 label = 同 provider 第一条 name
   *   - 自定义模型（provider === __custom__）：聚合到单一"自定义模型"组下，每条作为一个版本
   * 厂商一级显示顺序：先按出现顺序，自定义模型组始终放最后。
   */
  interface ProviderGroup {
    key: string;           // provider 值；自定义模型组固定为 __custom__
    label: string;         // 一级 Select 显示文本
    models: ModelRow[];    // 该厂商下所有可见模型记录
    isCustom: boolean;
  }

  const providerGroups = useMemo<ProviderGroup[]>(() => {
    const orderedKeys: string[] = [];
    const buckets = new Map<string, ModelRow[]>();
    for (const m of visibleAdminModels) {
      const key = m.provider;
      if (!buckets.has(key)) {
        buckets.set(key, []);
        orderedKeys.push(key);
      }
      buckets.get(key)!.push(m);
    }
    const groups: ProviderGroup[] = [];
    let customGroup: ProviderGroup | null = null;
    for (const key of orderedKeys) {
      const models = buckets.get(key)!;
      if (key === CUSTOM_PROVIDER_VALUE) {
        customGroup = {
          key,
          label: "自定义模型",
          models,
          isCustom: true,
        };
      } else {
        groups.push({
          key,
          // 同 provider 的多条记录 name 理论上一致，取第一条
          label: models[0].name,
          models,
          isCustom: false,
        });
      }
    }
    if (customGroup) groups.push(customGroup);
    return groups;
  }, [visibleAdminModels]);

  // ── 模型编辑态 ───────────────────────────────────────────────────────────
  /**
   * 模型编辑上下文：
   * - idle：未进入编辑态
   * - add：点击右上角"添加备选/设为主模型"按钮 → 底部 inline 新增卡
   * - replace：点击某条模型行的 ✏️ → 底部 inline 卡用于替换该条
   */
  type ModelActionContext =
    | { kind: "idle" }
    | { kind: "add" }
    | { kind: "replace"; modelEntryId: number };
  const [modelAction, setModelAction] = useState<ModelActionContext>({ kind: "idle" });
  const modelEditing = modelAction.kind !== "idle";

  /** 一级草稿：厂商 key（即 provider 值） */
  const [modelDraftProvider, setModelDraftProvider] = useState<string>("");
  /** 二级草稿：具体模型记录 id */
  const [modelDraftModelId, setModelDraftModelId] = useState<string>("");

  /** 模型操作二次确认弹窗（复用用户端三种类型） */
  const [modelConfirmDialog, setModelConfirmDialog] = useState<{
    open: boolean;
    type: "set-primary" | "delete" | "delete-backup";
    modelEntryId: number | null;
  }>({ open: false, type: "set-primary", modelEntryId: null });

  /** 把一个管控端 ModelRow + 其所在组转换成 AppliedModelItem 的展示字段 */
  const toAppliedModelFields = (
    group: ProviderGroup,
    model: ModelRow,
  ): Pick<AppliedModelItem, "modelConfigId" | "providerLabel" | "versionLabel" | "isCustom"> => ({
    modelConfigId: model.id,
    providerLabel: group.label,
    // 自定义模型：一级展示"自定义模型"，二级用模型 name；普通模型二级用 version
    versionLabel: group.isCustom ? model.name : model.version,
    isCustom: group.isCustom,
  });

  /** 进入"添加"模式：默认草稿回填首组首项 */
  const startAddModel = () => {
    if (providerGroups.length === 0) {
      setModelDraftProvider("");
      setModelDraftModelId("");
      setModelAction({ kind: "add" });
      return;
    }
    const g0 = providerGroups[0];
    setModelDraftProvider(g0.key);
    setModelDraftModelId(g0.models[0]?.id ?? "");
    setModelAction({ kind: "add" });
  };

  /** 进入"替换"模式：按被替换条目当前的 modelConfigId 回填；找不到则回退首组首项 */
  const startReplaceModel = (entry: AppliedModelItem) => {
    if (providerGroups.length === 0) {
      setModelDraftProvider("");
      setModelDraftModelId("");
      setModelAction({ kind: "replace", modelEntryId: entry.id });
      return;
    }
    let targetGroup: ProviderGroup | undefined;
    let targetModel: ModelRow | undefined;
    for (const g of providerGroups) {
      const m = g.models.find(x => x.id === entry.modelConfigId);
      if (m) { targetGroup = g; targetModel = m; break; }
    }
    if (!targetGroup || !targetModel) {
      targetGroup = providerGroups[0];
      targetModel = targetGroup.models[0];
    }
    setModelDraftProvider(targetGroup.key);
    setModelDraftModelId(targetModel.id);
    setModelAction({ kind: "replace", modelEntryId: entry.id });
  };

  const cancelEditModel = () => setModelAction({ kind: "idle" });

  const saveEditModel = () => {
    if (!selectedClaw) return;
    const group = providerGroups.find(g => g.key === modelDraftProvider);
    const model = group?.models.find(m => m.id === modelDraftModelId);
    if (!group || !model) {
      toast.error("请选择有效的模型厂商和版本");
      return;
    }
    const fields = toAppliedModelFields(group, model);
    const action = modelAction;
    const current = getClawDetail(selectedClaw.id);
    const list = current.appliedModels;
    // 重复校验：同一条模型配置不可重复添加（替换时允许命中自己）
    const dupe = list.find(m => m.modelConfigId === fields.modelConfigId
      && !(action.kind === "replace" && m.id === action.modelEntryId));
    if (dupe) {
      toast.error("该模型已在列表中，请勿重复添加");
      return;
    }
    const hadPrimaryBefore = list.some(m => m.primary);
    updateClawDetail(selectedClaw.id, prev => {
      if (action.kind === "add") {
        const hasPrimary = prev.appliedModels.some(m => m.primary);
        const newEntry: AppliedModelItem = {
          id: nextModelEntryId(prev.appliedModels),
          ...fields,
          // 无主模型时新加的直接成为主模型；否则作为备选
          primary: !hasPrimary,
          addedAt: Date.now(),
        };
        return { ...prev, appliedModels: [...prev.appliedModels, newEntry] };
      }
      if (action.kind === "replace") {
        return {
          ...prev,
          appliedModels: prev.appliedModels.map(m => m.id === action.modelEntryId
            ? { ...m, ...fields }
            : m),
        };
      }
      return prev;
    });
    const _isOpenClawSave = selectedClaw?.agentType === 'OpenClaw';
    if (action.kind === "add") {
      toast.success(hadPrimaryBefore ? "备选模型已添加" : (_isOpenClawSave ? "已设为主模型" : "模型已添加成功"));
    } else {
      toast.success("模型已更新");
    }
    setModelAction({ kind: "idle" });
  };

  /** 切换一级厂商时，把二级草稿重置为该厂商的第一项 */
  const handleDraftProviderChange = (value: string) => {
    setModelDraftProvider(value);
    const group = providerGroups.find(g => g.key === value);
    if (group && group.models.length > 0) {
      setModelDraftModelId(group.models[0].id);
    } else {
      setModelDraftModelId("");
    }
  };

  /** 确认二次确认 Dialog 的操作 */
  const runModelConfirm = () => {
    if (!selectedClaw) return;
    const { type, modelEntryId } = modelConfirmDialog;
    if (modelEntryId === null) {
      setModelConfirmDialog(prev => ({ ...prev, open: false }));
      return;
    }
    updateClawDetail(selectedClaw.id, prev => {
      const list = prev.appliedModels;
      if (type === "set-primary") {
        return {
          ...prev,
          appliedModels: list.map(m => ({ ...m, primary: m.id === modelEntryId })),
        };
      }
      if (type === "delete-backup") {
        return { ...prev, appliedModels: list.filter(m => m.id !== modelEntryId) };
      }
      // type === "delete" (主模型)：删除后首条备选自动升主
      const next = list.filter(m => m.id !== modelEntryId);
      const wasPrimary = list.find(m => m.id === modelEntryId)?.primary ?? false;
      if (wasPrimary && next.length > 0 && !next.some(m => m.primary)) {
        next[0] = { ...next[0], primary: true };
      }
      return { ...prev, appliedModels: next };
    });
    setModelConfirmDialog(prev => ({ ...prev, open: false }));
    // 如果当前正在替换的正是被删除的这条，取消编辑态
    if (modelAction.kind === "replace" && modelAction.modelEntryId === modelEntryId) {
      setModelAction({ kind: "idle" });
    }
    const _isOpenClaw = selectedClaw?.agentType === 'OpenClaw';
    if (type === "set-primary") toast.success("已设为主模型");
    else if (type === "delete-backup") toast.success("备选模型已删除");
    else toast.success(_isOpenClaw ? "主模型已删除，已自动升级备选模型" : "模型删除成功");
  };

  // ── 通道编辑态 ───────────────────────────────────────────────────────────
  /** 是否处于"新增通道"模式（展示底部 inline 选择条） */
  const [channelAdding, setChannelAdding] = useState(false);
  const [channelDraft, setChannelDraft] = useState<string>("");
  /** 新增通道时正在录入的凭证字段值 */
  const [channelDraftFields, setChannelDraftFields] = useState<Record<string, string>>({});
  /** 待移除的通道 name（触发 AlertDialog 二次确认） */
  const [channelRemoveTarget, setChannelRemoveTarget] = useState<string | null>(null);
  /** 当前展开查看/编辑凭证的通道 name（null 表示全部收起） */
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  /** 当前展开通道的编辑草稿值；null 表示未进入编辑态（只读查看） */
  const [channelEditDraft, setChannelEditDraft] = useState<Record<string, string> | null>(null);
  /** 密码字段可见性：用 "channelName:fieldKey" 作为 key */
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const toggleSecretVisibility = (channelName: string, fieldKey: string) => {
    const key = `${channelName}:${fieldKey}`;
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSecretVisible = (channelName: string, fieldKey: string): boolean => {
    return visibleSecrets.has(`${channelName}:${fieldKey}`);
  };

  /** 加密显示：保留前 3 字符，后面用 •••••• 替代 */
  const maskSecret = (val: string): string => {
    if (!val) return "—";
    if (val.length <= 3) return val;
    return val.slice(0, 3) + "••••••";
  };

  // ── 订阅"通道配置"页的可见性数据 ─────────────────────────────────────────
  const [builtinChannelVisibility, setBuiltinChannelVisibility] = useState<Record<string, boolean>>(
    () => loadBuiltinChannelVisibility(),
  );
  useEffect(() => {
    return onBuiltinChannelVisibilityChange(() => {
      setBuiltinChannelVisibility(loadBuiltinChannelVisibility());
    });
  }, []);

  const [visibleCustomChannels, setVisibleCustomChannels] = useState<AdminCustomChannel[]>(
    () => loadVisibleCustomChannels(),
  );
  useEffect(() => {
    return onCustomChannelsChange(() => {
      setVisibleCustomChannels(loadVisibleCustomChannels());
    });
  }, []);

  /**
   * 用户/Agent 可见的通道列表（内置 + 自定义）。
   *   - 内置通道：用 builtinId 或 value 查 builtinChannelVisibility，缺省按 true 处理
   *   - 自定义通道：来自管控端"通道配置"页，且 visible=true（loadVisibleCustomChannels 已过滤）
   */
  const availableChannelOptions = useMemo<ChannelConfig[]>(() => {
    const builtins = CHANNEL_OPTIONS.filter((ch) => {
      const key = ch.builtinId ?? ch.value;
      return builtinChannelVisibility[key] !== false;
    });
    const customs: ChannelConfig[] = visibleCustomChannels.map((cc) => ({
      value: `admin_custom_${cc.id}`,
      label: cc.name,
      descText: `企业自定义通道（Channel ID: ${cc.channelId}）`,
      detailUrl: "#",
      adminCustomMode: true as const,
      adminCustomId: cc.id,
      fields: cc.credentialFields.map((f) => ({
        key: f.key || f.id,
        label: f.label,
        secret: true,
      })),
    }));
    return [...builtins, ...customs];
  }, [builtinChannelVisibility, visibleCustomChannels]);

  /**
   * 通道反查表：用 channel.value 查 ChannelConfig（含 fields 定义）
   * - 内置通道：6 个全集（包括当前不可见的，避免已添加通道行失去字段定义）
   * - 自定义通道：所有"可见"的（loadVisibleCustomChannels 已过滤；不可见的暂不反查）
   * 注：现实场景中，自定义通道一旦被删除，已添加到 Agent 的同名通道将无 fields 元数据。
   */
  const channelLookup = useMemo<Map<string, ChannelConfig>>(() => {
    const map = new Map<string, ChannelConfig>();
    for (const ch of CHANNEL_OPTIONS) map.set(ch.value, ch);
    for (const ch of availableChannelOptions) {
      if (ch.adminCustomMode) map.set(ch.value, ch);
    }
    return map;
  }, [availableChannelOptions]);

  const startAddChannel = (detail: ClawDetail) => {
    // 默认选中第一个尚未被添加的通道；全部已添加时留空
    const existing = new Set(detail.connectedChannels.map(c => c.name));
    const firstAvailable = availableChannelOptions.find(c => !existing.has(c.label));
    setChannelDraft(firstAvailable?.value ?? "");
    setChannelDraftFields({});
    setChannelAdding(true);
    setExpandedChannel(null); // 收起已展开的通道，避免视觉混乱
    setChannelEditDraft(null);
  };

  const cancelAddChannel = () => {
    setChannelAdding(false);
    setChannelDraft("");
    setChannelDraftFields({});
  };

  /** 切换新增草稿中选择的通道 */
  const handleChannelDraftChange = (value: string) => {
    setChannelDraft(value);
    setChannelDraftFields({});
  };

  const confirmAddChannel = () => {
    if (!selectedClaw) return;
    const ch = availableChannelOptions.find(c => c.value === channelDraft);
    if (!ch) {
      toast.error("请选择要添加的通道");
      return;
    }
    const detail = getClawDetail(selectedClaw.id);
    if (detail.connectedChannels.some(c => c.name === ch.label)) {
      toast.error(`「${ch.label}」已添加，请勿重复`);
      return;
    }
    // 校验 fields（如有）必须填齐
    const requiredFields = ch.fields ?? [];
    const missing = requiredFields.find(f => !(channelDraftFields[f.key] ?? "").trim());
    if (missing) {
      toast.error(`请填写「${missing.label}」`);
      return;
    }
    updateClawDetail(selectedClaw.id, prev => ({
      ...prev,
      connectedChannels: [
        ...prev.connectedChannels,
        {
          name: ch.label,
          value: ch.value,
          fieldValues: { ...channelDraftFields },
          bots: [],
        },
      ],
    }));
    setChannelAdding(false);
    setChannelDraft("");
    setChannelDraftFields({});
    toast.success(`已添加通道「${ch.label}」`);
  };

  const confirmRemoveChannel = () => {
    if (!selectedClaw || !channelRemoveTarget) return;
    const targetName = channelRemoveTarget;
    updateClawDetail(selectedClaw.id, prev => ({
      ...prev,
      connectedChannels: prev.connectedChannels.filter(c => c.name !== targetName),
    }));
    // 如果被删除的通道正展开，顺手收起
    if (expandedChannel === targetName) {
      setExpandedChannel(null);
      setChannelEditDraft(null);
    }
    setChannelRemoveTarget(null);
    toast.success(`已移除通道「${targetName}」`);
  };

  /** 展开/收起某个通道的凭证展示区（同一时刻只展开一个） */
  const toggleExpandChannel = (channel: ConnectedChannel) => {
    if (expandedChannel === channel.name) {
      setExpandedChannel(null);
      setChannelEditDraft(null);
    } else {
      setExpandedChannel(channel.name);
      setChannelEditDraft(null); // 默认进入只读查看态
    }
  };

  /** 进入某个已接入通道的编辑态（只读 → 编辑） */
  const startEditChannel = (channel: ConnectedChannel) => {
    setExpandedChannel(channel.name);
    setChannelEditDraft({ ...channel.fieldValues });
  };

  const cancelEditChannel = () => {
    setChannelEditDraft(null);
  };

  const saveEditChannel = (channel: ConnectedChannel) => {
    if (!selectedClaw || !channelEditDraft) return;
    const chConfig = channelLookup.get(channel.value);
    const requiredFields = chConfig?.fields ?? [];
    const missing = requiredFields.find(f => !(channelEditDraft[f.key] ?? "").trim());
    if (missing) {
      toast.error(`请填写「${missing.label}」`);
      return;
    }
    updateClawDetail(selectedClaw.id, prev => ({
      ...prev,
      connectedChannels: prev.connectedChannels.map(c =>
        c.name === channel.name ? { ...c, fieldValues: { ...channelEditDraft } } : c,
      ),
    }));
    setChannelEditDraft(null);
    toast.success(`「${channel.name}」凭证已更新`);
  };

  const handleOpenDrawer = (claw: Claw) => {
    setSelectedClaw(claw);
    setShowDetailDrawer(true);
    // 切换实例时重置所有编辑态，避免上一个实例残留
    setModelAction({ kind: "idle" });
    setModelConfirmDialog({ open: false, type: "set-primary", modelEntryId: null });
    setChannelAdding(false);
    setChannelDraft("");
    setChannelDraftFields({});
    setExpandedChannel(null);
    setChannelEditDraft(null);
    setVisibleSecrets(new Set());
  };

  const handleRefreshDrawer = () => {
    if (!selectedClaw) return;
    setDrawerLoading(true);
    setTimeout(() => {
      setDrawerLoading(false);
      toast.success("信息已刷新");
    }, 1500);
  };

  const handleOpenMonitor = (claw: Claw) => {
    setSelectedClaw(claw);
    setShowMonitorDrawer(true);
  };

  const isStatusDisabled = (status: ClawStatus): boolean => {
    const available = getAvailableStatuses();
    return !available.includes(status);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="page-enter min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent 列表</h1>
            <p className="text-sm text-gray-500 mt-1">查看和管理所有企业用户创建的 Agent 云服务器。</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors whitespace-nowrap"
              >
                清除筛选
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50 shrink-0"
              title="刷新列表"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 状态统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* 总数 */}
          <button
            onClick={() => handleCardFilterChange("all")}
            className={`bg-white rounded-[4px] border p-4 transition-all text-left ${
              activeCardFilter === "all"
                ? "border-blue-300 ring-1 ring-blue-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400">总数</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </button>

          {/* 运行中 */}
          <button
            onClick={() => handleCardFilterChange("running")}
            className={`bg-white rounded-[4px] border p-4 transition-all text-left ${
              activeCardFilter === "running"
                ? "border-green-300 ring-1 ring-green-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400">运行中</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{runningCount}</p>
          </button>

          {/* 已关机 */}
          <button
            onClick={() => handleCardFilterChange("shutdown")}
            className={`bg-white rounded-[4px] border p-4 transition-all text-left ${
              activeCardFilter === "shutdown"
                ? "border-gray-400 ring-1 ring-gray-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                <PowerOff className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400">已关机</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{shutdownCount}</p>
          </button>

          {/* 其他 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleCardFilterChange("other")}
                className={`bg-white rounded-[4px] border p-4 transition-all text-left ${
                  activeCardFilter === "other"
                    ? "border-orange-300 ring-1 ring-orange-200"
                    : "border-gray-100 hover:border-gray-200"
                }`}
                style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                    <HelpCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-xs text-gray-400">其他</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{otherCount}</p>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 w-fit bg-white border border-gray-100 shadow-lg" style={{ color: 'inherit' }}>
              <div className="space-y-2.5">
                <div>
                  <p className="text-xs font-semibold text-orange-500 mb-1.5">⚠ 需关注</p>
                  <div className="flex gap-1">
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-red-50 text-red-700 whitespace-nowrap">创建失败</span>
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-red-50 text-red-700 whitespace-nowrap">加载失败</span>
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 whitespace-nowrap">维护中</span>
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 whitespace-nowrap">待处理</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">◎ 处理中</p>
                  <div className="flex gap-1">
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 whitespace-nowrap">创建中</span>
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 whitespace-nowrap">加载中</span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 表格卡片 */}
        <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
          style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>

          {/* 工具栏 */}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* 搜索框 */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索名称、ID 或创建人"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 bg-gray-50 border-gray-200 h-9"
                />
              </div>
            </div>
            {/* 批量更新按鈕 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    onClick={() => !batchDisabled && setShowBatchUpgradeDialog(true)}
                    disabled={batchDisabled}
                    className="px-3 gap-1.5"
                  >
                    <CircleArrowUp className="w-3.5 h-3.5" />
                    批量更新
                    {selectedCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded text-xs">{selectedCount}</span>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {batchDisabled && batchTooltip && (
                <TooltipContent side="bottom" className="text-xs">{batchTooltip}</TooltipContent>
              )}
            </Tooltip>
            {/* 批量删除按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    onClick={() => {
                      if (selectedCount > 0 && !batchDeleteDisabled) {
                        const names = selectedClaws.map(c => c.name).join("、");
                        if (window.confirm(`确认删除选中的 ${selectedCount} 个实例？\n\n${names}\n\n删除后无法恢复。`)) {
                          setClaws(prev => prev.filter(c => !selectedIds.has(c.id)));
                          setSelectedIds(new Set());
                          toast.success(`已删除 ${selectedCount} 个实例`);
                        }
                      }
                    }}
                    disabled={batchDeleteDisabled}
                    variant="outline"
                    className={`rounded-[4px] text-sm font-medium px-3 h-9 gap-1.5 transition-all ${
                      batchDeleteDisabled ? "text-gray-400 cursor-not-allowed" : "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    批量删除
                    {selectedCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs">{selectedCount}</span>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {batchDeleteDisabled && selectedCount === 0 && (
                <TooltipContent side="bottom" className="text-xs">请先选择实例</TooltipContent>
              )}
            </Tooltip>
            <button
              onClick={() => { setPendingTags([...selectedTags]); setAddingKey(''); setAddingValue(''); setKeySearchText(''); setShowTagConfigDialog(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-[4px] hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              配置默认标签
            </button>
            {/* 智能体迁移按鈕 */}
            <Link href="/admin/agent-migration">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-[4px] hover:bg-gray-50 hover:border-gray-300 transition-colors">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                智能体迁移
              </button>
            </Link>
          </div>

          <div className="overflow-x-auto" ref={tableScrollRef}>
          <table className="text-sm" style={{ width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                {/* 复选框列 - sticky left */}
                <th className="py-3 whitespace-nowrap sticky left-0 z-50 relative" style={{ width: '56px', minWidth: '56px', paddingLeft: '12px', paddingRight: '8px', backgroundColor: '#f9fafb' }}>
                  {isTableScrolled && (
                    <>
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200" />
                      <div className="absolute top-0 bottom-0" style={{ right: '-6px', width: '6px', background: 'linear-gradient(to left, transparent, rgba(0,0,0,0.04))' }} />
                    </>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                      onCheckedChange={(v) => handleSelectAll(!!v)}
                      className="size-4 border border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=indeterminate]:bg-blue-500 data-[state=indeterminate]:border-blue-500"
                    />
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">全选</span>
                  </div>
                </th>
                <th className="text-left pr-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '240px', paddingLeft: '4px' }}>名称 / ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '120px' }}>
                  <div className="flex items-center gap-2 relative z-40">
                    当前状态
                    <button
                      ref={filterButtonRef}
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={() => {
                        if (filterButtonRef.current) {
                          const rect = filterButtonRef.current.getBoundingClientRect();
                          setFilterPosition({
                            top: rect.bottom + 4,
                            left: rect.left
                          });
                        }
                        setShowStatusFilter(!showStatusFilter);
                      }}
                    >
                      <Filter className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {showStatusFilter && filterPosition && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowStatusFilter(false)}
                          style={{ pointerEvents: 'auto' }}
                        />
                        <div 
                          className="fixed w-56 bg-white border border-gray-200 rounded-[4px] shadow-2xl z-50 will-change-transform" 
                          style={{
                            top: `${filterPosition.top}px`,
                            left: `${filterPosition.left}px`,
                            pointerEvents: 'auto'
                          }}
                        >
                          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                            {["creating", "createFail", "running", "loading", "loadFail", "shutdown", "maintaining", "pending"].map((status) => (
                              <label key={status} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={selectedStatuses.has(status as ClawStatus)}
                                  onCheckedChange={(checked) => handleStatusFilterChange(status as ClawStatus, !!checked)}
                                  disabled={isStatusDisabled(status as ClawStatus)}
                                />
                                <span className={`text-sm ${isStatusDisabled(status as ClawStatus) ? "text-gray-300" : "text-gray-700"}`}>
                                  {STATUS_CONFIG[status as ClawStatus].label}
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="border-t border-gray-100 p-2 flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleStatusFilterReset} className="flex-1">
                              重置
                            </Button>
                            <Button size="sm" onClick={handleStatusFilterConfirm} className="flex-1">
                              确认
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ width: '208px', minWidth: '160px', maxWidth: '208px' }}>创建人</th>
                {hasOneid && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ width: 200, maxWidth: 200 }}>
                    <Popover open={deptColFilterOpen} onOpenChange={setDeptColFilterOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 group/dept">
                          <span>部门</span>
                          <Filter className={`w-3.5 h-3.5 transition-colors ${departmentFilter ? 'text-blue-500' : 'text-gray-400 group-hover/dept:text-gray-600'}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start" side="bottom">
                        <DepartmentColumnFilter
                          departments={MOCK_DEPARTMENTS}
                          value={departmentFilter}
                          onConfirm={(v) => { setDepartmentFilter(v); setPage(1); setDeptColFilterOpen(false); }}
                          onCancel={() => setDeptColFilterOpen(false)}
                        />
                      </PopoverContent>
                    </Popover>
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ width: 200, maxWidth: 200 }}>
                  <Popover open={groupColFilterOpen} onOpenChange={setGroupColFilterOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 group/grp">
                        <span>分组</span>
                        <Filter className={`w-3.5 h-3.5 transition-colors ${groupFilter ? 'text-blue-500' : 'text-gray-400 group-hover/grp:text-gray-600'}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start" side="bottom">
                      <GroupColumnFilter
                        groups={hasOneid ? MOCK_GROUPS : MOCK_MANUAL_GROUPS}
                        value={groupFilter}
                        hasOneid={hasOneid}
                        onConfirm={(v) => { setGroupFilter(v); setPage(1); setGroupColFilterOpen(false); }}
                        onCancel={() => setGroupColFilterOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '140px' }}>创建时间</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 normal-case whitespace-nowrap" style={{ minWidth: '130px' }}>
                  <Popover open={typeColFilterOpen} onOpenChange={(open) => {
                    setTypeColFilterOpen(open);
                    if (open) setTempTypeFilter(new Set(agentTypeFilter));
                  }}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 group/type">
                        <span>Agent类型</span>
                        <Filter className={`w-3.5 h-3.5 transition-colors ${agentTypeFilter.size > 0 && agentTypeFilter.size < ALL_AGENT_TYPES.length ? 'text-blue-500' : 'text-gray-400 group-hover/type:text-gray-600'}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start" side="bottom">
                      <div className="p-3 space-y-2">
                        {Object.entries(AGENT_TYPE_DISPLAY).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={tempTypeFilter.has(key)}
                              onCheckedChange={(checked) => {
                                setTempTypeFilter(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(key); else next.delete(key);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm text-gray-700">{label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 p-2 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                          setTempTypeFilter(new Set(ALL_AGENT_TYPES));
                          setAgentTypeFilter(new Set(ALL_AGENT_TYPES));
                          setPage(1);
                          setTypeColFilterOpen(false);
                        }}>重置</Button>
                        <Button size="sm" className="flex-1" onClick={() => {
                          setAgentTypeFilter(new Set(tempTypeFilter));
                          setPage(1);
                          setTypeColFilterOpen(false);
                        }}>确认</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 normal-case whitespace-nowrap" style={{ minWidth: '100px' }}>Agent 版本</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '60px' }}>标签</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap sticky right-0 z-50 relative" style={{ width: '160px', minWidth: '160px', backgroundColor: '#f9fafb' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="absolute top-0 bottom-0" style={{ left: '-6px', width: '6px', background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.04))' }} />
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={hasOneid ? 13 : 12} className="px-6 py-12 text-center text-sm text-gray-400">
                    暂无符合条件的 Agent
                  </td>
                </tr>
              ) : (
                paginated.map((claw) => {
                  const isRunning = claw.status === "running";
                  const statusConfig = STATUS_CONFIG[claw.status];

                  const upgradable = isUpgradable(claw);
                  // 所有状态均可勾选，不再禁用复选框
                  const checkboxDisabled = false;
                  const checkboxTooltip = "";

                  return (
                    <tr key={claw.id} className="group hover:bg-gray-50/50 transition-colors">
                      {/* 复选框 */}
                      <td className="py-4 whitespace-nowrap sticky left-0 z-50 bg-white group-hover:bg-gray-50 transition-colors relative" style={{ width: '56px', minWidth: '56px', paddingLeft: '12px', paddingRight: '8px' }}>
                        {isTableScrolled && (
                          <>
                            <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200" />
                            <div className="absolute top-0 bottom-0" style={{ right: '-6px', width: '6px', background: 'linear-gradient(to left, transparent, rgba(0,0,0,0.04))' }} />
                          </>
                        )}
                        <Checkbox
                          checked={selectedIds.has(claw.id)}
                          onCheckedChange={(v) => handleSelectOne(claw.id, !!v)}
                          className="size-4 border border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                      </td>
                      {/* 名称/ID */}
                      <td className="pr-4 py-4" style={{ paddingLeft: '4px', width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{claw.name}</div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-xs break-all">{claw.name}</TooltipContent>
                            </Tooltip>
                            <button
                              onClick={() => handleOpenDrawer(claw)}
                              className="text-xs font-mono cursor-pointer text-blue-500 hover:text-blue-700 hover:underline"
                            >
                              {claw.instanceId}
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* 状态列 */}
                      <td className="px-4 py-4">
                        <span className={`${statusConfig.badgeClass} text-xs`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      {/* 创建人 */}
                      <td className="px-4 py-4 text-sm text-gray-500" style={{ maxWidth: '208px' }}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate cursor-default">{claw.creator}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start">
                            <span className="text-xs">{claw.creator}</span>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {/* 部门 - 仅 OneID 模式显示 */}
                      {hasOneid && (
                        <td className="px-4 py-4">
                          {(() => {
                            const deptPaths = getCreatorDeptPaths(claw.creator);
                            if (deptPaths.length === 0) return <span className="text-sm text-gray-300">—</span>;
                            if (deptPaths.length === 1) {
                              return (
                                <span className="text-sm text-gray-600 truncate block max-w-[200px]" title={deptPaths[0].path}>
                                  {deptPaths[0].path}
                                </span>
                              );
                            }
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 max-w-[200px] cursor-default">
                                    <span className="text-sm text-gray-600 truncate">{deptPaths[0].path}</span>
                                    <span className="text-xs text-gray-400 tabular-nums shrink-0">+{deptPaths.length - 1}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start" className="max-w-[360px] p-0">
                                  <div className="py-2">
                                    {deptPaths.map((dp, idx) => (
                                      <div key={idx} className="px-3 py-1.5 text-sm">
                                        <span className="text-gray-200 mr-1">{idx + 1}.</span>
                                        <span className="text-white">{dp.path}</span>
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
                            );
                          })()}
                        </td>
                      )}
                      {/* 分组 */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {(() => {
                          if (hasOneid) {
                            const item = getCreatorGroupItemOneid(claw.creator);
                            if (!item) return <span className="text-sm text-gray-300">—</span>;
                            return (
                              <div className="flex items-center gap-1 max-w-[200px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="badge-shutdown max-w-[160px] truncate inline-block align-middle cursor-default">
                                      {item.path}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start" className="max-w-[380px] p-0">
                                    <div className="py-2">
                                      <div className="px-3 py-1.5 text-sm flex items-center gap-2">
                                        <span className={`inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 ${
                                          item.kind === "oneid-dept"
                                            ? "text-blue-400 bg-blue-500/20"
                                            : "text-purple-400 bg-purple-500/20"
                                        }`}>
                                          {item.kind === "oneid-dept" ? "部门" : "自定义分组"}
                                        </span>
                                        <span className="text-white">{item.path}</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          } else {
                            const item = getCreatorGroupItemManual(claw.creator);
                            if (!item) return <span className="text-sm text-gray-300">—</span>;
                            return (
                              <div className="flex items-center gap-1 max-w-[200px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="badge-shutdown max-w-[160px] truncate inline-block align-middle cursor-default">
                                      {item.path}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start" className="max-w-[380px] p-0">
                                    <div className="py-2">
                                      <div className="px-3 py-1.5 text-sm">
                                        <span className="text-white">{item.path}</span>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          }
                        })()}
                      </td>
                      {/* 创建时间 */}
                      <td className="px-4 py-4 text-sm whitespace-nowrap text-gray-500">{claw.createTime}</td>
                      {/* 智能体 */}
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-gray-500">{AGENT_TYPE_DISPLAY[claw.agentType] ?? claw.agentType}</span>
                      </td>
                      {/* Agent 版本 */}
                      <td className="px-4 py-4">
                        <span className="text-xs font-mono text-gray-500">{claw.version}</span>
                      </td>
                      {/* 标签 */}
                      <td className="px-4 py-4">
                        {claw.tags && claw.tags.length > 0 ? (
                          <HoverCard openDelay={100} closeDelay={150}>
                            <HoverCardTrigger asChild>
                              <button className="inline-flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" align="center" className="p-0 w-56 bg-white border border-gray-200 shadow-lg rounded-[4px] overflow-hidden">
                              <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-100 px-3 py-2">
                                <span className="text-xs font-semibold text-gray-600">标签键</span>
                                <span className="text-xs font-semibold text-gray-600">标签値</span>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {claw.tags.map((tag, i) => (
                                  <div key={i} className="grid grid-cols-2 px-3 py-2 gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-gray-600 truncate block max-w-full cursor-default">{tag.key}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left"><span>{tag.key}</span></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-gray-500 truncate block max-w-full cursor-default">{tag.value}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="right"><span>{tag.value}</span></TooltipContent>
                                    </Tooltip>
                                  </div>
                                ))}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                        )}
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-4 sticky right-0 z-50 bg-white group-hover:bg-gray-50 transition-colors relative" style={{ minWidth: '160px' }}>
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                        <div className="absolute top-0 bottom-0" style={{ left: '-6px', width: '6px', background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.04))' }} />
                        <div className="flex items-center gap-3 h-5 whitespace-nowrap">
                          {/* 终端 */}
                          {!isRunning ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-xs text-gray-300 cursor-not-allowed leading-none whitespace-nowrap">
                                  <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
                                  终端
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                仅运行中的实例可进入终端
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 leading-none whitespace-nowrap"
                              onClick={() => handleOpenTerminal(claw)}
                            >
                              <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
                              终端
                            </button>
                          )}

                          {/* 关机/开机 */}
                          {claw.status === "running" ? (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 leading-none whitespace-nowrap"
                              onClick={() => setShutdownTarget(claw.id)}
                            >
                              <Power className="w-3.5 h-3.5 flex-shrink-0" />
                              关机
                            </button>
                          ) : claw.status === "shutdown" ? (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 leading-none whitespace-nowrap"
                              onClick={() => setShutdownTarget(claw.id)}
                            >
                              <Power className="w-3.5 h-3.5 flex-shrink-0" />
                              开机
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-300 leading-none whitespace-nowrap">
                              <Power className="w-3.5 h-3.5 flex-shrink-0" />
                              开机
                            </span>
                          )}

                          {/* 删除 */}
                          {["creating", "loading", "pending"].includes(claw.status) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-xs text-gray-300 cursor-not-allowed leading-none whitespace-nowrap">
                                  <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                                  删除
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                当前状态不可删除
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 leading-none whitespace-nowrap"
                              onClick={() => handleDeleteClick(claw)}
                            >
                              <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                              删除
                            </button>
                          )}

                          {/* 更多操作 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex items-center text-xs text-gray-400 hover:text-gray-600 leading-none">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                className={`text-xs focus:bg-gray-50 cursor-pointer ${isRunning ? "text-gray-500 focus:text-gray-700" : "text-gray-400 opacity-40 cursor-not-allowed"}`}
                                disabled={!isRunning}
                                onClick={() => handleRestart(claw)}
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                重启
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className={`text-xs focus:bg-gray-50 cursor-pointer ${["running", "shutdown"].includes(claw.status) ? "text-gray-500 focus:text-gray-700" : "text-gray-400 opacity-40 cursor-not-allowed"}`}
                                disabled={!["running", "shutdown"].includes(claw.status)}
                                onClick={() => handleReinstallClick(claw)}
                              >
                                <HardDriveDownload className="w-3.5 h-3.5 mr-2" />
                                重新安装 Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs text-gray-500 focus:text-gray-700 focus:bg-gray-50 cursor-pointer"
                                onClick={() => handleOpenMonitor(claw)}
                              >
                                <Activity className="w-3.5 h-3.5 mr-2" />
                                监控
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">共 {versionFiltered.length} 条记录，第 {safePage}/{totalPages} 页</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}
                  className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
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
                      <span key={`ellipsis-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`h-7 w-7 rounded-[4px] text-xs font-medium transition-colors border ${p === safePage ? "text-white border-blue-500" : "text-gray-600 border-gray-200 bg-white hover:border-gray-300"}`}
                        style={p === safePage ? { background: "#1447E6" } : undefined}
                        onClick={() => setPage(p as number)}
                      >{p}</button>
                    )
                  );
                })()}
                <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}
                  className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 关机/开机确认弹窗 */}
      <Dialog open={!!shutdownTarget} onOpenChange={() => setShutdownTarget(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {claws.find(c => c.id === shutdownTarget)?.status === "running" ? "确认关机" : "确认开机"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 leading-relaxed">
            {claws.find(c => c.id === shutdownTarget)?.status === "running"
              ? <>关机后该 Agent「{claws.find(c => c.id === shutdownTarget)?.name}」将无法使用，直到重新开机。确认关机吗？</>
              : <>开机后该 Agent「{claws.find(c => c.id === shutdownTarget)?.name}」将重新运行。确认开机吗？</>}
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShutdownTarget(null)}>取消</Button>
            {claws.find(c => c.id === shutdownTarget)?.status === "running"
              ? <Button onClick={confirmShutdown} className="bg-orange-500 hover:bg-orange-600 text-white">确认关机</Button>
              : <Button onClick={confirmShutdown} className="bg-green-600 hover:bg-green-700 text-white">确认开机</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重新安装确认弹窗 */}
      <Dialog open={!!reinstallTarget} onOpenChange={() => setReinstallTarget(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">确认重新安装</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 leading-relaxed">
            将使用最新镜像重新安装「{claws.find(c => c.id === reinstallTarget)?.name}」，清除当前所有配置且无法恢复，安装完成后需重新配置模型和通道。
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700">请输入「重装」以确认</label>
            <Input
              value={reinstallInput}
              onChange={(e) => setReinstallInput(e.target.value)}
              placeholder="输入「重装」"
              className="mt-2"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setReinstallTarget(null)}>取消</Button>
            <Button
              onClick={confirmReinstall}
              disabled={reinstallInput !== "重装"}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              确认重新安装
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 leading-relaxed">
            {claws.find(c => c.id === deleteTarget)?.status === "createFail"
              ? `此操作将移除「${claws.find(c => c.id === deleteTarget)?.name}」该创建失败的记录，底层资源将由系统自动回收。`
              : `此操作不可撤销。「${claws.find(c => c.id === deleteTarget)?.name}」实例及相关数据将被永久删除，已配置的模型、通道和插件将全部清除且无法恢复。`}
          </p>
          {claws.find(c => c.id === deleteTarget)?.status === "running" && (
            <div>
              <label className="text-sm font-medium text-gray-700">请输入「删除」以确认</label>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="输入「删除」"
                className="mt-2"
              />
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button
              onClick={confirmDelete}
              disabled={claws.find(c => c.id === deleteTarget)?.status === "running" && deleteInput !== "删除"}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量更新确认弹窗 */}
      <Dialog open={showBatchUpgradeDialog} onOpenChange={setShowBatchUpgradeDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">批量更新</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[4px] px-4 py-3">
            <p>1. 更新版本预计需要 5～10 分钟不等，期间 Agent 实例不可使用。</p>
            <p>2. Agent 版本将会升级至当前生效镜像对应的版本，请先将目标镜像指定为生效状态再执行升级操作。</p>
            <p>3. 更新后模型、通道、技能和记忆，以及用户个人数据均不会丢失。</p>
          </div>
          <p className="text-sm text-gray-600">已选择 <span className="font-semibold text-gray-900">{selectedIds.size}</span> 个实例</p>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-[4px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">实例</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Agent类型</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Agent 版本</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">当前状态</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {claws.filter(c => selectedIds.has(c.id)).map(c => {
                  const sc = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-[4px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white" style={{ fontSize: '10px' }}>C</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{c.instanceId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-500">{AGENT_TYPE_DISPLAY[c.agentType] ?? c.agentType}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-gray-500">{c.version}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`${sc.badgeClass} text-xs inline-flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${sc.dotColor}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setSelectedIds(prev => { const n = new Set(prev); n.delete(c.id); return n; })}
                          className="text-xs text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowBatchUpgradeDialog(false)}>取消</Button>
            <Button onClick={confirmBatchUpgrade}>
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* 批量升级失败结果弹窗 */}
      <Dialog open={showUpgradeResultDialog} onOpenChange={setShowUpgradeResultDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">下发失败提醒</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-[4px] px-4 py-3">
            <p>当前没有生效的 OpenClaw 镜像，以下 agent 无法升级。</p>
            <p>请先前往「镜像管理」页面将目标镜像指定为生效状态。</p>
          </div>
          <p className="text-sm text-gray-600">任务已提交，以下 <span className="font-semibold text-red-600">{upgradeFailedAgents.length}</span> 个实例无法执行</p>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-[4px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">实例</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Agent类型</th>
                   <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">下发失败原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upgradeFailedAgents.map((a, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[4px] bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white" style={{ fontSize: '10px' }}>C</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{a.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{a.instanceId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">{AGENT_TYPE_DISPLAY[a.agentType] ?? a.agentType}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-red-600">当前没有生效的 {AGENT_TYPE_DISPLAY[a.agentType] ?? a.agentType} 镜像</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button onClick={() => setShowUpgradeResultDialog(false)}>
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配置默认标签弹窗 */}
      <Dialog open={showTagConfigDialog} onOpenChange={(open) => { if (!open) { setShowTagConfigDialog(false); setAddingKey(''); setAddingValue(''); setKeySearchText(''); setKeyDropdownOpen(false); setValueDropdownOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-500" />
              配置默认标签
            </DialogTitle>
          </DialogHeader>

          {/* 提示语 */}
          <div className="flex items-start gap-2 px-3 py-3 bg-blue-50 border border-blue-100 rounded-[4px] text-xs text-gray-600">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>当前仅支持使用<a href="https://console.cloud.tencent.com/tag/taglist" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5" onClick={(e) => e.stopPropagation()}>腾讯云控制台</a>已创建的标签。</li>
              <li>将在用户端新建实例时自动配置勾选的标签（仅限新建实例，已创建实例暂不支持绑定标签）。</li>
            </ol>
          </div>

          {/* 已选标签 Tag 列表 */}
          {pendingTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingTags.map((tag) => (
                <Tooltip key={tag.key + ':' + tag.value}>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium max-w-[200px]"
                    >
                      <span className="truncate">{tag.key}：{tag.value}</span>
                      <button
                        className="ml-0.5 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
                        onClick={() => setPendingTags(prev => prev.filter(t => !(t.key === tag.key && t.value === tag.value)))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span>{tag.key}：{tag.value}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {/* 添加标签区域 */}
          <div className="border border-gray-200 rounded-[4px] p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">添加标签</div>
            <div className="flex items-center gap-2">
              {/* 标签键下拉 */}
              <div className="relative flex-1 min-w-0">
                <Popover open={keyDropdownOpen} onOpenChange={setKeyDropdownOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full min-w-0 flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-[4px] bg-white hover:border-gray-300 transition-colors overflow-hidden"
                          onClick={() => { setKeyDropdownOpen(v => !v); setValueDropdownOpen(false); }}
                        >
                          <span className={`truncate min-w-0 flex-1 text-left ${addingKey ? 'text-gray-800' : 'text-gray-400'}`}>{addingKey || '选择标签键'}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    {addingKey && (
                      <TooltipContent side="top">
                        <span>{addingKey}</span>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <PopoverContent className="w-72 p-0" align="start" side="bottom">
                    {/* 搜索框 */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                      <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <input
                        autoFocus
                        className="flex-1 text-sm outline-none placeholder:text-gray-400"
                        placeholder="搜索标签键..."
                        value={keySearchText}
                        onChange={(e) => setKeySearchText(e.target.value)}
                      />
                    </div>
                    {/* 标签键列表 */}
                    <div className="max-h-52 overflow-y-auto py-1" onWheel={(e) => e.stopPropagation()}>
                      {DEMO_TAG_KEYS
                        .filter(k => k.toLowerCase().includes(keySearchText.toLowerCase()))
                        .map(k => (
                          <button
                            key={k}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                              addingKey === k ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-gray-700'
                            }`}
                            onClick={() => { setAddingKey(k); setAddingValue(''); setKeySearchText(''); setKeyDropdownOpen(false); }}
                          >
                            {k}
                          </button>
                        ))
                      }
                      {DEMO_TAG_KEYS.filter(k => k.toLowerCase().includes(keySearchText.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">无匹配结果</div>
                      )}
                    </div>
                    <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400">共 {DEMO_TAG_KEYS.length} 条</div>
                  </PopoverContent>
                </Popover>
              </div>

              <span className="text-gray-400 text-sm flex-shrink-0">:</span>

              {/* 标签値下拉（必须先选键） */}
              <div className="relative flex-1 min-w-0">
                {addingKey ? (
                  <Popover open={valueDropdownOpen} onOpenChange={setValueDropdownOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            className="w-full min-w-0 flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-[4px] bg-white hover:border-gray-300 transition-colors overflow-hidden"
                            onClick={() => { setValueDropdownOpen(v => !v); setKeyDropdownOpen(false); }}
                          >
                            <span className={`truncate min-w-0 flex-1 text-left ${addingValue ? 'text-gray-800' : 'text-gray-400'}`}>{addingValue || '选择标签値'}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      {addingValue && (
                        <TooltipContent side="top">
                          <span>{addingValue}</span>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <PopoverContent className="w-48 p-0" align="start" side="bottom">
                      <div className="max-h-44 overflow-y-auto py-1" onWheel={(e) => e.stopPropagation()}>
                        {(DEMO_TAG_KEY_VALUES[addingKey] || []).map(v => (
                          <button
                            key={v}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                              addingValue === v ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-gray-700'
                            }`}
                            onClick={() => { setAddingValue(v); setValueDropdownOpen(false); }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="w-full px-3 py-2 text-sm border border-gray-100 rounded-[4px] bg-gray-50 text-gray-400 cursor-not-allowed truncate">
                    请先选择标签键
                  </div>
                )}
              </div>

              {/* 添加按鈕 */}
              <button
                disabled={!addingKey || !addingValue}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() => {
                  if (!addingKey || !addingValue) return;
                  // 检查标签键是否已存在
                  if (pendingTags.some(t => t.key === addingKey)) {
                    toast.success('该标签键已存在，请删除原有标签后再添加');
                    return;
                  }
                  setPendingTags(prev => [...prev, { key: addingKey, value: addingValue }]);
                  setAddingKey('');
                  setAddingValue('');
                }}
              >
                <X className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>


          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowTagConfigDialog(false); setAddingKey(''); setAddingValue(''); setKeySearchText(''); }}>取消</Button>
            <Button
              onClick={() => {
                // 如果已选了键和值但未点击+，toast 提示
                if (addingKey && addingValue) {
                  toast.success('请点击「+」添加后再确认');
                  return;
                }
                setSelectedTags([...pendingTags]);
                setShowTagConfigDialog(false);
                setAddingKey(''); setAddingValue(''); setKeySearchText('');
                toast.success(
                  pendingTags.length > 0
                    ? `已配置 ${pendingTags.length} 个默认标签，新建实例将自动打 tag`
                    : '已清空默认标签配置'
                );
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent 详情抽屉 */}
      {showDetailDrawer && selectedClaw && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setShowDetailDrawer(false)}
          />
          <div className="w-[593px] bg-white shadow-lg flex flex-col">
            {/* 抽屉头 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Agent 详情</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={handleRefreshDrawer}
                  disabled={drawerLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${drawerLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowDetailDrawer(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* 抽屉内容 - 灰色背景 */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="p-6 space-y-5">
                {/* 名称/ID 部分 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-gray-900 leading-tight">{selectedClaw.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 font-mono">{selectedClaw.instanceId}</span>
                      <button
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 whitespace-nowrap"
                        onClick={() => window.open(`https://console.cloud.tencent.com/cvm/instance/detail?rid=1&id=${selectedClaw.instanceId}`, "_blank")}
                      >
                        去腾讯云控制台管理
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* 已应用模型 */}
                {(() => {
                  const detail = getClawDetail(selectedClaw.id);
                  const models = detail.appliedModels;
                  const hasPrimary = models.some(m => m.primary);
                  const primaryList = models.filter(m => m.primary);
                  const backupList = [...models.filter(m => !m.primary)].sort((a, b) => b.addedAt - a.addedAt);
                  // 是否为 OpenClaw 类型：OpenClaw 支持主模型 + 备选模型；其他类型只能配置一个模型
                  const isOpenClaw = selectedClaw.agentType === 'OpenClaw';
                  // 非 OpenClaw 且已有模型时不展示添加按鈕；OpenClaw 按现有逻辑
                  const canAddMore = isOpenClaw || models.length === 0;
                  const addButtonLabel = isOpenClaw
                    ? (hasPrimary ? "添加备选模型" : "添加主模型")
                    : "添加模型";
                  const isAdding = modelAction.kind === "add";

                  /** 卡片内两级 Select + 保存/取消（替换态 / 新增态共用） */
                  const renderInlineEditForm = () => (
                    <div className="space-y-3">
                      {providerGroups.length === 0 ? (
                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-[4px] px-3 py-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-700 leading-relaxed">
                            当前「模型配置」页中没有对用户可见的模型，请前往该页面添加或开启模型可见性。
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-600">模型厂商</label>
                            <Select value={modelDraftProvider} onValueChange={handleDraftProviderChange}>
                              <SelectTrigger className="w-full bg-gray-50 border-gray-200 h-9">
                                <SelectValue placeholder="选择模型厂商" />
                              </SelectTrigger>
                              <SelectContent>
                                {providerGroups.map((g) => (
                                  <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-600">模型名称</label>
                            <Select value={modelDraftModelId} onValueChange={setModelDraftModelId}>
                              <SelectTrigger className="w-full bg-gray-50 border-gray-200 h-9">
                                <SelectValue placeholder="选择模型名称" />
                              </SelectTrigger>
                              <SelectContent>
                                {(providerGroups.find(g => g.key === modelDraftProvider)?.models ?? []).map((m) => {
                                  const isCustom = m.provider === CUSTOM_PROVIDER_VALUE;
                                  return (
                                    <SelectItem key={m.id} value={m.id}>
                                      {isCustom ? m.name : m.version}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={cancelEditModel}>
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={saveEditModel}
                          disabled={!modelDraftProvider || !modelDraftModelId}
                        >
                          保存
                        </Button>
                      </div>
                    </div>
                  );

                  /** 渲染一行模型卡：替换态下卡片内直接变为编辑表单 */
                  const renderModelRow = (model: AppliedModelItem, isPrimary: boolean) => {
                    const isReplacingThis = modelAction.kind === "replace" && modelAction.modelEntryId === model.id;
                    return (
                      <div
                        key={model.id}
                        className={`px-4 py-3 bg-white rounded-[4px] border transition-colors ${isReplacingThis ? "border-blue-300" : "border-gray-200"}`}
                      >
                        {isReplacingThis ? (
                          renderInlineEditForm()
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                              <span className="text-sm font-semibold text-gray-900 leading-tight truncate">
                                {model.providerLabel}
                              </span>
                              {model.versionLabel && (
                                <span className="text-xs text-gray-400 leading-tight mt-0.5 truncate">
                                  {model.versionLabel}
                                </span>
                              )}
                            </div>
                            {isOpenClaw && (isPrimary ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-600 border border-green-100 pointer-events-none shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                主模型
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 pointer-events-none shrink-0">
                                备选模型
                              </span>
                            ))}
                            <div className="flex items-center gap-1 shrink-0">
                              {isOpenClaw && !isPrimary && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setModelConfirmDialog({ open: true, type: "set-primary", modelEntryId: model.id })}
                                      className="p-1 rounded text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                                    设为主模型
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!isOpenClaw && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => startReplaceModel(model)}
                                    className="p-1 rounded text-gray-400 hover:text-blue-500 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                                  替换
                                </TooltipContent>
                              </Tooltip>
                              )}
                              {isOpenClaw && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setModelConfirmDialog({
                                      open: true,
                                      type: isPrimary ? "delete" : "delete-backup",
                                      modelEntryId: model.id,
                                    })}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-gray-900 text-white text-xs">
                                  删除模型
                                </TooltipContent>
                              </Tooltip>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-500">已应用模型（{models.length}）</div>
                        {!isAdding && canAddMore && (
                          <button
                            onClick={startAddModel}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            {addButtonLabel}
                          </button>
                        )}
                      </div>

                      {/* 空态（无模型且不在新增态） */}
                      {models.length === 0 && !isAdding && (
                        <div className="px-4 py-6 bg-white rounded-[4px] border border-dashed border-gray-200 text-center text-sm text-gray-400">
                          暂未配置模型
                        </div>
                      )}

                      {/* 主模型分组 */}
                      {primaryList.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {primaryList.map((m) => renderModelRow(m, true))}
                        </div>
                      )}

                      {/* 备选模型分组 */}
                      {backupList.length > 0 && (
                        <div>
                          <div className="space-y-1.5">
                            {backupList.map((m) => renderModelRow(m, false))}
                          </div>
                        </div>
                      )}

                      {/* 新增态：底部 inline 卡（替换态已在行内展示，不再重复渲染） */}
                      {isAdding && (
                        <div className="mt-2 px-4 py-3 bg-white rounded-[4px] border border-blue-200">
                          {renderInlineEditForm()}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* 已接入通道 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500">已接入通道（{getClawDetail(selectedClaw.id).connectedChannels.length}）</div>
                    {/* 添加通道按钮已移除（本期需求不包含） */}
                  </div>
                  <div className="space-y-2">
                    {getClawDetail(selectedClaw.id).connectedChannels.map((channel) => {
                      const chConfig = channelLookup.get(channel.value);
                      const fields = chConfig?.fields ?? [];
                      const isExpanded = expandedChannel === channel.name;
                      const isEditingThis = isExpanded && channelEditDraft !== null;
                      return (
                        <div key={channel.name} className="bg-white rounded-[4px] border border-gray-200 overflow-hidden">
                          {/* 行头：通道名 + 展开/折叠按钮 */}
                          <div className="group px-4 py-3 flex items-center gap-3">
                            <button
                              onClick={() => toggleExpandChannel(channel)}
                              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                              title={isExpanded ? "收起" : "展开查看凭证"}
                            >
                              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </button>
                            <span className="text-sm font-semibold text-gray-900 flex-1">{channel.name}</span>
                            <button
                              onClick={() => setChannelRemoveTarget(channel.name)}
                              className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="移除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* 展开区域：凭证查看 / 编辑 */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-2">
                              {fields.length === 0 ? (
                                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-[4px] px-3 py-2.5">
                                  <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                  <p className="text-xs text-blue-600 leading-relaxed">
                                    该通道无需凭证配置（由租户在用户端完成扫码授权）。
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {fields.map((field) => {
                                    const visible = isSecretVisible(channel.name, field.key);
                                    if (isEditingThis) {
                                      // 编辑态：Input + 密码可见切换
                                      return (
                                        <div key={field.key} className="space-y-1">
                                          <label className="text-xs font-medium text-gray-600">{field.label}</label>
                                          <div className="relative">
                                            <Input
                                              type={field.secret && !visible ? "password" : "text"}
                                              value={channelEditDraft![field.key] ?? ""}
                                              onChange={(e) => setChannelEditDraft(prev => ({ ...(prev ?? {}), [field.key]: e.target.value }))}
                                              className="bg-white border-gray-200 text-sm h-9 pr-10"
                                            />
                                            {field.secret && (
                                              <button
                                                type="button"
                                                onClick={() => toggleSecretVisibility(channel.name, field.key)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                              >
                                                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }
                                    // 只读态：key - value（secret 自动 mask）
                                    const rawValue = channel.fieldValues[field.key] ?? "";
                                    const displayValue = field.secret && !visible ? maskSecret(rawValue) : (rawValue || "—");
                                    return (
                                      <div key={field.key} className="flex items-center gap-3 py-1.5">
                                        <span className="text-xs text-gray-500 w-28 shrink-0 truncate" title={field.label}>{field.label}</span>
                                        <span className="text-xs text-gray-800 flex-1 font-mono break-all">{displayValue}</span>
                                        {field.secret && rawValue && (
                                          <button
                                            type="button"
                                            onClick={() => toggleSecretVisibility(channel.name, field.key)}
                                            className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
                                            title={visible ? "隐藏" : "查看"}
                                          >
                                            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* 操作按钮 */}
                                  <div className="flex justify-end gap-2 pt-1">
                                    {isEditingThis ? (
                                      <>
                                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={cancelEditChannel}>
                                          取消
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-8 px-3 text-xs"
                                          onClick={() => saveEditChannel(channel)}
                                        >
                                          保存
                                        </Button>
                                      </>
                                    ) : (
                                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => startEditChannel(channel)}>
                                        <Pencil className="w-3 h-3 mr-1" />
                                        编辑凭证
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {getClawDetail(selectedClaw.id).connectedChannels.length === 0 && !channelAdding && (
                      <div className="px-4 py-6 bg-white rounded-[4px] border border-dashed border-gray-200 text-center text-sm text-gray-400">
                        暂未接入通道
                      </div>
                    )}
                    {/* 新增通道面板 */}
                    {channelAdding && (() => {
                      const existing = new Set(getClawDetail(selectedClaw.id).connectedChannels.map(c => c.name));
                      const available = availableChannelOptions.filter(c => !existing.has(c.label));
                      const currentCh = availableChannelOptions.find(c => c.value === channelDraft);
                      const isWechatLike = currentCh?.wechatMode;
                      return (
                        <div className="px-4 py-3 bg-white rounded-[4px] border border-gray-200 space-y-3">
                          {/* 通道选择 */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">通道类型</label>
                            <Select value={channelDraft} onValueChange={handleChannelDraftChange}>
                              <SelectTrigger className="w-full bg-gray-50 border-gray-200 h-9">
                                <SelectValue placeholder="选择要添加的通道" />
                              </SelectTrigger>
                              <SelectContent>
                                {available.length === 0 ? (
                                  <div className="px-3 py-6 text-center text-xs text-gray-400">
                                    所有通道均已添加
                                  </div>
                                ) : (
                                  available.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 无凭证字段的通道（微信）：提示框 */}
                          {currentCh && isWechatLike && (
                            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-[4px] px-3 py-2.5">
                              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-blue-600 leading-relaxed">
                                微信通道通过扫码授权接入，管控端仅创建占位记录，实际扫码绑定由租户在用户端完成。
                              </p>
                            </div>
                          )}

                          {/* 凭证字段录入 */}
                          {currentCh && !isWechatLike && (currentCh.fields ?? []).length > 0 && (
                            <div className="space-y-2">
                              {(currentCh.fields ?? []).map((field) => {
                                const visible = isSecretVisible("__draft__", field.key);
                                return (
                                  <div key={field.key} className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">{field.label}</label>
                                    <div className="relative">
                                      <Input
                                        type={field.secret && !visible ? "password" : "text"}
                                        value={channelDraftFields[field.key] ?? ""}
                                        onChange={(e) => setChannelDraftFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={field.label}
                                        className="bg-gray-50 border-gray-200 text-sm h-9 pr-10"
                                      />
                                      {field.secret && (
                                        <button
                                          type="button"
                                          onClick={() => toggleSecretVisibility("__draft__", field.key)}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={cancelAddChannel}>
                              取消
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={confirmAddChannel}
                              disabled={!channelDraft}
                            >
                              确认添加
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* 已安装技能 */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">已安装技能（{getClawDetail(selectedClaw.id).installedSkills.length}）</div>
                  <div className="space-y-2">
                    {getClawDetail(selectedClaw.id).installedSkills.map((skill) => (
                      <div key={skill} className="px-4 py-3 bg-white rounded-[4px] border border-gray-200 text-sm text-gray-800">
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 移除通道二次确认 */}
      <AlertDialog open={!!channelRemoveTarget} onOpenChange={(open) => { if (!open) setChannelRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除通道</AlertDialogTitle>
            <AlertDialogDescription>
              移除「{channelRemoveTarget}」后，该 Agent 将无法通过此通道收发消息。该操作不会删除通道下已有的凭证配置，可在用户端重新接入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemoveChannel}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 模型操作二次确认（设为主/删主/删备）—— 与用户端 OpenClawDetail 保持一致 */}
      <Dialog
        open={modelConfirmDialog.open}
        onOpenChange={(open) => !open && setModelConfirmDialog(prev => ({ ...prev, open: false }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-blue-600">
              {modelConfirmDialog.type === "delete"
                ? "确认删除主模型"
                : modelConfirmDialog.type === "delete-backup"
                ? "确认删除备选模型"
                : "切换主模型"}
            </DialogTitle>
            <DialogDescription className="text-gray-600 leading-relaxed pt-1">
              {modelConfirmDialog.type === "delete"
                ? "删除后将自动切换备选模型作为主模型，切换过程中将导致相关的 Gateway 服务重启"
                : modelConfirmDialog.type === "delete-backup"
                ? "删除后将导致相关的 Gateway 服务重启，确认删除么"
                : "将此模型设为主模型后，原主模型将降为备选模型。切换过程中会自动重启 Gateway 服务，是否继续？"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModelConfirmDialog(prev => ({ ...prev, open: false }))}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={runModelConfirm}
            >
              {modelConfirmDialog.type === "delete" || modelConfirmDialog.type === "delete-backup"
                ? "确认删除"
                : "确认设置"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 监控抽屉 */}
      {showMonitorDrawer && selectedClaw && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowMonitorDrawer(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[640px] bg-white shadow-lg overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">{selectedClaw.name} - 监控</h2>
              <button
                onClick={() => setShowMonitorDrawer(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Tokens 分析区 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Tokens 分析</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "输入 Tokens", value: "1,234", icon: ArrowUp,    color: "from-indigo-500 to-indigo-600" },
                    { label: "输出 Tokens", value: "5,678", icon: ArrowDown,   color: "from-purple-500 to-purple-600" },
                    { label: "总 Tokens",   value: "6,912", icon: Zap,         color: "from-blue-600 to-purple-600" },
                  ].map((stat) => (
                    <div key={stat.label}
                      className="bg-white rounded-[4px] border border-gray-100 p-4"
                      style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-[4px] bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                          <stat.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setLocation('/admin/tokens-monitor')}
                  className="mt-4 text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
                >
                  查看完整 Tokens 监控 <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 分隔线 */}
              {clsEnabled && <div className="border-t border-gray-100" />}

              {/* 会话记录区 - 仅当 CLS 日志服务开启时显示 */}
              {clsEnabled && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">会话记录</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "总会话数", value: "42",  icon: MessageCircle, color: "from-blue-500 to-blue-600" },
                      { label: "平均轮次", value: "8.5", icon: RotateCw,     color: "from-cyan-500 to-cyan-600" },
                    ].map((stat) => (
                      <div key={stat.label}
                        className="bg-white rounded-[4px] border border-gray-100 p-4"
                        style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-[4px] bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                            <stat.icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-xs text-gray-400">{stat.label}</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* 会话摘要表格 */}
                  <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
                    style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
                  >
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '24%' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">会话</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">类型</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">模型</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">最新时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs truncate">c3b2ac3c</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">Feishu Dm</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">hunyuan-turbos-latest</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">2026-03-09 17:49</td>
                        </tr>
                        <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs truncate">81c87c7b</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">QQ Dm</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">hunyuan-turbos-latest</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">2026-03-09 10:07</td>
                        </tr>
                        <tr className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs truncate">267e462d</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">CLI</td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">deepseek-v3.2</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">2026-03-08 12:54</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => setLocation('/admin/session-management')}
                    className="mt-4 text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  >
                    查看完整会话管理 <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes breathing {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-breathing {
          animation: breathing 2s ease-in-out infinite;
        }
      `}</style>
    </TooltipProvider>
  );
}
