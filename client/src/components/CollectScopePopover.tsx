/**
 * CollectScopePopover - CLS 开启范围选择器（ScopePopover 风格）
 *
 * 设计：完全继承 ModelConfig 页「应用范围」(ScopePopover) 的交互形态。
 *   - 顶部「全部用户 / 按分组」Tab 切换
 *   - "按分组" 下：搜索框 + 已选 chip + 树形多选（部门/自定义分组两分区）
 *   - 底部「取消 / 确认」
 *
 * 对外语义（适配 CLS 场景）：
 *   value: string[]  空数组 = 全部实例（"全部用户"模式）；非空 = 最小覆盖集（"按分组"模式）
 *   onChange(value): 单一出口
 */
import { useState, useMemo, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FilterSection,
  type TreeNodeData,
  collectDescendantIds,
  findNode,
  normalizeSelection,
  expandSelection,
  filterRoots,
} from "./groupTreeShared";

// ──────────────────────────────────────────────
// 类型
// ──────────────────────────────────────────────
export interface CollectScopePopoverProps {
  /** 分区数据（部门 + 自定义分组） */
  sections: FilterSection[];
  /** 当前开启范围（最小覆盖集）。空数组 = 全部实例 */
  value: string[];
  /** 变更回调 */
  onChange: (value: string[]) => void;
  /** 触发器宽度（默认 160） */
  triggerWidth?: number;
  /** 触发器占位文案（未选时展示） */
  placeholder?: string;
}

// ──────────────────────────────────────────────
// 树节点状态 & 工具函数
// ──────────────────────────────────────────────
type CheckState = "checked" | "unchecked" | "indeterminate";

function getCheckState(node: TreeNodeData, selectedIds: Set<string>): CheckState {
  if (selectedIds.has(node.id)) return "checked";
  if (!node.children || node.children.length === 0) return "unchecked";
  let hasChecked = false;
  let hasUnchecked = false;
  for (const c of node.children) {
    const s = getCheckState(c, selectedIds);
    if (s === "checked") hasChecked = true;
    else if (s === "unchecked") hasUnchecked = true;
    else {
      hasChecked = true;
      hasUnchecked = true;
    }
    if (hasChecked && hasUnchecked) return "indeterminate";
  }
  if (hasChecked && !hasUnchecked) return "checked";
  if (!hasChecked && hasUnchecked) return "unchecked";
  return "indeterminate";
}

/** 构造 id → 父 id 映射，方便求路径 */
function buildParentMap(sections: FilterSection[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const walk = (nodes: TreeNodeData[], parent: string | null) => {
    for (const n of nodes) {
      map.set(n.id, parent);
      if (n.children) walk(n.children, n.id);
    }
  };
  for (const sec of sections) walk(sec.roots, null);
  return map;
}

/** 取某节点的完整路径（"A公司/技术部/前端组"） */
function getNodePath(id: string, sections: FilterSection[]): string {
  const parentMap = buildParentMap(sections);
  const chain: string[] = [];
  let cur: string | null | undefined = id;
  while (cur) {
    const node = findNode(sections, cur);
    if (!node) break;
    chain.unshift(node.name);
    cur = parentMap.get(cur) ?? null;
  }
  return chain.join("/");
}

// ──────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────
export function CollectScopePopover({
  sections,
  value,
  onChange,
  triggerWidth = 160,
  placeholder = "全部用户",
}: CollectScopePopoverProps) {
  const [open, setOpen] = useState(false);
  // 当前模式：空数组 = all；非空 = groups
  const deriveScope = (v: string[]): "all" | "groups" => (v.length === 0 ? "all" : "groups");
  const [draftScope, setDraftScope] = useState<"all" | "groups">(deriveScope(value));
  const [draftIds, setDraftIds] = useState<Set<string>>(() => expandSelection(sections, value));
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 打开时重置草稿并展开已选节点的祖先
  useEffect(() => {
    if (!open) return;
    setDraftScope(deriveScope(value));
    setDraftIds(expandSelection(sections, value));
    setSearchQuery("");
    // 默认展开所有根节点 + 已选节点的祖先链
    const parentMap = buildParentMap(sections);
    const next = new Set<string>();
    sections.forEach((s) => s.roots.forEach((r) => next.add(r.id)));
    value.forEach((id) => {
      let cur: string | null | undefined = parentMap.get(id);
      while (cur) {
        next.add(cur);
        cur = parentMap.get(cur) ?? null;
      }
    });
    setExpanded(next);
  }, [open, value, sections]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleNode = (node: TreeNodeData) => {
    const next = new Set(draftIds);
    const state = getCheckState(node, next);
    const descendants = collectDescendantIds(node);
    if (state === "checked") {
      descendants.forEach((d) => next.delete(d));
    } else {
      descendants.forEach((d) => next.add(d));
    }
    setDraftIds(next);
  };

  // 搜索过滤
  const visibleSections = useMemo(
    () => sections.map((s) => ({ ...s, roots: filterRoots(s.roots, searchQuery) })),
    [sections, searchQuery],
  );
  const hasGroups = sections.some((s) => s.roots.length > 0);

  // 已选 chip（最小覆盖集 → path）
  const selectedChips = useMemo(() => {
    const minimal = normalizeSelection(sections, draftIds);
    return minimal.map((id) => ({ id, path: getNodePath(id, sections) }));
  }, [draftIds, sections]);

  const handleClearSelection = () => {
    setDraftIds(new Set());
    setSearchQuery("");
  };

  const handleRemoveChip = (id: string) => {
    const node = findNode(sections, id);
    if (!node) return;
    const next = new Set(draftIds);
    collectDescendantIds(node).forEach((d) => next.delete(d));
    setDraftIds(next);
  };

  const isConfirmDisabled = draftScope === "groups" && normalizeSelection(sections, draftIds).length === 0;

  const handleCancel = () => setOpen(false);

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    if (draftScope === "all") {
      onChange([]);
    } else {
      onChange(normalizeSelection(sections, draftIds));
    }
    setOpen(false);
  };

  // Trigger 文案
  const triggerText = useMemo(() => {
    if (value.length === 0) return placeholder;
    const minimal = value;
    if (minimal.length === 1) {
      const node = findNode(sections, minimal[0]);
      return node?.name ?? placeholder;
    }
    const first = findNode(sections, minimal[0])?.name ?? "";
    return `${first} +${minimal.length - 1}`;
  }, [value, sections, placeholder]);

  // ─── 渲染一个树节点（递归） ───
  const renderTreeNode = (node: TreeNodeData, depth: number) => {
    const checkState = getCheckState(node, draftIds);
    const isExpanded = expanded.has(node.id);
    const hasChildren = !!(node.children && node.children.length > 0);

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => toggleNode(node)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <span
            className={cn(
              "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
              checkState === "checked" && "bg-blue-500 border-blue-500",
              checkState === "indeterminate" && "bg-blue-500 border-blue-500",
              checkState === "unchecked" && "border-gray-300 bg-white",
            )}
          >
            {checkState === "checked" && <Check className="w-2.5 h-2.5 text-white" />}
            {checkState === "indeterminate" && <Minus className="w-2.5 h-2.5 text-white" />}
          </span>
          <span className="text-xs text-gray-700 truncate">{node.name}</span>
        </button>
        {hasChildren && isExpanded && node.children!.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "justify-between bg-white text-sm font-normal hover:bg-white",
            "data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
            value.length === 0 && "text-muted-foreground",
          )}
          style={{ width: triggerWidth, height: 36 }}
        >
          <span className="truncate flex-1 text-left">{triggerText}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 flex flex-col max-h-[460px]" align="start" sideOffset={6}>
        <div className="px-3.5 pt-3.5 pb-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-0">
          {/* Tab 切换 */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDraftScope("all")}
              className={cn(
                "flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                draftScope === "all"
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              全部用户
            </button>
            <button
              type="button"
              onClick={() => setDraftScope("groups")}
              className={cn(
                "flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                draftScope === "groups"
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              按分组
            </button>
          </div>

          {/* 分组选择区（仅 groups 模式） */}
          {draftScope === "groups" && (
            <div className="space-y-1.5">
              {!hasGroups ? (
                <div className="text-center py-5 px-2">
                  <p className="text-xs text-gray-400 leading-relaxed">暂无分组数据</p>
                </div>
              ) : (
                <>
                  {/* 搜索 + 已选 chip 合并框 */}
                  <div className="group relative flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-100 transition-colors max-h-[80px] overflow-y-auto">
                    {selectedChips.map((chip) => (
                      <span
                        key={chip.id}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-md border border-blue-100 shrink-0 max-w-[200px]"
                      >
                        <span className="truncate">{chip.path}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChip(chip.id)}
                          className="text-blue-400 hover:text-blue-600 shrink-0"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={selectedChips.length === 0 ? "请输入分组名称" : ""}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 min-w-[60px] text-xs bg-transparent outline-none placeholder:text-gray-400"
                    />
                    {(selectedChips.length > 0 || searchQuery) && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="清除全部"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 分区树形列表 */}
                  <div className="max-h-[220px] overflow-y-auto">
                    {visibleSections.map((section) => {
                      if (section.roots.length === 0) return null;
                      return (
                        <div key={section.key} className="mb-1">
                          <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                            {section.label}
                          </div>
                          {section.roots.map((root) => renderTreeNode(root, 0))}
                        </div>
                      );
                    })}
                    {visibleSections.every((s) => s.roots.length === 0) && (
                      <div className="text-center py-4 text-xs text-gray-400">未找到匹配的分组</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-gray-100 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={handleCancel}>
            取消
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
            style={isConfirmDisabled ? undefined : { background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
          >
            确认
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
