/**
 * PlatformPolicy - 平台策略页面
 * 基础信息 → 平台策略
 * 包含：用户配额 / 模型配额 / 功能权限开关
 * 全宽卡片布局，每张卡片支持按分组设置多行规则 + 全部用户兜底行
 */
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Zap, Pencil, Check, X, Terminal, Monitor, Cpu,
  Stethoscope, HelpCircle, Cloud, Info, MessageSquare, Brain,
  BarChart3, MessagesSquare, Plus, Trash2, Search,
  ChevronDown, ChevronRight, Minus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
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
import { MOCK_GROUPS as MOCK_ONEID_GROUPS, MOCK_MANUAL_GROUPS } from "./MemberManagement/mock";
import { buildGroupTree, type GroupTreeNode } from "./MemberManagement/health";
import type { UserGroup, GroupSource } from "./MemberManagement/types";

// ─── 类型 ────────────────────────────────────────────────────────────────────

type TokenLimit = number | "unlimited";

// 网络管理页默认安全组的本地快照（用于平台策略读/补规则）
type SnapshotInboundRule = {
  id: string;
  source: string;
  protocol: string;
  port: string;
  policy: string;
  remark?: string;
};
type DefaultSecurityGroupSnapshot = {
  id?: string;
  name?: string;
  inboundRules: SnapshotInboundRule[];
};

// 端口字段是否覆盖指定目标端口：支持 "ALL" / "80,443" / "6000-7000" / "6080"
function doesPortCoverTarget(port: string, target: number): boolean {
  const trimmed = (port || "").trim();
  if (!trimmed) return false;
  if (trimmed.toUpperCase() === "ALL") return true;
  if (trimmed.includes(",")) return trimmed.split(",").some((p) => doesPortCoverTarget(p, target));
  if (trimmed.includes("-")) {
    const [s, e] = trimmed.split("-").map((x) => Number(x.trim()));
    if (Number.isFinite(s) && Number.isFinite(e)) return s <= target && target <= e;
    return false;
  }
  return Number(trimmed) === target;
}
// 入站规则是否放通了目标端口（源 0.0.0.0/0、允许、TCP/ALL）
function isInboundRuleCoverPort(rule: SnapshotInboundRule, target: number): boolean {
  if (!rule) return false;
  if (rule.source !== "0.0.0.0/0") return false;
  if (rule.policy !== "允许") return false;
  const proto = (rule.protocol || "").toUpperCase();
  if (proto !== "TCP" && proto !== "ALL") return false;
  return doesPortCoverTarget(rule.port, target);
}

interface PolicyRule<T> {
  id: string;
  groupIds: string[]; // 空数组 = 全部用户
  value: T;
}

// ─── 分组数据 ─────────────────────────────────────────────────────────────────

const ALL_GROUPS: UserGroup[] = [...MOCK_ONEID_GROUPS, ...MOCK_MANUAL_GROUPS];

function getGroupPath(groupId: string, groups: UserGroup[]): string {
  const g = groups.find((x) => x.id === groupId);
  if (!g) return groupId;
  const parts: string[] = [g.name];
  let current = g;
  while (current.parentId) {
    const parent = groups.find((x) => x.id === current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(" / ");
}

// ─── 树工具函数 ──────────────────────────────────────────────────────────────

type CheckState = "checked" | "unchecked" | "indeterminate";

/** 节点本身或其任一祖先被选中 */
function isNodeOrAncestorSelected(
  node: GroupTreeNode,
  selectedIds: Set<string>,
  groupMap: Map<string, UserGroup>
): boolean {
  if (selectedIds.has(node.id)) return true;
  let cur: UserGroup | undefined = groupMap.get(node.id);
  while (cur && cur.parentId) {
    if (selectedIds.has(cur.parentId)) return true;
    cur = groupMap.get(cur.parentId);
  }
  return false;
}

/** 任一子孙被选中（不含自身） */
function hasSelectedDescendant(node: GroupTreeNode, selectedIds: Set<string>): boolean {
  for (const c of node.children) {
    if (selectedIds.has(c.id)) return true;
    if (hasSelectedDescendant(c, selectedIds)) return true;
  }
  return false;
}

/** 三态：本身被选=checked；祖先被选=checked；有子孙被选=indeterminate；其他=unchecked */
function getCheckState(
  node: GroupTreeNode,
  selectedIds: Set<string>,
  groupMap: Map<string, UserGroup>
): CheckState {
  if (selectedIds.has(node.id)) return "checked";
  // 祖先被选中 → 自动视为 checked
  let cur: UserGroup | undefined = groupMap.get(node.id);
  while (cur && cur.parentId) {
    if (selectedIds.has(cur.parentId)) return "checked";
    cur = groupMap.get(cur.parentId);
  }
  if (hasSelectedDescendant(node, selectedIds)) return "indeterminate";
  return "unchecked";
}

function getDescendantIds(node: GroupTreeNode): string[] {
  const ids: string[] = [node.id];
  node.children.forEach((c) => ids.push(...getDescendantIds(c)));
  return ids;
}

/**
 * 递归向上聚合：若某父节点的所有直接可用（非 disabled）子节点都已被选中，
 * 则将这些子节点 id 全部移除，换成该父节点 id。继续向上直到无法再聚合。
 */
function aggregateSelection(
  selected: Set<string>,
  roots: GroupTreeNode[],
  disabledIds: Set<string>
): Set<string> {
  const result = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    const walk = (node: GroupTreeNode) => {
      if (node.children.length === 0) return;
      // 先递归处理子节点（自底向上）
      node.children.forEach(walk);
      // 若本节点尚未被选中
      if (result.has(node.id)) return;
      // 所有直接子节点都必须可聚合：非 disabled 且都已选中
      const hasDisabled = node.children.some((c) => disabledIds.has(c.id));
      if (hasDisabled) return;
      const allSelected = node.children.every((c) => result.has(c.id));
      if (!allSelected) return;
      // 聚合：移除所有直接子节点，加入本节点
      node.children.forEach((c) => result.delete(c.id));
      result.add(node.id);
      changed = true;
    };
    roots.forEach(walk);
  }
  return result;
}

const SOURCE_LABELS: Record<GroupSource, string> = {
  "oneid-dept": "部门",
  "oneid-group": "用户组",
  "manual": "自定义分组",
};
// 选择框内只展示部门和自定义分组（不含用户组）
const SOURCE_ORDER: GroupSource[] = ["oneid-dept", "manual"];

// ─── 分组选择器（带标签输入框 + 树形 Popover，勾选即生效） ─────────────────────

function GroupTagSelector({
  selectedIds,
  disabledIds,
  onChange,
}: {
  selectedIds: string[];
  disabledIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState(false);

  // 只保留部门和自定义分组（不含用户组）
  const visibleGroups = useMemo(
    () => ALL_GROUPS.filter((g) => SOURCE_ORDER.includes(g.source)),
    []
  );
  const groupMap = useMemo(
    () => new Map(visibleGroups.map((g) => [g.id, g])),
    [visibleGroups]
  );

  // 按 source 分桶 + 建树
  const groupsBySource = useMemo(() => {
    const buckets: Record<string, UserGroup[]> = { "oneid-dept": [], manual: [] };
    visibleGroups.forEach((g) => { if (buckets[g.source]) buckets[g.source].push(g); });
    return buckets;
  }, [visibleGroups]);
  const activeSources = useMemo(
    () => SOURCE_ORDER.filter((s) => (groupsBySource[s] || []).length > 0),
    [groupsBySource]
  );
  const treesMap = useMemo(() => {
    const map: Record<string, GroupTreeNode[]> = {};
    activeSources.forEach((s) => { map[s] = buildGroupTree(groupsBySource[s] || []); });
    return map;
  }, [activeSources, groupsBySource]);

  // 所有可见分组的根（用于聚合算法遍历）
  const allRoots = useMemo(
    () => activeSources.flatMap((s) => treesMap[s] || []),
    [activeSources, treesMap]
  );

  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);

  // 打开时：默认展开已选祖先 + 根节点
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSearch("");
      const expandSet = new Set<string>();
      selectedIds.forEach((gid) => {
        let cur = groupMap.get(gid);
        while (cur && cur.parentId) {
          expandSet.add(cur.parentId);
          cur = groupMap.get(cur.parentId);
        }
      });
      activeSources.forEach((s) => {
        treesMap[s]?.forEach((root) => expandSet.add(root.id));
      });
      setExpanded(expandSet);
    }
    setOpen(v);
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 查找节点所在树的某个具体 GroupTreeNode（用于取它的 children / 子孙）
  const findTreeNode = (id: string): GroupTreeNode | null => {
    const walk = (nodes: GroupTreeNode[]): GroupTreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    return walk(allRoots);
  };

  /**
   * 点击节点：
   * - 本身已选 → 移除
   * - 祖先已选（自动 checked）→ 展开祖先为除当前路径外的兄弟子节点
   * - 半选（indeterminate）→ 清空所有子孙，加入自身
   * - 未选 → 加入自身
   * 最后执行递归向上聚合
   */
  const toggleNode = (node: GroupTreeNode) => {
    if (disabledSet.has(node.id)) return;
    const ids = new Set(selectedIds);

    // 祖先中被选中的最近一个
    let ancestorSelectedId: string | null = null;
    let cur: UserGroup | undefined = groupMap.get(node.id);
    while (cur && cur.parentId) {
      if (ids.has(cur.parentId)) { ancestorSelectedId = cur.parentId; break; }
      cur = groupMap.get(cur.parentId);
    }

    if (ids.has(node.id)) {
      // 本身已选 → 移除
      ids.delete(node.id);
    } else if (ancestorSelectedId) {
      // 祖先已选中 → 展开该祖先：移除祖先，加入祖先到 node 路径上所有节点的"兄弟"
      // 即：沿 祖先 → node 的路径，每一步把当前节点的所有非路径子节点都选上，最终排除 node
      ids.delete(ancestorSelectedId);
      // 从 ancestorSelectedId 沿路径走到 node
      // 构造 node → ancestor 的路径
      const pathNodes: UserGroup[] = [];
      let p: UserGroup | undefined = groupMap.get(node.id);
      while (p && p.id !== ancestorSelectedId) {
        pathNodes.push(p);
        p = p.parentId ? groupMap.get(p.parentId) : undefined;
      }
      // 反转为 ancestor下的第一层 → ... → node 的父级
      pathNodes.reverse();
      // 起点：祖先节点的 tree
      let cursor = findTreeNode(ancestorSelectedId);
      // 从祖先一层层下降，将每层的"非下一跳"子节点选上
      for (let i = 0; i < pathNodes.length; i++) {
        const nextHopId = pathNodes[i].id;
        if (!cursor) break;
        cursor.children.forEach((c) => {
          if (c.id !== nextHopId && !disabledSet.has(c.id)) ids.add(c.id);
        });
        cursor = cursor.children.find((c) => c.id === nextHopId) || null;
      }
      // 最后一步：在 node 的父层已处理，node 本身不加入
    } else {
      // 本身未选 + 祖先也没选
      const state = hasSelectedDescendant(node, ids) ? "indeterminate" : "unchecked";
      if (state === "indeterminate") {
        // 清空所有子孙（包括 disabled 的也要清，避免残留）
        getDescendantIds(node).forEach((d) => ids.delete(d));
      }
      // 加入自身
      ids.add(node.id);
    }

    // 递归向上聚合
    const aggregated = aggregateSelection(ids, allRoots, disabledSet);
    onChange(Array.from(aggregated));
  };

  // 搜索过滤
  const matchedIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return new Set(
      visibleGroups
        .filter((g) => g.name.toLowerCase().includes(q) || getGroupPath(g.id, visibleGroups).toLowerCase().includes(q))
        .map((g) => g.id)
    );
  }, [search, visibleGroups]);
  const isVisible = (node: GroupTreeNode): boolean => {
    if (!matchedIds) return true;
    if (matchedIds.has(node.id)) return true;
    return node.children.some(isVisible);
  };

  const renderNode = (node: GroupTreeNode, depth: number) => {
    if (!isVisible(node)) return null;
    const checkState = getCheckState(node, new Set(selectedIds), groupMap);
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isDisabled = disabledSet.has(node.id);

    const nameSpan = <span className="text-xs text-gray-700 truncate">{node.name}</span>;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => !isDisabled && toggleNode(node)}
          disabled={isDisabled}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] transition-colors text-left ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <span
            className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
              checkState === "checked" || checkState === "indeterminate"
                ? "bg-blue-500 border-blue-500"
                : "border-gray-300 bg-white"
            }`}
          >
            {checkState === "checked" && <Check className="w-2.5 h-2.5 text-white" />}
            {checkState === "indeterminate" && <Minus className="w-2.5 h-2.5 text-white" />}
          </span>
          {isDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>{nameSpan}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs max-w-[240px] leading-relaxed">
                该分组已设置策略，每个分组只允许有一个平台策略
              </TooltipContent>
            </Tooltip>
          ) : (
            nameSpan
          )}
        </button>
        {hasChildren && isExpanded && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="relative w-full min-h-7 px-2 py-1 rounded-[4px] border border-gray-200 bg-white hover:border-blue-300 transition-colors cursor-pointer flex items-center flex-wrap gap-1 pr-7"
        >
          {selectedIds.length === 0 ? (
            <span className="text-xs text-gray-400 px-1">选择分组…</span>
          ) : (
            selectedIds.map((id) => {
              const path = getGroupPath(id, ALL_GROUPS);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] max-w-full"
                >
                  <span className="truncate">{path}</span>
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
              );
            })
          )}
          {hover && selectedIds.length > 0 && (
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
        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {activeSources.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">暂无分组</p>
          ) : (
            activeSources.map((source) => {
              const trees = treesMap[source] || [];
              const hasVisibleTrees = trees.some(isVisible);
              if (!hasVisibleTrees) return null;
              return (
                <div key={source} className="mb-1.5 last:mb-0">
                  <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">{SOURCE_LABELS[source]}</div>
                  {trees.map((root) => renderNode(root, 0))}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 分组名称展示（保存后的只读态：单行 + +N 折叠） ──────────────────────────

function GroupBadges({ groupIds }: { groupIds: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(groupIds.length);

  const paths = useMemo(
    () => groupIds.map((id) => getGroupPath(id, ALL_GROUPS)),
    [groupIds]
  );

  useLayoutEffect(() => {
    if (groupIds.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    // 先尝试放全部（在 effect 开始时暂时设为全部，让 DOM 渲染出所有标签供测量）
    const computeVisible = () => {
      const available = container.clientWidth;
      if (available <= 0) return;

      // 间隙宽度（gap-1 = 4px）
      const gap = 4;
      // 逐个累加宽度找到能塞下的最大 n
      let totalW = 0;
      let fitCount = 0;
      for (let i = 0; i < paths.length; i++) {
        const el = tagRefs.current[i];
        if (!el) break;
        const w = el.offsetWidth;
        const add = totalW === 0 ? w : w + gap;
        if (totalW + add <= available) {
          totalW += add;
          fitCount = i + 1;
        } else {
          break;
        }
      }

      if (fitCount === paths.length) {
        setVisibleCount(paths.length);
        return;
      }

      // 放不下全部：需要预留 "…等 N 个分组" 占位
      // 依次从 fitCount 递减，直到能塞下 "已展示标签 + 空间 + 更多标签"
      const moreEl = moreRef.current;
      if (!moreEl) {
        setVisibleCount(Math.max(1, fitCount));
        return;
      }
      for (let n = fitCount; n >= 1; n--) {
        // 重新计算 n 个标签的总宽
        let w = 0;
        for (let i = 0; i < n; i++) {
          const el = tagRefs.current[i];
          if (!el) continue;
          w += el.offsetWidth + (i === 0 ? 0 : gap);
        }
        // 临时设置 more 文案以测量（X = 总数）
        moreEl.textContent = `…共 ${paths.length} 个分组`;
        const moreW = moreEl.offsetWidth;
        if (w + gap + moreW <= available) {
          setVisibleCount(n);
          return;
        }
      }
      // 至少展示 1 个
      setVisibleCount(1);
    };

    computeVisible();
    const observer = new ResizeObserver(computeVisible);
    observer.observe(container);
    return () => observer.disconnect();
  }, [paths, groupIds.length]);

  if (groupIds.length === 0) return <span className="text-xs text-gray-500 font-medium">预设策略</span>;

  const omitted = paths.length - visibleCount;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={containerRef}
          className="flex items-center gap-1 w-full overflow-hidden cursor-default"
        >
          {/* 可见标签 */}
          {paths.slice(0, visibleCount).map((p, i) => (
            <span
              key={i}
              ref={(el) => { tagRefs.current[i] = el; }}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] whitespace-nowrap shrink-0"
            >
              {p}
            </span>
          ))}
          {/* 折叠提示 */}
          {omitted > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-gray-500 whitespace-nowrap shrink-0">
              …共 {paths.length} 个分组
            </span>
          )}
          {/* 隐藏测量区：渲染所有标签 + more 文案，供 useLayoutEffect 读取宽度 */}
          <div aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap" style={{ left: -99999, top: -99999 }}>
            {paths.map((p, i) => (
              <span
                key={`m-${i}`}
                ref={(el) => { tagRefs.current[i] = el; }}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] whitespace-nowrap"
              >
                {p}
              </span>
            ))}
            <span
              ref={moreRef}
              className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-gray-500 whitespace-nowrap"
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[360px] text-xs leading-relaxed">
        <div className="space-y-0.5">
          {paths.map((p, i) => <div key={i}>{p}</div>)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── 通用选项指示器（label + 当前值 badge + 编辑 Popover + 信息 Tooltip） ───────

interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

function LabeledOptionIndicator<T extends string>({
  label,
  value,
  options,
  onSave,
  tooltipContent,
  saveToastFormatter,
}: {
  label: string;
  value: T;
  options: LabeledOption<T>[];
  onSave: (v: T) => void;
  tooltipContent: React.ReactNode;
  /** 保存后的 toast 文案生成器，参数为新选中项的 label */
  saveToastFormatter?: (nextLabel: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T>(value);

  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(value);
    setOpen(v);
  };
  const handleConfirm = () => {
    onSave(draft);
    setOpen(false);
    const nextLabel = options.find((o) => o.value === draft)?.label ?? "";
    toast.success(saveToastFormatter ? saveToastFormatter(nextLabel) : `已切换为${nextLabel}`);
  };

  const currentLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="badge-shutdown whitespace-nowrap">{currentLabel}</span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className="text-gray-300 hover:text-blue-500 transition-colors" title={`编辑${label}`}><Pencil className="w-3 h-3" /></button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" sideOffset={6}>
          <div className="px-3.5 pt-3.5 pb-2.5 space-y-2.5">
            <div className="flex gap-1.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraft(opt.value)}
                  className={`flex-1 px-2.5 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${draft === opt.value ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-gray-100">
            <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs px-3" onClick={handleConfirm}>确认</Button>
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild><span className="cursor-default"><Info className="w-3 h-3 text-gray-400" /></span></TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[320px] leading-relaxed">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── 访问方式指示器（基于 LabeledOptionIndicator） ────────────────────────────

function AccessModeIndicator({ mode, onSave }: { mode: "public" | "private"; onSave: (m: "public" | "private") => void }) {
  return (
    <LabeledOptionIndicator<"public" | "private">
      label="访问方式"
      value={mode}
      options={[
        { value: "public", label: "公网访问" },
        { value: "private", label: "私网访问" },
      ]}
      onSave={onSave}
      tooltipContent={
        <>
          <p className="mb-1.5 text-justify"><span className="font-medium">公网访问：</span>用户通过公网直接访问 Agent 面板（WebUI），连接云服务器公网 IP。适用于大多数场景，推荐选择。</p>
          <p className="text-justify"><span className="font-medium">私网访问：</span>用户通过同一私有网络访问 Agent 面板（WebUI），连接云服务器内网 IP。使用前需先自行将企业内网与腾讯云私有网络（VPC）打通，并在「网络管理」中将云服务器绑定至该 VPC。配置完成后，企业用户可通过企业内网访问面板，但无法通过公网访问。</p>
        </>
      }
    />
  );
}

// ─── 时间维度指示器（基于 LabeledOptionIndicator） ────────────────────────────

function TimeDimensionIndicator({ mode, onSave }: { mode: "daily" | "monthly"; onSave: (m: "daily" | "monthly") => void }) {
  return (
    <LabeledOptionIndicator<"daily" | "monthly">
      label="时间维度"
      value={mode}
      options={[
        { value: "daily", label: "每日" },
        { value: "monthly", label: "每月" },
      ]}
      onSave={onSave}
      tooltipContent={
        <>
          <p className="mb-1.5"><span className="font-medium">每日：</span>每日全局 Tokens 到达上限即暂停服务，按自然日统计，每天 0 点重置。</p>
          <p><span className="font-medium">每月：</span>每月全局 Tokens 到达上限即暂停服务，按自然月统计，每月 1 号 0 点重置。</p>
        </>
      }
    />
  );
}

// ─── 统一的行容器 ─────────────────────────────────────────────────────────────
const ROW_CLASS = "flex items-center gap-3 px-3 h-10";
// 编辑行：允许分组标签撑开高度（多标签时换行）
const EDIT_ROW_CLASS = "flex items-start gap-3 px-3 min-h-10 py-1.5";

// ─── 子组件：配额策略卡片 ────────────────────────────────────────────────────

interface QuotaPolicyCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  type: "integer" | "token";
  rules: PolicyRule<TokenLimit>[];
  onRulesChange: (rules: PolicyRule<TokenLimit>[]) => void;
  extraContent?: React.ReactNode;
}

function QuotaPolicyCard({ icon, iconBg, title, description, type, rules, onRulesChange, extraContent }: QuotaPolicyCardProps) {
  // integer 类型（如 Agent 数量上限）不需要无限制/自定义切换，配额列可以缩短，让分组列更长
  const valueColClass = type === "integer" ? "w-32" : "w-60";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftMode, setDraftMode] = useState<"custom" | "unlimited">("custom");
  const [addingNew, setAddingNew] = useState(false);

  const getDisabledIds = (excludeRuleId?: string) =>
    rules.filter((r) => r.groupIds.length > 0 && r.id !== excludeRuleId).flatMap((r) => r.groupIds);

  const fallbackRule = rules.find((r) => r.groupIds.length === 0)!;
  const groupRules = rules.filter((r) => r.groupIds.length > 0);

  const displayValue = (v: TokenLimit) => (v === "unlimited" || v === -1) ? "无限制" : Number(v).toLocaleString();

  const startEdit = (rule: PolicyRule<TokenLimit>) => {
    setEditingId(rule.id);
    setDraftGroupIds([...rule.groupIds]);
    if (rule.value === "unlimited") { setDraftMode("unlimited"); setDraftValue(""); }
    else { setDraftMode("custom"); setDraftValue(String(rule.value)); }
    setAddingNew(false);
  };

  const startAdd = () => { setAddingNew(true); setEditingId(null); setDraftGroupIds([]); setDraftValue(type === "integer" ? "3" : "100000"); setDraftMode("custom"); };
  const cancelEdit = () => { setEditingId(null); setAddingNew(false); };

  const saveEdit = (ruleId?: string) => {
    let finalValue: TokenLimit;
    if (type === "token" && draftMode === "unlimited") { finalValue = "unlimited"; }
    else {
      const n = parseInt(draftValue, 10);
      if (isNaN(n) || n < 0) { toast.error("请输入有效数值"); return; }
      if (type === "integer" && n > 999) { toast.error("请输入 0-999 之间的整数"); return; }
      finalValue = n;
    }
    if (addingNew) {
      if (draftGroupIds.length === 0) { toast.error("请选择至少一个分组"); return; }
      const newRule: PolicyRule<TokenLimit> = { id: `rule-${Date.now()}`, groupIds: draftGroupIds, value: finalValue };
      onRulesChange([...groupRules, newRule, fallbackRule]);
      toast.success("策略已保存");
    } else if (ruleId) {
      onRulesChange(rules.map((r) => r.id === ruleId ? { ...r, groupIds: draftGroupIds, value: finalValue } : r));
      toast.success("策略已保存");
    }
    cancelEdit();
  };

  const deleteRule = (ruleId: string) => { onRulesChange(rules.filter((r) => r.id !== ruleId)); toast.success("策略已删除"); };

  // 值编辑控件（无限制/自定义 + 输入框）
  const renderValueEditor = () => (
    <>
      {type === "token" && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setDraftMode("unlimited")} className={`text-xs h-7 px-2 rounded-[4px] border transition-colors ${draftMode === "unlimited" ? "border-blue-500 bg-blue-50 text-blue-600 font-medium" : "border-gray-200 text-gray-500"}`}>无限制</button>
          <button onClick={() => setDraftMode("custom")} className={`text-xs h-7 px-2 rounded-[4px] border transition-colors ${draftMode === "custom" ? "border-blue-500 bg-blue-50 text-blue-600 font-medium" : "border-gray-200 text-gray-500"}`}>自定义</button>
        </div>
      )}
      {(type === "integer" || draftMode === "custom") && (
        <Input type="number" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className="h-7 text-xs bg-white w-32" placeholder={type === "integer" ? "0-999" : "数量"} />
      )}
    </>
  );

  return (
    <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1.5">
          <div className={`w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>

      <div className="px-5 pb-4">
        {/* 预设策略（置顶） */}
        {editingId === fallbackRule.id ? (
          <div className={ROW_CLASS}>
            <div className="flex-1 min-w-0"><span className="text-sm text-gray-700 font-medium">预设策略</span></div>
            <div className={`${valueColClass} flex items-center justify-end gap-1`}>{renderValueEditor()}</div>
            <div className="w-14 flex items-center justify-end gap-1">
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
              <button onClick={() => saveEdit(fallbackRule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <div className={ROW_CLASS}>
            <div className="flex-1 min-w-0"><span className="text-sm text-gray-700 font-medium">预设策略</span></div>
            <span className={`${valueColClass} text-right text-sm text-gray-700 font-medium tabular-nums`}>{displayValue(fallbackRule.value)}</span>
            <div className="w-14 flex items-center justify-end">
              <button onClick={() => startEdit(fallbackRule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1"><Pencil className="w-3 h-3" /></button>
            </div>
          </div>
        )}

        {/* 虚线分隔：主策略 vs 例外策略 */}
        <div className="border-t border-dashed border-gray-200 mt-2 pt-2">
          {/* 表头：仅在新增/编辑分组策略时展示 */}
          {(addingNew || (editingId && editingId !== fallbackRule.id)) && (
            <div className={`${ROW_CLASS} border-b border-gray-100`}>
              <span className="flex-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">分组</span>
              <span className={`${valueColClass} text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide`}>配额</span>
              <span className="w-14 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide">操作</span>
            </div>
          )}

          {/* 分组策略行 */}
          {groupRules.map((rule) => (
            <div key={rule.id}>
              {editingId === rule.id ? (
                <div className={EDIT_ROW_CLASS}>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <GroupTagSelector
                      selectedIds={draftGroupIds}
                      disabledIds={getDisabledIds(rule.id)}
                      onChange={setDraftGroupIds}
                    />
                  </div>
                  <div className={`${valueColClass} flex items-center justify-end gap-1 h-7 pt-0.5`}>{renderValueEditor()}</div>
                  <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                    <button onClick={() => saveEdit(rule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div className={`${ROW_CLASS} border-b border-gray-50 hover:bg-gray-50/50 transition-colors`}>
                  <div className="flex-1 min-w-0"><GroupBadges groupIds={rule.groupIds} /></div>
                  <span className={`${valueColClass} text-right text-sm text-gray-700 font-medium tabular-nums`}>{displayValue(rule.value)}</span>
                  <div className="w-14 flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(rule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deleteRule(rule.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 添加分组策略 */}
          {addingNew ? (
            <div className={EDIT_ROW_CLASS}>
              <div className="flex-1 min-w-0 pt-0.5">
                <GroupTagSelector
                  selectedIds={draftGroupIds}
                  disabledIds={getDisabledIds()}
                  onChange={setDraftGroupIds}
                />
              </div>
              <div className={`${valueColClass} flex items-center justify-end gap-1 h-7 pt-0.5`}>{renderValueEditor()}</div>
              <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                <button onClick={() => saveEdit()} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
              </div>
            </div>
          ) : (
            <button onClick={startAdd} className="flex items-center gap-1.5 px-3 h-10 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-[4px] transition-colors">
              <Plus className="w-3.5 h-3.5" />添加分组策略
            </button>
          )}
        </div>
      </div>

      {extraContent && (
        <div className="px-8 pb-4 pt-3 border-t border-gray-100">{extraContent}</div>
      )}
    </div>
  );
}

// ─── 子组件：功能开关策略卡片 ────────────────────────────────────────────────

interface TogglePolicyCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  rules: PolicyRule<boolean>[];
  /** 返回 false 表示变更被拒绝（如前置校验失败），卡片不会弹成功 toast / 不会关闭编辑态 */
  onRulesChange: (rules: PolicyRule<boolean>[]) => boolean | void;
  extraContent?: React.ReactNode;
  /** 指定哪一行（rule.id）正在 loading：该行权限列显示「配置中，请勿关闭」 */
  loadingRuleId?: string | null;
}

function TogglePolicyCard({ icon, iconBg, title, description, rules, onRulesChange, extraContent, loadingRuleId }: TogglePolicyCardProps) {
  // 任一行处于 loading 时，权限列加宽以容纳"配置中，请勿关闭"文案
  const valueColClass = loadingRuleId ? "w-32" : "w-24";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<boolean>(true);
  const [addingNew, setAddingNew] = useState(false);
  // 二次确认弹窗：切换兜底值时会清空分组规则
  const [confirmFallbackDraft, setConfirmFallbackDraft] = useState<boolean | null>(null);

  const getDisabledIds = (excludeRuleId?: string) =>
    rules.filter((r) => r.groupIds.length > 0 && r.id !== excludeRuleId).flatMap((r) => r.groupIds);

  const fallbackRule = rules.find((r) => r.groupIds.length === 0)!;
  const groupRules = rules.filter((r) => r.groupIds.length > 0);
  // 分组规则的值 = 兜底值的相反（「例外」语义）
  const groupRuleValue = !fallbackRule.value;

  const startEdit = (rule: PolicyRule<boolean>) => {
    setEditingId(rule.id);
    setDraftGroupIds([...rule.groupIds]);
    // 分组规则编辑时值固定为 !fallback，兜底行编辑时为其本身
    setDraftValue(rule.groupIds.length === 0 ? rule.value : groupRuleValue);
    setAddingNew(false);
  };
  const startAdd = () => {
    setAddingNew(true);
    setEditingId(null);
    setDraftGroupIds([]);
    setDraftValue(groupRuleValue); // 预填为例外值
  };
  const cancelEdit = () => { setEditingId(null); setAddingNew(false); };

  const saveEdit = (ruleId?: string) => {
    if (addingNew) {
      if (draftGroupIds.length === 0) { toast.error("请选择至少一个分组"); return; }
      const result = onRulesChange([...groupRules, { id: `rule-${Date.now()}`, groupIds: draftGroupIds, value: groupRuleValue }, fallbackRule]);
      if (result === false) return;
      toast.success("策略已保存");
      cancelEdit();
      return;
    }
    if (!ruleId) return;
    // 兜底行保存：若值发生变化且有分组规则 → 弹二次确认
    if (ruleId === fallbackRule.id) {
      if (draftValue !== fallbackRule.value && groupRules.length > 0) {
        setConfirmFallbackDraft(draftValue);
        return;
      }
      // 直接保存兜底值
      const result = onRulesChange(rules.map((r) => r.id === ruleId ? { ...r, value: draftValue } : r));
      if (result === false) return;
      toast.success("策略已保存");
      cancelEdit();
      return;
    }
    // 分组规则保存：只更新 groupIds（value 永远跟随兜底相反值）
    const result = onRulesChange(rules.map((r) => r.id === ruleId ? { ...r, groupIds: draftGroupIds, value: groupRuleValue } : r));
    if (result === false) return;
    toast.success("策略已保存");
    cancelEdit();
  };

  // 确认切换兜底值：清空所有分组规则 + 更新兜底值
  const handleConfirmFallbackSwitch = () => {
    if (confirmFallbackDraft === null) return;
    const newValue = confirmFallbackDraft;
    const result = onRulesChange([{ ...fallbackRule, value: newValue }]);
    if (result !== false) {
      toast.success("已更新预设策略，分组策略已清空");
      cancelEdit();
    }
    setConfirmFallbackDraft(null);
  };

  const deleteRule = (ruleId: string) => {
    const result = onRulesChange(rules.filter((r) => r.id !== ruleId));
    if (result === false) return;
    toast.success("策略已删除");
  };

  // 兜底值编辑器（开启/关闭 二选一按钮）
  const renderFallbackValueEditor = () => (
    <>
      <button onClick={() => setDraftValue(true)} className={`text-xs h-7 px-2 rounded-[4px] border transition-colors ${draftValue ? "border-green-400 bg-green-50 text-green-700 font-medium" : "border-gray-200 text-gray-500"}`}>开启</button>
      <button onClick={() => setDraftValue(false)} className={`text-xs h-7 px-2 rounded-[4px] border transition-colors ${!draftValue ? "border-red-300 bg-red-50 text-red-600 font-medium" : "border-gray-200 text-gray-500"}`}>关闭</button>
    </>
  );
  // 分组规则编辑态：展示静态文字（值固定为例外值，不可改）
  const renderGroupRuleStaticValue = () => (
    <span className={`text-xs font-medium ${groupRuleValue ? "text-green-600" : "text-red-500"}`}>{groupRuleValue ? "开启" : "关闭"}</span>
  );
  // 行内 loading 文字
  const renderLoading = () => (
    <span className="inline-flex items-center gap-1.5 text-xs text-blue-500 font-medium whitespace-nowrap">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />配置中，请勿关闭
    </span>
  );

  return (
    <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1.5">
          <div className={`w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>

      <div className="px-5 pb-4">
        {/* 预设策略（置顶） */}
        {editingId === fallbackRule.id ? (
          <div className={ROW_CLASS}>
            <div className="flex-1 min-w-0"><span className="text-sm text-gray-700 font-medium">预设策略</span></div>
            <div className={`${valueColClass} flex items-center justify-end gap-1`}>{renderFallbackValueEditor()}</div>
            <div className="w-14 flex items-center justify-end gap-1">
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
              <button onClick={() => saveEdit(fallbackRule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <div className={ROW_CLASS}>
            <div className="flex-1 min-w-0"><span className="text-sm text-gray-700 font-medium">预设策略</span></div>
            <div className={`${valueColClass} text-right`}>
              {loadingRuleId === fallbackRule.id
                ? renderLoading()
                : <span className={`text-xs font-medium ${fallbackRule.value ? "text-green-600" : "text-red-500"}`}>{fallbackRule.value ? "开启" : "关闭"}</span>}
            </div>
            <div className="w-14 flex items-center justify-end">
              <button onClick={() => startEdit(fallbackRule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" disabled={!!loadingRuleId}><Pencil className="w-3 h-3" /></button>
            </div>
          </div>
        )}

        {/* 虚线分隔：主策略 vs 例外策略 */}
        <div className="border-t border-dashed border-gray-200 mt-2 pt-2">
          {/* 表头：仅在新增/编辑分组策略时展示 */}
          {(addingNew || (editingId && editingId !== fallbackRule.id)) && (
            <div className={`${ROW_CLASS} border-b border-gray-100`}>
              <span className="flex-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">分组</span>
              <span className={`${valueColClass} text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide`}>权限</span>
              <span className="w-14 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide">操作</span>
            </div>
          )}

          {groupRules.map((rule) => (
            <div key={rule.id}>
              {editingId === rule.id ? (
                <div className={EDIT_ROW_CLASS}>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <GroupTagSelector
                      selectedIds={draftGroupIds}
                      disabledIds={getDisabledIds(rule.id)}
                      onChange={setDraftGroupIds}
                    />
                  </div>
                  <div className={`${valueColClass} flex items-center justify-end gap-1 h-7 pt-0.5`}>{renderGroupRuleStaticValue()}</div>
                  <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                    <button onClick={() => saveEdit(rule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                <div className={`${ROW_CLASS} border-b border-gray-50 hover:bg-gray-50/50 transition-colors`}>
                  <div className="flex-1 min-w-0"><GroupBadges groupIds={rule.groupIds} /></div>
                  <div className={`${valueColClass} text-right`}>
                    {loadingRuleId === rule.id
                      ? renderLoading()
                      : <span className={`text-xs font-medium ${rule.value ? "text-green-600" : "text-red-500"}`}>{rule.value ? "开启" : "关闭"}</span>}
                  </div>
                  <div className="w-14 flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(rule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" disabled={!!loadingRuleId}><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deleteRule(rule.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" disabled={!!loadingRuleId}><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingNew ? (
            <div className={EDIT_ROW_CLASS}>
              <div className="flex-1 min-w-0 pt-0.5">
                <GroupTagSelector
                  selectedIds={draftGroupIds}
                  disabledIds={getDisabledIds()}
                  onChange={setDraftGroupIds}
                />
              </div>
              <div className={`${valueColClass} flex items-center justify-end gap-1 h-7 pt-0.5`}>{renderGroupRuleStaticValue()}</div>
              <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                <button onClick={() => saveEdit()} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
              </div>
            </div>
          ) : (
            // 最多 1 条分组策略：已有则不显示添加按钮
            groupRules.length === 0 && (
              <button onClick={startAdd} disabled={!!loadingRuleId} className="flex items-center gap-1.5 px-3 h-10 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="w-3.5 h-3.5" />添加分组策略
              </button>
            )
          )}
        </div>
      </div>

      {extraContent && (
        <div className="px-8 pb-4 pt-3 border-t border-gray-100">{extraContent}</div>
      )}

      {/* 兜底值切换二次确认弹窗 */}
      <AlertDialog open={confirmFallbackDraft !== null} onOpenChange={(o) => { if (!o) setConfirmFallbackDraft(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换后将清空分组策略</AlertDialogTitle>
            <AlertDialogDescription>
              分组策略是基于「预设策略」的例外设置。切换「预设策略」后，现有分组策略将全部清空，需重新添加。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmFallbackSwitch}>确认切换</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function PlatformPolicy() {
  const [, navigate] = useLocation();

  // ── 用户配额规则 ──
  const [clawRules, setClawRules] = useState<PolicyRule<TokenLimit>[]>([
    { id: "claw-fallback", groupIds: [], value: 3 },
  ]);
  const [tokenRules, setTokenRules] = useState<PolicyRule<TokenLimit>[]>([
    { id: "token-fallback", groupIds: [], value: 500000 },
  ]);

  // ── 模型配额规则 ──
  const [globalTokenRules, setGlobalTokenRules] = useState<PolicyRule<TokenLimit>[]>([
    { id: "global-fallback", groupIds: [], value: 1000000 },
  ]);
  // 全局 Tokens 时间维度（每日/不限时）
  const [globalTokenTimeDim, setGlobalTokenTimeDim] = useState<"daily" | "monthly">(() => {
    const v = localStorage.getItem("admin_global_token_time_dim");
    return v === "monthly" ? "monthly" : "daily"; // 旧值（如 unlimited）回退为 daily
  });
  // 初次挂载时把当前分组策略同步到 localStorage，确保 TokensMonitor 能读到
  useEffect(() => {
    const groupRules = globalTokenRules
      .filter((r) => r.groupIds.length > 0)
      .map((r) => ({ id: r.id, groupIds: r.groupIds, value: r.value }));
    const serialized = JSON.stringify(groupRules);
    localStorage.setItem("admin_global_token_group_rules", serialized);
    window.dispatchEvent(new StorageEvent("storage", { key: "admin_global_token_group_rules", newValue: serialized, storageArea: localStorage }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleGlobalTokenRulesChange = (next: PolicyRule<TokenLimit>[]) => {
    setGlobalTokenRules(next);
    const fallback = next.find((r) => r.groupIds.length === 0);
    if (fallback) {
      if (fallback.value === "unlimited") {
        localStorage.setItem("globalLimitMode", "unlimited");
        window.dispatchEvent(new StorageEvent("storage", { key: "globalLimitMode", newValue: "unlimited", storageArea: localStorage }));
      } else {
        localStorage.setItem("globalLimitMode", "custom");
        localStorage.setItem("globalLimit", String(fallback.value));
        window.dispatchEvent(new StorageEvent("storage", { key: "globalLimitMode", newValue: "custom", storageArea: localStorage }));
      }
    }
    // 同步分组策略（除兜底行之外）到 localStorage，供 TokensMonitor 读取
    const groupRules = next
      .filter((r) => r.groupIds.length > 0)
      .map((r) => ({ id: r.id, groupIds: r.groupIds, value: r.value }));
    const serialized = JSON.stringify(groupRules);
    localStorage.setItem("admin_global_token_group_rules", serialized);
    window.dispatchEvent(new StorageEvent("storage", { key: "admin_global_token_group_rules", newValue: serialized, storageArea: localStorage }));
  };

  // ── 功能权限开关规则 ──
  const [configModelRules, setConfigModelRules] = useState<PolicyRule<boolean>[]>([{ id: "cm-fallback", groupIds: [], value: true }]);
  const [configChannelRules, setConfigChannelRules] = useState<PolicyRule<boolean>[]>([{ id: "cc-fallback", groupIds: [], value: true }]);
  const [customModelRules, setCustomModelRules] = useState<PolicyRule<boolean>[]>([{ id: "cust-fallback", groupIds: [], value: false }]);
  const [terminalRules, setTerminalRules] = useState<PolicyRule<boolean>[]>([{ id: "term-fallback", groupIds: [], value: false }]);
  const [panelRules, setPanelRules] = useState<PolicyRule<boolean>[]>(() => [
    { id: "panel-fallback", groupIds: [], value: localStorage.getItem("admin_allow_panel_access") === "true" },
  ]);
  const [chatViewRules, setChatViewRules] = useState<PolicyRule<boolean>[]>([{ id: "chat-fallback", groupIds: [], value: true }]);
  const [cloudBrowserRules, setCloudBrowserRules] = useState<PolicyRule<boolean>[]>(() => [
    { id: "cb-fallback", groupIds: [], value: localStorage.getItem("admin_allow_cloud_browser") === "true" },
  ]);
  const [lobsterDoctorRules, setLobsterDoctorRules] = useState<PolicyRule<boolean>[]>(() => [
    // 与「允许用户访问 Agent 云端浏览器」同款持久化策略：从 localStorage 恢复开关状态，
    // 避免管控端切换开关后用户端无法感知（用户端 OpenClawDetail 读同一个 key）。
    { id: "ld-fallback", groupIds: [], value: localStorage.getItem("admin_allow_lobster_doctor") === "true" },
  ]);
  const [modelQuotaRules, setModelQuotaRules] = useState<PolicyRule<boolean>[]>([{ id: "mq-fallback", groupIds: [], value: true }]);

  // ── Agent 面板属性 ──
  const [panelAccessMode, setPanelAccessMode] = useState<"public" | "private">(() =>
    (localStorage.getItem("admin_panel_access_mode") as "public" | "private") || "public"
  );
  const [panelPort, setPanelPort] = useState<string | null>(() => localStorage.getItem("admin_panel_port"));
  const [panelLoadingRuleId, setPanelLoadingRuleId] = useState<string | null>(null);
  // 本次自动追加的 面板端口 放通规则 id（用于在卡片内展示"已自动添加"提示）
  const [panelSgRuleId, setPanelSgRuleId] = useState<string | null>(() => localStorage.getItem("admin_panel_sg_rule_id"));

  // 计算面板规则是否已开启（任一规则值为 true）
  const isPanelEnabled = (rs: PolicyRule<boolean>[]) => rs.some((r) => r.value);
  // 找到触发开启的那一行（next 中 value=true 但 prev 中 false 的第一行；找不到则返回兜底行）
  const findTriggeredEnableRule = (prev: PolicyRule<boolean>[], next: PolicyRule<boolean>[]) => {
    const prevMap = new Map(prev.map((r) => [r.id, r.value]));
    const enabledRow = next.find((r) => r.value && !prevMap.get(r.id));
    return enabledRow?.id ?? next.find((r) => r.value)?.id ?? null;
  };

  const handlePanelRulesChange = (next: PolicyRule<boolean>[]): boolean | void => {
    const prev = panelRules;
    const wasEnabled = isPanelEnabled(prev);
    const willEnable = isPanelEnabled(next);

    // 关闭 → 开启：执行开启流程（校验安全组 + loading + 分配端口 + 补规则）
    if (!wasEnabled && willEnable) {
      const snapshotRaw = localStorage.getItem("admin_default_security_group_snapshot");
      let snapshot: DefaultSecurityGroupSnapshot | null = null;
      if (snapshotRaw) {
        try { snapshot = JSON.parse(snapshotRaw) as DefaultSecurityGroupSnapshot; } catch { snapshot = null; }
      }
      if (!snapshot || !Array.isArray(snapshot.inboundRules)) {
        toast.error("请先前往网络管理配置 ClawPro 的安全组，再开启该功能");
        return false; // 回滚：不应用本次规则变更，卡片也不弹成功 toast
      }
      // 应用规则变更并进入 loading
      setPanelRules(next);
      localStorage.setItem("admin_allow_panel_access", "true");
      const triggeredId = findTriggeredEnableRule(prev, next);
      setPanelLoadingRuleId(triggeredId);
      setTimeout(() => {
        const randomPort = String(Math.floor(Math.random() * 1000) + 9000);
        const portNum = Number(randomPort);
        const hasCovered = snapshot!.inboundRules.some((r) => isInboundRuleCoverPort(r, portNum));
        if (!hasCovered) {
          const newRule: SnapshotInboundRule = {
            id: `panel-${Date.now()}`,
            source: "0.0.0.0/0",
            protocol: "TCP",
            port: randomPort,
            policy: "允许",
            remark: "Agent 面板访问",
          };
          const nextSnapshot: DefaultSecurityGroupSnapshot = {
            ...snapshot!,
            inboundRules: [...snapshot!.inboundRules, newRule],
          };
          localStorage.setItem("admin_default_security_group_snapshot", JSON.stringify(nextSnapshot));
          localStorage.setItem("admin_panel_sg_rule_id", newRule.id);
          setPanelSgRuleId(newRule.id);
        } else {
          localStorage.removeItem("admin_panel_sg_rule_id");
          setPanelSgRuleId(null);
        }
        setPanelPort(randomPort);
        localStorage.setItem("admin_panel_port", randomPort);
        setPanelLoadingRuleId(null);
        toast.success("已开启用户端访问 Agent 面板");
      }, 3000);
      return;
    }

    // 开启 → 关闭：清理端口和自动补规则标记
    if (wasEnabled && !willEnable) {
      setPanelRules(next);
      localStorage.setItem("admin_allow_panel_access", "false");
      setPanelPort(null);
      localStorage.removeItem("admin_panel_port");
      localStorage.removeItem("admin_panel_sg_rule_id");
      setPanelSgRuleId(null);
      toast.success("已禁止用户端访问 Agent 面板");
      return;
    }

    // 其他情况（已开启状态下规则增删/值变更，或都是关闭态）：直接应用
    setPanelRules(next);
  };

  // ── Agent 云端浏览器属性 ──
  const [cloudBrowserSgRuleId, setCloudBrowserSgRuleId] = useState<string | null>(() =>
    localStorage.getItem("admin_cloud_browser_sg_rule_id"),
  );
  const isCloudBrowserEnabled = (rs: PolicyRule<boolean>[]) => rs.some((r) => r.value);

  const handleCloudBrowserRulesChange = (next: PolicyRule<boolean>[]): boolean | void => {
    const wasEnabled = isCloudBrowserEnabled(cloudBrowserRules);
    const willEnable = isCloudBrowserEnabled(next);

    // 关闭 → 开启：校验安全组并尝试补 6080 放通规则
    if (!wasEnabled && willEnable) {
      const snapshotRaw = localStorage.getItem("admin_default_security_group_snapshot");
      let snapshot: DefaultSecurityGroupSnapshot | null = null;
      if (snapshotRaw) {
        try { snapshot = JSON.parse(snapshotRaw) as DefaultSecurityGroupSnapshot; } catch { snapshot = null; }
      }
      if (!snapshot || !Array.isArray(snapshot.inboundRules)) {
        toast.error("请先前往网络管理配置 ClawPro 的安全组，再开启该功能");
        return false;
      }

      // 判断是否已有 6080 放通规则
      const hasCovered = snapshot.inboundRules.some((r) => isInboundRuleCoverPort(r, 6080));
      if (!hasCovered) {
        const newRule: SnapshotInboundRule = {
          id: `cb-${Date.now()}`,
          source: "0.0.0.0/0",
          protocol: "TCP",
          port: "6080",
          policy: "允许",
          remark: "云端浏览器访问",
        };
        const nextSnapshot: DefaultSecurityGroupSnapshot = {
          ...snapshot,
          inboundRules: [...snapshot.inboundRules, newRule],
        };
        localStorage.setItem("admin_default_security_group_snapshot", JSON.stringify(nextSnapshot));
        localStorage.setItem("admin_cloud_browser_sg_rule_id", newRule.id);
        setCloudBrowserSgRuleId(newRule.id);
      } else {
        localStorage.removeItem("admin_cloud_browser_sg_rule_id");
        setCloudBrowserSgRuleId(null);
      }

      setCloudBrowserRules(next);
      localStorage.setItem("admin_allow_cloud_browser", "true");
      toast.success("已开启 Agent 云端浏览器");
      return;
    }

    // 开启 → 关闭：清掉"自动添加"标记（规则保留在安全组中）
    if (wasEnabled && !willEnable) {
      setCloudBrowserRules(next);
      localStorage.setItem("admin_allow_cloud_browser", "false");
      localStorage.removeItem("admin_cloud_browser_sg_rule_id");
      setCloudBrowserSgRuleId(null);
      toast.success("已关闭 Agent 云端浏览器");
      return;
    }

    // 其他情况：直接应用
    setCloudBrowserRules(next);
  };

  // ── 龙虾医生开关持久化（与云端浏览器同款模式）────────────────────────────
  // 动机：用户端 OpenClawDetail 通过读取 localStorage 的 "admin_allow_lobster_doctor"
  //       决定是否渲染「龙虾医生对话卡片」，并监听 storage 事件实现跨 tab 响应。
  //       而此前本页的 onRulesChange 仅 setState、未 persist，导致：
  //         ① 管控端开启后切到用户端仍看不到龙虾医生；
  //         ② 再次回到管控端时 state 复位到初始 false（因无持久化源）；
  //       形成"开关打不开、也留不住"的双重断裂。此 handler 负责打通该链路。
  const isLobsterDoctorEnabled = (rs: PolicyRule<boolean>[]) => rs.some((r) => r.value);
  const handleLobsterDoctorRulesChange = (next: PolicyRule<boolean>[]): boolean | void => {
    const wasEnabled = isLobsterDoctorEnabled(lobsterDoctorRules);
    const willEnable = isLobsterDoctorEnabled(next);
    setLobsterDoctorRules(next);
    if (!wasEnabled && willEnable) {
      localStorage.setItem("admin_allow_lobster_doctor", "true");
      toast.success("已开启龙虾医生");
    } else if (wasEnabled && !willEnable) {
      localStorage.setItem("admin_allow_lobster_doctor", "false");
      toast.success("已关闭龙虾医生");
    }
  };

  // ── 龙虾医生详情弹窗 ──
  const [showLobsterDoctorDialog, setShowLobsterDoctorDialog] = useState(false);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">平台策略</h1>
        <p className="text-sm text-gray-500 mt-1">管理平台默认配额、全局限制和功能权限开关，支持按分组设置不同策略</p>
      </div>

      {/* 优先级说明信息条 */}
      <div className="flex items-start gap-2.5 rounded-[4px] bg-blue-50 border border-blue-100 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <ul className="text-xs text-blue-700 leading-relaxed space-y-1 list-disc pl-4">
          <li>无需按分组设置策略时，直接使用<span className="font-medium">「预设策略」</span>，全部用户应用该策略。</li>
          <li>需要按分组设置策略时，添加<span className="font-medium">「分组策略」</span>，优先采用本分组策略；本分组无则采用最近的上级分组策略；均无则使用<span className="font-medium">「预设策略」</span>。若用户属于多个分组，用户将在用户端创建 Agent 时自行选择分组，该 Agent 即拥有所选分组对应的策略权限。</li>
        </ul>
      </div>

      {/* ── 板块一：用户配额 ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">用户配额</h2>
        <div className="space-y-4">
          <QuotaPolicyCard
            icon={<Zap className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            title="单用户 Agent 数量上限"
            description="单用户最多可以创建的 Agent 数量，新用户创建时自动应用此默认值，可在用户管理中对单个用户单独调整"
            type="integer"
            rules={clawRules}
            onRulesChange={setClawRules}
          />
          <QuotaPolicyCard
            icon={<Zap className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            title="单用户每日 Tokens 上限"
            description="单用户每日最多可消耗的 Tokens 数量，新用户创建时自动应用此默认值，可在用户管理中对单个用户单独调整"
            type="token"
            rules={tokenRules}
            onRulesChange={setTokenRules}
          />
        </div>
      </section>

      {/* ── 板块二：模型配额 ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">模型配额</h2>
        <div className="space-y-4">
          <QuotaPolicyCard
            icon={<Zap className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
            title="全局 Tokens 上限"
            description="全局 Tokens 指所有企业用户使用所有模型所消耗的总 Tokens 数量，达到上限后将暂停服务"
            type="token"
            rules={globalTokenRules}
            onRulesChange={handleGlobalTokenRulesChange}
            extraContent={
              <TimeDimensionIndicator
                mode={globalTokenTimeDim}
                onSave={(m) => { setGlobalTokenTimeDim(m); localStorage.setItem("admin_global_token_time_dim", m); }}
              />
            }
          />
        </div>
      </section>

      {/* ── 板块三：功能权限开关 ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">功能权限开关</h2>
        <div className="space-y-4">
          <TogglePolicyCard icon={<Brain className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户配置模型" description="开启后，用户可在 Agent 详细配置中自行选择和切换模型。关闭后，模型配置区域将锁定，用户无法调整（适用于管理员已统一预配置模型的场景）" rules={configModelRules} onRulesChange={setConfigModelRules} />
          <TogglePolicyCard icon={<MessageSquare className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户配置通道" description="开启后，用户可在 Agent 详细配置中自行添加和管理通道。关闭后，通道配置区域将锁定，用户无法调整（适用于管理员已统一预配置通道的场景）" rules={configChannelRules} onRulesChange={setConfigChannelRules} />
          <TogglePolicyCard icon={<Cpu className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户添加自定义模型" description="开启后，用户可在 Agent 中自行添加自定义模型，不在企业管控和 Tokens 覆盖范围内（注意需要先开启「允许用户配置模型」）" rules={customModelRules} onRulesChange={setCustomModelRules} />
          <TogglePolicyCard icon={<Terminal className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户进入 Agent 终端" description="开启后，所有用户在用户端可看到「进入终端」选项，进入对应 Agent 云服务器的终端" rules={terminalRules} onRulesChange={setTerminalRules} />
          <TogglePolicyCard
            icon={<Monitor className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-green-500 to-green-600"
            title="允许用户访问 Agent 面板"
            description="开启后，系统会为企业分配一个随机端口并自动添加一条安全组规则放通该端口，用户可通过该端口访问 Agent 面板"
            rules={panelRules}
            onRulesChange={handlePanelRulesChange}
            loadingRuleId={panelLoadingRuleId}
            extraContent={
              <div className="space-y-3">
                <AccessModeIndicator
                  mode={panelAccessMode}
                  onSave={(m) => { setPanelAccessMode(m); localStorage.setItem("admin_panel_access_mode", m); }}
                />
                {panelPort && (
                  <div className="inline-flex items-start gap-2.5 bg-blue-50 rounded-[4px] px-3 py-2">
                    <span className="text-xs text-blue-700 leading-relaxed">
                      {panelSgRuleId
                        ? `已为您分配随机端口 ${panelPort} 并自动为默认安全组添加该端口放通规则，`
                        : `已为您分配随机端口 ${panelPort}，`}
                      如用户端仍无法访问面板，请在网络管理的
                      <button onClick={() => navigate("/admin/security-group")} className="underline underline-offset-2 font-medium hover:text-blue-900 transition-colors mx-0.5">安全组规则</button>
                      处检查是否生效
                    </span>
                  </div>
                )}
              </div>
            }
          />
          <TogglePolicyCard icon={<MessagesSquare className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户使用对话视图" description="开启后，用户可在「我的 Agent」中使用对话视图，通过浏览器与 AI 对话（建议提前配置默认模型，用户创建 Agent 后 AI 即可正常回复）" rules={chatViewRules} onRulesChange={setChatViewRules} />
          <TogglePolicyCard
            icon={<Cloud className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-green-500 to-green-600"
            title="允许用户访问 Agent 云端浏览器"
            description="开启后，用户可在「我的 Agent」对话视图里访问云端浏览器，查看 AI 浏览器执行过程并进入操作（注意需要先开启「允许用户使用对话视图」）"
            rules={cloudBrowserRules}
            onRulesChange={handleCloudBrowserRulesChange}
            extraContent={
              isCloudBrowserEnabled(cloudBrowserRules) && cloudBrowserSgRuleId ? (
                <div className="inline-flex items-start gap-2.5 bg-blue-50 rounded-[4px] px-3 py-2">
                  <span className="text-xs text-blue-700 leading-relaxed">
                    已为您当前的安全组添加该功能所需的 6080 端口放通规则，如用户端仍无法访问，请在网络管理的
                    <button onClick={() => navigate("/admin/security-group")} className="underline underline-offset-2 font-medium hover:text-blue-900 transition-colors mx-0.5">安全组规则</button>
                    处检查是否生效
                  </span>
                </div>
              ) : undefined
            }
          />
          <TogglePolicyCard
            icon={<Stethoscope className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-green-500 to-green-600"
            title="允许用户使用龙虾医生"
            description="开启后，所有用户在用户端可免费使用「龙虾医生」AI 诊断功能，自动检测并对话式修复 Agent 运行问题"
            rules={lobsterDoctorRules}
            onRulesChange={handleLobsterDoctorRulesChange}
            extraContent={
              lobsterDoctorRules.some((r) => r.value) ? (
                <div className="bg-blue-50 border border-blue-100 rounded-[4px] px-3 py-2.5">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    龙虾医生每次诊断会产生部分底层资源费用和 Token 消耗，详见{" "}
                    <button onClick={() => setShowLobsterDoctorDialog(true)} className="inline-flex items-center text-blue-700 hover:opacity-70 transition-opacity" title="查看详情"><HelpCircle className="w-3.5 h-3.5" /></button>
                  </p>
                </div>
              ) : undefined
            }
          />
          <TogglePolicyCard icon={<BarChart3 className="w-4 h-4 text-white" />} iconBg="bg-gradient-to-br from-green-500 to-green-600" title="允许用户查看模型额度" description="开启后，用户可在顶部导航栏看到「模型额度」入口，查看个人的 Token 使用情况" rules={modelQuotaRules} onRulesChange={setModelQuotaRules} />
        </div>
      </section>

      {/* 龙虾医生详情弹窗 */}
      <Dialog open={showLobsterDoctorDialog} onOpenChange={setShowLobsterDoctorDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="py-1 space-y-4 text-sm text-gray-600 leading-relaxed">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">工作原理</p>
              <p>当用户点击「开始诊断」后，ClawPro 平台将完成以下步骤：</p>
              <ol className="space-y-1.5 pl-5 list-decimal">
                <li>创建一个临时按量计费的龙虾医生 Agent 节点</li>
                <li>通过该节点对用户的目标 Agent 进行检测和修复</li>
                <li>诊断结束后，临时节点自动销毁，不留存任何数据</li>
              </ol>
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-900">说明</p>
              <ol className="space-y-1.5 pl-5 list-decimal text-gray-600">
                <li><span className="font-medium text-gray-700">资源费用</span>：底层云资源费用可在 <a href="https://console.cloud.tencent.com/expense" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors">腾讯云费用中心</a> 查看</li>
                <li><span className="font-medium text-gray-700">Token 消耗</span>：诊断消耗的 Token 计入对应用户的 Token 消耗，可在 <button onClick={() => { setShowLobsterDoctorDialog(false); navigate("/admin/tokens-monitor"); }} className="text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors">Tokens 监控</button> 查看</li>
                <li><span className="font-medium text-gray-700">诊断模型</span>：诊断所用模型将按照当前已启用的模型顺序使用，可前往 <button onClick={() => { setShowLobsterDoctorDialog(false); navigate("/admin/model-config"); }} className="text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors">模型配置</button> 调整</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
