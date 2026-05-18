/**
 * TokensMonitor - 管控端 Tokens 监控页
 * 设计风格：与整体管控台保持一致，浅色卡片 + 蓝紫渐变强调色
 */
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, TrendingUp, ArrowUp, ArrowDown, RefreshCw, ChevronLeft, ChevronRight, Info, AlertCircle, ArrowUpRight, BarChart3, Activity, CheckCircle2, AlertTriangle, ChevronDown, Check, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentCombobox } from "@/components/OpenClawCombobox";
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipTrigger as UITooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { MOCK_DEPARTMENTS, MOCK_TOKEN_BY_DEPARTMENT, MOCK_OPENCLAW_LIST, MOCK_CLAWS_WITH_DEPT, type DepartmentNode, type GroupNode, MOCK_GROUP_TREE_MANUAL, MOCK_GROUP_TREE_ONEID, MOCK_TOKEN_BY_GROUP_MANUAL, MOCK_TOKEN_BY_GROUP_ONEID } from "@/lib/mockData";
import { useAdminMode } from "@/contexts/AdminModeContext";

// CLS 采集插件版本历史
interface CLSPluginVersion {
  version: string;
  releaseDate: string;
  changelog: string;
  status: 'current' | 'available' | 'deprecated';
}

const CLS_PLUGIN_VERSIONS: CLSPluginVersion[] = [
  { version: "v5", releaseDate: "2026-03-24", changelog: "修复会话追踪精度问题，优化 Token 计算算法", status: "available" },
  { version: "v4", releaseDate: "2026-03-17", changelog: "新增会话全局监控功能，支持多渠道分析", status: "available" },
  { version: "v3", releaseDate: "2026-03-10", changelog: "优化日志采集性能，降低 CPU 占用率", status: "current" },
  { version: "v2", releaseDate: "2026-03-03", changelog: "修复 CLS 连接超时问题", status: "deprecated" },
  { version: "v1", releaseDate: "2026-02-24", changelog: "首次发布 CLS 采集插件", status: "deprecated" },
];

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function todayStr() {
  return toDateStr(new Date());
}
function addDays(base: string, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}
function fmt(n: number) { return n.toLocaleString(); }

// ─── Mock 数据生成 ────────────────────────────────────────────────────────────
// 生成最近 60 天每天的数据
const DAYS_HISTORY = 60;
const BASE_DATE = addDays(todayStr(), -(DAYS_HISTORY - 1));

const MEMBERS = [
  "alice@acompany.com",
  "bob@acompany.com",
  "carol@acompany.com",
  "dave@acompany.com",
  "eve@acompany.com",
  "frank@acompany.com",
  "grace@acompany.com",
  "henry@acompany.com",
  "ivy@acompany.com",
  "jack@acompany.com",
  "karen@acompany.com",
  "leo@acompany.com",
  "longname-user@very-long-domain-example.com",
  "product-ops-admin@enterprise-acompany.com",
];

const MODELS = [
  "腾讯云 DeepSeek (V3 0324)",
  "腾讯云混元 (Turbo)",
  "腾讯云 DeepSeek (R1)",
  "腾讯云混元 (Pro)",
];

// 每天每用户的 mock 数据
function seedRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

interface DayRecord {
  date: string;
  memberId: string;
  modelName: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

const ALL_RECORDS: DayRecord[] = [];
for (let i = 0; i < DAYS_HISTORY; i++) {
  const date = addDays(BASE_DATE, i);
  MEMBERS.forEach((memberId, mi) => {
    MODELS.forEach((modelName, moi) => {
      const rand = seedRand(i * 1000 + mi * 100 + moi);
      const requests = Math.floor(rand() * 80 + 5);
      const inputTokens = Math.floor(rand() * 15000 + 2000);
      const outputTokens = Math.floor(rand() * 12000 + 1500);
      ALL_RECORDS.push({ date, memberId, modelName, requests, inputTokens, outputTokens });
    });
  });
}

// 今日全局配额（固定）
// 注意：GLOBAL_LIMIT 为 null 表示无限制
const TODAY_RECORDS = ALL_RECORDS.filter((r) => r.date === todayStr());
const TODAY_TOTAL_TOKENS = TODAY_RECORDS.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);

// ─── 进度条 ───────────────────────────────────────────────────────────────────
function ProgressBar({ value, max, showTooltip, isUnlimited }: { value: number; max: number | null; showTooltip?: boolean; isUnlimited?: boolean }) {
  if (isUnlimited || max === null) {
    // 无限制时显示浅灰色进度条，不显示进度
    const bar = (
      <div className="w-full bg-gray-100 rounded-full h-1.5 cursor-default">
        <div className="h-1.5 rounded-full bg-gray-300 transition-all" style={{ width: "0%" }} />
      </div>
    );
    if (!showTooltip) return bar;
    return (
      <UITooltip>
        <UITooltipTrigger asChild>
          {bar}
        </UITooltipTrigger>
        <UITooltipContent side="bottom" className="text-xs font-medium">
          已消耗 {value.toLocaleString()} Tokens（无限制）
        </UITooltipContent>
      </UITooltip>
    );
  }
  const pct = Math.min((value / max) * 100, 100);
  const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-blue-500";
  const bar = (
    <div className="w-full bg-gray-100 rounded-full h-1.5 cursor-default">
      <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
  if (!showTooltip) return bar;
  return (
    <UITooltip>
      <UITooltipTrigger asChild>
        {bar}
      </UITooltipTrigger>
      <UITooltipContent side="bottom" className="text-xs font-medium">
        {value.toLocaleString()} / {max.toLocaleString()} Tokens
      </UITooltipContent>
    </UITooltip>
  );
}

// ─── CSV 导出工具 ────────────────────────────────────────────────────────────
function makeCsvBlob(header: string, rows: string[]): Blob {
  return new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 翻页组件 ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

// ─── 部门树节点（递归）──────────────────────────────────────────────────────
function TokenDepartmentTreeNode({
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
        <TokenDepartmentTreeNode key={child.id} node={child} level={level + 1}
          selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ─── 部门筛选弹出框（Tokens 监控「按部门」Tab 用） ────────────────────────────
function TokenDepartmentFilter({
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
          className={`w-[140px] justify-between bg-white text-sm font-normal hover:bg-white data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 ${
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
            <TokenDepartmentTreeNode key={dept.id} node={dept} level={0}
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

// ─── 分组树节点（递归）──────────────────────────────────────────────────────
function TokenGroupTreeNode({
  node, level, selected, expanded, onToggle, onSelect, search,
}: {
  node: GroupNode; level: number; selected: string;
  expanded: Set<string>; onToggle: (id: string) => void; onSelect: (id: string) => void;
  search: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;
  const isSection = node.id.startsWith("__section_");

  // 搜索过滤：如果有搜索词，只显示匹配的节点
  const matchesSearch = !search || node.name.toLowerCase().includes(search.toLowerCase());
  const childrenMatchSearch = hasChildren && node.children!.some(child => {
    const childMatch = child.name.toLowerCase().includes(search.toLowerCase());
    const grandChildMatch = child.children?.some(gc => gc.name.toLowerCase().includes(search.toLowerCase()));
    return childMatch || grandChildMatch;
  });

  if (search && !matchesSearch && !childrenMatchSearch && !isSection) return null;

  return (
    <div>
      {isSection ? (
        <div className="px-2 pt-3 pb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{node.name}</span>
        </div>
      ) : (
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
      )}
      {hasChildren && (isExpanded || isSection || (search && childrenMatchSearch)) && node.children!.map((child) => (
        <TokenGroupTreeNode key={child.id} node={child} level={isSection ? level : level + 1}
          selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} search={search} />
      ))}
    </div>
  );
}

// ─── 分组筛选弹出框（Tokens 监控「按分组」Tab 用） ────────────────────────────
function TokenGroupFilter({
  groups, value, onChange,
}: {
  groups: GroupNode[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => { if (open) { setTempValue(value); setSearch(""); } }, [open, value]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleConfirm = () => { onChange(tempValue); setOpen(false); };
  const handleCancel = () => { setTempValue(value); setOpen(false); };

  const findNode = (nodes: GroupNode[], id: string): GroupNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const found = findNode(n.children, id); if (found) return found; }
    }
    return undefined;
  };
  const selectedNode = tempValue ? findNode(groups, tempValue) : undefined;
  const triggerNode = value ? findNode(groups, value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox"
          className={`w-[160px] justify-between bg-white text-sm font-normal hover:bg-white data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50 ${
            triggerNode ? "text-foreground" : "text-muted-foreground"
          }`}>
          <span className="truncate">{triggerNode?.name || "全部分组"}</span>
          <ChevronDown className={`w-3.5 h-3.5 ml-1 shrink-0 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {/* 搜索框 */}
        <div className="p-2 border-b border-gray-100">
          <input
            type="text"
            placeholder="搜索分组"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2">
          <div className={`flex items-center gap-2 py-1.5 px-2 rounded-[4px] cursor-pointer transition-colors ${
            tempValue === "" ? "bg-blue-50" : "hover:bg-gray-100"
          }`} onClick={() => setTempValue("")}>
            <span className={`text-sm flex-1 ${tempValue === "" ? "text-blue-600 font-medium" : "text-gray-700"}`}>全部分组</span>
            {tempValue === "" && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          </div>
          {groups.map((group) => (
            <TokenGroupTreeNode key={group.id} node={group} level={0}
              selected={tempValue} expanded={expanded} onToggle={toggleExpand} onSelect={setTempValue} search={search} />
          ))}
        </div>
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1 text-xs overflow-hidden">
            {tempValue === "" ? (
              <span className="text-blue-600 font-medium truncate">全部分组</span>
            ) : selectedNode?.path ? (
              <span className="flex items-center gap-0.5 truncate">
                {selectedNode.path.split("/").map((seg, idx, arr) => (
                  <span key={idx} className="flex items-center gap-0.5 shrink-0">
                    {idx > 0 && <span className="text-gray-300 mx-0.5">›</span>}
                    <span className={idx === arr.length - 1 ? "text-blue-600 font-medium" : "text-gray-500"}>{seg}</span>
                  </span>
                ))}
              </span>
            ) : selectedNode ? (
              <span className="text-blue-600 font-medium truncate">{selectedNode.name}</span>
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

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safe = Math.min(page, totalPages);
  if (totalPages <= 1) return (
    <div className="px-6 py-3 border-t border-gray-50 text-xs text-gray-400">共 {total} 条记录</div>
  );
  return (
    <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
      <span className="text-xs text-gray-400">共 {total} 条记录，第 {safe} / {totalPages} 页</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, safe - 1))} disabled={safe <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-[4px] border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 flex items-center justify-center rounded-[4px] text-xs font-medium transition-colors ${p === safe ? "text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            style={p === safe ? { background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)" } : {}}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(Math.min(totalPages, safe + 1))} disabled={safe >= totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-[4px] border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function TokensMonitor() {
  const [, navigate] = useLocation(); // 在组件顶级调用 useLocation
  const { hasOneid } = useAdminMode();
  const today = todayStr();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [refreshing, setRefreshing] = useState(false);
  const [instancePage, setInstancePage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [modelPage, setModelPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [deptPage, setDeptPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("");
  const [groupPage, setGroupPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState("");
  const [isEnablingCls, setIsEnablingCls] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [clsEnabled, setClsEnabled] = useState(() => {
    const stored = localStorage.getItem("globalClsEnabled");
    return stored === "true";
  });
  const [showCloseClsConfirm, setShowCloseClsConfirm] = useState(false);
  const [isClosingCls, setIsClosingCls] = useState(false);
  const [deleteLogTopic, setDeleteLogTopic] = useState(false);
  const [showPluginUpgradeDialog, setShowPluginUpgradeDialog] = useState(false);
  const [selectedPluginVersion, setSelectedPluginVersion] = useState<any>(null);
  const [isUpgradingPlugin, setIsUpgradingPlugin] = useState(false);

  // 当弹窗打开时，自动选中最新版本
  useEffect(() => {
    if (showPluginUpgradeDialog && !selectedPluginVersion) {
      setSelectedPluginVersion(CLS_PLUGIN_VERSIONS[0]); // v5 是最新版本
    }
  }, [showPluginUpgradeDialog]);
  const [showClsAgreementDialog, setShowClsAgreementDialog] = useState(false);
  const [clsAgreed, setClsAgreed] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [authCheckInterval, setAuthCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [showFreeQuotaDialog, setShowFreeQuotaDialog] = useState(false);
  const [freeQuotaAgreed, setFreeQuotaAgreed] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(""); // Agent 名称筛选
  const [globalLimit, setGlobalLimit] = useState<number | null>(() => {
    const mode = localStorage.getItem("globalLimitMode");
    if (mode === "unlimited") return null;
    const value = localStorage.getItem("globalLimit");
    return value ? parseInt(value, 10) : 2000000;
  });
  // 全局 Tokens 时间维度（每日/每月）—— 与平台策略页同步
  const [globalTokenTimeDim, setGlobalTokenTimeDim] = useState<"daily" | "monthly">(() => {
    const v = localStorage.getItem("admin_global_token_time_dim");
    return v === "monthly" ? "monthly" : "daily";
  });
  // 全局 Tokens 上限的"分组策略"列表（来自平台策略页）
  // 每条：{ id, groupIds: string[], value: number | "unlimited" }
  type GlobalTokenGroupRule = { id: string; groupIds: string[]; value: number | "unlimited" };
  const [globalTokenGroupRules, setGlobalTokenGroupRules] = useState<GlobalTokenGroupRule[]>(() => {
    try {
      const raw = localStorage.getItem("admin_global_token_group_rules");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  // 是否启用了"按分组"模式（存在分组策略）
  const IS_GLOBAL_BY_GROUP = globalTokenGroupRules.length > 0;

  // 监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "globalClsEnabled") {
        setClsEnabled(e.newValue === "true");
      } else if (e.key === "globalLimitMode" || e.key === "globalLimit") {
        const mode = localStorage.getItem("globalLimitMode");
        if (mode === "unlimited") {
          setGlobalLimit(null);
        } else {
          const value = localStorage.getItem("globalLimit");
          setGlobalLimit(value ? parseInt(value, 10) : 2000000);
        }
      } else if (e.key === "admin_global_token_time_dim") {
        setGlobalTokenTimeDim(e.newValue === "monthly" ? "monthly" : "daily");
      } else if (e.key === "admin_global_token_group_rules") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : [];
          setGlobalTokenGroupRules(Array.isArray(parsed) ? parsed : []);
        } catch {
          setGlobalTokenGroupRules([]);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 监听 clsOpenClicked 标记，显示协议弹窗
  useEffect(() => {
    const checkClsOpen = () => {
      if (localStorage.getItem('clsOpenClicked') === 'true') {
        localStorage.removeItem('clsOpenClicked');
        setShowClsAgreementDialog(true);
      }
    };
    
    // 页面加载时检查
    checkClsOpen();
    
    // 监听 focus 事件
    window.addEventListener('focus', checkClsOpen);
    return () => window.removeEventListener('focus', checkClsOpen);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); toast.success("数据已刷新"); }, 1000);
  };

  const handleOpenCLS = () => {
    // 检查授权状态（从后台缓存数据中获取）
    const isAuthorized = localStorage.getItem('clsAuthorized') === 'true';
    
    if (!isAuthorized) {
      // 未授权，显示授权 Dialog
      setShowAuthDialog(true);
      // 启动自动检测授权状态
      setIsCheckingAuth(true);
      const interval = setInterval(() => {
        const authorized = localStorage.getItem('clsAuthorized') === 'true';
        if (authorized) {
          // 已授权，关闭 Dialog 并继续
          setShowAuthDialog(false);
          setIsCheckingAuth(false);
          clearInterval(interval);
          // 继续开启 CLS 日志服务
          proceedWithClsSetup();
        }
      }, 2000);
      setAuthCheckInterval(interval);
    } else {
      // 已授权，直接继续
      proceedWithClsSetup();
    }
  };

  const proceedWithClsSetup = () => {
    // 显示免费额度 Dialog
    setShowFreeQuotaDialog(true);
    setFreeQuotaAgreed(false);
  };

  const handleGoToAuth = () => {
    // Mock 授权流程：5 秒后自动检测授权完成
    // 不真正打开腾讯云页面，而是模拟授权完成
    // 先显示检测状态
    setIsCheckingAuth(true);
    setAuthCompleted(false);
    
    setTimeout(() => {
      localStorage.setItem('clsAuthorized', 'true');
      // 检测完成，显示完成状态
      setIsCheckingAuth(false);
      setAuthCompleted(true);
      // 1秒后自动关闭Dialog并进入下一步
      setTimeout(() => {
        setShowAuthDialog(false);
        setAuthCompleted(false);
        proceedWithClsSetup();
      }, 1000);
    }, 5000);
  };

  const handleCancelAuth = () => {
    setShowAuthDialog(false);
    setIsCheckingAuth(false);
    setAuthCompleted(false);
    if (authCheckInterval) {
      clearInterval(authCheckInterval);
      setAuthCheckInterval(null);
    }
  };

  const handleConfirmFreeQuota = () => {
    if (!freeQuotaAgreed) return;
    setShowFreeQuotaDialog(false);
    setIsEnablingCls(true);
    setTimeout(() => {
      setClsEnabled(true);
      localStorage.setItem('globalClsEnabled', 'true');
      setIsEnablingCls(false);
      setShowSuccessMessage(true);
      setFreeQuotaAgreed(false);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }, 1500);
  };

  const handleGoToCalcDetail = () => {
    window.open('https://cloud.tencent.com/document/product/614/45802', '_blank');
  };

  const handleCancelFreeQuota = () => {
    setShowFreeQuotaDialog(false);
    setFreeQuotaAgreed(false);
  };

  const handleCloseClsConfirmCancel = () => {
    setShowCloseClsConfirm(false);
    setDeleteLogTopic(false);
  };

  const handleConfirmClsAgreement = () => {
    if (!clsAgreed) return;
    setIsEnablingCls(true);
    // 模拟 loading 1.5 秒
    setTimeout(() => {
      setClsEnabled(true);
      localStorage.setItem('globalClsEnabled', 'true');
      setIsEnablingCls(false);
      setShowSuccessMessage(true);
      setShowClsAgreementDialog(false);
      setClsAgreed(false);
      // 3 秒后隐藏成功提示
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }, 1500);
  };

  const handleCloseCls = () => {
    setIsClosingCls(true);
    setTimeout(() => {
      setClsEnabled(false);
      localStorage.setItem("globalClsEnabled", "false");
      setIsClosingCls(false);
      setShowCloseClsConfirm(false);
      setDeleteLogTopic(false);
      const message = deleteLogTopic ? "CLS 日志服务已关闭，日志主题资源已删除" : "CLS 日志服务已关闭";
      toast.success(message);
    }, 1000);
  };

  // 计算全局配额百分比
  const TODAY_GLOBAL_PCT = globalLimit === null ? "0" : ((TODAY_TOTAL_TOKENS / globalLimit) * 100).toFixed(1);
  const IS_GLOBAL_UNLIMITED = globalLimit === null;

  const handleFromChange = (v: string) => {
    setDateFrom(v);
    setInstancePage(1);
    setMemberPage(1);
    setModelPage(1);
    setSessionPage(1);
    setDeptPage(1);
    setGroupPage(1);
  };
  const handleToChange = (v: string) => {
    setDateTo(v);
    setInstancePage(1);
    setMemberPage(1);
    setModelPage(1);
    setSessionPage(1);
    setDeptPage(1);
    setGroupPage(1);
  };

  // 有效时间范围
  const effectiveFrom = dateFrom || today;
  const effectiveTo = dateTo || today;
  const isSingleDay = effectiveFrom === effectiveTo;

  // 筛选范围内的记录
  const rangeRecords = useMemo(
    () => ALL_RECORDS.filter((r) => r.date >= effectiveFrom && r.date <= effectiveTo),
    [effectiveFrom, effectiveTo]
  );

  // 总览指标（随时间联动）
  const totalRequests = rangeRecords.reduce((s, r) => s + r.requests, 0);
  const totalInput = rangeRecords.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutput = rangeRecords.reduce((s, r) => s + r.outputTokens, 0);
  const totalTokens = totalInput + totalOutput;

  // 折线图数据
  const chartData = useMemo(() => {
    if (isSingleDay) {
      // 单日：展示最近 7 天
      return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6);
        const recs = ALL_RECORDS.filter((r) => r.date === date);
        return {
          date: date.slice(5), // MM-DD
          输入Tokens: recs.reduce((s, r) => s + r.inputTokens, 0),
          输出Tokens: recs.reduce((s, r) => s + r.outputTokens, 0),
        };
      });
    } else {
      // 时间段：展示每天
      const days = daysBetween(effectiveFrom, effectiveTo);
      return Array.from({ length: days + 1 }, (_, i) => {
        const date = addDays(effectiveFrom, i);
        const recs = ALL_RECORDS.filter((r) => r.date === date);
        return {
          date: date.slice(5),
          输入Tokens: recs.reduce((s, r) => s + r.inputTokens, 0),
          输出Tokens: recs.reduce((s, r) => s + r.outputTokens, 0),
        };
      });
    }
  }, [isSingleDay, effectiveFrom, effectiveTo, today]);

  // 按实例汇总（随时间联动），按总 token 降序
  // 普通模式用 MOCK_OPENCLAW_LIST，OneID 模式用 MOCK_CLAWS_WITH_DEPT
  const instanceList = hasOneid ? MOCK_CLAWS_WITH_DEPT : MOCK_OPENCLAW_LIST;
  const instanceStats = useMemo(() => {
    // 用实例 id 作为 seed 生成稳定的 mock 消耗数据
    return instanceList.map((inst, idx) => {
      const rand = seedRand(idx * 777 + 42);
      const days = daysBetween(effectiveFrom, effectiveTo) + 1;
      const requests = Math.floor(rand() * 200 * days + 10);
      const inputTokens = Math.floor(rand() * 30000 * days + 5000);
      const outputTokens = Math.floor(rand() * 25000 * days + 3000);
      return {
        id: inst.id,
        instanceId: inst.instanceId,
        name: inst.name,
        creator: (inst as any).creator ?? "",
        department: (inst as any).department ?? "",
        requests,
        inputTokens,
        outputTokens,
        total: inputTokens + outputTokens,
      };
    }).sort((a, b) => b.total - a.total);
  }, [instanceList, effectiveFrom, effectiveTo, hasOneid]);
  const instancePaged = instanceStats.slice((instancePage - 1) * PAGE_SIZE, instancePage * PAGE_SIZE);

  // 按用户汇总（随时间联动），按总请求数降序
  const memberStats = useMemo(() => {
    const map = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>();
    rangeRecords.forEach((r) => {
      const cur = map.get(r.memberId) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
      map.set(r.memberId, {
        requests: cur.requests + r.requests,
        inputTokens: cur.inputTokens + r.inputTokens,
        outputTokens: cur.outputTokens + r.outputTokens,
      });
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, total: v.inputTokens + v.outputTokens }))
      .sort((a, b) => b.total - a.total);
  }, [rangeRecords]);

  // 按模型汇总（随时间联动），按总 token 降序
  const modelStats = useMemo(() => {
    const map = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>();
    rangeRecords.forEach((r) => {
      const cur = map.get(r.modelName) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
      map.set(r.modelName, {
        requests: cur.requests + r.requests,
        inputTokens: cur.inputTokens + r.inputTokens,
        outputTokens: cur.outputTokens + r.outputTokens,
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, total: v.inputTokens + v.outputTokens }))
      .sort((a, b) => b.total - a.total);
  }, [rangeRecords]);

  // 按会话汇总（高成本 TOP 5），按成本降序
  interface SessionStat {
    sessionId: string;
    sessionName: string;
    channel: string;
    model: string;
    lastActiveTime: string;
    rounds: number;
    tokens: number;
    cost: number;
    duration: string;
  }
  const sessionStats: SessionStat[] = [
    { sessionId: "fb766833", sessionName: "你能干啥 / 你管理一下我在伊朗的局势", channel: "Feishu Dm", model: "deepseek-v3.2", lastActiveTime: "2026-03-04 21:06", rounds: 63, tokens: 1950000, cost: 0.2743, duration: "454m 1s" },
    { sessionId: "06468225", sessionName: "我感觉现在仅表盘可观测细节这人，...", channel: "Feishu Dm", model: "deepseek-v3.2", lastActiveTime: "2026-03-08 13:14", rounds: 51, tokens: 1880000, cost: 0.2700, duration: "28m 52s" },
    { sessionId: "a9c7eb8b", sessionName: "请帮我列出 /etc 目录下所有 .conf ...", channel: "Webchat", model: "deepseek-v3.2", lastActiveTime: "2026-03-04 20:23", rounds: 47, tokens: 1590000, cost: 0.2242, duration: "12m 5s" },
    { sessionId: "a46be600", sessionName: "nihao / 帮我看看你的session-cost...", channel: "QQ Dm", model: "deepseek-v3.2", lastActiveTime: "2026-03-07 23:29", rounds: 35, tokens: 965000, cost: 0.1359, duration: "679m 41s" },
    { sessionId: "7bec562c", sessionName: "你还在吗 / 我是觉得现在 agent 仍...", channel: "Feishu Group", model: "hunyuan-turbos-latest", lastActiveTime: "2026-03-08 21:58", rounds: 28, tokens: 755000, cost: 0.1076, duration: "548m 57s" },
  ];
  const sessionPaged = sessionStats.slice((sessionPage - 1) * PAGE_SIZE, sessionPage * PAGE_SIZE);

  // 导出函数
  const runExport = (buildBlob: () => { blob: Blob; filename: string }) => {
    const tid = toast.loading("正在导出Tokens消耗明细列表");
    setTimeout(() => {
      const { blob, filename } = buildBlob();
      downloadBlob(blob, filename);
      toast.dismiss(tid);
    }, 500);
  };

  const handleExportInstance = () => runExport(() => {
    const header = hasOneid
      ? "实例名称,实例ID,用户ID,所属部门,总请求数,输入Tokens,输出Tokens,总Tokens"
      : "实例名称,实例ID,用户ID,总请求数,输入Tokens,输出Tokens,总Tokens";
    const rows = instanceStats.map((r) =>
      hasOneid
        ? `${r.name},${r.instanceId},${r.creator},${r.department},${r.requests},${r.inputTokens},${r.outputTokens},${r.total}`
        : `${r.name},${r.instanceId},${r.creator},${r.requests},${r.inputTokens},${r.outputTokens},${r.total}`
    );
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_instance_${effectiveFrom}_${effectiveTo}.csv` };
  });
  const handleExportMember = () => runExport(() => {
    const header = "用户ID,总请求数,输入Tokens,输出Tokens,总Tokens";
    const rows = memberStats.map((r) => `${r.id},${r.requests},${r.inputTokens},${r.outputTokens},${r.total}`);
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_member_${effectiveFrom}_${effectiveTo}.csv` };
  });
  const handleExportModel = () => runExport(() => {
    const header = "模型名称,总请求数,输入Tokens,输出Tokens,总Tokens";
    const rows = modelStats.map((r) => `${r.name},${r.requests},${r.inputTokens},${r.outputTokens},${r.total}`);
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_model_${effectiveFrom}_${effectiveTo}.csv` };
  });
  const handleExportDept = () => runExport(() => {
    const header = "部门名称,所属路径,总请求数,输入Tokens,输出Tokens,总Tokens";
    const rows = deptStats.map((r) => `${r.departmentName},${r.path},${r.requests},${r.inputTokens},${r.outputTokens},${r.totalTokens}`);
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_department_${effectiveFrom}_${effectiveTo}.csv` };
  });
  const handleExportSession = () => runExport(() => {
    const header = "会话ID,会话名称,渠道,模型,最后活动时间,轮次,Tokens,成本($),耗时";
    const rows = sessionStats.map((r) => `${r.sessionId},"${r.sessionName}",${r.channel},${r.model},${r.lastActiveTime},${r.rounds},${r.tokens},${r.cost.toFixed(4)},${r.duration}`);
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_session_${effectiveFrom}_${effectiveTo}.csv` };
  });

  // 翻页切片
  const memberPaged = memberStats.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE);
  const modelPaged = modelStats.slice((modelPage - 1) * PAGE_SIZE, modelPage * PAGE_SIZE);

  // 按部门汇总（OneID 模式使用）
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

  const deptStats = useMemo(() => {
    if (!hasOneid) return [];
    let data = MOCK_TOKEN_BY_DEPARTMENT;
    if (deptFilter) {
      const allowedIds = findDeptAndChildren(MOCK_DEPARTMENTS, deptFilter);
      data = data.filter((d) => allowedIds.includes(d.departmentId));
    }
    return data.sort((a, b) => b.totalTokens - a.totalTokens);
  }, [hasOneid, deptFilter]);
  const deptPaged = deptStats.slice((deptPage - 1) * PAGE_SIZE, deptPage * PAGE_SIZE);

  // 按分组汇总（普通模式和 OneID 模式都可见）
  const groupTree = hasOneid ? MOCK_GROUP_TREE_ONEID : MOCK_GROUP_TREE_MANUAL;
  const findGroupAndChildren = (nodes: GroupNode[], targetId: string): string[] => {
    const ids: string[] = [];
    const collect = (node: GroupNode) => {
      if (!node.id.startsWith("__section_")) ids.push(node.id);
      node.children?.forEach(collect);
    };
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

  const groupStats = useMemo(() => {
    const rawData = hasOneid ? MOCK_TOKEN_BY_GROUP_ONEID : MOCK_TOKEN_BY_GROUP_MANUAL;
    let data = rawData;
    if (groupFilter) {
      const allowedIds = findGroupAndChildren(groupTree, groupFilter);
      data = data.filter((d) => allowedIds.includes(d.groupId));
    }
    return data.sort((a, b) => b.totalTokens - a.totalTokens);
  }, [hasOneid, groupFilter, groupTree]);
  const groupPaged = groupStats.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE);

  // ── 分组 → 全局 Tokens 上限映射 ──
  // 把 groupRule.groupIds 展开成"该规则覆盖的所有底层分组ID"
  const groupLimitMap = useMemo(() => {
    const map = new Map<string, number | "unlimited">();
    for (const rule of globalTokenGroupRules) {
      for (const gid of rule.groupIds) {
        const expanded = findGroupAndChildren(groupTree, gid);
        const ids = expanded.length > 0 ? expanded : [gid];
        for (const id of ids) {
          // 后写入会覆盖前面（按规则顺序，后定义优先）
          map.set(id, rule.value);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTokenGroupRules, groupTree]);
  // 给每个分组返回"按时间维度的消耗 / 上限"
  // mock：daily 用 totalTokens × 0.3，monthly 用 totalTokens 直接
  const getGroupQuotaInfo = (g: { groupId: string; totalTokens: number }) => {
    const limit = groupLimitMap.get(g.groupId);
    const consumed = globalTokenTimeDim === "daily"
      ? Math.round(g.totalTokens * 0.3)
      : g.totalTokens;
    if (limit === undefined) {
      // 未配置策略 → 落入兜底：兜底无限制 ↔ globalLimit === null
      if (IS_GLOBAL_UNLIMITED) return { unlimited: true, consumed, limit: null as number | null, pct: 0 };
      const pct = globalLimit && globalLimit > 0 ? (consumed / globalLimit) * 100 : 0;
      return { unlimited: false, consumed, limit: globalLimit, pct };
    }
    if (limit === "unlimited" || limit === -1) {
      return { unlimited: true, consumed, limit: null as number | null, pct: 0 };
    }
    const num = Number(limit);
    const pct = num > 0 ? (consumed / num) * 100 : 0;
    return { unlimited: false, consumed, limit: num, pct };
  };

  const handleExportGroup = () => runExport(() => {
    const header = "分组名称,总请求数,输入Tokens,输出Tokens,总Tokens";
    const rows = groupStats.map((r) => `${r.groupName},${r.requests},${r.inputTokens},${r.outputTokens},${r.totalTokens}`);
    return { blob: makeCsvBlob(header, rows), filename: `tokens_by_group_${effectiveFrom}_${effectiveTo}.csv` };
  });

  return (
      <div className="page-enter">
        {/* Header */}




        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tokens 监控</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-700">查看企业用户和模型的 Tokens 消耗情况。</span>
              <UITooltip>
                <UITooltipTrigger asChild>
                  <button className="text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-help transition-colors">
                    查看tokens统计规则
                  </button>
                </UITooltipTrigger>
                <UITooltipContent side="right" className="max-w-sm text-xs">
                  <div className="space-y-1.5">
                    <p>统计数据为模型 API 处理的全量 Token，包含输入 Token(缓存未命中)、输入 Token(缓存命中)、输出 Token。</p>
                    <p>缓存命中 Token 的实际计费价格通常远低于缓存未命中 Token。</p>
                    <p>因此页面展示的总 Token 数不等于等额的实际计费成本。</p>
                    <p>如需了解各模型的缓存输入 Token 定价，请参考对应模型提供商的官方计费文档。</p>
                  </div>
                </UITooltipContent>
              </UITooltip>
            </div>
          </div>
          {/* 时间范围筛选 + 刷新 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Overview Cards - 始终显示 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* 随时间联动的四张卡片 */}
          {[
            { label: "总请求数", value: fmt(totalRequests), icon: TrendingUp, color: "from-blue-500 to-blue-600" },
            { label: "输入 Tokens", value: fmt(totalInput), icon: ArrowUp, color: "from-indigo-500 to-indigo-600" },
            { label: "输出 Tokens", value: fmt(totalOutput), icon: ArrowDown, color: "from-purple-500 to-purple-600" },
            { label: "总 Tokens", value: fmt(totalTokens), icon: Zap, color: "from-blue-600 to-purple-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-[4px] border border-gray-100 p-4"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-[4px] bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
          {/* 全局配额消耗（按时间维度展示：今日/本月，不随上方时间筛选联动） */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-4"
            style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-400">{globalTokenTimeDim === "daily" ? "今日全局配额消耗" : "本月全局配额消耗"}</p>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <span className="cursor-default">
                      <Info className="w-3 h-3 text-gray-300 hover:text-gray-400 transition-colors" />
                    </span>
                  </UITooltipTrigger>
                  <UITooltipContent side="top" className="max-w-[260px] text-xs">
                    {IS_GLOBAL_BY_GROUP
                      ? '全局 Tokens 上限已按分组进行设置，请在下方"按分组"Tab 查看具体分组的消耗'
                      : IS_GLOBAL_UNLIMITED
                        ? "全局配额已设置为无限制，无需关注消耗占比"
                        : globalTokenTimeDim === "daily"
                          ? "此处统计所有用户使用所有公司配置模型的总 Tokens 占每日全局 Tokens 上限的占比，按自然日统计，每天 0 点重置"
                          : "此处统计所有用户使用所有公司配置模型的总 Tokens 占每月全局 Tokens 上限的占比，按自然月统计，每月 1 号 0 点重置"}
                  </UITooltipContent>
                </UITooltip>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-gray-900">{IS_GLOBAL_BY_GROUP ? "0" : TODAY_GLOBAL_PCT}%</p>
              {IS_GLOBAL_BY_GROUP ? (
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1.5 rounded-[4px]">按分组</span>
              ) : IS_GLOBAL_UNLIMITED ? (
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1.5 rounded-[4px]">无限制</span>
              ) : null}
            </div>
            <ProgressBar
              value={IS_GLOBAL_BY_GROUP ? 0 : TODAY_TOTAL_TOKENS}
              max={IS_GLOBAL_BY_GROUP ? 1 : globalLimit}
              showTooltip={!IS_GLOBAL_BY_GROUP}
              isUnlimited={IS_GLOBAL_UNLIMITED && !IS_GLOBAL_BY_GROUP}
            />
          </div>
        </div>

        {/* Line Chart */}
        <div className="bg-white rounded-[4px] border border-gray-100 p-5 mb-6"
          style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
          <p className="text-sm font-medium text-gray-700 mb-4">
            {isSingleDay ? "最近 7 天 Tokens 趋势" : "所选时间段 Tokens 趋势"}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value: number) => [value.toLocaleString(), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="输入Tokens" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="输出Tokens" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detail Tabs */}
        <Tabs defaultValue="instance">
          <div className="flex items-center justify-between mb-2">
            <TabsList>
              <TabsTrigger value="instance">按实例</TabsTrigger>
              <TabsTrigger value="member">按用户</TabsTrigger>
              <TabsTrigger value="model">按模型</TabsTrigger>
              {hasOneid && <TabsTrigger value="department">按部门</TabsTrigger>}
              <TabsTrigger value="group" className="relative pr-3">
                按分组
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              </TabsTrigger>
              <TabsTrigger value="session">按会话</TabsTrigger>
            </TabsList>
          </div>

          {/* 按实例 */}
          <TabsContent value="instance">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">汇总所选时间范围内每台实例的 Token 消耗，按总 Tokens 降序排序</p>
              <UITooltip>
                <UITooltipTrigger asChild>
                  <button
                    onClick={handleExportInstance}
                    className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </UITooltipTrigger>
                <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
              </UITooltip>
            </div>
            <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}>名称 / ID</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">用户 ID</th>
                    {hasOneid && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">所属部门</th>}
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总请求数</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输入 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输出 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总 Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {instancePaged.length === 0 ? (
                    <tr><td colSpan={hasOneid ? 7 : 6} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                  ) : instancePaged.map((inst) => (
                    <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4" style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <UITooltip>
                              <UITooltipTrigger asChild>
                                <div className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{inst.name}</div>
                              </UITooltipTrigger>
                              <UITooltipContent side="top" className="text-xs max-w-xs break-all">{inst.name}</UITooltipContent>
                            </UITooltip>
                            <div className="text-xs font-mono text-blue-500">{inst.instanceId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{inst.creator || "—"}</td>
                      {hasOneid && <td className="px-6 py-4 text-sm text-gray-500">{inst.department || "—"}</td>}
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(inst.requests)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(inst.inputTokens)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(inst.outputTokens)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(inst.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={instancePage} total={instanceStats.length} onChange={setInstancePage} />
            </div>
          </TabsContent>

          {/* 按用户 */}
          <TabsContent value="member">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">汇总所选时间范围内每个用户使用所有模型的消耗，按总 Tokens 降序排序</p>
              <UITooltip>
                <UITooltipTrigger asChild>
                  <button
                    onClick={handleExportMember}
                    className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </UITooltipTrigger>
                <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
              </UITooltip>
            </div>
            <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">用户 ID</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总请求数</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输入 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输出 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总 Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {memberPaged.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                  ) : memberPaged.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4" style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <UITooltip>
                          <UITooltipTrigger asChild>
                            <span className="text-sm text-gray-700 truncate block max-w-[180px]">{m.id}</span>
                          </UITooltipTrigger>
                          <UITooltipContent side="top" className="text-xs max-w-xs break-all">{m.id}</UITooltipContent>
                        </UITooltip>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.requests)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.inputTokens)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.outputTokens)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={memberPage} total={memberStats.length} onChange={setMemberPage} />
            </div>
          </TabsContent>

          {/* 按模型 */}
          <TabsContent value="model">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">汇总所选时间范围内每个模型被所有企业用户使用的消耗，按总 Tokens 降序排序</p>
              <UITooltip>
                <UITooltipTrigger asChild>
                  <button
                    onClick={handleExportModel}
                    className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </UITooltipTrigger>
                <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
              </UITooltip>
            </div>
            <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">模型名称</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总请求数</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输入 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输出 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总 Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {modelPaged.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                  ) : modelPaged.map((m) => (
                    <tr key={m.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.requests)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.inputTokens)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(m.outputTokens)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={modelPage} total={modelStats.length} onChange={setModelPage} />
            </div>
          </TabsContent>

          {/* 按部门 - 仅 OneID 模式显示 */}
          {hasOneid && (
            <TabsContent value="department">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">汇总所选时间范围内各部门的消耗，按总 Tokens 降序排序</p>
                <div className="flex items-center gap-2">
                  <TokenDepartmentFilter
                    departments={MOCK_DEPARTMENTS}
                    value={deptFilter}
                    onChange={(v) => { setDeptFilter(v); setDeptPage(1); }}
                  />
                  <UITooltip>
                    <UITooltipTrigger asChild>
                      <button
                        onClick={handleExportDept}
                        className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </UITooltipTrigger>
                    <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
                  </UITooltip>
                </div>
              </div>
              <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
                style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">部门名称</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">所属路径</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总请求数</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输入 Tokens</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输出 Tokens</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总 Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {deptPaged.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                    ) : deptPaged.map((d) => (
                      <tr key={d.departmentId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.departmentName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{d.path.replace(/\//g, " / ")}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(d.requests)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(d.inputTokens)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(d.outputTokens)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(d.totalTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={deptPage} total={deptStats.length} onChange={setDeptPage} />
              </div>
            </TabsContent>
          )}

          {/* 按分组 */}
          <TabsContent value="group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">汇总所选时间范围内各分组的消耗，按总 Tokens 降序排序</p>
              <div className="flex items-center gap-2">
                <TokenGroupFilter
                  groups={groupTree}
                  value={groupFilter}
                  onChange={(v) => { setGroupFilter(v); setGroupPage(1); }}
                />
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <button
                      onClick={handleExportGroup}
                      className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </UITooltipTrigger>
                  <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
                </UITooltip>
              </div>
            </div>
            <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">分组名称</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总请求数</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输入 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">输出 Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">总 Tokens</th>
                    {IS_GLOBAL_BY_GROUP && (
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{globalTokenTimeDim === "daily" ? "今日全局配额消耗" : "本月全局配额消耗"}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupPaged.length === 0 ? (
                    <tr><td colSpan={IS_GLOBAL_BY_GROUP ? 6 : 5} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                  ) : groupPaged.map((g) => {
                    const q = IS_GLOBAL_BY_GROUP ? getGroupQuotaInfo(g) : null;
                    return (
                      <tr key={g.groupId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{g.groupName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(g.requests)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(g.inputTokens)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{fmt(g.outputTokens)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(g.totalTokens)}</td>
                        {IS_GLOBAL_BY_GROUP && q && (
                          <td className="px-6 py-4 text-sm text-right">
                            {q.unlimited ? (
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-[4px]">无限制</span>
                            ) : (
                              <UITooltip>
                                <UITooltipTrigger asChild>
                                  <span className="cursor-default text-gray-900 font-medium tabular-nums">
                                    {q.pct.toFixed(1)}%
                                  </span>
                                </UITooltipTrigger>
                                <UITooltipContent side="top" className="text-xs">
                                  {fmt(q.consumed)} / {q.limit !== null ? fmt(q.limit) : "—"}
                                </UITooltipContent>
                              </UITooltip>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={groupPage} total={groupStats.length} onChange={setGroupPage} />
            </div>
          </TabsContent>

          {/* 按会话 */}
          <TabsContent value="session">
            {!clsEnabled && (
              <>
                {/* CLS 提示弹框 */}
                <div className="bg-blue-50 border border-blue-200 rounded-[4px] p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900">Tokens 监控（按会话）需要开启 CLS 日志服务</h3>
                      <p className="text-xs text-blue-700">开启后，为您赠送3个月ClawPro 专属 CLS 日志服务免费额度，预估可覆盖 500台 Agent 机器3个月的日志用量；服务到期后，CLS 将按量计费。<a href="https://cloud.tencent.com/document/product/614/45802" target="_blank" className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">计费详情 <ArrowUpRight className="w-3 h-3" /></a></p>
                    </div>
                    <Button
                      onClick={handleOpenCLS}
                      disabled={isEnablingCls}
                      className="ml-4 text-xs h-8 px-4 whitespace-nowrap"
                    >
                      {isEnablingCls ? "开启中..." : "开启 CLS 日志服务"}
                    </Button>
                  </div>
                </div>

                {/* CLS 协议确认弹窗 */}
                <Dialog open={showClsAgreementDialog} onOpenChange={setShowClsAgreementDialog}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>确认免费额度</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="cls-agreement"
                          checked={clsAgreed}
                          onChange={(e) => setClsAgreed(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="cls-agreement" className="text-sm text-gray-700 cursor-pointer flex-1">
                          为您赠送三个月ClawPro 专属 CLS 日志服务免费额度，预估可覆盖 700 台 Agent 机器的日志用量；服务到期后，CLS 将按量计费。<a href="https://cloud.tencent.com/document/product/614/45802" target="_blank" className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">计费详情 <ArrowUpRight className="w-3 h-3" /></a>
                        </label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowClsAgreementDialog(false);
                          setClsAgreed(false);
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleConfirmClsAgreement}
                        disabled={!clsAgreed || isEnablingCls}
                      >
                        {isEnablingCls ? "开启中..." : "确认"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* 卡片功能展示 */}
                <div className="space-y-6 mb-8">
                  {/* 第一块：高成本会话分析 */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">开启CLS日志服务后您可以在此处获得以下会话数据：</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#F59E0B" }}>
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">高Token会话实时分析与管控</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">聚焦 TOP 会话的 Token 消耗、轮次分布与耗时特征，精准定位高Token交互，优化模型调用成本与资源效率</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#AF52DE" }}>
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">单会话全链路Token透视</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">拆解每轮交互的 Token 流量与耗时分布，可视化工具调用与上下文膨胀对成本的影响</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 分割线 */}
                  <div className="border-t border-gray-200" />

                  {/* 第二块：会话管理功能 */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">开启CLS日志服务后您还可以在运维观测和会话管理页面中获得以下观测数据：</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#3B82F6" }}>
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">应用日志与 OTEL 指标全景洞察</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">多维度分析日志级别与模块分布，精细化追踪消息处理、队列状态与执行耗时</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#FF9500" }}>
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">会话详情与交互效率精细化分析</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">聚焦单会话 Token 消耗，可视化渠道与模型分布特征，精准定位高Token会话，优化资源配置与调用效率</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#10B981" }}>
                            <Activity className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">业务运行健康度实时监控</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">聚焦消息处理总量、入队效率与卡死会话，保障系统稳定运行</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow" style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0" style={{ background: "#34C759" }}>
                            <Activity className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 mb-1">会话全局运行态势监控</h5>
                            <p className="text-xs text-gray-500 leading-relaxed">聚合总会话数、平均轮次与工具调用量，多维度洞察渠道与模型分布，实现会话全生命周期可追溯、可分析</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {showSuccessMessage && (
              <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-[4px] px-4 py-3 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 max-w-md">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">✓</div>
                  <div>
                    <p className="text-sm font-medium text-green-800">CLS 日志服务开启成功</p>
                  </div>
                </div>
              </div>
            )}
            {clsEnabled && (
              <>

              {/* 顶部：关闭 CLS 按钮（右上角）+ OpenClaw 搜索框（左下方）*/}
              <div className="flex items-start justify-between mb-6 gap-4">
                {/* 左侧：Agent 名称筛选 */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-700 block mb-2">Agent名称：</label>
                  <AgentCombobox
                    value={selectedAgent}
                    onValueChange={setSelectedAgent}
                    className="max-w-xs"
                  />
                </div>
                 {/* 右侧：升级CLS插件 + 关闭CLS按钮 */}
                <div className="flex items-center gap-2 mt-6">
                  <Button
                    onClick={() => setShowPluginUpgradeDialog(true)}
                    variant="outline"
                    className="text-xs h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 bg-white"
                  >
                    升级CLS采集插件
                  </Button>
                  <Button
                    onClick={() => setShowCloseClsConfirm(true)}
                    variant="outline"
                    className="text-xs h-8 px-3 text-red-600 border-red-200 hover:bg-white bg-white"
                  >
                    关闭CLS服务
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400">全部会话已按tokens排序，点击可查看会话详情</p>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <button
                      onClick={handleExportSession}
                      className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </UITooltipTrigger>
                  <UITooltipContent side="top" className="text-xs">导出列表</UITooltipContent>
                </UITooltip>
              </div>
              <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
                style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">会话</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">渠道</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">模型</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">最后活动时间</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">轮次</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">TOKENS</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">成本</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">耗时</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sessionPaged.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
                    ) : sessionPaged.map((s) => {
                      return (
                      <tr key={s.sessionId} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/session/${s.sessionId}`)}>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{s.sessionName}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{s.sessionId}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{s.channel}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{s.model}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{s.lastActiveTime}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{s.rounds}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">{(s.tokens / 1000000).toFixed(2)}M</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">${s.cost.toFixed(4)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{s.duration}</td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/session/${s.sessionId}`);
                            }}
                            variant="outline"
                            className="text-xs h-7 px-3"
                          >
                            查看详情
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination page={sessionPage} total={sessionStats.length} onChange={setSessionPage} />
              </div>
              </>
            )}
          </TabsContent>
        </Tabs>

      {/* CLS 授权 Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>开通服务授权</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            {!isCheckingAuth && !authCompleted && (
              <p className="text-sm text-gray-700">开启CLS日志服务后您可以获取会话数据和观测数据</p>
            )}
            <div className="space-y-3 flex flex-col items-center min-h-16 justify-center">
              {isCheckingAuth ? (
                <>
                  {/* 检测中的旋转动画 */}
                  <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 text-center">检测中...</p>
                </>
              ) : authCompleted ? (
                <>
                  {/* 检测完成后显示完成 icon */}
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <p className="text-xs text-gray-500 text-center">检测到已授权</p>
                </>
              ) : null}
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancelAuth}>
              取消
            </Button>
            <Button
              onClick={handleGoToAuth}
            >
              前往授权
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 免费额度 Dialog */}
      <Dialog open={showFreeQuotaDialog} onOpenChange={setShowFreeQuotaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>免费额度说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="bg-blue-50 border border-blue-200 rounded-[4px] p-4 space-y-2">
              <p className="text-sm text-gray-700">
                为您赠送<span className="font-semibold text-blue-600">3个月</span>ClawPro 专属 CLS 日志服务免费额度（共<span className="font-semibold text-blue-600">3000U</span>），预估可覆盖 <span className="font-semibold text-blue-600">500台</span> Agent 机器<span className="font-semibold text-blue-600">3个月</span>的日志用量；超过免费额度达到上限或<span className="font-semibold text-blue-600">3个月</span>到期后，CLS 将按量计费。计费详情请参考{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleGoToCalcDetail();
                  }}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  计费详情
                </a>
                。
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={freeQuotaAgreed}
                onChange={(e) => setFreeQuotaAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">我已阅读并同意免费额度说明</span>
            </label>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancelFreeQuota}>
              取消
            </Button>
            <Button
              onClick={handleConfirmFreeQuota}
              disabled={!freeQuotaAgreed}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关闭CLS确认对话框 */}
       <Dialog open={showCloseClsConfirm} onOpenChange={setShowCloseClsConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确定要关闭 CLS 日志服务吗？</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <p className="text-sm text-gray-600">关闭后以下功能将无法使用：</p>
            <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 space-y-2">
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">运维观测：</span>
                <span>支持通过全链路性能监控采集核心运行指标</span>
              </div>
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">会话管理：</span>
                <span>支持通过会话总览、会话链下钻还原及渠道模型分布分析</span>
              </div>
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">Tokens 监控（按会话）：</span>
                <span>支持从按会话、消息维度查看 tokens、费用使用情况</span>
              </div>
            </div>

            {/* 删除日志主题资源选项 */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="deleteLogTopic" 
                  checked={deleteLogTopic}
                  onCheckedChange={(checked) => setDeleteLogTopic(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="deleteLogTopic" className="text-sm font-medium text-gray-900 cursor-pointer">
                    删除关联的日志主题资源
                  </Label>
                  <div className="space-y-1.5">
                    <div className="flex gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>勾选后将永久删除该日志主题及所有日志数据，数据不可恢复。</span>
                    </div>
                    <div className="flex gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>未删除的日志主题资源会持续产生存储费用。</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCloseClsConfirmCancel}>
              取消
            </Button>
            <Button
              onClick={handleCloseCls}
              disabled={isClosingCls}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClosingCls ? "关闭中..." : "确定关闭"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLS 采集插件升级对话框 */}
      <Dialog open={showPluginUpgradeDialog} onOpenChange={setShowPluginUpgradeDialog}>
        <DialogContent className="max-w-10xl">
          <DialogHeader>
            <DialogTitle>升级 CLS 采集插件</DialogTitle>
            <DialogDescription>选择要升级的版本并查看更新内容</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700" style={{ width: '100px' }}>版本号</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700" style={{ flex: 1 }}>更新内容</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700" style={{ width: '100px' }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {CLS_PLUGIN_VERSIONS.map((v) => {
                  // 只允许选择比当前版本（v3）更高的版本
                  const isUpgradeable = v.status !== 'current' && v.status !== 'deprecated';
                  return (
                  <tr
                    key={v.version}
                    onClick={() => isUpgradeable && setSelectedPluginVersion(v)}
                    className={`border-b border-gray-100 ${
                      isUpgradeable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    } transition-colors ${
                      selectedPluginVersion?.version === v.version
                        ? "bg-blue-50"
                        : isUpgradeable ? "hover:bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap" style={{ width: '100px' }}>{v.version}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap" style={{ flex: 1 }}>{v.changelog}</td>
                    <td className="px-3 py-2 text-center" style={{ width: '100px' }}>
                      {v.status === 'current' && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">当前版本</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
            onClick={() => {
              setShowPluginUpgradeDialog(false);
              setSelectedPluginVersion(null);
            }}
            disabled={isUpgradingPlugin}
          >
            取消
            </Button>
            <Button
              onClick={() => {
                setIsUpgradingPlugin(true);
                setTimeout(() => {
                  setIsUpgradingPlugin(false);
                  setShowPluginUpgradeDialog(false);
                  if (selectedPluginVersion) {
                    toast.success(`成功升级到 ${selectedPluginVersion?.version}`);
                  }
                }, 2000);
              }}
              disabled={isUpgradingPlugin || !selectedPluginVersion || selectedPluginVersion?.status === 'current'}
            >
              {isUpgradingPlugin ? "升级中..." : "确认升级"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
