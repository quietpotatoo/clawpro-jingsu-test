/**
 * 分组弹窗组件
 *   - 新建分组（GroupFormDialog）
 *   - 编辑分组（GroupFormDialog mode="edit"）
 *   - 添加子分组（GroupFormDialog mode="addChild"）
 *   - 删除分组确认（DeleteGroupDialog）
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  X,
  ChevronsUpDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UserGroup } from "./types";
import {
  buildGroupTree,
  type GroupTreeNode,
  findGroupNode,
  getResourcesOfGroup,
} from "./health";
import { MOCK_USER_GROUP_AGENTS } from "./mock";

// ─── 下拉树形选择器（单选，用于选择上级分组） ────────────────────
function ParentDropdownSelector({
  groups,
  value,
  onChange,
  disabled,
  excludeIds,
}: {
  groups: UserGroup[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** 排除的分组 id 集合（编辑时排除自身及子孙） */
  excludeIds?: Set<string>;
}) {
  const tree = useMemo(
    () => buildGroupTree(groups.filter((g) => g.source === "manual" || g.source === "oneid-group")),
    [groups]
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const walk = (nodes: GroupTreeNode[]) => {
      nodes.forEach((n) => {
        s.add(n.id);
        walk(n.children);
      });
    };
    walk(tree);
    return s;
  });

  // 点击外部关闭下拉
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // 打开时聚焦搜索框并清空搜索
  useEffect(() => {
    if (dropdownOpen) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [dropdownOpen]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 获取选中分组的完整路径名称（如 "研发组/研发-前端"）
  const selectedFullPath = useMemo(() => {
    if (!value) return null;
    const node = findGroupNode(tree, value);
    if (!node) return null;
    // node.path 格式 "A / B"，转为 "A/B"
    return node.path.replace(/\s*\/\s*/g, "/");
  }, [value, tree]);

  // 搜索过滤：收集匹配节点 id 及其所有祖先 id
  const matchedIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null 表示不过滤
    const q = searchQuery.trim().toLowerCase();
    const matched = new Set<string>();
    const walkCollect = (nodes: GroupTreeNode[]) => {
      for (const n of nodes) {
        if (excludeIds?.has(n.id)) continue;
        if (n.name.toLowerCase().includes(q)) {
          // 添加该节点及其所有祖先
          for (const pid of n.pathIds) matched.add(pid);
        }
        walkCollect(n.children);
      }
    };
    walkCollect(tree);
    return matched;
  }, [searchQuery, tree, excludeIds]);

  const renderNode = (node: GroupTreeNode): React.ReactNode => {
    if (excludeIds?.has(node.id)) return null;
    // 如果正在搜索且该节点不在匹配集中，隐藏
    if (matchedIds && !matchedIds.has(node.id)) return null;

    const isSelected = value === node.id;
    const isExp = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    // 搜索时强制展开所有匹配路径
    const shouldShow = matchedIds ? true : isExp;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 h-8 px-2 rounded-[4px] cursor-pointer text-sm transition-colors ${
            isSelected
              ? "bg-blue-50 text-blue-600"
              : "text-gray-700 hover:bg-gray-50"
          }`}
          style={{ paddingLeft: 8 + node.depth * 16 }}
          onClick={() => {
            onChange(isSelected ? null : node.id);
            if (!isSelected) setDropdownOpen(false);
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
            >
              {(shouldShow) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate flex-1">{node.name}</span>
        </div>
        {hasChildren && shouldShow && node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* 触发器 */}
      <div
        className={`w-full h-9 px-3 flex items-center gap-2 text-sm bg-white border rounded-[4px] cursor-pointer transition-colors ${dropdownOpen ? "border-blue-300 ring-2 ring-blue-50" : "border-gray-200"} ${disabled ? "opacity-50 pointer-events-none bg-gray-50" : ""}`}
        onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
      >
        {selectedFullPath ? (
          <span className="flex items-center gap-1 flex-1 min-w-0">
            <span className="truncate text-gray-900">{selectedFullPath}</span>
            {!disabled && (
              <button
                type="button"
                className="w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ) : (
          <span className="flex-1 text-gray-400">选填，不选则为一级分组</span>
        )}
        <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </div>

      {/* 下拉面板 */}
      {dropdownOpen && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-200 rounded-[4px] shadow-lg overflow-hidden">
          {/* 搜索框 */}
          <div className="px-2 pt-2 pb-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5 h-8 px-2 bg-gray-50 border border-gray-200 rounded-[4px]">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索分组"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          {/* 树形列表 */}
          <div className="max-h-[180px] overflow-y-auto p-1.5">
            {tree.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">
                暂无可选分组
              </div>
            ) : matchedIds && matchedIds.size === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">
                未找到匹配分组
              </div>
            ) : (
              tree.map(renderNode)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 新建 / 编辑 / 添加子分组弹窗 ──────────────────────────
export interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: UserGroup[];
  /** "create" | "edit" | "addChild" */
  mode: "create" | "edit" | "addChild";
  /** 编辑/添加子分组时的参考分组 */
  target?: { id: string; name: string; parentId: string | null } | null;
  onConfirm: (name: string, parentId: string | null) => void;
}

export function GroupFormDialog({
  open,
  onOpenChange,
  groups,
  mode,
  target,
  onConfirm,
}: GroupFormDialogProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 构建树用于路径查找
  const tree = useMemo(
    () => buildGroupTree(groups.filter((g) => g.source === "manual" || g.source === "oneid-group")),
    [groups]
  );

  // 初始化
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && target) {
      setName(target.name);
      setParentId(target.parentId);
    } else if (mode === "addChild" && target) {
      setName("");
      setParentId(target.id);
    } else {
      setName("");
      setParentId(null);
    }
  }, [open, mode, target]);

  // 编辑时排除自身及子孙（不能把自己设为自己或子孙的子节点）
  const excludeIds = useMemo(() => {
    if (mode !== "edit" || !target) return undefined;
    const s = new Set<string>();
    const t = buildGroupTree(groups.filter((g) => g.source === "manual"));
    const walk = (nodes: GroupTreeNode[]) => {
      for (const n of nodes) {
        if (n.id === target.id) {
          const addAll = (node: GroupTreeNode) => {
            s.add(node.id);
            node.children.forEach(addAll);
          };
          addAll(n);
          return;
        }
        walk(n.children);
      }
    };
    walk(t);
    return s;
  }, [mode, target, groups]);

  // 计算路径前缀：根据选中的上级分组，拼接 "A/B/" 格式
  const pathPrefix = useMemo(() => {
    if (!parentId) return "";
    const node = findGroupNode(tree, parentId);
    if (!node) return "";
    // node.path 格式是 "A / B"，转为 "A/B/"
    return node.path.replace(/\s*\/\s*/g, "/") + "/";
  }, [parentId, tree]);

  // 完整分组名称 = pathPrefix + name
  const fullName = pathPrefix + name.trim();

  const isDuplicate = groups.some(
    (g) =>
      g.name.trim() === name.trim() &&
      g.source === "manual" &&
      (mode !== "edit" || g.id !== target?.id)
  );

  const isValid = name.trim().length > 0 && !isDuplicate;

  const title =
    mode === "create"
      ? "新建分组"
      : mode === "edit"
        ? "编辑分组"
        : "添加子分组";

  const confirmText =
    mode === "create" ? "确认创建" : mode === "edit" ? "保存" : "确认创建";

  // addChild 模式下，上级分组选中且锁定
  const parentLocked = mode === "addChild";

  // 锁定时显示上级名称
  const lockedParentName = parentLocked && target
    ? groups.find((g) => g.id === target.id)?.name ?? target.name
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* 上级分组（在前） */}
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1.5 block">
              上级分组
            </label>
            {parentLocked && lockedParentName ? (
              <div className="h-9 flex items-center px-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-[4px]">
                {lockedParentName}
              </div>
            ) : (
              <ParentDropdownSelector
                groups={groups}
                value={parentId}
                onChange={setParentId}
                excludeIds={excludeIds}
              />
            )}
          </div>

          {/* 分组名称（在后） */}
          <div>
            <label className="text-sm font-medium text-gray-900 mb-1.5 block">
              分组名称<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div
              className="w-full flex items-center h-9 bg-white border border-gray-200 rounded-[4px] transition-colors focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 cursor-text"
              onClick={() => nameInputRef.current?.focus()}
            >
              {pathPrefix && (
                <span className="pl-3 text-sm text-gray-600 whitespace-nowrap shrink-0 pointer-events-none select-none">
                  {pathPrefix}
                </span>
              )}
              <input
                ref={nameInputRef}
                type="text"
                placeholder="请输入分组名称"
                className="flex-1 h-full px-3 text-sm bg-transparent outline-none placeholder:text-gray-400"
                style={{ paddingLeft: pathPrefix ? "0" : undefined }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {isDuplicate && name.trim() && (
              <p className="text-xs text-red-500 mt-1">分组名称已存在</p>
            )}
            <p className="text-xs text-gray-400 mt-1.5">
              分组名称为唯一标识，不能与已有分组重名，创建后支持修改
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              onConfirm(name.trim(), parentId);
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除分组确认弹窗 ──────────────────────────────────────
export interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: { id: string; name: string } | null;
  memberCount: number;
  groups: UserGroup[];
  onConfirm: (groupId: string) => void;
}

/** 统计某分组下的 Agent 实例（仅该分组自身，不递归子分组） */
function getGroupAgentStats(groupId: string) {
  let instanceCount = 0;
  const userIds = new Set<string>();
  for (const [userId, groupMap] of Object.entries(MOCK_USER_GROUP_AGENTS)) {
    const instances = groupMap[groupId];
    if (instances && instances.length > 0) {
      instanceCount += instances.length;
      userIds.add(userId);
    }
  }
  return { instanceCount, userCount: userIds.size };
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  group,
  memberCount,
  groups,
  onConfirm,
}: DeleteGroupDialogProps) {
  const [configRefreshing, setConfigRefreshing] = useState(false);
  const [agentRefreshing, setAgentRefreshing] = useState(false);

  // 获取关联的资源配置
  const relatedResources = useMemo(
    () => (group ? getResourcesOfGroup(group.id) : []),
    [group]
  );

  const hasRelatedConfigs = relatedResources.length > 0;

  // 按 kind 去重（只关心有哪些类别，不计数）
  const configKinds = useMemo(() => {
    const kinds = new Set<string>();
    relatedResources.forEach((r) => kinds.add(r.kind));
    return Array.from(kinds);
  }, [relatedResources]);

  // 统计该分组下的 Agent 实例
  const agentStats = useMemo(
    () => (group ? getGroupAgentStats(group.id) : { instanceCount: 0, userCount: 0 }),
    [group]
  );
  const hasAgentInstances = agentStats.instanceCount > 0;

  // 是否可以删除：无配置且无实例
  const canDelete = !hasRelatedConfigs && !hasAgentInstances;

  const kindLabel: Record<string, string> = {
    model: "模型",
    channel: "通道",
    skill: "技能",
    agentTool: "Agent 工具",
    memory: "记忆",
    drive: "网盘",
    image: "镜像",
    network: "网络",
    securityGroup: "网络",
    vpc: "网络",
    cls: "CLS 日志服务",
    aiAgentSecurity: "AI Agent 安全",
    platformPolicy: "平台策略",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>删除分组</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">分组名称</span>
            <span className="text-sm font-medium text-gray-900">
              {group?.name}
            </span>
          </div>
          <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">分组内用户数</span>
            <span className="text-sm font-semibold text-gray-800">
              {memberCount} 人
            </span>
          </div>

          {/* 分组专属配置 */}
          <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">分组专属配置</span>
              <button
                className="text-gray-400 hover:text-blue-500 transition-colors"
                title="刷新"
                onClick={() => {
                  setConfigRefreshing(true);
                  setTimeout(() => setConfigRefreshing(false), 1200);
                }}
              >
                {configRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {hasRelatedConfigs ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {configKinds.map((kind) => (
                  <span key={kind} className="badge-shutdown">
                    {kindLabel[kind] ?? kind}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-green-600">无关联配置</span>
            )}
          </div>

          {/* Agent 实例数 */}
          <div className="rounded-[4px] bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">分组下 Agent 实例</span>
              <button
                className="text-gray-400 hover:text-blue-500 transition-colors"
                title="刷新"
                onClick={() => {
                  setAgentRefreshing(true);
                  setTimeout(() => setAgentRefreshing(false), 1200);
                }}
              >
                {agentRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {hasAgentInstances ? (
              <span className="text-sm font-semibold text-gray-800">
                {agentStats.instanceCount} 个实例
              </span>
            ) : (
              <span className="text-sm text-green-600">无 Agent 实例</span>
            )}
          </div>

          {/* 状态提示 */}
          {canDelete ? (
            <div className="rounded-[4px] bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-700">
              该分组无关联配置且无 Agent 实例，可安全删除。删除后组内用户不会被删除，仅解除分组关联。
            </div>
          ) : (
            <div className="rounded-[4px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 space-y-2">
              {hasRelatedConfigs && (
                <p className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                  以上配置的应用范围包含该分组，请先前往对应配置页面移除该分组后再执行删除。
                </p>
              )}
              {hasAgentInstances && (
                <p className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                  该分组下仍有 Agent 实例，请先删除实例后再执行删除。
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => group && onConfirm(group.id)}
            >
              确认删除
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
