/**
 * GroupSingleFilter - 分组单选筛选器
 *
 * 设计参考：
 *   - 外观复刻 Agent 列表页的 InstanceDepartmentFilter（120px 宽 Popover）
 *   - 支持部门 + 自定义分组两分区（沿用 FilterSection 数据结构）
 *   - 单选交互：点击节点选中；点击"全部分组"清空
 *   - 底部显示面包屑路径；选中子节点时高亮
 */
import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type FilterSection, type TreeNodeData, findNode } from "./groupTreeShared";

export interface GroupSingleFilterProps {
  /** 分区数据（部门 + 自定义分组） */
  sections: FilterSection[];
  /** 当前选中的分组 id；空串表示"全部分组" */
  value: string;
  /** 变更回调 */
  onChange: (value: string) => void;
  /** 触发器宽度（默认 120，对齐 Agent 列表） */
  triggerWidth?: number;
  /** 未选时的 placeholder */
  placeholder?: string;
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

/** 取节点的完整路径（例："A公司 / 技术部 / 前端组"） */
function getPathParts(id: string, sections: FilterSection[]): string[] {
  const parentMap = buildParentMap(sections);
  const chain: string[] = [];
  let cur: string | null | undefined = id;
  while (cur) {
    const node = findNode(sections, cur);
    if (!node) break;
    chain.unshift(node.name);
    cur = parentMap.get(cur) ?? null;
  }
  return chain;
}

// ─── 单选树节点（参考 InstanceDepartmentTreeNode）───
interface SingleTreeNodeProps {
  node: TreeNodeData;
  level: number;
  selected: string;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}

function SingleTreeNode({ node, level, selected, expanded, onToggleExpand, onSelect }: SingleTreeNodeProps) {
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          isSelected ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </span>
        )}
        <span className={cn("text-sm truncate flex-1", isSelected && "text-blue-600 font-medium")}>
          {node.name}
        </span>
        {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 flex-shrink-0" />}
      </div>
      {hasChildren &&
        isExpanded &&
        node.children!.map((child) => (
          <SingleTreeNode
            key={child.id}
            node={child}
            level={level + 1}
            selected={selected}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// ─── 主组件 ───
export function GroupSingleFilter({
  sections,
  value,
  onChange,
  triggerWidth = 120,
  placeholder = "全部分组",
}: GroupSingleFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 打开时重置草稿 + 默认展开根节点 + 展开已选节点祖先
  useEffect(() => {
    if (!open) return;
    setTempValue(value);
    const parentMap = buildParentMap(sections);
    const next = new Set<string>();
    sections.forEach((s) => s.roots.forEach((r) => next.add(r.id)));
    if (value) {
      let cur: string | null | undefined = parentMap.get(value);
      while (cur) {
        next.add(cur);
        cur = parentMap.get(cur) ?? null;
      }
    }
    setExpanded(next);
  }, [open, value, sections]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleConfirm = () => {
    onChange(tempValue);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setOpen(false);
  };

  // Trigger 显示：选中的分组名 or placeholder
  const triggerNode = value ? findNode(sections, value) : undefined;

  // 底部面包屑
  const pathParts = useMemo(() => (tempValue ? getPathParts(tempValue, sections) : []), [tempValue, sections]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "justify-between bg-white text-sm font-normal hover:bg-white",
            "data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
            !triggerNode && "text-muted-foreground",
          )}
          style={{ width: triggerWidth, height: 36 }}
        >
          <span className="truncate">{triggerNode?.name ?? placeholder}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[320px] overflow-y-auto p-2">
          {/* "全部分组"选项 */}
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
              tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100",
            )}
            onClick={() => setTempValue("")}
          >
            <span
              className={cn(
                "text-sm flex-1",
                tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700",
              )}
            >
              {placeholder}
            </span>
            {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          </div>

          {/* 分区 + 树 */}
          {sections.map((section) => {
            if (section.roots.length === 0) return null;
            return (
              <div key={section.key} className="mt-1">
                <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {section.label}
                </div>
                {section.roots.map((root) => (
                  <SingleTreeNode
                    key={root.id}
                    node={root}
                    level={0}
                    selected={tempValue}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onSelect={setTempValue}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* 底部：面包屑 + 操作按钮 */}
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1 text-xs overflow-hidden">
            {tempValue === "" ? (
              <span className="text-blue-600 font-medium truncate">{placeholder}</span>
            ) : pathParts.length > 0 ? (
              pathParts.map((part, idx) => (
                <span key={idx} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                  <span
                    className={cn(
                      "truncate",
                      idx === pathParts.length - 1 ? "text-blue-600 font-medium" : "text-gray-500",
                    )}
                  >
                    {part}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-gray-400 truncate">未选择</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2" onClick={handleCancel}>
              取消
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 px-3"
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
              onClick={handleConfirm}
            >
              确认
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 帮助函数：把单选 id 解析成"视作命中"的 id 集合（含子孙） ───
/**
 * 将单选 id 转成"包含自身 + 所有子孙"的 id 集合，供下游筛选。
 * 空字符串返回空集，下游判空即视作"全部"。
 */
export function getSingleGroupFilterIds(sections: FilterSection[], value: string): Set<string> {
  if (!value) return new Set();
  const node = findNode(sections, value);
  if (!node) return new Set();
  const ids = new Set<string>();
  const walk = (n: TreeNodeData) => {
    ids.add(n.id);
    n.children?.forEach(walk);
  };
  walk(node);
  return ids;
}
