/**
 * ImageManagement - 管控端镜像管理页
 * 按 Agent 类型分组管理镜像（OpenClaw / Hermes Agent / LightClaw ACE + 用户自定义类型）
 *
 * 核心交互：
 *   - 类型分两类：腾讯云官方（不可删）、自定义（可加可删）
 *   - 自定义类型有「兼容内核」概念：兼容 openclaw/hermes/lightclawace 时管控台功能完整可用；
 *     自研内核（native）部分管控台功能不可用，需要客户显式确认"允许用户进入终端"
 *   - 每个分组可独立启用一个镜像、可设为"用户端首选"类型
 *   - 公共镜像排最前面，不可删除/编辑；自定义镜像可编辑 type/version、可删除
 *   - 导入弹窗同时支持公共 + 自定义镜像，选中公共镜像会自动匹配类型/版本并置灰
 *   - 左侧 sticky 锚点导航支持快速定位
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trash2, Info, RefreshCw, ExternalLink, Search, ChevronsUpDown, Star,
  ChevronDown, ChevronRight, Plus, Pencil, AlertTriangle, Layers,
  Check, X, Minus,
} from "lucide-react";
import type { UserGroup } from "./MemberManagement/types";
import { MOCK_GROUPS as MOCK_ONEID_GROUPS, MOCK_MANUAL_GROUPS } from "./MemberManagement/mock";
import { buildGroupTree, type GroupTreeNode } from "./MemberManagement/health";

// ─── 内核（Kernel）定义 ───────────────────────────────────────────────────────
type KernelValue = "openclaw" | "hermes" | "lightclawace" | "native";

interface KernelConfig {
  value: KernelValue;
  label: string;
  versionPlaceholder: string;
  versionRegex: RegExp;
}

const KERNELS: KernelConfig[] = [
  { value: "openclaw",     label: "OpenClaw",      versionPlaceholder: "如 2026.4.2", versionRegex: /^\d{4}\.\d{1,2}\.\d{1,2}$/ },
  { value: "hermes",       label: "Hermes Agent",  versionPlaceholder: "如 0.8.0",    versionRegex: /^\d+\.\d+\.\d+$/ },
  { value: "lightclawace", label: "LightClaw ACE", versionPlaceholder: "如 1.0.2",    versionRegex: /^\d+\.\d+\.\d+$/ },
  { value: "native",       label: "自定义内核",       versionPlaceholder: "如 1.0.0 或 2026.5.8",    versionRegex: /^\d+\.\d+\.\d+$/ },
];

const getKernel = (v: KernelValue) => KERNELS.find((k) => k.value === v)!;

function validateVersion(kernel: KernelValue, version: string): boolean {
  const cfg = getKernel(kernel);
  if (!cfg.versionRegex.test(version)) return false;
  if (kernel === "openclaw") {
    const [y, m, d] = version.split(".").map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }
  return true;
}

// ─── Agent 类型定义 ────────────────────────────────────────────────────────────
interface AgentType {
  value: string;
  label: string;
  isOfficial: boolean;
  kernel: KernelValue;
}

const OFFICIAL_TYPES: AgentType[] = [
  { value: "openclaw",     label: "OpenClaw",      isOfficial: true, kernel: "openclaw" },
  { value: "hermes",       label: "Hermes Agent",  isOfficial: true, kernel: "hermes" },
  { value: "lightclawace", label: "LightClaw ACE", isOfficial: true, kernel: "lightclawace" },
];

const DEFAULT_AGENT_TYPE = "openclaw";

const NATIVE_KERNEL_NOTICE_TITLE = "管控台部分功能在该类型上不可用";
const NATIVE_KERNEL_NOTICE_LINES = [
  "1. 员工端需要登录\"终端\"配置模型/通道/技能，不支持管控台快捷配置；",
  "2. 管控端部分功能不可用：如 Agent 工具库、记忆管理、网盘管理、运维观测、AI Agent 安全、会话管理 等功能将不可用",
];
// 注：上方 TITLE 与 LINES 同时被「Agent 类型卡片温馨提示」与「添加自定义 Agent 类型」弹窗复用，文案保持一致

/** 把任意类型名称转为唯一英文 value（slug） */
function nameToValue(name: string): string {
  const trimmed = name.trim().toLowerCase();
  // 仅保留小写字母数字，其余字符（含中文、空格）转 "-"
  let slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // 全是非法字符时，退化为时间戳保证唯一
  if (!slug) slug = `agent-${Date.now()}`;
  return slug;
}

// ─── 分组数据 & 应用范围工具 ─────────────────────────────────────────────────
const ALL_GROUPS: UserGroup[] = [...MOCK_ONEID_GROUPS, ...MOCK_MANUAL_GROUPS];

function getGroupPath(groupId: string, groups: UserGroup[]): string {
  const map = new Map(groups.map((g) => [g.id, g]));
  const chain: string[] = [];
  let cur = map.get(groupId);
  while (cur) {
    chain.unshift(cur.name);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain.join("/");
}

type CheckState = "checked" | "unchecked" | "indeterminate";

function getCheckState(node: GroupTreeNode, selectedIds: Set<string>): CheckState {
  if (selectedIds.has(node.id)) return "checked";
  if (node.children.length === 0) return "unchecked";
  let hasChecked = false;
  let hasUnchecked = false;
  for (const c of node.children) {
    const s = getCheckState(c, selectedIds);
    if (s === "checked") hasChecked = true;
    else if (s === "unchecked") hasUnchecked = true;
    else { hasChecked = true; hasUnchecked = true; }
    if (hasChecked && hasUnchecked) return "indeterminate";
  }
  if (hasChecked && !hasUnchecked) return "checked";
  if (!hasChecked && hasUnchecked) return "unchecked";
  return "indeterminate";
}

function getDescendantIds(node: GroupTreeNode): string[] {
  const ids: string[] = [node.id];
  node.children.forEach((c) => ids.push(...getDescendantIds(c)));
  return ids;
}

// ─── 应用范围 Popover（镜像管理专用，按 Agent 类型维度） ──────────────────────
interface ImageScopeData {
  visibilityScope: "all" | "groups";
  visibilityGroupIds: string[];
}

function ImageScopePopover({
  scopeData,
  groups,
  onSave,
}: {
  scopeData: ImageScopeData;
  groups: UserGroup[];
  onSave: (scope: "all" | "groups", groupIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftScope, setDraftScope] = useState<"all" | "groups">(scopeData.visibilityScope);
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>(scopeData.visibilityGroupIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  type DisplayBucket = "dept" | "custom";
  const groupsByBucket = useMemo(() => {
    const buckets: Record<DisplayBucket, UserGroup[]> = { dept: [], custom: [] };
    groups.forEach((g) => { if (g.source === "oneid-dept") buckets.dept.push(g); else buckets.custom.push(g); });
    return buckets;
  }, [groups]);

  const activeBuckets = useMemo(() => {
    const order: DisplayBucket[] = ["dept", "custom"];
    return order.filter((b) => groupsByBucket[b].length > 0);
  }, [groupsByBucket]);

  const BUCKET_LABELS: Record<DisplayBucket, string> = { dept: "部门", custom: "自定义分组" };

  const treesMap = useMemo(() => {
    const map: Record<string, GroupTreeNode[]> = {};
    activeBuckets.forEach((b) => { map[b] = buildGroupTree(groupsByBucket[b]); });
    return map;
  }, [activeBuckets, groupsByBucket]);

  const hasGroups = activeBuckets.length > 0;

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setDraftScope(scopeData.visibilityScope);
      setDraftGroupIds([...scopeData.visibilityGroupIds]);
      setSearchQuery("");
      const expandSet = new Set<string>();
      const groupMap = new Map(groups.map((g) => [g.id, g]));
      scopeData.visibilityGroupIds.forEach((gid) => {
        let cur = groupMap.get(gid);
        while (cur && cur.parentId) { expandSet.add(cur.parentId); cur = groupMap.get(cur.parentId); }
      });
      activeBuckets.forEach((b) => { treesMap[b]?.forEach((root) => expandSet.add(root.id)); });
      setExpanded(expandSet);
    }
    setOpen(v);
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const toggleNode = (node: GroupTreeNode) => {
    const ids = new Set(draftGroupIds);
    const state = getCheckState(node, ids);
    const descendants = getDescendantIds(node);
    if (state === "checked") { descendants.forEach((d) => ids.delete(d)); }
    else { descendants.forEach((d) => ids.add(d)); }
    setDraftGroupIds(Array.from(ids));
  };

  const handleClearSelection = () => { setDraftGroupIds([]); setSearchQuery(""); };

  const isConfirmDisabled = draftScope === "groups" && draftGroupIds.length === 0;

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onSave(draftScope, draftScope === "all" ? [] : draftGroupIds);
    setOpen(false);
    toast.success("应用范围已更新");
  };

  const matchedGroupIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(groups.filter((g) => g.name.toLowerCase().includes(q) || getGroupPath(g.id, groups).toLowerCase().includes(q)).map((g) => g.id));
  }, [searchQuery, groups]);

  const isNodeVisible = (node: GroupTreeNode): boolean => {
    if (!matchedGroupIds) return true;
    if (matchedGroupIds.has(node.id)) return true;
    return node.children.some(isNodeVisible);
  };

  const renderTreeNode = (node: GroupTreeNode, depth: number) => {
    if (!isNodeVisible(node)) return null;
    const selectedSet = new Set(draftGroupIds);
    const checkState = getCheckState(node, selectedSet);
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id}>
        <button
          onClick={() => toggleNode(node)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] hover:bg-gray-50 transition-colors text-left"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <span onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }} className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (<span className="w-4 h-4 shrink-0" />)}
          <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checkState === "checked" ? "bg-blue-500 border-blue-500" : checkState === "indeterminate" ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}>
            {checkState === "checked" && <Check className="w-2.5 h-2.5 text-white" />}
            {checkState === "indeterminate" && <Minus className="w-2.5 h-2.5 text-white" />}
          </span>
          <span className="text-xs text-gray-700 truncate">{node.name}</span>
        </button>
        {hasChildren && isExpanded && node.children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  };

  // 已选标签：子孙全选时自动合并为父分组
  const selectedTags = useMemo(() => {
    const selectedSet = new Set(draftGroupIds);
    const collectEffective = (nodes: GroupTreeNode[]): string[] => {
      const result: string[] = [];
      for (const node of nodes) {
        const state = getCheckState(node, selectedSet);
        if (state === "checked") { result.push(node.id); }
        else if (state === "indeterminate") { result.push(...collectEffective(node.children)); }
      }
      return result;
    };
    const effectiveIds: string[] = [];
    activeBuckets.forEach((b) => { effectiveIds.push(...collectEffective(treesMap[b] || [])); });
    return effectiveIds.map((gid) => ({ id: gid, path: getGroupPath(gid, groups) }));
  }, [draftGroupIds, groups, activeBuckets, treesMap]);

  const selectedGroupPaths = useMemo(() => {
    const selectedSet = new Set(scopeData.visibilityGroupIds);
    const collectEffective = (nodes: GroupTreeNode[]): string[] => {
      const result: string[] = [];
      for (const node of nodes) {
        const state = getCheckState(node, selectedSet);
        if (state === "checked") { result.push(node.id); }
        else if (state === "indeterminate") { result.push(...collectEffective(node.children)); }
      }
      return result;
    };
    const effectiveIds: string[] = [];
    activeBuckets.forEach((b) => { effectiveIds.push(...collectEffective(treesMap[b] || [])); });
    return effectiveIds.map((gid) => getGroupPath(gid, groups));
  }, [groups, scopeData.visibilityGroupIds, activeBuckets, treesMap]);

  const renderBadges = () => {
    if (scopeData.visibilityScope === "all" || selectedGroupPaths.length === 0) {
      return <span className="badge-loading whitespace-nowrap">全部用户</span>;
    }
    const firstName = selectedGroupPaths[0];
    const rest = selectedGroupPaths.length - 1;
    const tooltipText = selectedGroupPaths.join("\n");
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-default">
            <span className="badge-shutdown max-w-[140px] truncate inline-block align-middle">{firstName}</span>
            {rest > 0 && <span className="badge-shutdown whitespace-nowrap">+{rest}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[320px] text-xs leading-relaxed whitespace-pre-line">{tooltipText}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="inline-flex items-center gap-1.5 min-h-[20px]">
      <span className="text-xs text-gray-500 whitespace-nowrap">应用范围</span>
      {renderBadges()}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className="self-center text-gray-300 hover:text-blue-500 transition-colors" title="编辑应用范围">
            <Pencil className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0 flex flex-col max-h-[420px]" align="end" sideOffset={6}>
          <div className="px-3.5 pt-3.5 pb-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-0">
            <div className="flex gap-1.5">
              <button onClick={() => setDraftScope("all")} className={`flex-1 px-2.5 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${draftScope === "all" ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>全部用户</button>
              <button onClick={() => setDraftScope("groups")} className={`flex-1 px-2.5 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${draftScope === "groups" ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>按分组</button>
            </div>
            {draftScope === "groups" && (
              <div className="space-y-1.5">
                {!hasGroups ? (
                  <div className="text-center py-5 px-2">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      暂无分组，请前往
                      <a href="/admin/members" className="text-blue-500 hover:text-blue-600 hover:underline mx-0.5" onClick={(e) => { e.preventDefault(); setOpen(false); window.location.href = "/admin/members"; }}>用户管理</a>
                      建立分组
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="group relative flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-[4px] bg-gray-50 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-100 transition-colors max-h-[80px] overflow-y-auto">
                      {selectedTags.map((tag) => (
                        <span key={tag.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-[4px] border border-blue-100 shrink-0 max-w-[200px]">
                          <span className="truncate">{tag.path}</span>
                          <button
                            onClick={() => {
                              const findNode = (nodes: GroupTreeNode[]): GroupTreeNode | undefined => { for (const n of nodes) { if (n.id === tag.id) return n; const found = findNode(n.children); if (found) return found; } return undefined; };
                              let targetNode: GroupTreeNode | undefined;
                              for (const b of activeBuckets) { targetNode = findNode(treesMap[b] || []); if (targetNode) break; }
                              const idsToRemove = targetNode ? new Set(getDescendantIds(targetNode)) : new Set([tag.id]);
                              setDraftGroupIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
                            }}
                            className="text-blue-400 hover:text-blue-600 shrink-0"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      <input type="text" placeholder={selectedTags.length === 0 ? "请输入分组名称" : ""} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[60px] text-xs bg-transparent outline-none placeholder:text-gray-400" />
                      {(selectedTags.length > 0 || searchQuery) && (
                        <button onClick={handleClearSelection} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" title="清除全部">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-[220px] overflow-y-auto">
                      {activeBuckets.map((bucket) => {
                        const trees = treesMap[bucket];
                        if (!trees || trees.length === 0) return null;
                        const anyVisible = trees.some(isNodeVisible);
                        if (!anyVisible) return null;
                        return (
                          <div key={bucket} className="mb-1">
                            <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{BUCKET_LABELS[bucket]}</div>
                            {trees.map((root) => renderTreeNode(root, 0))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-gray-100 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs px-3" disabled={isConfirmDisabled} onClick={handleConfirm}>确认</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── 镜像状态枚举（与生产一致） ───────────────────────────────────────────────
type ImageState =
  | "NORMAL" | "CREATING" | "CREATEFAILED"
  | "SYNCING_DST" | "SYNCING_SRC"
  | "IMPORTING" | "IMPORTFAILED" | "EXPORTING";

const IMAGE_STATE_MAP: Record<ImageState, { label: string; color: string; bg: string; dot: string; animate?: boolean }> = {
  NORMAL:        { label: "可用",     color: "text-green-700", bg: "bg-green-50", dot: "bg-green-500" },
  CREATING:      { label: "创建中",   color: "text-blue-700",  bg: "bg-blue-50",  dot: "bg-blue-500", animate: true },
  CREATEFAILED:  { label: "创建失败", color: "text-red-700",   bg: "bg-red-50",   dot: "bg-red-500" },
  SYNCING_DST:   { label: "复制中",   color: "text-blue-700",  bg: "bg-blue-50",  dot: "bg-blue-500", animate: true },
  SYNCING_SRC:   { label: "复制中",   color: "text-blue-700",  bg: "bg-blue-50",  dot: "bg-blue-500", animate: true },
  IMPORTING:     { label: "导入中",   color: "text-blue-700",  bg: "bg-blue-50",  dot: "bg-blue-500", animate: true },
  IMPORTFAILED:  { label: "导入失败", color: "text-red-700",   bg: "bg-red-50",   dot: "bg-red-500" },
  EXPORTING:     { label: "导出中",   color: "text-blue-700",  bg: "bg-blue-50",  dot: "bg-blue-500", animate: true },
};

// ─── Mock 云端镜像（导入弹窗可选） ─────────────────────────────────────────────
interface CloudImage {
  imageId: string;
  imageName: string;
  public: boolean;
  agentType?: string;
  agentVersion?: string;
}

const CLOUD_IMAGES: CloudImage[] = [
  { imageId: "img-agent-official",     imageName: "云服务器 OpenClaw 镜像",    public: true,  agentType: "openclaw",     agentVersion: "2026.3.28" },
  { imageId: "img-hermes-official",    imageName: "Hermes Agent 官方镜像",     public: true,  agentType: "hermes",       agentVersion: "0.8.0" },
  { imageId: "img-lightclaw-official", imageName: "LightClaw ACE 官方镜像",    public: true,  agentType: "lightclawace", agentVersion: "1.0.2" },
  { imageId: "img-cust-a1b2c3d4",      imageName: "openclaw-custom-v1.0",      public: false },
  { imageId: "img-cust-e5f6g7h8",      imageName: "hermes-custom-v0.7",        public: false },
  { imageId: "img-cust-i9j0k1l2",      imageName: "lightclaw-prod-2025Q4",     public: false },
  { imageId: "img-cust-m3n4o5p6",      imageName: "openclaw-dev-latest",       public: false },
  { imageId: "img-cust-q7r8s9t0",      imageName: "agent-test-v2.0",           public: false },
  { imageId: "img-cust-u1v2w3x4",      imageName: "petzhouclaw-v1.0",          public: false },
  { imageId: "img-cust-y5z6a7b8",      imageName: "myagent-native-v1.0",       public: false },
];

// ─── 列表展示的镜像结构 ────────────────────────────────────────────────────────
interface ImageRow {
  id: string;
  name: string;
  state: ImageState;
  isPublic: boolean;
  agentType: string;
  agentVersion: string;
  os: string;
  createTime: string;
  active: boolean;
}

const INITIAL_IMAGES: ImageRow[] = [
  { id: "img-agent-official",     name: "云服务器 OpenClaw 镜像",  state: "NORMAL", isPublic: true,  agentType: "openclaw",     agentVersion: "2026.3.28", os: "CentOS 7.9 64位", createTime: "2025-12-01 10:30:00", active: true },
  { id: "img-hermes-official",    name: "Hermes Agent 官方镜像",   state: "NORMAL", isPublic: true,  agentType: "hermes",       agentVersion: "0.8.0",     os: "CentOS 7.9 64位", createTime: "2025-12-01 10:30:00", active: true },
  { id: "img-lightclaw-official", name: "LightClaw ACE 官方镜像",  state: "NORMAL", isPublic: true,  agentType: "lightclawace", agentVersion: "1.0.2",     os: "CentOS 7.9 64位", createTime: "2025-12-01 10:30:00", active: true },
  { id: "img-cust-a1b2c3d4",      name: "openclaw-custom-v1.0",    state: "NORMAL", isPublic: false, agentType: "openclaw",     agentVersion: "2025.9.1",  os: "CentOS 7.9 64位", createTime: "2025-09-15 14:22:35", active: false },
  { id: "img-cust-legacy-001",    name: "legacy-image-v1",         state: "NORMAL", isPublic: false, agentType: "openclaw",     agentVersion: "",          os: "CentOS 7.9 64位", createTime: "2025-06-01 12:00:00", active: false },
];

// ─── 主组件 ────────────────────────────────────────────────────────────────────
export default function ImageManagement() {
  // 自定义 Agent 类型列表
  const [customTypes, setCustomTypes] = useState<AgentType[]>(() => {
    try {
      const raw = localStorage.getItem("admin_custom_agent_types_v1");
      if (raw) return JSON.parse(raw) as AgentType[];
    } catch { /* ignore */ }
    return [];
  });
  const syncCustomTypes = (next: AgentType[]) => {
    setCustomTypes(next);
    localStorage.setItem("admin_custom_agent_types_v1", JSON.stringify(next));
  };

  const [images, setImages] = useState<ImageRow[]>(() => {
    try {
      const raw = localStorage.getItem("admin_images_v2");
      if (raw) return JSON.parse(raw) as ImageRow[];
    } catch { /* ignore */ }
    return INITIAL_IMAGES;
  });
  const syncImages = (next: ImageRow[]) => {
    setImages(next);
    localStorage.setItem("admin_images_v2", JSON.stringify(next));
  };

  const [defaultAgentType, setDefaultAgentType] = useState<string>(() => {
    try {
      const v = localStorage.getItem("admin_default_agent_type");
      if (v) return v;
    } catch { /* ignore */ }
    return DEFAULT_AGENT_TYPE;
  });
  const syncDefaultAgentType = (v: string) => {
    setDefaultAgentType(v);
    localStorage.setItem("admin_default_agent_type", v);
  };

  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  // 每个 Agent 类型的应用范围
  const [typeScopeMap, setTypeScopeMap] = useState<Record<string, ImageScopeData>>(() => {
    try {
      const raw = localStorage.getItem("admin_image_type_scope_v1");
      if (raw) return JSON.parse(raw) as Record<string, ImageScopeData>;
    } catch { /* ignore */ }
    return {};
  });
  const getTypeScope = (typeValue: string): ImageScopeData =>
    typeScopeMap[typeValue] ?? { visibilityScope: "all", visibilityGroupIds: [] };
  const handleScopeChange = (typeValue: string, scope: "all" | "groups", groupIds: string[]) => {
    const next = { ...typeScopeMap, [typeValue]: { visibilityScope: scope, visibilityGroupIds: groupIds } };
    setTypeScopeMap(next);
    localStorage.setItem("admin_image_type_scope_v1", JSON.stringify(next));
  };

  // 所有 Agent 类型（官方 + 自定义）
  const allTypes: AgentType[] = useMemo(
    () => [...OFFICIAL_TYPES, ...customTypes],
    [customTypes]
  );
  const getType = (value: string) => allTypes.find((t) => t.value === value);
  const getTypeLabel = (value: string) => getType(value)?.label ?? value;

  // 锚点导航：跟踪当前可视类型
  const [activeAnchor, setActiveAnchor] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.anchor;
          if (id) setActiveAnchor(id);
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [allTypes.length]);

  const scrollToType = (value: string) => {
    const el = sectionRefs.current[value];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveAnchor(value);
    }
  };

  // 导入弹窗
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [importAgentType, setImportAgentType] = useState("");
  const [importAgentVersion, setImportAgentVersion] = useState("");
  const [versionError, setVersionError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showImageList, setShowImageList] = useState(false);
  const imageListRef = useRef<HTMLDivElement>(null);

  // 编辑自定义镜像弹窗
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingImageId, setEditingImageId] = useState("");
  const [editAgentType, setEditAgentType] = useState("");
  const [editAgentVersion, setEditAgentVersion] = useState("");
  const [editVersionError, setEditVersionError] = useState("");

  // 添加自定义 Agent 类型弹窗
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeKernel, setNewTypeKernel] = useState<KernelValue>("openclaw");
  const [nativeAck, setNativeAck] = useState(false);
  const [addTypeError, setAddTypeError] = useState<{ label?: string }>({});

  // 删除自定义类型二次确认
  const [pendingRemoveType, setPendingRemoveType] = useState<AgentType | null>(null);

  // 类型展示顺序：官方在前，自定义按添加顺序追加
  const displayTypes = allTypes;

  const toggleCollapse = (type: string) => {
    setCollapsedTypes((prev) => {
      const n = new Set(prev);
      if (n.has(type)) n.delete(type); else n.add(type);
      return n;
    });
  };

  // ─── 导入弹窗 ─────────────────────────────────────────────────────────────────
  const handleDialogOpenChange = (open: boolean) => {
    setShowImportDialog(open);
    if (!open) {
      setSelectedImageId("");
      setImportAgentType("");
      setImportAgentVersion("");
      setVersionError("");
      setSearchQuery("");
      setShowImageList(false);
    }
  };

  // 按搜索词过滤（公共 + 自定义）
  const filteredImages = CLOUD_IMAGES.filter((img) =>
    img.imageId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    img.imageName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPublic = filteredImages.filter((img) => img.public);
  const filteredCustom = filteredImages.filter((img) => !img.public);

  const selectedCloudImage = CLOUD_IMAGES.find((i) => i.imageId === selectedImageId);
  const isPublicSelected = !!selectedCloudImage?.public;
  const isCustomImageSelected = !!selectedImageId && !isPublicSelected;

  // 当前导入/编辑场景对应的 kernel（决定版本号格式）
  const importKernel: KernelValue = importAgentType
    ? (getType(importAgentType)?.kernel || "openclaw")
    : "openclaw";
  const editKernel: KernelValue = editAgentType
    ? (getType(editAgentType)?.kernel || "openclaw")
    : "openclaw";

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success("镜像列表已刷新");
    }, 1200);
  };

  const formatNow = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const handleSelectImage = (imgId: string) => {
    setSelectedImageId(imgId);
    setShowImageList(false);
    setSearchQuery("");
    const cloudImg = CLOUD_IMAGES.find((i) => i.imageId === imgId);
    if (cloudImg?.public && cloudImg.agentType) {
      // 公共镜像自动匹配类型和版本
      setImportAgentType(cloudImg.agentType);
      setImportAgentVersion(cloudImg.agentVersion || "");
      setVersionError("");
    } else {
      setImportAgentVersion("");
      setVersionError("");
    }
  };

  const handleVersionChange = (v: string) => {
    setImportAgentVersion(v);
    if (v && importAgentType) {
      const cfg = getKernel(importKernel);
      if (!cfg.versionRegex.test(v)) {
        setVersionError(`格式不正确，请输入 ${cfg.versionPlaceholder.replace("如 ", "")} 格式`);
      } else if (importKernel === "openclaw" && !validateVersion("openclaw", v)) {
        setVersionError("日期不合法");
      } else {
        setVersionError("");
      }
    } else {
      setVersionError("");
    }
  };

  const openImportForType = (agentType: string) => {
    setShowImportDialog(true);
    setSelectedImageId("");
    setSearchQuery("");
    setShowImageList(false);
    setImportAgentType(agentType);
    setImportAgentVersion("");
    setVersionError("");
  };

  const handleImport = () => {
    if (!selectedImageId) { toast.error("请选择要导入的镜像"); return; }
    if (!importAgentType) { toast.error("请选择 Agent 类型"); return; }
    if (!importAgentVersion.trim()) { toast.error("请填写 Agent 版本"); return; }
    if (!validateVersion(importKernel, importAgentVersion)) { toast.error("版本格式不正确"); return; }
    if (images.some((img) => img.id === selectedImageId)) { toast.error("该镜像已在列表中"); return; }

    const cloudImg = CLOUD_IMAGES.find((i) => i.imageId === selectedImageId);
    if (!cloudImg) return;

    syncImages([...images, {
      id: cloudImg.imageId,
      name: cloudImg.imageName,
      state: "NORMAL",
      isPublic: cloudImg.public,
      agentType: importAgentType,
      agentVersion: importAgentVersion.trim(),
      os: "CentOS 7.9 64位",
      createTime: formatNow(),
      active: false,
    }]);
    handleDialogOpenChange(false);
    toast.success(`镜像「${cloudImg.imageName}」已导入至 ${getTypeLabel(importAgentType)}`);
  };

  // ─── 启用 / 首选 / 删除 ───────────────────────────────────────────────────────
  const handleToggleActive = (imgId: string, agentType: string) => {
    const target = images.find((i) => i.id === imgId);
    if (!target) return;
    if (target.active) {
      // 取消启用
      syncImages(images.map((i) => i.id === imgId ? { ...i, active: false } : i));
      toast.success(`镜像「${target.name}」已取消启用`);
    } else {
      // 同类型内单选
      syncImages(images.map((i) =>
        i.agentType === agentType ? { ...i, active: i.id === imgId } : i
      ));
      toast.success(`镜像「${target.name}」已设为 ${getTypeLabel(agentType)} 的目标镜像`);
    }
  };

  const handleSetDefaultType = (agentType: string) => {
    if (!images.some((i) => i.agentType === agentType && i.active)) {
      toast.error(`请先为 ${getTypeLabel(agentType)} 启用一个镜像`);
      return;
    }
    syncDefaultAgentType(agentType);
    toast.success(`已将「${getTypeLabel(agentType)}」设为用户端首选类型`);
  };

  const handleDelete = (img: ImageRow) => {
    if (img.isPublic) { toast.error("公共镜像不支持删除"); return; }
    if (img.active) {
      if (img.agentType === defaultAgentType) {
        toast.error("该镜像为用户端首选类型的启用镜像，无法删除");
        return;
      }
      toast.error("当前启用镜像不可删除，请先切换至其他镜像");
      return;
    }
    syncImages(images.filter((i) => i.id !== img.id));
    toast.success("镜像已删除");
  };

  // ─── 编辑弹窗 ─────────────────────────────────────────────────────────────────
  const openEditDialog = (img: ImageRow) => {
    setEditingImageId(img.id);
    setEditAgentType(img.agentType);
    setEditAgentVersion(img.agentVersion);
    setEditVersionError("");
    setShowEditDialog(true);
  };

  const handleEditVersionChange = (v: string) => {
    setEditAgentVersion(v);
    if (v && editAgentType) {
      const cfg = getKernel(editKernel);
      if (!cfg.versionRegex.test(v)) {
        setEditVersionError(`格式不正确，请输入 ${cfg.versionPlaceholder.replace("如 ", "")} 格式`);
      } else if (editKernel === "openclaw" && !validateVersion("openclaw", v)) {
        setEditVersionError("日期不合法");
      } else {
        setEditVersionError("");
      }
    } else {
      setEditVersionError("");
    }
  };

  const handleEditSave = () => {
    if (!editAgentType) { toast.error("请选择 Agent 类型"); return; }
    if (!editAgentVersion.trim()) { toast.error("请填写 Agent 版本"); return; }
    if (!validateVersion(editKernel, editAgentVersion)) { toast.error("版本格式不正确"); return; }
    syncImages(images.map((i) =>
      i.id === editingImageId
        ? { ...i, agentType: editAgentType, agentVersion: editAgentVersion.trim() }
        : i
    ));
    setShowEditDialog(false);
    toast.success("镜像信息已更新");
  };

  // ─── 添加 Agent 类型 ─────────────────────────────────────────────────────────
  const openAddTypeDialog = () => {
    setNewTypeLabel("");
    setNewTypeKernel("openclaw");
    setNativeAck(false);
    setAddTypeError({});
    setShowAddTypeDialog(true);
  };

  const validateAddType = (): boolean => {
    const errs: { label?: string } = {};
    const labelTrim = newTypeLabel.trim();
    if (!labelTrim) {
      errs.label = "请输入类型名称";
    } else if (labelTrim.length > 32) {
      errs.label = "类型名称最多 32 个字符";
    } else if (allTypes.some((t) => t.label.toLowerCase() === labelTrim.toLowerCase())) {
      errs.label = "该名称已被使用，请换一个";
    }
    setAddTypeError(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddType = () => {
    if (!validateAddType()) return;
    if (newTypeKernel === "native" && !nativeAck) {
      toast.error("请勾选确认\"允许用户进入该类型 Agent 的终端\"");
      return;
    }
    const labelTrim = newTypeLabel.trim();
    // 自动根据名称生成内部 value，并保证不与现有类型冲突
    let value = nameToValue(labelTrim);
    if (allTypes.some((t) => t.value === value)) {
      value = `${value}-${Date.now().toString(36)}`;
    }
    const next: AgentType = {
      value,
      label: labelTrim,
      isOfficial: false,
      kernel: newTypeKernel,
    };
    syncCustomTypes([...customTypes, next]);
    setShowAddTypeDialog(false);
    toast.success(`已添加 Agent 类型「${next.label}」`);
    setTimeout(() => scrollToType(next.value), 100);
  };

  // ─── 删除自定义类型 ──────────────────────────────────────────────────────────
  const requestRemoveType = (t: AgentType) => {
    if (images.some((i) => i.agentType === t.value)) {
      toast.error("请先删除该类型下所有镜像，再移除类型");
      return;
    }
    if (defaultAgentType === t.value) {
      toast.error("该类型是用户端首选类型，请先切换首选类型");
      return;
    }
    setPendingRemoveType(t);
  };

  const confirmRemoveType = () => {
    if (!pendingRemoveType) return;
    syncCustomTypes(customTypes.filter((t) => t.value !== pendingRemoveType.value));
    toast.success(`已移除 Agent 类型「${pendingRemoveType.label}」`);
    setPendingRemoveType(null);
  };

  const canImport = !!(selectedImageId && importAgentType && importAgentVersion.trim() && !versionError);

  // ─── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-enter flex gap-6">
        {/* 右侧 sticky 锚点导航（DOM 上放在主内容之后通过 order 控制位置） */}
        <aside className="hidden lg:block w-[180px] shrink-0 order-2">
          <div className="sticky top-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-3">Agent 类型</div>
            <nav className="flex flex-col gap-0.5 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
              {displayTypes.map((t) => {
                const typeImages = images.filter((i) => i.agentType === t.value);
                const count = typeImages.length;
                const hasActive = typeImages.some((i) => i.active);
                const isActive = activeAnchor === t.value;
                const isDefault = defaultAgentType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => scrollToType(t.value)}
                    className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-[4px] text-left text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isDefault ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0">
                              <Star className="w-2.5 h-2.5 text-white" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">用户端首选类型</TooltipContent>
                        </Tooltip>
                      ) : hasActive ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">用户端可选</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">用户端不可选</TooltipContent>
                        </Tooltip>
                      )}
                      <span className="truncate">{t.label}</span>
                    </span>
                    <span className={`text-[10px] shrink-0 ${isActive ? "text-blue-500" : "text-gray-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 主内容区 */}
        <div className="flex-1 min-w-0 max-w-[1100px] order-1">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">镜像管理</h1>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              管理不同 Agent 类型的运行环境镜像。启用镜像后该类型在用户端可选，未启用则不可选。
            </p>
          </div>

        {/* 按 agentType 分组展示 */}
        <div className="space-y-6">
          {displayTypes.map((agentTypeObj) => {
            const agentType = agentTypeObj.value;
            // 公共镜像排在前面
            const typeImages = images
              .filter((i) => i.agentType === agentType)
              .sort((a, b) => {
                if (a.isPublic && !b.isPublic) return -1;
                if (!a.isPublic && b.isPublic) return 1;
                return 0;
              });
            const isDefault = defaultAgentType === agentType;
            const isCollapsed = collapsedTypes.has(agentType);
            const activeImg = typeImages.find((i) => i.active);
            const isCustom = !agentTypeObj.isOfficial;
            const isNativeKernel = agentTypeObj.kernel === "native";

            return (
              <div
                key={agentType}
                ref={(el) => { sectionRefs.current[agentType] = el; }}
                data-anchor={agentType}
                className={`rounded-[4px] border overflow-hidden transition-all scroll-mt-6 ${isDefault ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-100"}`}
                style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
              >
                {/* 标题栏 */}
                <div className={`flex items-center justify-between px-6 py-4 ${isDefault ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100" : "bg-white border-b border-gray-50"}`}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button onClick={() => toggleCollapse(agentType)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <h2 className="font-semibold text-gray-900">{agentTypeObj.label}</h2>
                    <span className="text-xs text-gray-400">{typeImages.length} 个镜像</span>

                    {/* 自定义标签（官方不打） */}
                    {isCustom && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100 cursor-default">
                            自定义 Agent 类型
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] text-xs leading-relaxed">由企业自行定义和维护的 Agent 类型</TooltipContent>
                      </Tooltip>
                    )}

                    {/* 内核标签（仅自定义类型展示） */}
                    {isCustom && (
                      isNativeKernel ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-100 cursor-default">
                              <Layers className="w-3 h-3" /> 自定义内核
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
                            该类型不基于任何已知 Agent 内核，部分管控台功能不可用
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 cursor-default">
                              <Layers className="w-3 h-3" /> 兼容 {getKernel(agentTypeObj.kernel).label} 内核
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
                            该类型与 {getKernel(agentTypeObj.kernel).label} 完全兼容，管控台功能与 {getKernel(agentTypeObj.kernel).label} 保持一致。请务必先验证管控台功能可用性，排除不兼容问题
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}

                    {/* 自定义内核：温馨提示图标 */}
                    {isCustom && isNativeKernel && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center text-amber-500 cursor-help">
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[320px] text-xs leading-relaxed">
                          <div className="font-semibold mb-1">温馨提示</div>
                          <div className="mb-1">{NATIVE_KERNEL_NOTICE_TITLE}：</div>
                          {NATIVE_KERNEL_NOTICE_LINES.map((l, i) => (
                            <div key={i} className="mt-0.5">{l}</div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* 用户端可选状态 */}
                    {activeImg ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100 cursor-default">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> 用户端可选
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
                          当前启用：{activeImg.name}（{activeImg.agentVersion || "未知版本"}），支持用户创建该类型 Agent；一键升级将此镜像版本作为升级目标版本
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 cursor-default">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" /> 用户端不可选
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs leading-relaxed">
                          未启用镜像，用户端无法选择此类型创建 Agent。启用一个镜像即可开放
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* 用户端首选标记 */}
                    {isDefault && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white cursor-default">
                            <Star className="w-3 h-3" /> 用户端首选
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                          用户创建 Agent 时会优先选此类型，也支持手动切换
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* 设为用户端首选按钮（移到左侧） */}
                    {!isDefault && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleSetDefaultType(agentType)}>
                            <Star className="w-3 h-3 mr-1" /> 设为用户端首选
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs leading-relaxed">设为用户端优先选择的 Agent 类型</TooltipContent>
                      </Tooltip>
                    )}

                    {/* 自定义类型可移除 */}
                    {isCustom && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => requestRemoveType(agentTypeObj)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            title="移除此 Agent 类型"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>移除此 Agent 类型</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* 右侧：应用范围 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ImageScopePopover
                      scopeData={getTypeScope(agentType)}
                      groups={ALL_GROUPS}
                      onSave={(scope, groupIds) => handleScopeChange(agentType, scope, groupIds)}
                    />
                  </div>
                </div>

                {/* 镜像列表 */}
                {!isCollapsed && (
                  <div className="bg-white">
                    {typeImages.length > 0 ? (
                      <>
                        <table className="w-full" style={{ tableLayout: "fixed" }}>
                          <colgroup>
                            <col style={{ width: "26%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "8%" }} />
                            <col style={{ width: "8%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "22%" }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-gray-50 bg-gray-50/50">
                              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">镜像名称 / ID</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 tracking-wide whitespace-nowrap">Agent 版本</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">镜像类型</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">状态</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">操作系统</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">导入时间</th>
                              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {typeImages.map((img) => (
                              <tr
                                key={img.id}
                                className={`hover:bg-gray-50/50 transition-colors ${img.isPublic ? "bg-blue-50/40" : ""}`}
                                style={img.isPublic ? { borderLeft: "3px solid #3B82F6" } : { borderLeft: "3px solid transparent" }}
                              >
                                <td className="px-6 py-4">
                                  <div className="min-w-0 overflow-hidden">
                                    <p className="text-sm font-medium text-gray-900 truncate" title={img.name}>{img.name}</p>
                                    <p className="text-xs text-gray-400 font-mono truncate" title={img.id}>{img.id}</p>
                                    {img.isPublic && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap mt-1 cursor-default">腾讯云维护</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[260px] text-xs leading-relaxed">由腾讯云维护，自动跟进平台程序版本更新，无需企业自行维护</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  {img.agentVersion ? (
                                    <span className="text-sm text-gray-700 font-mono">{img.agentVersion}</span>
                                  ) : img.active ? (
                                    <div className="flex items-start gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                                        ⚠ 未填写版本
                                      </span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help inline-flex">
                                            <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                                          该镜像正在使用中但缺少版本信息，可能影响用户端版本显示。建议编辑填写版本
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400 leading-tight">
                                      <span className="text-orange-500">未填写</span>
                                      <br />
                                      <span>请编辑版本信息</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                  {img.isPublic ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 cursor-default">公共</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">由腾讯云维护，自动跟进平台程序版本更新，无需企业自行维护</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100 cursor-default">自定义</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">由企业自行制作和维护，腾讯云不负责版本更新和维护</TooltipContent>
                                    </Tooltip>
                                  )}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                  {(() => {
                                    const s = IMAGE_STATE_MAP[img.state] ?? { label: img.state, color: "text-yellow-700", bg: "bg-yellow-50", dot: "bg-yellow-400" };
                                    return (
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot} ${s.animate ? "animate-pulse" : ""}`} />
                                        {s.label}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-3 py-4 text-sm text-gray-600" title={img.os}>{img.os}</td>
                                <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                                  {img.createTime ? (
                                    <div className="leading-tight">
                                      <span className="whitespace-nowrap">{img.createTime.split(" ")[0]}</span>
                                    </div>
                                  ) : "—"}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">启用</span>
                                      {!img.agentVersion && !img.active ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                              <Switch checked={false} disabled className="opacity-40 cursor-not-allowed" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                                            缺少 Agent 版本信息，无法启用。请编辑填写版本
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : !img.agentVersion && img.active ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                              <Switch
                                                checked={img.active}
                                                onCheckedChange={() => handleToggleActive(img.id, agentType)}
                                              />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                                            <span className="text-amber-500 font-medium">⚠ 该镜像缺少版本信息</span>，建议编辑填写版本
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Switch
                                          checked={img.active}
                                          onCheckedChange={() => handleToggleActive(img.id, agentType)}
                                        />
                                      )}
                                    </div>

                                    {/* 编辑按钮（仅自定义镜像） */}
                                    {!img.isPublic && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button onClick={() => openEditDialog(img)} className="text-gray-400 hover:text-blue-500 transition-colors" title="编辑镜像信息">
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>编辑 Agent 类型和版本</TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* 删除按钮 */}
                                    {img.isPublic ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-gray-200 cursor-not-allowed">
                                            <Trash2 className="w-4 h-4" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">公共镜像不可删除</TooltipContent>
                                      </Tooltip>
                                    ) : img.active ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-gray-200 cursor-not-allowed">
                                            <Trash2 className="w-4 h-4" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">启用中的镜像无法删除</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <button
                                        onClick={() => handleDelete(img)}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                        title="删除镜像"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* 分组底部：导入镜像 */}
                        <div className="px-6 py-3 border-t border-gray-50 flex justify-start">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => openImportForType(agentType)}>
                                <Plus className="w-3 h-3 mr-1" /> 导入镜像
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-xs leading-relaxed">支持导入公共镜像（腾讯云维护）或自定义镜像（企业维护）</TooltipContent>
                          </Tooltip>
                        </div>
                      </>
                    ) : (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm text-gray-400 mb-2">暂无镜像</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => openImportForType(agentType)}>
                              <Plus className="w-3 h-3 mr-1" /> 导入镜像
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px] text-xs leading-relaxed">支持导入公共镜像（腾讯云维护）或自定义镜像（企业维护）</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

            {/* 底部：添加自定义 Agent 类型 */}
            <button
              onClick={openAddTypeDialog}
              className="w-full rounded-[4px] border-2 border-dashed border-blue-300 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/70 transition-all py-6 flex flex-col items-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-[4px] flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold transition-colors" style={{ color: "#1447E6" }}>添加自定义 Agent 类型</span>
              <span className="text-xs text-gray-500">支持基于现有 Agent 内核扩展，或添加完全自定义的 Agent 类型</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 导入镜像弹窗（公共 + 自定义） ─── */}
      <Dialog open={showImportDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          onClick={() => { if (showImageList) { setShowImageList(false); setSearchQuery(""); } }}
        >
          <DialogHeader>
            <DialogTitle>导入镜像</DialogTitle>
          </DialogHeader>

          <div className="flex items-start gap-2 bg-gray-50 rounded-[4px] px-3 py-2.5 -mt-1">
            <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              以下镜像均为已在腾讯云创建好的镜像。若需要创建新镜像，请前往{" "}
              <a href="https://console.cloud.tencent.com/cvm/image" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-0.5">
                腾讯云云服务器控制台 <ExternalLink className="w-3 h-3" />
              </a>{" "}操作后，再回此处刷新并导入。
            </p>
          </div>

          <div className="space-y-4 py-1">
            {/* Step 1: 选择镜像 */}
            <div className="space-y-2">
              <Label>选择镜像 <span className="text-red-400">*</span></Label>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowImageList(!showImageList); }}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-[4px] bg-gray-50 text-sm text-gray-600 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
                >
                  <span>
                    {selectedImageId
                      ? (selectedCloudImage?.imageName || selectedImageId)
                      : "请选择要导入的镜像"}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50"
                  title="刷新镜像列表"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
              <p className="text-xs text-gray-400">镜像大小不允许超过50GiB</p>

              {showImageList && (
                <div ref={imageListRef} className="border border-gray-200 rounded-[4px] bg-white overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="relative p-2 border-b border-gray-100">
                    <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索镜像 ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-[4px] bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredPublic.length > 0 && (
                      <div>
                        <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                          公共镜像 <span className="text-gray-400 font-normal">（腾讯云维护）</span>
                        </div>
                        {filteredPublic.map((img) => (
                          <div
                            key={img.imageId}
                            onClick={() => handleSelectImage(img.imageId)}
                            className={`px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${selectedImageId === img.imageId ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-900 truncate">{img.imageName}</span>
                              <span className="text-xs text-gray-400 font-mono shrink-0">{img.imageId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {filteredCustom.length > 0 && (
                      <div>
                        <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                          自定义镜像 <span className="text-gray-400 font-normal">（企业维护）</span>
                        </div>
                        {filteredCustom.map((img) => (
                          <div
                            key={img.imageId}
                            onClick={() => handleSelectImage(img.imageId)}
                            className={`px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${selectedImageId === img.imageId ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-900 truncate">{img.imageName}</span>
                              <span className="text-xs text-gray-400 font-mono shrink-0">{img.imageId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {filteredImages.length === 0 && (
                      <div className="px-3 py-8 text-center text-sm text-gray-400">未找到匹配的镜像</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 自定义镜像选中时的提示 */}
            {isCustomImageSelected && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[4px] px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  请确认 Agent 类型选择正确，类型不匹配将导致管控台功能无法使用。
                </p>
              </div>
            )}

            {/* Step 2: Agent 类型 */}
            <div className={`space-y-2 transition-opacity ${!selectedImageId ? "opacity-50 pointer-events-none" : ""}`}>
              <Label>Agent 类型 <span className="text-red-400">*</span></Label>
              {!selectedImageId ? (
                <div className="px-3 py-2 border border-gray-200 rounded-[4px] bg-gray-100 text-sm text-gray-400">
                  请先选择镜像
                </div>
              ) : isPublicSelected ? (
                <div className="px-3 py-2 border border-gray-200 rounded-[4px] bg-gray-100 text-sm text-gray-500">
                  {getTypeLabel(importAgentType)}
                  <span className="text-xs text-gray-400 ml-2">（公共镜像自动匹配）</span>
                </div>
              ) : (
                <Select value={importAgentType} onValueChange={(v) => { setImportAgentType(v); setImportAgentVersion(""); setVersionError(""); }}>
                  <SelectTrigger className="bg-gray-50 w-full"><SelectValue placeholder="请选择 Agent 类型" /></SelectTrigger>
                  <SelectContent>
                    {allTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-1.5">
                          {t.label}
                          {!t.isOfficial && <span className="text-[10px] text-purple-500">(自定义)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Step 3: Agent 版本 */}
            <div className={`space-y-2 transition-opacity ${!selectedImageId ? "opacity-50 pointer-events-none" : ""}`}>
              <Label>Agent 版本 <span className="text-red-400">*</span></Label>
              {!selectedImageId ? (
                <div className="px-3 py-2 border border-gray-200 rounded-[4px] bg-gray-100 text-sm text-gray-400">
                  请先选择镜像
                </div>
              ) : isPublicSelected ? (
                <div className="px-3 py-2 border border-gray-200 rounded-[4px] bg-gray-100 text-sm text-gray-500 font-mono">
                  {importAgentVersion}
                  <span className="text-xs text-gray-400 ml-2 font-normal">（公共镜像自动匹配）</span>
                </div>
              ) : (
                <>
                  <Input
                    placeholder={importAgentType ? getKernel(importKernel).versionPlaceholder : "请先选择 Agent 类型"}
                    value={importAgentVersion}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    className={`bg-gray-50 font-mono ${versionError ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                    disabled={!importAgentType}
                  />
                  {versionError && <p className="text-xs text-red-500">{versionError}</p>}
                  {importAgentType && !versionError && (
                    <p className="text-xs text-gray-400">格式：{getKernel(importKernel).versionPlaceholder}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>取消</Button>
            <Button
              onClick={handleImport}
              disabled={!canImport}
            >
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 编辑自定义镜像弹窗 ─── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑镜像信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const editImg = images.find((i) => i.id === editingImageId);
              return editImg ? (
                <div className="rounded-[4px] border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">镜像名称 / ID</p>
                    <p className="text-sm font-semibold text-gray-900">{editImg.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{editImg.id}</p>
                  </div>
                  <div className="px-4 py-2.5 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">当前类型</span>
                      <span className="font-medium text-gray-700">{editImg.agentType ? getTypeLabel(editImg.agentType) : "未设置"}</span>
                    </div>
                    <div className="w-px h-3 bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">当前版本</span>
                      <span className="font-medium text-gray-700 font-mono">{editImg.agentVersion || "未设置"}</span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
            <div className="space-y-2">
              <Label>Agent 类型 <span className="text-red-400">*</span></Label>
              <Select value={editAgentType} onValueChange={(v) => { setEditAgentType(v); setEditAgentVersion(""); setEditVersionError(""); }}>
                <SelectTrigger className="bg-gray-50 w-full"><SelectValue placeholder="请选择 Agent 类型" /></SelectTrigger>
                <SelectContent>
                  {allTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-1.5">
                        {t.label}
                        {!t.isOfficial && <span className="text-[10px] text-purple-500">(自定义)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agent 版本 <span className="text-red-400">*</span></Label>
              <Input
                placeholder={editAgentType ? getKernel(editKernel).versionPlaceholder : "请先选择 Agent 类型"}
                value={editAgentVersion}
                onChange={(e) => handleEditVersionChange(e.target.value)}
                className={`bg-gray-50 font-mono ${editVersionError ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                disabled={!editAgentType}
              />
              {editVersionError && <p className="text-xs text-red-500">{editVersionError}</p>}
              {editAgentType && !editVersionError && (
                <p className="text-xs text-gray-400">格式：{getKernel(editKernel).versionPlaceholder}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button
              onClick={handleEditSave}
              disabled={!editAgentType || !editAgentVersion.trim() || !!editVersionError}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 添加自定义 Agent 类型弹窗 ─── */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加自定义 Agent 类型</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              支持基于现有 Agent 内核扩展，或添加完全自定义的 Agent 类型
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 类型名称 */}
            <div className="space-y-2">
              <Label>类型名称 <span className="text-red-400">*</span></Label>
              <Input
                placeholder="例如：CustomClaw"
                value={newTypeLabel}
                maxLength={32}
                autoComplete="off"
                onChange={(e) => { setNewTypeLabel(e.target.value); if (addTypeError.label) setAddTypeError({ ...addTypeError, label: undefined }); }}
                className={`bg-gray-50 ${addTypeError.label ? "border-red-300 focus-visible:ring-red-500" : ""}`}
              />
              {addTypeError.label && <p className="text-xs text-red-500">{addTypeError.label}</p>}
              <p className="text-xs text-gray-400">用户端展示的类型名称，可包含中英文，需保持唯一</p>
            </div>

            {/* 兼容内核 */}
            <div className="space-y-2">
              <Label>兼容内核 <span className="text-red-400">*</span></Label>
              <RadioGroup
                value={newTypeKernel}
                onValueChange={(v) => { setNewTypeKernel(v as KernelValue); setNativeAck(false); }}
                className="space-y-2"
              >
                {KERNELS.map((k) => {
                  const checked = newTypeKernel === k.value;
                  const isNative = k.value === "native";
                  return (
                    <label
                      key={k.value}
                      htmlFor={`kernel-${k.value}`}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-[4px] border cursor-pointer transition-colors ${
                        checked
                          ? (isNative ? "border-orange-300 bg-orange-50/40" : "border-blue-300 bg-blue-50/40")
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <RadioGroupItem id={`kernel-${k.value}`} value={k.value} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">
                            {isNative ? "自定义内核 / 不兼容上述已知类型" : `兼容 ${k.label}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                          {isNative
                            ? "该类型为自定义内核，与上述已知 Agent 内核均不兼容；部分管控台功能将不可用，详见下方说明"
                            : `该类型与 ${k.label} 完全兼容，管控台功能与 ${k.label} 保持一致`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* 兼容内核 - 强提醒 */}
            {newTypeKernel !== "native" && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[4px] px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  自定义 Agent 请务必先验证管控台功能可用性，排除不兼容问题。
                </p>
              </div>
            )}

            {/* 自定义内核 - 温馨提示 + 必须勾选 */}
            {newTypeKernel === "native" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-[4px] px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-orange-700 leading-relaxed space-y-1">
                    <p className="font-semibold">{NATIVE_KERNEL_NOTICE_TITLE}：</p>
                    {NATIVE_KERNEL_NOTICE_LINES.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-2 px-3 py-2 rounded-[4px] border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <Checkbox
                    id="native-ack"
                    checked={nativeAck}
                    onCheckedChange={(c) => setNativeAck(!!c)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-gray-700 leading-relaxed">
                    我已知晓上述限制，且确认<span className="font-medium">允许用户进入该类型 Agent 的终端</span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>取消</Button>
            <Button
              onClick={handleAddType}
              disabled={!newTypeLabel.trim() || (newTypeKernel === "native" && !nativeAck)}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 删除自定义类型 二次确认 ─── */}
      <Dialog open={!!pendingRemoveType} onOpenChange={(open) => { if (!open) setPendingRemoveType(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              移除 Agent 类型
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-700 leading-relaxed">
              确认移除自定义类型「<span className="font-semibold">{pendingRemoveType?.label}</span>」？
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              移除后该类型将不再展示，可重新添加。此操作不会影响已存在的镜像数据。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemoveType(null)}>取消</Button>
            <Button
              onClick={confirmRemoveType}
              variant="destructive"
            >
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
