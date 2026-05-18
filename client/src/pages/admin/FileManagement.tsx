import React, { useState, useRef, useLayoutEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Search, 
  Bot,
  Building,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  ChevronLeft,
  Link,
  UserCheck,
  ShoppingCart,
  Trash2,
  RotateCcw,
  Plus,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { MOCK_GROUPS as MOCK_ONEID_GROUPS, MOCK_MANUAL_GROUPS } from "./MemberManagement/mock";
import { buildGroupTree, type GroupTreeNode } from "./MemberManagement/health";
import type { UserGroup, GroupSource } from "./MemberManagement/types";
import { MOCK_GROUP_TREE_MANUAL, type GroupNode } from "@/lib/mockData";

// ─── creator → 分组 ID 映射（普通模式下，与 MemberManagement mock 对齐） ──────
const CREATOR_GROUP_MAP: Record<string, string> = {
  "noah@acompany.com":  "mgrp-rd",
  "mia@acompany.com":   "mgrp-design",
  "leo@acompany.com":   "mgrp-product",
  "emma@acompany.com":  "mgrp-rd-fe",
  "alice@acompany.com": "mgrp-product",
  "bob@acompany.com":   "mgrp-rd-be",
  "carol@acompany.com": "mgrp-design",
  "david@acompany.com": "mgrp-ops",
  "frank@acompany.com": "mgrp-rd-fe",
  "grace@acompany.com": "mgrp-rd-be",
  "helen@acompany.com": "mgrp-rd-fe",
  "ivan@acompany.com":  "mgrp-rd-fe",
  "jason@acompany.com": "mgrp-rd-be",
  "kelly@acompany.com": "mgrp-rd-be",
  "lisa@acompany.com":  "mgrp-design",
  "tom@acompany.com":   "mgrp-ops",
  "amy@acompany.com":   "mgrp-product",
  "mike@acompany.com":  "mgrp-rd-be",
  "kate@acompany.com":  "mgrp-rd-fe",
  "ryan@acompany.com":  "mgrp-rd",
};

// ─── 分组筛选器组件（与 TokensMonitor 同款） ────────────────────────────────
function FMGroupFilter({
  groups, value, onChange,
}: {
  groups: GroupNode[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  React.useEffect(() => { if (open) { setTempValue(value); setSearch(""); } }, [open, value]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const handleConfirm = () => { onChange(tempValue); setOpen(false); };
  const handleCancel = () => { setTempValue(value); setOpen(false); };

  const findNode = (nodes: GroupNode[], id: string): GroupNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const found = findNode(n.children, id); if (found) return found; }
    }
  };
  const triggerNode = value ? findNode(groups, value) : undefined;
  const selectedNode = tempValue ? findNode(groups, tempValue) : undefined;

  function TreeNode({ node, level = 0 }: { node: GroupNode; level?: number }) {
    const hasChildren = !!node.children?.length;
    const isExpanded = expanded.has(node.id);
    const isSelected = tempValue === node.id;
    const matchSearch = !search || node.name.includes(search);
    const childMatch = search ? (node.children || []).some(c => c.name.includes(search)) : true;
    if (!matchSearch && !childMatch) return null;
    return (
      <div>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-100"}`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => setTempValue(node.id)}
        >
          {hasChildren ? (
            <button className="p-0.5 text-gray-400 shrink-0" onClick={e => { e.stopPropagation(); toggleExpand(node.id); }}>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : <span className="w-4 shrink-0" />}
          <span className={`text-sm truncate flex-1 ${isSelected ? "text-blue-600 font-medium" : ""}`}>{node.name}</span>
          {isSelected && <Check className="w-4 h-4 ml-auto text-blue-600 flex-shrink-0" />}
        </div>
        {hasChildren && (isExpanded || !!search) && node.children!.map(c => <TreeNode key={c.id} node={c} level={level + 1} />)}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox"
          className={`w-[140px] justify-between bg-white text-sm font-normal h-9 hover:bg-white data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 ${triggerNode ? "text-foreground" : "text-muted-foreground"}`}>
          <span className="truncate">{triggerNode?.name || "全部分组"}</span>
          <ChevronDown className={`w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b border-gray-100">
          <input
            type="text" placeholder="搜索分组" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-8 px-3 text-sm rounded-md border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2">
          <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"}`} onClick={() => setTempValue("")}>
            <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部分组</span>
            {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          </div>
          {groups.map(g => <TreeNode key={g.id} node={g} />)}
        </div>
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 text-xs overflow-hidden">
            {tempValue === "" ? (
              <span className="text-blue-600 font-medium truncate">全部分组</span>
            ) : selectedNode ? (
              <span className="text-blue-600 font-medium truncate">{selectedNode.name}</span>
            ) : (
              <span className="text-gray-400 truncate">未选择</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7 px-2" onClick={handleCancel}>取消</Button>
            <Button size="sm" className="text-xs h-7 px-3" onClick={handleConfirm}>确认</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── PolicyRule 类型 ─────────────────────────────────────────────────────────

interface PolicyRule<T> {
  id: string;
  groupIds: string[];
  value: T;
}

// ─── 行容器样式常量 ──────────────────────────────────────────────────────────
const FM_ROW_CLASS = "flex items-center gap-3 px-3 h-10";
const FM_EDIT_ROW_CLASS = "flex items-start gap-3 px-3 min-h-10 py-1.5";

// ─── 分组选择器 ──────────────────────────────────────────────────────────────
function FMGroupTagSelector({
  selectedIds,
  disabledIds = [],
  onChange,
}: {
  selectedIds: string[];
  disabledIds?: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allGroups: UserGroup[] = [...MOCK_ONEID_GROUPS, ...MOCK_MANUAL_GROUPS];
  const tree: GroupTreeNode[] = buildGroupTree(allGroups);

  const getGroupName = (id: string) => allGroups.find((g) => g.id === id)?.name ?? id;

  const toggle = (id: string) => {
    if (disabledIds.includes(id)) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const filterTree = (nodes: GroupTreeNode[], q: string): GroupTreeNode[] => {
    if (!q) return nodes;
    return nodes.reduce<GroupTreeNode[]>((acc, node) => {
      const children = filterTree(node.children, q);
      if (node.name.includes(q) || children.length > 0) acc.push({ ...node, children });
      return acc;
    }, []);
  };

  function TreeNode({ node, depth = 0 }: { node: GroupTreeNode; depth?: number }) {
    const [expanded, setExpanded] = useState(true);
    const checked = selectedIds.includes(node.id);
    const disabled = disabledIds.includes(node.id);
    return (
      <div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => !disabled && toggle(node.id)}
        >
          {node.children.length > 0 ? (
            <button className="p-0.5 text-gray-400 shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : <span className="w-4 shrink-0" />}
          <Checkbox checked={checked} disabled={disabled} className="w-3.5 h-3.5 shrink-0" onChange={() => {}} />
          <span className="text-xs text-gray-700 truncate">{node.name}</span>
        </div>
        {expanded && node.children.map((c) => <TreeNode key={c.id} node={c} depth={depth + 1} />)}
      </div>
    );
  }

  const filtered = filterTree(tree, search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="min-h-7 flex flex-wrap gap-1 items-center px-2 py-1 border border-gray-200 rounded-md cursor-pointer hover:border-blue-400 transition-colors bg-white">
          {selectedIds.length === 0
            ? <span className="text-xs text-gray-400">选择分组…</span>
            : selectedIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px]">
                {getGroupName(id)}
                <button onClick={(e) => { e.stopPropagation(); toggle(id); }} className="hover:text-blue-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <Input placeholder="搜索分组…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs mb-2" />
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0
            ? <p className="text-xs text-gray-400 text-center py-4">无匹配分组</p>
            : filtered.map((n) => <TreeNode key={n.id} node={n} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 分组名称展示 ────────────────────────────────────────────────────────────
function FMGroupBadges({ groupIds }: { groupIds: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(groupIds.length);

  const allGroups: UserGroup[] = [...MOCK_ONEID_GROUPS, ...MOCK_MANUAL_GROUPS];
  const paths = groupIds.map((id) => allGroups.find((g) => g.id === id)?.name ?? id);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const computeVisible = () => {
      const available = container.offsetWidth;
      const gap = 4;
      let w = 0; let fitCount = 0;
      for (let i = 0; i < paths.length; i++) {
        const el = tagRefs.current[i];
        if (!el) continue;
        const add = el.offsetWidth + (i === 0 ? 0 : gap);
        if (w + add > available) break;
        w += add; fitCount++;
      }
      if (fitCount === paths.length) { setVisibleCount(paths.length); return; }
      const moreEl = moreRef.current;
      if (!moreEl) { setVisibleCount(Math.max(1, fitCount)); return; }
      for (let n = fitCount; n >= 1; n--) {
        let tw = 0;
        for (let i = 0; i < n; i++) { const el = tagRefs.current[i]; if (!el) continue; tw += el.offsetWidth + (i === 0 ? 0 : gap); }
        moreEl.textContent = `…共 ${paths.length} 个分组`;
        if (tw + gap + moreEl.offsetWidth <= available) { setVisibleCount(n); return; }
      }
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
        <div ref={containerRef} className="flex items-center gap-1 w-full overflow-hidden cursor-default">
          {paths.slice(0, visibleCount).map((p, i) => (
            <span key={i} ref={(el) => { tagRefs.current[i] = el; }} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] whitespace-nowrap shrink-0">{p}</span>
          ))}
          {omitted > 0 && <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-gray-500 whitespace-nowrap shrink-0">…共 {paths.length} 个分组</span>}
          <div aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap" style={{ left: -99999, top: -99999 }}>
            {paths.map((p, i) => <span key={`m-${i}`} ref={(el) => { tagRefs.current[i] = el; }} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] whitespace-nowrap">{p}</span>)}
            <span ref={moreRef} className="inline-flex items-center px-1.5 py-0.5 text-[11px] text-gray-500 whitespace-nowrap" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent><p className="text-xs">{paths.join("、")}</p></TooltipContent>
    </Tooltip>
  );
}

// ─── TogglePolicyCard ────────────────────────────────────────────────────────
interface TogglePolicyCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  rules: PolicyRule<boolean>[];
  onRulesChange: (rules: PolicyRule<boolean>[]) => boolean | void;
}

function FMTogglePolicyCard({ icon, iconBg, title, description, rules, onRulesChange }: TogglePolicyCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<boolean>(true);
  const [addingNew, setAddingNew] = useState(false);
  const [confirmFallbackDraft, setConfirmFallbackDraft] = useState<boolean | null>(null);

  const getDisabledIds = (excludeRuleId?: string) =>
    rules.filter((r) => r.groupIds.length > 0 && r.id !== excludeRuleId).flatMap((r) => r.groupIds);

  const fallbackRule = rules.find((r) => r.groupIds.length === 0)!;
  const groupRules = rules.filter((r) => r.groupIds.length > 0);
  const groupRuleValue = !fallbackRule.value;

  const startEdit = (rule: PolicyRule<boolean>) => {
    setEditingId(rule.id);
    setDraftGroupIds([...rule.groupIds]);
    setDraftValue(rule.groupIds.length === 0 ? rule.value : groupRuleValue);
    setAddingNew(false);
  };
  const startAdd = () => { setAddingNew(true); setEditingId(null); setDraftGroupIds([]); setDraftValue(groupRuleValue); };
  const cancelEdit = () => { setEditingId(null); setAddingNew(false); };

  const saveEdit = (ruleId?: string) => {
    if (addingNew) {
      if (draftGroupIds.length === 0) { toast.error("请选择至少一个分组"); return; }
      const result = onRulesChange([...groupRules, { id: `rule-${Date.now()}`, groupIds: draftGroupIds, value: groupRuleValue }, fallbackRule]);
      if (result === false) return;
      toast.success("策略已保存"); cancelEdit(); return;
    }
    if (!ruleId) return;
    if (ruleId === fallbackRule.id) {
      if (draftValue !== fallbackRule.value && groupRules.length > 0) { setConfirmFallbackDraft(draftValue); return; }
      const result = onRulesChange(rules.map((r) => r.id === ruleId ? { ...r, value: draftValue } : r));
      if (result === false) return;
      toast.success("策略已保存"); cancelEdit(); return;
    }
    const result = onRulesChange(rules.map((r) => r.id === ruleId ? { ...r, groupIds: draftGroupIds, value: groupRuleValue } : r));
    if (result === false) return;
    toast.success("策略已保存"); cancelEdit();
  };

  const handleConfirmFallbackSwitch = () => {
    if (confirmFallbackDraft === null) return;
    const result = onRulesChange([{ ...fallbackRule, value: confirmFallbackDraft }]);
    if (result !== false) { toast.success("已更新预设策略，分组策略已清空"); cancelEdit(); }
    setConfirmFallbackDraft(null);
  };

  const deleteRule = (ruleId: string) => {
    const result = onRulesChange(rules.filter((r) => r.id !== ruleId));
    if (result === false) return;
    toast.success("策略已删除");
  };

  const renderFallbackValueEditor = () => (
    <>
      <button onClick={() => setDraftValue(true)} className={`text-xs h-7 px-2 rounded-md border transition-colors ${draftValue ? "border-green-400 bg-green-50 text-green-700 font-medium" : "border-gray-200 text-gray-500"}`}>开启</button>
      <button onClick={() => setDraftValue(false)} className={`text-xs h-7 px-2 rounded-md border transition-colors ${!draftValue ? "border-red-300 bg-red-50 text-red-600 font-medium" : "border-gray-200 text-gray-500"}`}>关闭</button>
    </>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}>
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-gray-900 flex-1">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>

      <div className="px-5 pb-4">
        {(groupRules.length > 0 || addingNew) && (
          <div className={`${FM_ROW_CLASS} border-b border-gray-100`}>
            <span className="flex-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">分组</span>
            <span className="w-24 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide">权限</span>
            <span className="w-14 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wide">操作</span>
          </div>
        )}

        {groupRules.map((rule) => (
          <div key={rule.id}>
            {editingId === rule.id ? (
              <div className={FM_EDIT_ROW_CLASS}>
                <div className="flex-1 min-w-0 pt-0.5">
                  <FMGroupTagSelector selectedIds={draftGroupIds} disabledIds={getDisabledIds(rule.id)} onChange={setDraftGroupIds} />
                </div>
                <div className="w-24 flex items-center justify-end gap-1 h-7 pt-0.5">
                  <span className={`text-xs font-medium ${groupRuleValue ? "text-green-600" : "text-red-500"}`}>{groupRuleValue ? "开启" : "关闭"}</span>
                </div>
                <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
                  <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                  <button onClick={() => saveEdit(rule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
                </div>
              </div>
            ) : (
              <div className={`${FM_ROW_CLASS} border-b border-gray-50 hover:bg-gray-50/50 transition-colors`}>
                <div className="flex-1 min-w-0"><FMGroupBadges groupIds={rule.groupIds} /></div>
                <div className="w-24 text-right">
                  <span className={`text-xs font-medium ${rule.value ? "text-green-600" : "text-red-500"}`}>{rule.value ? "开启" : "关闭"}</span>
                </div>
                <div className="w-14 flex items-center justify-end gap-1">
                  <button onClick={() => startEdit(rule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => deleteRule(rule.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {addingNew ? (
          <div className={FM_EDIT_ROW_CLASS}>
            <div className="flex-1 min-w-0 pt-0.5">
              <FMGroupTagSelector selectedIds={draftGroupIds} disabledIds={getDisabledIds()} onChange={setDraftGroupIds} />
            </div>
            <div className="w-24 flex items-center justify-end gap-1 h-7 pt-0.5">
              <span className={`text-xs font-medium ${groupRuleValue ? "text-green-600" : "text-red-500"}`}>{groupRuleValue ? "开启" : "关闭"}</span>
            </div>
            <div className="w-14 flex items-center justify-end gap-1 h-7 pt-0.5">
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
              <button onClick={() => saveEdit()} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          groupRules.length === 0 && (
            <button onClick={startAdd} className="flex items-center gap-1.5 px-3 h-10 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />添加分组策略
            </button>
          )
        )}

        <div className="border-t border-dashed border-gray-200 mt-2 pt-2">
          {editingId === fallbackRule.id ? (
            <div className={FM_ROW_CLASS}>
              <div className="flex-1 min-w-0"><span className="text-xs text-gray-500 font-medium">预设策略</span></div>
              <div className="w-24 flex items-center justify-end gap-1">{renderFallbackValueEditor()}</div>
              <div className="w-14 flex items-center justify-end gap-1">
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-3 h-3" /></button>
                <button onClick={() => saveEdit(fallbackRule.id)} className="text-blue-500 hover:text-blue-700 transition-colors p-1"><Check className="w-3 h-3" /></button>
              </div>
            </div>
          ) : (
            <div className={FM_ROW_CLASS}>
              <div className="flex-1 min-w-0"><span className="text-xs text-gray-500 font-medium">预设策略</span></div>
              <div className="w-24 text-right">
                <span className={`text-xs font-medium ${fallbackRule.value ? "text-green-600" : "text-red-500"}`}>{fallbackRule.value ? "开启" : "关闭"}</span>
              </div>
              <div className="w-14 flex items-center justify-end">
                <button onClick={() => startEdit(fallbackRule)} className="text-gray-400 hover:text-blue-500 transition-colors p-1"><Pencil className="w-3 h-3" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmFallbackDraft !== null} onOpenChange={(o) => { if (!o) setConfirmFallbackDraft(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换后将清空分组策略</AlertDialogTitle>
            <AlertDialogDescription>分组策略是基于「预设策略」的例外设置。切换「预设策略」后，现有分组策略将全部清空，需重新添加。</AlertDialogDescription>
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

// Updated Mock Data for Enterprise Spaces
const ENTERPRISE_SPACES = [
  { id: "ent-001", name: "Agent 工具库", type: "公共", used: "12GB", quota: "50GB", expiry: "永久有效" },
  { id: "ent-002", name: "初始技能包", type: "公共", used: "8GB", quota: "50GB", expiry: "永久有效" },
];

// Mock Data for Personal Spaces (Flat Structure) - 已去重
const PERSONAL_SPACES_DATA = [
  { id: "user-ins-1", instanceId: "ins-u25p9jqg", instanceName: "Noah的分析助手", creator: "noah@acompany.com", avatar: "N", type: "个人", used: "5GB", quota: "50GB", expiry: "2026-06-30", enabled: false, wasEnabled: true, deletedDaysAgo: 20 }, // 永久删除状态（超过15天）
  { id: "user-ins-3", instanceId: "ins-v88x2kww", instanceName: "Noah的测试沙盒", creator: "noah@acompany.com", avatar: "N", type: "个人", used: "2GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-4", instanceId: "ins-t14o8ipf", instanceName: "Mia的新助手", creator: "mia@acompany.com", avatar: "M", type: "个人", used: "5GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-6", instanceId: "ins-s03n7heo", instanceName: "Leo的项目助手", creator: "leo@acompany.com", avatar: "L", type: "个人", used: "5GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-7", instanceId: "ins-x11m9zzz", instanceName: "Leo的文档库", creator: "leo@acompany.com", avatar: "L", type: "个人", used: "15GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-9", instanceId: "ins-p99k3mnn", instanceName: "Emma的数据分析", creator: "emma@acompany.com", avatar: "E", type: "个人", used: "7GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-10", instanceId: "ins-q22l4roo", instanceName: "David的代码助手", creator: "david@acompany.com", avatar: "D", type: "个人", used: "9GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-11", instanceId: "ins-r33m5spp", instanceName: "Sarah的研究工具", creator: "sarah@acompany.com", avatar: "S", type: "个人", used: "4GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-12", instanceId: "ins-t44n6tqq", instanceName: "Jack的文案助手", creator: "jack@acompany.com", avatar: "J", type: "个人", used: "6GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-13", instanceId: "ins-u55o7urr", instanceName: "Lisa的设计工具", creator: "lisa@acompany.com", avatar: "L", type: "个人", used: "11GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-14", instanceId: "ins-v66p8vss", instanceName: "Tom的营销助手", creator: "tom@acompany.com", avatar: "T", type: "个人", used: "8GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-15", instanceId: "ins-w77q9wtt", instanceName: "Amy的翻译工具", creator: "amy@acompany.com", avatar: "A", type: "个人", used: "3GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-16", instanceId: "ins-x88r0xuu", instanceName: "Mike的产品分析", creator: "mike@acompany.com", avatar: "M", type: "个人", used: "13GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-17", instanceId: "ins-y99s1yvv", instanceName: "Kate的客服助手", creator: "kate@acompany.com", avatar: "K", type: "个人", used: "5GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-18", instanceId: "ins-z00t2zww", instanceName: "Ryan的技术文档", creator: "ryan@acompany.com", avatar: "R", type: "个人", used: "10GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-19", instanceId: "ins-a11u3axv", instanceName: "这是一个名称非常非常长的智能助手用来测试超长文本截断效果", creator: "longname-user@very-long-domain-example.com", avatar: "L", type: "个人", used: "8GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
  { id: "user-ins-20", instanceId: "ins-b22v4byw", instanceName: "GPULab产品线专属AI智能运营分析与决策支持系统", creator: "product-ops-admin@enterprise-acompany.com", avatar: "G", type: "个人", used: "22GB", quota: "50GB", expiry: "2026-06-30", enabled: false },
];

const StatCard = ({ title, value, icon: Icon, gradient }: any) => (
  <div
    className="bg-white rounded-[4px] border border-gray-100 p-5 transition-all duration-200 hover:-translate-y-0.5"
    style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
  >
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-9 h-9 rounded-[4px] bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-sm text-gray-500">{title}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
  </div>
);

export default function FileManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [autoBindRules, setAutoBindRules] = useState<PolicyRule<boolean>[]>([
    { id: "autobind-fallback", groupIds: [], value: true },
  ]);
  const [allowSelfEnableRules, setAllowSelfEnableRules] = useState<PolicyRule<boolean>[]>([
    { id: "selfopen-fallback", groupIds: [], value: true },
  ]);
  const [instancesEnabled, setInstancesEnabled] = useState<Record<string, boolean>>(
    PERSONAL_SPACES_DATA.reduce((acc, item) => {
      acc[item.id] = item.enabled;
      return acc;
    }, {} as Record<string, boolean>)
  );
  // 追踪曾经启用过的实例（用于显示"可恢复"状态）
  const [instancesEverEnabled, setInstancesEverEnabled] = useState<Record<string, boolean>>(
    PERSONAL_SPACES_DATA.reduce((acc, item) => {
      // @ts-ignore - 使用 wasEnabled 字段初始化
      acc[item.id] = item.wasEnabled !== undefined ? item.wasEnabled : item.enabled;
      return acc;
    }, {} as Record<string, boolean>)
  );
  // 追踪实例的关闭时间（用于计算剩余天数）
  const [instancesDisabledTime, setInstancesDisabledTime] = useState<Record<string, Date>>(
    PERSONAL_SPACES_DATA.reduce((acc, item) => {
      // @ts-ignore - 如果有 deletedDaysAgo 字段，计算关闭时间
      if (item.deletedDaysAgo !== undefined) {
        const disabledDate = new Date();
        // @ts-ignore
        disabledDate.setDate(disabledDate.getDate() - item.deletedDaysAgo);
        acc[item.id] = disabledDate;
      }
      return acc;
    }, {} as Record<string, Date>)
  );
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [instanceToDisable, setInstanceToDisable] = useState<{ id: string; name: string } | null>(null);
  const [batchEnableDialogOpen, setBatchEnableDialogOpen] = useState(false);
  const [singleEnableDialogOpen, setSingleEnableDialogOpen] = useState(false);
  const [instanceToEnable, setInstanceToEnable] = useState<{ id: string; name: string } | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [instanceToPurchase, setInstanceToPurchase] = useState<{ id: string; name: string } | null>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<string>("50GB");
  const [selectedDuration, setSelectedDuration] = useState<string>("3");
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [instanceToRenew, setInstanceToRenew] = useState<{ id: string; name: string } | null>(null);
  const [renewDuration, setRenewDuration] = useState<string>("3");
  const [expandDialogOpen, setExpandDialogOpen] = useState(false);
  const [instanceToExpand, setInstanceToExpand] = useState<{ id: string; name: string } | null>(null);
  const [expandCapacity, setExpandCapacity] = useState<string>("100GB");
  const [recyclebinOpen, setRecyclebinOpen] = useState(false);
  const [enableChoiceDialogOpen, setEnableChoiceDialogOpen] = useState(false);
  const [instanceToEnableChoice, setInstanceToEnableChoice] = useState<{ id: string; name: string } | null>(null);
  const [recyclebinRecoverDialogOpen, setRecyclebinRecoverDialogOpen] = useState(false);
  const [instanceToRecoverFromRecyclebin, setInstanceToRecoverFromRecyclebin] = useState<{ id: string; name: string } | null>(null);
  const [recyclebinDeleteDialogOpen, setRecyclebinDeleteDialogOpen] = useState(false);
  const [instanceToDeletePermanently, setInstanceToDeletePermanently] = useState<{ id: string; name: string } | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [instanceToTransfer, setInstanceToTransfer] = useState<{ id: string; name: string; instanceId: string } | null>(null);
  const [selectedTargetInstance, setSelectedTargetInstance] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleToggleInstance = (instanceId: string, instanceName: string, currentEnabled: boolean, wasEverEnabled: boolean) => {
    if (currentEnabled) {
      // 如果当前是开启状态，尝试关闭时弹出确认对话框
      setInstanceToDisable({ id: instanceId, name: instanceName });
      setDisableDialogOpen(true);
    } else {
      // 如果当前是关闭状态
      // 检查回收站中是否有该实例自己的网盘（15天内可恢复）
      const hasOwnRecyclableSpace = wasEverEnabled && !isPermanentlyDeleted(instanceId);
      
      if (hasOwnRecyclableSpace) {
        // 回收站中有该实例自己的网盘，弹出选择弹窗（新启用 vs 恢复之前的）
        setInstanceToEnableChoice({ id: instanceId, name: instanceName });
        setEnableChoiceDialogOpen(true);
      } else {
        // 回收站中没有该实例自己的网盘，直接弹出首次启用确认对话框（不再检查其他实例）
        setInstanceToEnable({ id: instanceId, name: instanceName });
        setSingleEnableDialogOpen(true);
      }
    }
  };

  const handleConfirmDisable = () => {
    if (instanceToDisable) {
      setInstancesEnabled(prev => ({
        ...prev,
        [instanceToDisable.id]: false
      }));
      // 记录关闭时间
      setInstancesDisabledTime(prev => ({
        ...prev,
        [instanceToDisable.id]: new Date()
      }));
    }
    setDisableDialogOpen(false);
    setInstanceToDisable(null);
  };

  const handleCancelDisable = () => {
    setDisableDialogOpen(false);
    setInstanceToDisable(null);
  };

  const handleBatchEnable = () => {
    if (selectedInstances.size > 0) {
      setBatchEnableDialogOpen(true);
    }
  };

  const handleConfirmBatchEnable = () => {
    // 启用所有选中的实例
    const newEnabled = { ...instancesEnabled };
    const newEverEnabled = { ...instancesEverEnabled };
    const newDisabledTimes = { ...instancesDisabledTime };
    selectedInstances.forEach(instanceId => {
      newEnabled[instanceId] = true;
      newEverEnabled[instanceId] = true; // 标记为曾经启用过
      delete newDisabledTimes[instanceId]; // 清除关闭时间
    });
    setInstancesEnabled(newEnabled);
    setInstancesEverEnabled(newEverEnabled);
    setInstancesDisabledTime(newDisabledTimes);
    setSelectedInstances(new Set()); // 清空选中状态
    setBatchEnableDialogOpen(false);
  };

  const handleCancelBatchEnable = () => {
    setBatchEnableDialogOpen(false);
  };

  const handleConfirmSingleEnable = () => {
    if (instanceToEnable) {
      setInstancesEnabled(prev => ({
        ...prev,
        [instanceToEnable.id]: true
      }));
      setInstancesEverEnabled(prev => ({
        ...prev,
        [instanceToEnable.id]: true // 标记为曾经启用过
      }));
    }
    setSingleEnableDialogOpen(false);
    setInstanceToEnable(null);
  };

  const handleCancelSingleEnable = () => {
    setSingleEnableDialogOpen(false);
    setInstanceToEnable(null);
  };

  // 选择新启用
  const handleChooseNewEnable = () => {
    if (instanceToEnableChoice) {
      setInstanceToEnable({ id: instanceToEnableChoice.id, name: instanceToEnableChoice.name });
      setEnableChoiceDialogOpen(false);
      setInstanceToEnableChoice(null);
      setSingleEnableDialogOpen(true);
    }
  };

  // 选择恢复已有
  const handleChooseRecoverExisting = () => {
    if (!instanceToEnableChoice) {
      setEnableChoiceDialogOpen(false);
      setInstanceToEnableChoice(null);
      return;
    }
    
    // 直接恢复该实例自己的网盘（因为只有该实例自己有网盘时才会显示选择弹窗）
    handleDirectRecover(instanceToEnableChoice.id);
    
    setEnableChoiceDialogOpen(false);
    setInstanceToEnableChoice(null);
  };

  // 取消选择
  const handleCancelEnableChoice = () => {
    setEnableChoiceDialogOpen(false);
    setInstanceToEnableChoice(null);
  };


  const handleConfirmPurchase = () => {
    if (instanceToPurchase) {
      // 启用实例
      setInstancesEnabled(prev => ({
        ...prev,
        [instanceToPurchase.id]: true
      }));
      setInstancesEverEnabled(prev => ({
        ...prev,
        [instanceToPurchase.id]: true
      }));
      // 清除关闭时间记录
      setInstancesDisabledTime(prev => {
        const newTimes = { ...prev };
        delete newTimes[instanceToPurchase.id];
        return newTimes;
      });
    }
    setPurchaseDialogOpen(false);
    setInstanceToPurchase(null);
    // 重置选择
    setSelectedCapacity("50GB");
    setSelectedDuration("3");
  };

  const handleCancelPurchase = () => {
    setPurchaseDialogOpen(false);
    setInstanceToPurchase(null);
    // 重置选择
    setSelectedCapacity("50GB");
    setSelectedDuration("3");
  };

  // 计算购买价格
  const calculatePrice = () => {
    const capacityPrices: Record<string, number> = {
      "50GB": 2,
      "100GB": 4,
      "500GB": 8
    };
    const basePrice = capacityPrices[selectedCapacity] || 0;
    const duration = parseInt(selectedDuration);
    return basePrice * duration;
  };

  // 处理续费
  const handleRenew = (instanceId: string, instanceName: string) => {
    setInstanceToRenew({ id: instanceId, name: instanceName });
    setRenewDialogOpen(true);
  };

  const handleConfirmRenew = () => {
    if (instanceToRenew) {
      // TODO: 实现续费逻辑
      console.log('确认续费', instanceToRenew.id, '时长', renewDuration);
    }
    setRenewDialogOpen(false);
    setInstanceToRenew(null);
    setRenewDuration("3");
  };

  const handleCancelRenew = () => {
    setRenewDialogOpen(false);
    setInstanceToRenew(null);
    setRenewDuration("3");
  };

  // 计算续费价格
  const calculateRenewPrice = () => {
    const basePrice = 2; // 假设当前容量为50GB，单价2元/月
    const duration = parseInt(renewDuration);
    return basePrice * duration;
  };

  // 处理扩容
  const handleExpand = (instanceId: string, instanceName: string) => {
    setInstanceToExpand({ id: instanceId, name: instanceName });
    setExpandDialogOpen(true);
  };

  const handleConfirmExpand = () => {
    if (instanceToExpand) {
      // TODO: 实现扩容逻辑
      console.log('确认扩容', instanceToExpand.id, '容量', expandCapacity);
    }
    setExpandDialogOpen(false);
    setInstanceToExpand(null);
    setExpandCapacity("50GB");
  };

  const handleCancelExpand = () => {
    setExpandDialogOpen(false);
    setInstanceToExpand(null);
    setExpandCapacity("100GB");
  };

  // 生成扩容容量选项（以50GB为步长，最多显示6个档位）
  const generateExpandCapacityOptions = () => {
    const options = [];
    for (let i = 1; i <= 10; i++) {
      const capacity = i * 50;
      options.push({
        value: `${capacity}GB`,
        label: `${capacity}GB`,
        price: `¥${i * 2}`
      });
    }
    return options;
  };

  // 计算扩容价格（一次性费用，不涉及时长）
  // 规则：每50GB = ¥2
  const calculateExpandPrice = () => {
    const match = expandCapacity.match(/^(\d+)GB$/);
    if (match) {
      const capacity = parseInt(match[1]);
      return (capacity / 50) * 2;
    }
    return 0;
  };

  // 计算可恢复的剩余天数
  const getRemainingDays = (instanceId: string): number => {
    const disabledTime = instancesDisabledTime[instanceId];
    if (!disabledTime) return 15; // 如果没有关闭时间记录，默认显示15天
    
    const now = new Date();
    const diffTime = now.getTime() - disabledTime.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remainingDays = 15 - diffDays;
    
    return Math.max(0, remainingDays); // 确保不返回负数
  };

  // 获取回收站中的实例（已关闭的实例）
  const getRecyclebinInstances = () => {
    return PERSONAL_SPACES_DATA.filter(item => {
      const isDisabled = !instancesEnabled[item.id];
      const wasEnabled = instancesEverEnabled[item.id];
      return isDisabled && wasEnabled;
    }).map(item => ({
      ...item,
      remainingDays: getRemainingDays(item.id),
      isPermanentlyDeleted: isPermanentlyDeleted(item.id)
    }));
  };

  // 从回收站永久删除实例
  const handlePermanentDelete = (instanceId: string) => {
    // 这里可以调用后端API永久删除数据
    console.log('永久删除实例:', instanceId);
    // 从instancesEverEnabled中移除，表示彻底删除
    setInstancesEverEnabled(prev => {
      const newEnabled = { ...prev };
      delete newEnabled[instanceId];
      return newEnabled;
    });
  };

  // 确认永久删除
  const handleConfirmPermanentDelete = () => {
    if (instanceToDeletePermanently) {
      handlePermanentDelete(instanceToDeletePermanently.id);
    }
    setRecyclebinDeleteDialogOpen(false);
    setInstanceToDeletePermanently(null);
  };

  // 取消永久删除
  const handleCancelPermanentDelete = () => {
    setRecyclebinDeleteDialogOpen(false);
    setInstanceToDeletePermanently(null);
  };

  // 直接恢复实例（免费）
  const handleDirectRecover = (instanceId: string) => {
    console.log('直接恢复实例:', instanceId);
    setInstancesEnabled(prev => ({
      ...prev,
      [instanceId]: true
    }));
    // 清除关闭时间记录
    setInstancesDisabledTime(prev => {
      const newTimes = { ...prev };
      delete newTimes[instanceId];
      return newTimes;
    });
  };

  // 从回收站恢复实例
  const handleRestoreFromRecyclebin = (instanceId: string, instanceName: string) => {
    // 打开恢复确认弹窗
    setInstanceToRecoverFromRecyclebin({ id: instanceId, name: instanceName });
    setRecyclebinRecoverDialogOpen(true);
  };

  // 确认从回收站恢复
  const handleConfirmRecyclebinRecover = () => {
    if (instanceToRecoverFromRecyclebin) {
      handleDirectRecover(instanceToRecoverFromRecyclebin.id);
    }
    setRecyclebinRecoverDialogOpen(false);
    setInstanceToRecoverFromRecyclebin(null);
  };

  // 取消从回收站恢复
  const handleCancelRecyclebinRecover = () => {
    setRecyclebinRecoverDialogOpen(false);
    setInstanceToRecoverFromRecyclebin(null);
  };

  // 打开转接对话框
  const handleOpenTransfer = (instanceId: string, instanceName: string, instanceIdString: string) => {
    setInstanceToTransfer({ id: instanceId, name: instanceName, instanceId: instanceIdString });
    setSelectedTargetInstance("");
    setTransferDialogOpen(true);
  };

  // 确认转接
  const handleConfirmTransfer = () => {
    if (!instanceToTransfer || !selectedTargetInstance) {
      return;
    }
    
    // 执行转接逻辑
    console.log('转接网盘:', instanceToTransfer.id, '目标实例:', selectedTargetInstance);
    
    // 1. 将原实例的网盘标记为永久删除
    setInstancesEverEnabled(prev => {
      const newEnabled = { ...prev };
      delete newEnabled[instanceToTransfer.id];
      return newEnabled;
    });
    
    // 2. 将目标实例启用并标记为曾经启用过
    setInstancesEnabled(prev => ({
      ...prev,
      [selectedTargetInstance]: true
    }));
    setInstancesEverEnabled(prev => ({
      ...prev,
      [selectedTargetInstance]: true
    }));
    
    // 3. 清除目标实例的关闭时间（如果有）
    setInstancesDisabledTime(prev => {
      const newTimes = { ...prev };
      delete newTimes[selectedTargetInstance];
      return newTimes;
    });
    
    // 关闭对话框
    setTransferDialogOpen(false);
    setInstanceToTransfer(null);
    setSelectedTargetInstance("");
  };

  // 取消转接
  const handleCancelTransfer = () => {
    setTransferDialogOpen(false);
    setInstanceToTransfer(null);
    setSelectedTargetInstance("");
  };

  // 获取可转接的目标实例列表（排除当前实例）
  const getAvailableTargetInstances = () => {
    if (!instanceToTransfer) return [];
    return PERSONAL_SPACES_DATA.filter(item => 
      item.id !== instanceToTransfer.id && // 排除当前实例
      !instancesEnabled[item.id] && // 只显示未启用的实例
      !instancesEverEnabled[item.id] // 排除曾经启用过的实例
    );
  };


  // 检查实例是否已永久删除（超过15天）
  const isPermanentlyDeleted = (instanceId: string): boolean => {
    const disabledTime = instancesDisabledTime[instanceId];
    if (!disabledTime) return false;
    
    const now = new Date();
    const diffTime = now.getTime() - disabledTime.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 15; // 超过或等于15天则永久删除
  };

  // 计算未启用的实例数量（排除永久删除的）
  const disabledInstancesCount = React.useMemo(() => {
    return PERSONAL_SPACES_DATA.filter(item => 
      !instancesEnabled[item.id] && !isPermanentlyDeleted(item.id)
    ).length;
  }, [instancesEnabled, instancesDisabledTime]);

  // 获取所有未启用的实例ID（排除永久删除的）
  const allDisabledInstanceIds = React.useMemo(() => {
    return PERSONAL_SPACES_DATA.filter(item => 
      !instancesEnabled[item.id] && !isPermanentlyDeleted(item.id)
    ).map(item => item.id);
  }, [instancesEnabled, instancesDisabledTime]);

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInstances(new Set(allDisabledInstanceIds));
    } else {
      setSelectedInstances(new Set());
    }
  };

  // 处理单个实例选中
  const handleSelectInstance = (instanceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInstances);
    if (checked) {
      newSelected.add(instanceId);
    } else {
      newSelected.delete(instanceId);
    }
    setSelectedInstances(newSelected);
  };

  // 判断是否全选
  const isAllSelected = allDisabledInstanceIds.length > 0 && 
    allDisabledInstanceIds.every(id => selectedInstances.has(id));

  // 判断是否部分选中
  const isIndeterminate = selectedInstances.size > 0 && 
    selectedInstances.size < allDisabledInstanceIds.length;

  // 计算统计数据
  const stats = React.useMemo(() => {
    // 计算企业公共空间数量
    const enterpriseSpacesCount = ENTERPRISE_SPACES.length;

    // 计算个人空间实例总数（只计算enabled=true的记录）
    const totalPersonalInstances = PERSONAL_SPACES_DATA.filter(item => instancesEnabled[item.id]).length;

    return {
      enterpriseSpacesCount,
      totalPersonalInstances
    };
  }, [instancesEnabled]);

  // 搜索过滤
  const filteredPersonalSpaces = React.useMemo(() => {
    let result = PERSONAL_SPACES_DATA;
    // 分组筛选
    if (groupFilter) {
      // 收集所选分组及其子孙 ID
      const collectIds = (nodes: GroupNode[], targetId: string): string[] => {
        const ids: string[] = [];
        const collect = (node: GroupNode) => { ids.push(node.id); node.children?.forEach(collect); };
        const find = (list: GroupNode[]): boolean => {
          for (const n of list) {
            if (n.id === targetId) { collect(n); return true; }
            if (n.children && find(n.children)) return true;
          }
          return false;
        };
        find(nodes);
        return ids;
      };
      const allowedGroupIds = collectIds(MOCK_GROUP_TREE_MANUAL, groupFilter);
      result = result.filter(item => {
        const g = CREATOR_GROUP_MAP[item.creator];
        return g && allowedGroupIds.includes(g);
      });
    }
    // 关键词搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.instanceName.toLowerCase().includes(query) ||
        item.instanceId.toLowerCase().includes(query) ||
        item.creator.toLowerCase().includes(query)
      );
    }
    return result;
  }, [searchQuery, groupFilter]);

  // 计算总页数
  const totalPages = Math.ceil(filteredPersonalSpaces.length / itemsPerPage);

  // 获取当前页数据
  const paginatedPersonalSpaces = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPersonalSpaces.slice(startIndex, endIndex);
  }, [filteredPersonalSpaces, currentPage]);

  // 当搜索或分组条件变化时重置到第一页
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, groupFilter]);

  return (
    <div className="page-enter space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">网盘管理</h1>
          <p className="text-sm text-gray-500 mt-1">为您提供专属、安全的云存储空间，由腾讯云存储 Agent Storage 服务提供支持</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-6">
        <StatCard 
          title="企业公共空间" 
          value={stats.enterpriseSpacesCount}
          icon={Building} 
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard 
          title="已开通智能体网盘" 
          value={stats.totalPersonalInstances}
          icon={Bot} 
          gradient="from-purple-500 to-purple-600"
        />
      </div>

      {/* Enterprise Public Space Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900">企业公共空间</h2>
        </div>

        {/* 信息提示横幅 */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-[4px] px-4 py-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-600 leading-relaxed">
            默认开启,为您赠送 <span className="font-semibold">50GB + 50GB</span> 永久免费空间,用于存放 Agent 工具库和初始技能包
          </p>
        </div>

        <div
          className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
          style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[35%]">
                  空间名称
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[18%]">
                  类型
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[28%]">
                  已用/存储容量
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[19%]">
                  有效期
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ENTERPRISE_SPACES.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[4px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-[4px] text-xs font-medium bg-blue-50 text-blue-600">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="tabular-nums">
                      {item.used}/{<span className="font-semibold">{item.quota}</span>}
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-emerald-50 text-emerald-600">
                      免费
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 tabular-nums">{item.expiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Agent Private Space Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900">智能体网盘</h2>
        </div>

        {/* 信息提示横幅 */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-[4px] px-4 py-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-600 leading-relaxed">
            开启后,为您赠送每个 OpenClaw 实例 <span className="font-semibold">3个月50GB</span> 免费额度,到期后可以通过购买资源包进行续租
          </p>
        </div>

        {/* 网盘配置卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <FMTogglePolicyCard
            icon={<Link className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            title="新增实例是否自动绑定网盘"
            description="开启后,新创建的 AI 智能体实例将自动分配网盘空间"
            rules={autoBindRules}
            onRulesChange={setAutoBindRules}
          />
          <FMTogglePolicyCard
            icon={<UserCheck className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            title="允许用户自行开启网盘"
            description="开启后,用户可在自己的实例中自主开启网盘服务"
            rules={allowSelfEnableRules}
            onRulesChange={setAllowSelfEnableRules}
          />
        </div>

        <div
          className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
          style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
        >
          {/* Search Bar and Batch Enable */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBatchEnable}
                disabled={selectedInstances.size === 0}
              >
                批量启用网盘服务
                {selectedInstances.size > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                    {selectedInstances.size}
                  </span>
                )}
              </Button>
              <FMGroupFilter
                groups={MOCK_GROUP_TREE_MANUAL}
                value={groupFilter}
                onChange={(v) => setGroupFilter(v)}
              />
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="搜索名称、ID或创建人" 
                  className="pl-9 h-9 bg-white border-gray-300 hover:border-gray-400 focus:border-purple-500 rounded-[4px] text-sm transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="h-9 px-4 gap-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                onClick={() => setRecyclebinOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                回收站
                {getRecyclebinInstances().length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
                    {getRecyclebinInstances().length}
                  </span>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>共计 <span className="font-semibold text-gray-900 tabular-nums">{stats.totalPersonalInstances}</span> 个 OpenClaw 实例</span>
            </div>
          </div>

          {/* Flat Table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[6%]">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={disabledInstancesCount === 0}
                      className={disabledInstancesCount === 0 ? "opacity-60 cursor-not-allowed pointer-events-none bg-gray-300 border-gray-500" : ""}
                      aria-label="全选"
                    />
                    <span className={disabledInstancesCount === 0 ? "text-gray-400" : ""}>全选</span>
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[20%]">
                  OpenClaw 实例
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[15%]">
                  创建人
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[8%]">
                  类型
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[18%]">
                  已用/存储容量
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[10%]">
                  有效期
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap w-[9%]">
                  启用网盘
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedPersonalSpaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-12 h-12 text-gray-300" />
                      <p className="text-sm text-gray-500">未找到匹配的记录</p>
                      <p className="text-xs text-gray-400">请尝试其他搜索关键词</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPersonalSpaces.map((item) => {
                  const isEnabled = instancesEnabled[item.id];
                  const wasEverEnabled = instancesEverEnabled[item.id];
                  const isSelected = selectedInstances.has(item.id);
                  const isDeleted = wasEverEnabled && isPermanentlyDeleted(item.id);
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectInstance(item.id, checked as boolean)}
                          disabled={isEnabled || isDeleted}
                          className={(isEnabled || isDeleted) ? "opacity-60 cursor-not-allowed pointer-events-none bg-gray-300 border-gray-500" : ""}
                          aria-label={`选择 ${item.instanceName}`}
                        />
                      </td>
                      <td className="px-6 py-4" style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#1447E6] flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{item.instanceName}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-xs break-all">{item.instanceName}</TooltipContent>
                            </Tooltip>
                            <span className="text-xs font-mono text-blue-500">{item.instanceId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-gray-900 truncate block max-w-[140px]">{item.creator}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-xs break-all">{item.creator}</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-[4px] text-xs font-medium bg-blue-50 text-blue-600">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {isEnabled ? (
                          <span className="tabular-nums">
                            {item.used}/{<span className="font-semibold">{item.quota}</span>}
                            <span className="ml-2 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-emerald-50 text-emerald-600">
                              免费
                            </span>
                          </span>
                        ) : wasEverEnabled && !isPermanentlyDeleted(item.id) ? (
                          <span className="tabular-nums flex items-center gap-1">
                            <span>
                              {item.used}/{<span className="font-semibold">{item.quota}</span>}
                              <span className="ml-2 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-blue-50 text-blue-600">
                                可恢复
                              </span>
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-blue-500 cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">剩余 {getRemainingDays(item.id)} 天可恢复</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                        ) : (
                          <span className="text-gray-400">未启用</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 tabular-nums">
                        {isEnabled ? item.expiry : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <Switch 
                          checked={isEnabled}
                          onCheckedChange={() => handleToggleInstance(item.id, item.instanceName, isEnabled, wasEverEnabled)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                显示 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredPersonalSpaces.length)} 条，共 {filteredPersonalSpaces.length} 条记录
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 p-0 rounded-full transition-all ${
                      currentPage === page
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disable Confirmation Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              确认关闭网盘
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-700">
              您确定要关闭 <span className="font-bold text-gray-900">"{instanceToDisable?.name}"</span> 的网盘功能吗？
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-[4px]">
              <div className="text-xs text-gray-700 space-y-1">
                <p className="font-semibold">关闭网盘后：</p>
                <div className="space-y-0.5 ml-1">
                  <p>• 该实例将无法访问网盘中的文件</p>
                  <p>• 15天内网盘数据可恢复</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDisable}>取消</Button>
            <Button onClick={handleConfirmDisable} variant="destructive">
              确认关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Enable Confirmation Dialog */}
      <Dialog open={batchEnableDialogOpen} onOpenChange={setBatchEnableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              批量启用网盘服务
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-700">
              您确定要为选中的 <span className="font-semibold text-gray-900 tabular-nums">{selectedInstances.size}</span> 个实例启用网盘服务吗?
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-[4px] px-3 py-2.5">
              <div className="text-xs text-gray-700 space-y-1 leading-relaxed">
                <p className="font-semibold">启用后：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>每个实例将获得 3个月50GB 免费额度</li>
                  <li>实例可以访问专属网盘空间</li>
                  <li>到期后可购买资源包续租</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelBatchEnable}>取消</Button>
            <Button onClick={handleConfirmBatchEnable}>
              确认启用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable Choice Dialog - 选择新启用或恢复已有 */}
      <Dialog open={enableChoiceDialogOpen} onOpenChange={setEnableChoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              选择启用方式
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-700">
              检测到回收站中有该实例之前的网盘空间（15天内可恢复），您可以选择：
            </p>
            
            <div className="space-y-3">
              {/* 新启用网盘 */}
              <button
                onClick={handleChooseNewEnable}
                className="w-full group relative overflow-hidden rounded-[4px] border-2 border-gray-200 hover:border-blue-400 bg-white p-5 text-left transition-all duration-200 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-[4px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">新启用网盘</h3>
                    <p className="text-sm text-gray-600">
                      为该实例创建新的网盘空间
                    </p>
                  </div>
                </div>
              </button>

              {/* 恢复已有网盘 */}
              <button
                onClick={handleChooseRecoverExisting}
                className="w-full group relative overflow-hidden rounded-[4px] border-2 border-gray-200 hover:border-green-400 bg-white p-5 text-left transition-all duration-200 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-[4px] bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <RotateCcw className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">恢复已有网盘</h3>
                    <p className="text-sm text-gray-600">
                      恢复该实例之前的网盘空间，保留原有文件和数据
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEnableChoice}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Enable Confirmation Dialog */}
      <Dialog open={singleEnableDialogOpen} onOpenChange={setSingleEnableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              启用网盘服务
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-700">
              您确定要为 <span className="font-bold text-gray-900">"{instanceToEnable?.name}"</span> 启用网盘服务吗?
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-[4px] px-3 py-2.5">
              <div className="text-xs text-gray-700 space-y-1 leading-relaxed">
                <p className="font-semibold">启用后：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>该实例将获得 3个月50GB 免费额度</li>
                  <li>实例可以访问专属网盘空间</li>
                  <li>到期后可以进行续租</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSingleEnable}>取消</Button>
            <Button onClick={handleConfirmSingleEnable}>
              确认启用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Storage Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              购买网盘容量
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="bg-blue-50 border border-blue-100 rounded-[4px] px-3 py-2.5">
              <p className="text-xs text-blue-600 leading-relaxed">
                为 <span className="font-semibold">"{instanceToPurchase?.name}"</span> 购买网盘容量
              </p>
            </div>

            {/* 选择存储容量 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">选择存储容量</Label>
              <RadioGroup value={selectedCapacity} onValueChange={setSelectedCapacity}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "50GB", label: "50GB", price: "¥2/月" },
                    { value: "100GB", label: "100GB", price: "¥4/月" },
                    { value: "500GB", label: "500GB", price: "¥8/月" }
                  ].map((item) => (
                    <div key={item.value} className="flex items-center">
                      <RadioGroupItem value={item.value} id={item.value} className="peer sr-only" />
                      <Label
                        htmlFor={item.value}
                        className="flex flex-1 flex-col items-center justify-center rounded-[4px] border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 transition-all"
                      >
                        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                        <span className="text-xs text-gray-500 mt-1">{item.price}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 选择购买时长 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">选择购买时长</Label>
              <RadioGroup value={selectedDuration} onValueChange={setSelectedDuration}>
                <div className="space-y-2">
                  {[
                    { value: "1", label: "1个月" },
                    { value: "3", label: "3个月" },
                    { value: "6", label: "6个月" },
                    { value: "12", label: "12个月" }
                  ].map((item) => (
                    <div key={item.value} className="flex items-center">
                      <RadioGroupItem value={item.value} id={`duration-${item.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`duration-${item.value}`}
                        className="flex flex-1 items-center justify-between rounded-[4px] border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 transition-all"
                      >
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 价格汇总 */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-[4px] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">合计金额：</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-purple-600 tabular-nums">¥{calculatePrice()}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                购买后立即生效，有效期 {selectedDuration} 个月
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPurchase}>取消</Button>
            <Button
              onClick={handleConfirmPurchase}
              className="gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              确认购买
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Storage Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              续费网盘
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="bg-blue-50 border border-blue-100 rounded-[4px] px-3 py-2.5">
              <p className="text-xs text-blue-600 leading-relaxed">
                为 <span className="font-semibold">"{instanceToRenew?.name}"</span> 续费网盘服务
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-[4px] px-3 py-2.5">
              <div className="text-xs text-gray-700 space-y-1">
                <p className="font-semibold">当前配置：</p>
                <p>• 存储容量：50GB</p>
                <p>• 到期时间：2026-06-30</p>
              </div>
            </div>

            {/* 选择续费时长 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">选择续费时长</Label>
              <RadioGroup value={renewDuration} onValueChange={setRenewDuration}>
                <div className="space-y-2">
                  {[
                    { value: "1", label: "1个月" },
                    { value: "3", label: "3个月" },
                    { value: "6", label: "6个月" },
                    { value: "12", label: "12个月" }
                  ].map((item) => (
                    <div key={item.value} className="flex items-center">
                      <RadioGroupItem value={item.value} id={`renew-duration-${item.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`renew-duration-${item.value}`}
                        className="flex flex-1 items-center justify-between rounded-[4px] border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 transition-all"
                      >
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 价格汇总 */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-[4px] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">续费金额：</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-blue-600 tabular-nums">¥{calculateRenewPrice()}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                续费后有效期延长 {renewDuration} 个月
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRenew}>取消</Button>
            <Button 
              onClick={handleConfirmRenew} 
              style={{ background: "linear-gradient(135deg, #1447E6, #00C6FF)" }}
              className="gap-2"
            >
              确认续费
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expand Storage Dialog */}
      <Dialog open={expandDialogOpen} onOpenChange={setExpandDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              扩容网盘
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="bg-purple-50 border border-purple-100 rounded-[4px] px-3 py-2.5">
              <p className="text-xs text-purple-600 leading-relaxed">
                为 <span className="font-semibold">"{instanceToExpand?.name}"</span> 扩容网盘空间
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-[4px] px-3 py-2.5">
              <div className="text-xs text-gray-700 space-y-1">
                <p className="font-semibold">当前配置：</p>
                <p>• 存储容量：50GB</p>
                <p>• 到期时间：2026-06-30</p>
              </div>
            </div>

            {/* 选择扩容容量 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">选择扩容容量</Label>
              <RadioGroup value={expandCapacity} onValueChange={setExpandCapacity}>
                <div className="grid grid-cols-3 gap-3 max-h-[240px] overflow-y-auto pr-2">
                  {generateExpandCapacityOptions().map((item) => (
                    <div key={item.value} className="flex items-center">
                      <RadioGroupItem value={item.value} id={`expand-${item.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`expand-${item.value}`}
                        className="flex flex-1 flex-col items-center justify-center rounded-[4px] border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 transition-all"
                      >
                        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                        <span className="text-xs text-gray-500 mt-1">{item.price}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 价格汇总 */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-[4px] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">扩容费用：</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-purple-600 tabular-nums">¥{calculateExpandPrice()}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                扩容 {expandCapacity}，立即生效，不延长有效期
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelExpand}>取消</Button>
            <Button 
              onClick={handleConfirmExpand} 
              style={{ background: "linear-gradient(135deg, #A855F7, #EC4899)" }}
              className="gap-2"
            >
              确认扩容
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recycle Bin Dialog */}
      <Dialog open={recyclebinOpen} onOpenChange={setRecyclebinOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-gray-600" />
              回收站
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {getRecyclebinInstances().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Trash2 className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm">回收站为空</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getRecyclebinInstances().map((instance) => (
                  <div
                    key={instance.id}
                    className="bg-gray-50 border border-gray-200 rounded-[4px] p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-[4px] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {instance.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                              {instance.instanceName}
                            </h4>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">
                              {instance.remainingDays}天后永久删除
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>创建人: {instance.creator}</span>
                            <span>容量: {instance.used}/{instance.quota}</span>
                            <span>实例ID: {instance.instanceId}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                                onClick={() => handleRestoreFromRecyclebin(instance.id, instance.instanceName)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                恢复
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>恢复此网盘空间</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 gap-1.5 border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                                onClick={() => handleOpenTransfer(instance.id, instance.instanceName, instance.instanceId)}
                              >
                                <Link className="w-3.5 h-3.5" />
                                转接
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>将此网盘转接给其他实例</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                                onClick={() => {
                                  setInstanceToDeletePermanently({ id: instance.id, name: instance.instanceName });
                                  setRecyclebinDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                永久删除
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>永久删除此网盘空间（不可恢复）</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecyclebinOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recyclebin Recover Confirmation Dialog */}
      <Dialog open={recyclebinRecoverDialogOpen} onOpenChange={setRecyclebinRecoverDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              恢复网盘空间
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-[4px] p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                确定要恢复 <span className="font-semibold text-blue-600">"{instanceToRecoverFromRecyclebin?.name}"</span> 的网盘服务吗？
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-[4px] p-3">
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>• 恢复后将继续使用之前的网盘空间</p>
                  <p>• 原有文件和数据将保持不变</p>
                  <p>• 恢复操作完全免费</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRecyclebinRecover}>取消</Button>
            <Button 
              onClick={handleConfirmRecyclebinRecover}
              style={{ background: "linear-gradient(135deg, #1447E6, #00C6FF)" }}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recyclebin Permanent Delete Confirmation Dialog */}
      <Dialog open={recyclebinDeleteDialogOpen} onOpenChange={setRecyclebinDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              永久删除网盘空间
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-[4px] p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                确定要永久删除 <span className="font-semibold text-red-600">"{instanceToDeletePermanently?.name}"</span> 的网盘空间吗？
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-[4px] p-3">
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-600">⚠️ 此操作不可恢复！</p>
                  <p>• 网盘中所有文件和数据将被永久删除</p>
                  <p>• 删除后无法恢复任何内容</p>
                  <p>• 请谨慎操作</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPermanentDelete}>取消</Button>
            <Button 
              onClick={handleConfirmPermanentDelete}
              style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog - 转接网盘 */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-600" />
              转接网盘空间
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="bg-purple-50 border border-purple-100 rounded-[4px] p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                将 <span className="font-semibold text-purple-600">"{instanceToTransfer?.name}"</span> 的网盘空间转接给其他实例
              </p>
              <p className="text-xs text-gray-600 mt-2">
                实例ID: <span className="font-mono text-purple-600">{instanceToTransfer?.instanceId}</span>
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-[4px] p-3">
              <div className="flex items-start gap-2 text-xs text-blue-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>• 转接后，网盘空间将绑定到新实例</p>
                  <p>• 原实例将无法再访问此网盘</p>
                  <p>• 网盘中的文件和数据将完整保留</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-900">选择目标实例</Label>
              {getAvailableTargetInstances().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Bot className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">暂无可转接的目标实例</p>
                  <p className="text-xs mt-1">只能转接给未启用过网盘的实例</p>
                </div>
              ) : (
                <RadioGroup value={selectedTargetInstance} onValueChange={setSelectedTargetInstance}>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {getAvailableTargetInstances().map((item) => (
                      <div key={item.id} className="flex items-center">
                        <RadioGroupItem value={item.id} id={`transfer-${item.id}`} className="peer sr-only" />
                        <Label
                          htmlFor={`transfer-${item.id}`}
                          className="flex flex-1 items-center gap-3 rounded-[4px] border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 transition-all"
                        >
                          <div className="w-10 h-10 rounded-[4px] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                            {item.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {item.instanceName}
                              </h4>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                未启用
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>创建人: {item.creator}</span>
                              <span className="font-mono text-blue-500">{item.instanceId}</span>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelTransfer}>取消</Button>
            <Button 
              onClick={handleConfirmTransfer}
              disabled={!selectedTargetInstance}
              style={selectedTargetInstance ? { background: "linear-gradient(135deg, #A855F7, #EC4899)" } : {}}
              className={`gap-2 ${!selectedTargetInstance ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Link className="w-4 h-4" />
              确认转接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
