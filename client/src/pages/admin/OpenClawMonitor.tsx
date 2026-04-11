/**
 * OpenClawList - 管控端 OpenClaw 列表页
 * 4 个模块：状态统计卡片、状态列+列头筛选、操作列、监控抽屉面板
 */
import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, Bot, Trash2, ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
  Terminal, Power, MoreHorizontal, RotateCcw, HardDriveDownload,
  Activity, Loader2, ExternalLink, ChevronDown, Filter, HelpCircle, X, Eye, EyeOff,
  Server, CheckCircle2, PowerOff, Layers, ArrowUp, ArrowDown, Zap, BarChart3,
  MessageCircle, RotateCw, Check, ArrowLeftRight, CircleArrowUp
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { MOCK_DEPARTMENTS, MOCK_CLAWS_WITH_DEPT, type DepartmentNode } from "@/lib/mockData";
import { useAdminMode } from "@/contexts/AdminModeContext";

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
  pluginVersions: PluginVersions;
  department?: string;
  departmentId?: string;
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

const MOCK_CLAWS: Claw[] = [
  { id: "1",  instanceId: "ins-g83c6wvc", name: "Alice的助手",      creator: "alice@acompany.com",  createTime: "2025-12-01 09:12:34", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "2",  instanceId: "ins-h92d7xwe", name: "Bob工作助手",       creator: "bob@acompany.com",    createTime: "2025-12-15 14:05:22", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "3",  instanceId: "ins-j14e8yvf", name: "Carol的研究助手",   creator: "carol@acompany.com",  createTime: "2026-01-05 10:33:47", status: "shutdown",   version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "4",  instanceId: "ins-k25f9zwg", name: "Dave的代码助手",    creator: "dave@acompany.com",   createTime: "2026-01-20 16:48:09", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.1.5", dingtalk: "2.7.2", feishu: "1.4.8", wecom: "2.0.9", qq: "1.0.1" } },
  { id: "5",  instanceId: "ins-l36g0axh", name: "Eve的写作助手",     creator: "eve@acompany.com",    createTime: "2026-02-10 08:21:55", status: "createFail", version: "2026.3.28", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "6",  instanceId: "ins-m47h1byi", name: "Frank的数据助手",   creator: "frank@acompany.com",  createTime: "2026-02-18 11:07:30", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "7",  instanceId: "ins-n58i2czj", name: "Grace的翻译助手",   creator: "grace@acompany.com",  createTime: "2026-02-25 15:44:18", status: "creating",   version: "2026.3.28", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "8",  instanceId: "ins-o69j3dak", name: "Henry的销售助手",   creator: "henry@acompany.com",  createTime: "2026-03-01 09:58:03", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "9",  instanceId: "ins-p70k4ebl", name: "Ivy的客服助手",     creator: "ivy@acompany.com",    createTime: "2026-03-05 13:26:41", status: "running", version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "10", instanceId: "ins-q81l5fcm", name: "Jack的会议助手",    creator: "jack@acompany.com",   createTime: "2026-03-08 17:02:15", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.0", dingtalk: "2.8.0", feishu: "1.5.2", wecom: "2.1.3", qq: "1.0.2" } },
  { id: "11", instanceId: "ins-r92m6gdn", name: "Karen的报告助手",   creator: "karen@acompany.com",  createTime: "2026-03-09 10:15:50", status: "loadFail",   version: "2026.3.28", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "12", instanceId: "ins-s03n7heo", name: "Leo的项目助手",     creator: "leo@acompany.com",    createTime: "2026-03-10 08:39:27", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "13", instanceId: "ins-t14o8ipf", name: "Mia的新助手",        creator: "mia@acompany.com",    createTime: "2026-03-12 11:00:00", status: "maintaining", version: "2026.3.28", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "14", instanceId: "ins-u25p9jqg", name: "Noah的分析助手",    creator: "noah@acompany.com",   createTime: "2026-03-13 14:30:00", status: "pending",    version: "2026.3.28", pluginVersions: DEFAULT_PLUGIN_VERSIONS },
  { id: "15", instanceId: "ins-v36q0krh", name: "Olivia的运营助手",  creator: "olivia@acompany.com",  createTime: "2026-03-14 09:00:00", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "16", instanceId: "ins-w47r1lsi", name: "Peter的财务助手",  creator: "peter@acompany.com",   createTime: "2026-03-15 10:20:00", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "17", instanceId: "ins-x58s2mtj", name: "Quinn的法务助手",  creator: "quinn@acompany.com",   createTime: "2026-03-16 11:45:00", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "18", instanceId: "ins-y69t3nuk", name: "Rachel的HR助手",      creator: "rachel@acompany.com",  createTime: "2026-03-17 13:10:00", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "19", instanceId: "ins-z70u4ovl", name: "Sam的产品助手",    creator: "sam@acompany.com",     createTime: "2026-03-18 14:30:00", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "20", instanceId: "ins-a81v5pwm", name: "Tina的客服助手",  creator: "tina@acompany.com",    createTime: "2026-03-19 15:00:00", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
  { id: "21", instanceId: "ins-b92w6qxn", name: "Uma的设计助手",   creator: "uma@acompany.com",     createTime: "2026-03-20 09:30:00", status: "running",     version: "2026.4.2",  pluginVersions: { wechat: "3.3.0", dingtalk: "2.9.1", feishu: "1.6.0", wecom: "2.2.0", qq: "1.1.0" } },
  { id: "22", instanceId: "ins-c03x7ryo", name: "Victor的技术助手", creator: "victor@acompany.com",  createTime: "2026-03-21 10:00:00", status: "running",     version: "2026.3.28", pluginVersions: { wechat: "3.2.1", dingtalk: "2.8.0", feishu: "1.5.3", wecom: "2.1.4", qq: "1.0.2" } },
];

const PAGE_SIZE = 10;

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
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
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

// ─── 部门筛选弹出框（OpenClaw 列表页用） ──────────────────────────────────────
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
          <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
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
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }} onClick={handleConfirm}>确认</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function OpenClawMonitor() {
  const [, setLocation] = useLocation();
  const { hasOneid } = useAdminMode();
  const [claws, setClaws] = useState<Claw[]>(
    [...(hasOneid ? (MOCK_CLAWS_WITH_DEPT as Claw[]) : MOCK_CLAWS)].sort((a, b) => b.createTime.localeCompare(a.createTime))
  );
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");

  // 状态卡片筛选
  const [activeCardFilter, setActiveCardFilter] = useState<"all" | "running" | "shutdown" | "other">("all");

  // 状态列筛选
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ClawStatus>>(new Set());
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null);

  // 操作对话框
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [shutdownTarget, setShutdownTarget] = useState<string | null>(null);
  const [reinstallTarget, setReinstallTarget] = useState<string | null>(null);
  const [reinstallInput, setReinstallInput] = useState("");
  const [deleteInput, setDeleteInput] = useState("");

  // 批量更新
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchUpgradeDialog, setShowBatchUpgradeDialog] = useState(false);
  const [pluginVersionTarget, setPluginVersionTarget] = useState<Claw | null>(null);

  // 版本列筛选
  const VERSION_OPTIONS = ["2026.3.28", "2026.4.2", "unrecognized"] as const;
  type VersionFilter = typeof VERSION_OPTIONS[number];
  const [showVersionFilter, setShowVersionFilter] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<Set<VersionFilter>>(new Set(VERSION_OPTIONS));
  const versionFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [versionFilterPosition, setVersionFilterPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingVersions, setPendingVersions] = useState<Set<VersionFilter>>(new Set(VERSION_OPTIONS));

  const handleVersionFilterChange = (v: VersionFilter, checked: boolean) => {
    setPendingVersions(prev => {
      const next = new Set(prev);
      if (checked) next.add(v); else next.delete(v);
      return next;
    });
  };

  const handleVersionFilterReset = () => setPendingVersions(new Set(VERSION_OPTIONS));

  const handleVersionFilterConfirm = () => {
    setSelectedVersions(new Set(pendingVersions));
    setShowVersionFilter(false);
    setPage(1);
  };

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

  const confirmBatchUpgrade = () => {
    const ids = Array.from(selectedIds);
    setClaws(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: "upgrading" as ClawStatus } : c));
    setSelectedIds(new Set());
    setShowBatchUpgradeDialog(false);
    toast.success(`已开始升级 ${ids.length} 个实例`);
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

  const cardFiltered = deptFiltered.filter((c) => {
    switch (activeCardFilter) {
      case "running": return c.status === "running";
      case "shutdown": return c.status === "shutdown";
      case "other": return ["creating", "loading", "createFail", "loadFail", "maintaining", "pending"].includes(c.status);
      case "all": return true;
    }
  });

  const statusFiltered = cardFiltered.filter((c) => {
    if (selectedStatuses.size === 0) return true;
    return selectedStatuses.has(c.status);
  });

  const getVersionKey = (version: string): VersionFilter => {
    if (version === "2026.3.28") return "2026.3.28";
    if (version === "2026.4.2") return "2026.4.2";
    return "unrecognized";
  };

  const versionFiltered = statusFiltered.filter((c) => {
    if (selectedVersions.size === VERSION_OPTIONS.length) return true;
    return selectedVersions.has(getVersionKey(c.version));
  });

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
  const batchDisabled = selectedCount === 0 || selectedCount > 20 || hasNonRunning;
  const batchTooltip = selectedCount === 0
    ? '请先选择实例'
    : selectedCount > 20
    ? '批量更新数量不可大于20'
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

  // 详情抽屉模拟数据
  interface ClawDetail {
    appliedModel: string;
    appliedModelVersion: string;
    connectedChannels: { name: string; bots: string[] }[];
    installedSkills: string[];
  }
  const getClawDetail = (_clawId: string): ClawDetail => {
    return {
      appliedModel: "tencentcodingplan",
      appliedModelVersion: "minimax-m2.5",
      connectedChannels: [
        { name: "飞书", bots: [] },
      ],
      installedSkills: [
        "feishu-doc", "feishu-drive", "feishu-perm", "feishu-wiki",
        "feishu-calendar", "feishu-message", "feishu-task",
      ],
    };
  };

  const handleOpenDrawer = (claw: Claw) => {
    setSelectedClaw(claw);
    setShowDetailDrawer(true);
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
      <div className="page-enter">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OpenClaw 列表</h1>
            <p className="text-sm text-gray-500 mt-1">查看和管理所有企业用户创建的 OpenClaw 云服务器。</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors whitespace-nowrap"
              >
                清除筛选
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50 shrink-0"
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
            className={`bg-white rounded-2xl border p-4 transition-all text-left ${
              activeCardFilter === "all"
                ? "border-blue-300 ring-1 ring-blue-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400">总数</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{totalCount}</p>
          </button>

          {/* 运行中 */}
          <button
            onClick={() => handleCardFilterChange("running")}
            className={`bg-white rounded-2xl border p-4 transition-all text-left ${
              activeCardFilter === "running"
                ? "border-green-300 ring-1 ring-green-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400">运行中</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{runningCount}</p>
          </button>

          {/* 已关机 */}
          <button
            onClick={() => handleCardFilterChange("shutdown")}
            className={`bg-white rounded-2xl border p-4 transition-all text-left ${
              activeCardFilter === "shutdown"
                ? "border-gray-400 ring-1 ring-gray-200"
                : "border-gray-100 hover:border-gray-200"
            }`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
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
                className={`bg-white rounded-2xl border p-4 transition-all text-left ${
                  activeCardFilter === "other"
                    ? "border-orange-300 ring-1 ring-orange-200"
                    : "border-gray-100 hover:border-gray-200"
                }`}
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
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
        <div className="bg-white rounded-2xl border border-gray-100 overflow-visible"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}>

          {/* 工具栏 */}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* 部门筛选 - 仅 OneID 模式显示 */}
              {hasOneid && (
                <InstanceDepartmentFilter
                  departments={MOCK_DEPARTMENTS}
                  value={departmentFilter}
                  onChange={(v) => { setDepartmentFilter(v); setPage(1); }}
                />
              )}
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
                    style={!batchDisabled ? { background: "linear-gradient(135deg, #007AFF, #5856D6)" } : {}}
                    className={`text-white rounded-lg text-sm font-medium px-3 h-9 gap-1.5 transition-all ${
                      batchDisabled ? "bg-gray-300 cursor-not-allowed" : "btn-primary-glow"
                    }`}
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
            {/* 智能体迁移按鈕 */}
            <Link href="/admin/agent-migration">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                智能体迁移
              </button>
            </Link>
          </div>

          <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50 relative">
                {/* 复选框列 */}
                <th className="py-3 whitespace-nowrap" style={{ width: '1%', paddingLeft: '12px', paddingRight: '8px' }}>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                      onCheckedChange={(v) => handleSelectAll(!!v)}
                      className="size-4 border border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=indeterminate]:bg-blue-500 data-[state=indeterminate]:border-blue-500"
                    />
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">全选</span>
                  </div>
                </th>
                <th className="text-left pr-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '12%' : '16%', paddingLeft: '4px' }}>名称 / ID</th>
                {hasOneid && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-[13%]">用户归属</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '7%' : '10%' }}>
                  <div className="flex items-center gap-2 relative z-40">
                    当前状态
                    <button
                      ref={filterButtonRef}
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={() => {
                        if (filterButtonRef.current) {
                          const rect = filterButtonRef.current.getBoundingClientRect();
                          setFilterPosition({
                            top: rect.bottom + window.scrollY + 8,
                            left: rect.left + window.scrollX
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
                          className="fixed w-56 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 will-change-transform" 
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '13%' : '15%' }}>创建人</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '13%' : '15%' }}>创建时间</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '10%' : '12%' }}>
                  <div className="flex items-center gap-2 relative z-40">
                    智能体版本
                    <button
                      ref={versionFilterButtonRef}
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={() => {
                        if (versionFilterButtonRef.current) {
                          const rect = versionFilterButtonRef.current.getBoundingClientRect();
                          setVersionFilterPosition({
                            top: rect.bottom + window.scrollY + 8,
                            left: rect.left + window.scrollX
                          });
                        }
                        setPendingVersions(new Set(selectedVersions));
                        setShowVersionFilter(!showVersionFilter);
                      }}
                    >
                      <Filter className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {showVersionFilter && versionFilterPosition && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowVersionFilter(false)}
                          style={{ pointerEvents: 'auto' }}
                        />
                        <div
                          className="fixed w-52 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 will-change-transform"
                          style={{
                            top: `${versionFilterPosition.top}px`,
                            left: `${versionFilterPosition.left}px`,
                            pointerEvents: 'auto'
                          }}
                        >
                          <div className="p-3 space-y-2">
                            {([
                              { key: "2026.3.28" as VersionFilter, label: "OpenClaw/2026.3.28" },
                              { key: "2026.4.2" as VersionFilter, label: "OpenClaw/2026.4.2" },
                              { key: "unrecognized" as VersionFilter, label: "未识别" },
                            ]).map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={pendingVersions.has(key)}
                                  onCheckedChange={(checked) => handleVersionFilterChange(key, !!checked)}
                                />
                                <span className="text-sm text-gray-700 normal-case">{label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="border-t border-gray-100 p-2 flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleVersionFilterReset} className="flex-1">重置</Button>
                            <Button size="sm" onClick={handleVersionFilterConfirm} className="flex-1">确认</Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '8%' : '9%' }}>插件版本</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: hasOneid ? '12%' : '13%' }}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={hasOneid ? 10 : 9} className="px-6 py-12 text-center text-sm text-gray-400">
                    暂无符合条件的 OpenClaw
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
                    <tr key={claw.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* 复选框 */}
                      <td className="py-4 whitespace-nowrap" style={{ width: '1%', paddingLeft: '12px', paddingRight: '8px' }}>
                        <Checkbox
                          checked={selectedIds.has(claw.id)}
                          onCheckedChange={(v) => handleSelectOne(claw.id, !!v)}
                          className="size-4 border border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                      </td>
                      {/* 名称/ID */}
                      <td className="pr-4 py-4" style={{ paddingLeft: '4px' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{claw.name}</div>
                            <button
                              onClick={() => handleOpenDrawer(claw)}
                              className="text-xs font-mono cursor-pointer text-blue-500 hover:text-blue-700 hover:underline"
                            >
                              {claw.instanceId}
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* 用户归属 - 仅 OneID 模式显示 */}
                      {hasOneid && (
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {claw.department ? claw.department.replace(/\//g, " / ") : "—"}
                        </td>
                      )}
                      {/* 状态列 */}
                      <td className="px-4 py-4">
                        <span className={`${statusConfig.badgeClass} text-xs`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      {/* 创建人 */}
                      <td className="px-4 py-4 text-sm text-gray-500">{claw.creator}</td>
                      {/* 创建时间 */}
                      <td className="px-4 py-4 text-sm whitespace-nowrap text-gray-500">{claw.createTime}</td>
                      {/* 智能体版本 */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500">OpenClaw</span>
                          <span className="text-xs font-mono text-gray-500">
                            {claw.version}

                          </span>
                        </div>
                      </td>
                      {/* 插件版本 */}
                      <td className="px-4 py-4">
                        <button
                          className="text-xs text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                          onClick={() => setPluginVersionTarget(claw)}
                        >
                          查看详情
                        </button>
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-4">
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
                                重新安装 OpenClaw
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
            <span className="text-xs text-gray-400">共 {statusFiltered.length} 条记录</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors border ${
                      p === safePage
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
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
              ? <>关机后该 OpenClaw「{claws.find(c => c.id === shutdownTarget)?.name}」将无法使用，直到重新开机。确认关机吗？</>
              : <>开机后该 OpenClaw「{claws.find(c => c.id === shutdownTarget)?.name}」将重新运行。确认开机吗？</>}
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
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
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
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
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
          <div className="space-y-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p>1. 更新版本预计需要 5～10 分钟不等，期间 OpenClaw 实例不可使用。</p>
            <p>2. OpenClaw 版本将会升级至当前生效镜像对应的版本，请先将目标镜像指定为生效状态再执行升级操作。</p>
            <p>3. 更新后模型、通道、技能和记忆，以及用户个人数据均不会丢失。</p>
          </div>
          <p className="text-sm text-gray-600">已选择 <span className="font-semibold text-gray-900">{selectedIds.size}</span> 个实例</p>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">实例</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">当前版本</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">当前状态</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">插件是否最新版本</th>
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
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white" style={{ fontSize: '10px' }}>C</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{c.instanceId}</div>
                          </div>
                        </div>
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
                      <td className="px-4 py-2.5 text-center">
                        {(() => {
                          const RECOMMENDED: PluginVersions = { wechat: '3.2.1', dingtalk: '2.1.0', feishu: '1.8.5', wecom: '4.0.2', qq: '1.3.0' };
                          const isLatest = (['wechat', 'dingtalk', 'feishu', 'wecom', 'qq'] as const).every(
                            k => c.pluginVersions[k] === RECOMMENDED[k]
                          );
                          return isLatest
                            ? <span className="text-xs text-green-600">是</span>
                            : <span className="text-xs text-red-500">否</span>;
                        })()}
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
            <Button onClick={confirmBatchUpgrade} className="bg-blue-500 hover:bg-blue-600 text-white">
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 插件版本弹窗 */}
      <Dialog open={!!pluginVersionTarget} onOpenChange={(open) => { if (!open) setPluginVersionTarget(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">插件版本</DialogTitle>
          </DialogHeader>
          {pluginVersionTarget && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">实例：<span className="font-medium text-gray-700">{pluginVersionTarget.name}</span></p>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {/* 表头 */}
                <div className="grid grid-cols-3 px-4 py-2 bg-gray-50/80 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500">插件</span>
                  <span className="text-xs font-medium text-gray-500">当前版本</span>
                  <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    建议升级版本
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-gray-400 cursor-help flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          适配当前生效镜像中openclaw版本的最新插件版本
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                </div>
                {([
                  { label: '微信', key: 'wechat', recommended: '3.2.1' },
                  { label: '钉钉', key: 'dingtalk', recommended: '2.1.0' },
                  { label: '飞书', key: 'feishu', recommended: '1.8.5' },
                  { label: '企业微信', key: 'wecom', recommended: '4.0.2' },
                  { label: 'QQ', key: 'qq', recommended: '1.3.0' },
                ] as const).map(({ label, key, recommended }, idx, arr) => {
                  const current = pluginVersionTarget.pluginVersions[key];
                  const isUpToDate = current === recommended;
                  return (
                    <div key={key} className={`grid grid-cols-3 items-center px-4 py-2.5 ${idx < arr.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50/50`}>
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-sm font-mono text-gray-700">{current}</span>
                      {isUpToDate
                        ? <span className="text-sm text-green-600">已是最新版本</span>
                        : <span className="text-sm font-mono text-gray-700">{recommended}</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* OpenClaw 详情抽屉 */}
      {showDetailDrawer && selectedClaw && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setShowDetailDrawer(false)}
          />
          <div className="w-[593px] bg-white shadow-lg flex flex-col">
            {/* 抽屉头 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">OpenClaw 详情</h2>
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
                <div>
                  <div className="text-sm text-gray-500 mb-2">已应用模型</div>
                  <div className="px-4 py-3 bg-white rounded-2xl border border-gray-200">
                    <div className="text-sm font-semibold text-gray-900">{getClawDetail(selectedClaw.id).appliedModel}</div>
                    <div className="text-xs text-gray-400 mt-1">{getClawDetail(selectedClaw.id).appliedModelVersion}</div>
                  </div>
                </div>
                {/* 已接入通道 */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">已接入通道（{getClawDetail(selectedClaw.id).connectedChannels.length}）</div>
                  <div className="space-y-2">
                    {getClawDetail(selectedClaw.id).connectedChannels.map((channel) => (
                      <div key={channel.name} className="px-4 py-3 bg-white rounded-2xl border border-gray-200 flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="text-sm font-semibold text-gray-900">{channel.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 已安装技能 */}
                <div>
                  <div className="text-sm text-gray-500 mb-2">已安装技能（{getClawDetail(selectedClaw.id).installedSkills.length}）</div>
                  <div className="space-y-2">
                    {getClawDetail(selectedClaw.id).installedSkills.map((skill) => (
                      <div key={skill} className="px-4 py-3 bg-white rounded-2xl border border-gray-200 text-sm text-gray-800">
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
                      className="bg-white rounded-2xl border border-gray-100 p-4"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
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
                        className="bg-white rounded-2xl border border-gray-100 p-4"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                            <stat.icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-xs text-gray-400">{stat.label}</p>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* 会话摘要表格 */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)" }}
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
