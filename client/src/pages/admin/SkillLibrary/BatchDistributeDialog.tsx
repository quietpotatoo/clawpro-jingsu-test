import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type DistributionStatus, DISTRIBUTION_STATUS_MAP, type InstanceStatus, INSTANCE_STATUS_MAP, type SkillScope, type AgentInstance, type Group } from './types';

/** 筛选选项类型 —— 多选 */
type FilterOption = 'not_distributed' | 'failed' | 'pending_update';

/** 版本筛选选项 */
type VersionFilterOption = 'all' | 'gte_0328' | 'lt_0328';

/** 版本筛选选项配置 */
const VERSION_FILTER_OPTIONS: { key: VersionFilterOption; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'gte_0328', label: '26.3.28版本后（含28）' },
  { key: 'lt_0328', label: '26.3.28版本前' },
];

/** 版本号比较基准：2026.3.28 */
const VERSION_THRESHOLD = '2026.3.28';

/** 解析版本号为可比较的数值数组 */
function parseVersion(v: string): number[] {
  return v.split('.').map(Number);
}

/** 比较两个版本号，返回 -1/0/1 */
function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

interface BatchDistributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId?: string;
  skillName?: string;
  /** 当前 Skill 最新版本号，用于判定"待更新" */
  skillVersion?: string;
  /** 当前 Skill 的应用范围 */
  skillScope?: SkillScope;
  /** 当前 Skill 关联的分组 ID 列表 */
  skillGroupIds?: string[];
  onDistributionStart?: (selectedInstanceIds: string[], selectedInstancesData: any[]) => void;
  /** 弹窗标题，默认 "批量下发 Skill" */
  title?: string;
  /** 是否显示应用范围筛选，默认 true */
  showScopeFilter?: boolean;
  /** Agent 实例列表（外部传入） */
  instances: AgentInstance[];
  /** 分组列表（外部传入，showScopeFilter=true 时必传） */
  groups?: Group[];
  /** MCP 场景：隐藏实例列表中的创建人、分组信息 */
  hideCreatorAndGroup?: boolean;
  /** MCP 场景：下发状态筛选改为单选下拉（只有 未下发 / 下发失败），去掉待更新和多选逻辑 */
  singleStatusFilter?: boolean;
  /** MCP 场景：自定义描述 ReactNode，覆盖默认描述 */
  descriptionNode?: React.ReactNode;
  /** MCP 场景：显示版本筛选下拉，默认 false */
  showVersionFilter?: boolean;
  /** MCP 场景：下发前需要二次确认弹窗，默认 false */
  showConfirmDialog?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500];

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'not_distributed', label: '未下发' },
  { key: 'failed', label: '下发失败' },
  { key: 'pending_update', label: '待更新' },
];

export default function BatchDistributeDialog({
  open,
  onOpenChange,
  skillName,
  skillVersion,
  skillScope,
  skillGroupIds,
  onDistributionStart,
  title = '批量下发 Skill',
  showScopeFilter = true,
  instances,
  groups = [],
  hideCreatorAndGroup = false,
  singleStatusFilter = false,
  descriptionNode,
  showVersionFilter = false,
  showConfirmDialog = false,
}: BatchDistributeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  /** 状态多选筛选 */
  const [statusFilters, setStatusFilters] = useState<FilterOption[]>([]);
  /** 应用范围筛选：空数组=全部, 否则为选中的分组 ID 列表（多选） */
  const [scopeFilters, setScopeFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  /** 多选下拉的展开状态 */
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  /** 分组筛选下拉 */
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  /** 版本筛选 */
  const [versionFilter, setVersionFilter] = useState<VersionFilterOption>('gte_0328');
  /** 二次确认弹窗 */
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 当打开弹窗时，重置筛选状态；技能库默认全选符合条件的实例，插件库不自动选中
  useEffect(() => {
    if (open) {
      // MCP 和 Skill 场景默认选中「未下发」+「下发失败」
      setStatusFilters(['not_distributed', 'failed']);
      setSearchQuery('');
      setCurrentPage(1);
      setPageSize(20);
      setFilterDropdownOpen(false);
      setScopeDropdownOpen(false);
      setScopeSearchQuery('');
      setVersionFilter('gte_0328');
      setConfirmDialogOpen(false);
      setConfirmInput('');
      // 根据 Skill 应用范围设置默认筛选
      if (showScopeFilter) {
        if (skillScope === 'private' && skillGroupIds && skillGroupIds.length > 0) {
          setScopeFilters([...skillGroupIds]);
        } else {
          setScopeFilters([]);
        }
        const validIds = instances
          .filter(i => {
            if (i.status !== 'running') return false;
            // 仅选中 未下发 和 下发失败 的实例
            if (i.distributionStatus !== 'not_distributed' && i.distributionStatus !== 'failed') return false;
            if (skillScope === 'private' && skillGroupIds && skillGroupIds.length > 0) {
              return i.groupIds?.some(gId => skillGroupIds.includes(gId));
            }
            return true;
          })
          .map(i => i.id);
        setSelectedInstances(validIds);
      } else {
        setScopeFilters([]);
        setSelectedInstances([]);
      }
    }
  }, [open, skillScope, skillGroupIds]);

  /** 切换筛选选项 */
  const toggleFilterOption = (key: FilterOption) => {
    setStatusFilters(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
    setCurrentPage(1);
  };

  /** 获取筛选下拉的显示文本 */
  const getFilterDisplayText = () => {
    if (statusFilters.length === 0) return '全部下发状态';
    if ((statusFilters as any)[0] === '__none__') return '下发状态';
    if (statusFilters.length === FILTER_OPTIONS.length) return '全部下发状态';
    return statusFilters.map(k => FILTER_OPTIONS.find(o => o.key === k)?.label).filter(Boolean).join('、');
  };

  /** 判断当前是否为"全部状态"（所有3个选项都选中，或空数组） */
  const isAllStatusSelected = statusFilters.length === 0 || statusFilters.length === FILTER_OPTIONS.length;

  /** 获取分组筛选显示文本 */
  const getScopeDisplayText = () => {
    if (scopeFilters.length === 0) return '全部分组';
    if (scopeFilters[0] === '__none__') return '分组';
    const names: string[] = [];
    const groupFilterIds = scopeFilters.filter(id => id !== '__public__' && id !== '__none__' && id !== '__ungrouped__');
    const hasUngrouped = scopeFilters.includes('__ungrouped__');
    // 全部分组 = 所有分组 + 未分组
    if (groupFilterIds.length === groups.length && hasUngrouped) return '全部分组';
    groupFilterIds.forEach(id => {
      const g = groups.find(g => g.id === id);
      if (g) names.push(g.name);
    });
    if (hasUngrouped) names.push('未分组');
    return names.join('、') || '分组';
  };

  /** 获取实例的显示状态（运行时计算，pending_update 不是持久化状态） */
  const getInstanceFilterKey = (instance: AgentInstance): FilterOption | null => {
    if (instance.distributionStatus === 'not_distributed') return 'not_distributed';
    if (instance.distributionStatus === 'failed') return 'failed';
    // 已下发成功 + 版本与当前 Skill 最新版本不一致 → 待更新
    if (instance.distributionStatus === 'success' && skillVersion && instance.distributedVersion && instance.distributedVersion !== skillVersion) {
      return 'pending_update';
    }
    return null;
  };

  /** 获取分组名称 */
  const getGroupName = (groupId: string) => {
    return groups.find(g => g.id === groupId)?.name || groupId;
  };

  const allFilteredInstances = instances
    .filter(instance => {
      // 仅显示运行中的实例
      if (instance.status !== 'running') return false;
      // 仅显示未下发、下发失败、待更新的实例
      const filterKey = getInstanceFilterKey(instance);
      if (!filterKey) return false;

      const matchesSearch = instance.name.toLowerCase().includes(searchQuery.toLowerCase()) || instance.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 多选筛选逻辑：空数组 = 全部；['__none__'] = 全不选
      let matchesStatus = true;
      if (statusFilters.length > 0) {
        if ((statusFilters as any)[0] === '__none__') {
          matchesStatus = false;
        } else {
          matchesStatus = statusFilters.includes(filterKey);
        }
      }

      // 分组筛选（多选）：空数组 = 全部；['__none__'] = 全不选
      let matchesScope = true;
      if (scopeFilters.length > 0) {
        if (scopeFilters[0] === '__none__') {
          matchesScope = false;
        } else {
          const groupFilterIds = scopeFilters.filter(id => id !== '__public__' && id !== '__none__' && id !== '__ungrouped__');
          const hasUngrouped = scopeFilters.includes('__ungrouped__');
          const matchesGroup = groupFilterIds.length > 0 && instance.groupIds?.some(gId => groupFilterIds.includes(gId));
          const matchesUngrouped = hasUngrouped && (!instance.groupIds || instance.groupIds.length === 0 || instance.groupIds.every(gId => gId === '__public__'));
          matchesScope = matchesGroup || matchesUngrouped || false;
        }
      }

      return matchesSearch && matchesStatus && matchesScope;
    })
    // 版本筛选（仅 MCP 场景启用）
    .filter(instance => {
      if (!showVersionFilter || versionFilter === 'all') return true;
      const ver = instance.agentVersion;
      if (!ver) return versionFilter === 'lt_0328'; // 无版本信息视为旧版
      const cmp = compareVersion(ver, VERSION_THRESHOLD);
      if (versionFilter === 'gte_0328') return cmp >= 0;
      if (versionFilter === 'lt_0328') return cmp < 0;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 分页计算
  const totalCount = allFilteredInstances.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedInstances = allFilteredInstances.slice(startIndex, startIndex + pageSize);

  /** 全选 / 取消全选 —— 操作所有筛选后的实例（跨页） */
  const handleSelectAll = () => {
    const allIds = allFilteredInstances.map(i => i.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedInstances.includes(id));
    if (allSelected) {
      // 取消全选：移除所有筛选结果中的 id
      setSelectedInstances(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      // 全选：合并所有筛选结果的 id
      setSelectedInstances(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleSelectInstance = (id: string) => {
    setSelectedInstances(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDistribute = () => {
    if (showConfirmDialog) {
      // 打开二次确认弹窗
      setConfirmInput('');
      setConfirmDialogOpen(true);
      return;
    }
    doDistribute();
  };

  const doDistribute = () => {
    const selectedInstancesData = instances.filter(i => selectedInstances.includes(i.id));
    
    if (onDistributionStart) {
      onDistributionStart(selectedInstances, selectedInstancesData);
    }
    
    setSelectedInstances([]);
    setSearchQuery('');
    setStatusFilters(['not_distributed', 'failed']);
    setScopeFilters([]);
    setCurrentPage(1);
    setPageSize(20);
    setConfirmDialogOpen(false);
    setConfirmInput('');
    onOpenChange(false);
  };

  const handleConfirmDistribute = () => {
    if (confirmInput !== '确认下发') return;
    doDistribute();
  };

  const getStatusDisplay = (instance: AgentInstance) => {
    const filterKey = getInstanceFilterKey(instance);
    // 待更新：黄色样式 + 老版本号
    if (filterKey === 'pending_update') {
      return (
        <div className="text-right">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-yellow-700 bg-yellow-50">待更新</span>
          <div className="text-[11px] text-gray-400 mt-0.5 text-center">v{instance.distributedVersion}</div>
        </div>
      );
    }
    const s = instance.distributionStatus || 'not_distributed';
    const { label, color } = DISTRIBUTION_STATUS_MAP[s];
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
  };

  // 全选判断：跨所有页
  const allIds = allFilteredInstances.map(i => i.id);
  const selectedInFilterCount = allIds.filter(id => selectedInstances.includes(id)).length;
  const isAllSelected = allIds.length > 0 && selectedInFilterCount === allIds.length;
  const isIndeterminate = selectedInFilterCount > 0 && selectedInFilterCount < allIds.length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              {descriptionNode || (
                <>
                  <p>将 <span className="font-semibold text-gray-900">{skillName}{skillVersion ? ` (${skillVersion})` : ''}</span> 部署至所选实例。</p>
                  <p className="mt-1">筛选限制：仅限状态为 <span className="font-medium text-gray-700">运行中</span> 的实例；同时，该实例的下发状态须为 <span className="font-medium text-gray-700">未下发</span>{showScopeFilter ? <>{' '}、 <span className="font-medium text-gray-700">下发失败</span> 或 <span className="font-medium text-gray-700">待更新</span></> : <>{' '}、 <span className="font-medium text-gray-700">下发失败</span> 或 <span className="font-medium text-gray-700">待更新</span></>}。</p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* 搜索框 + 应用范围筛选 + 版本筛选 + 状态下拉 */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索实例名称/ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          {/* 版本筛选 — MCP 场景 */}
          {showVersionFilter && (
            <Select
              value={versionFilter}
              onValueChange={(value) => {
                setVersionFilter(value as VersionFilterOption);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-24 h-9">
                <span>版本</span>
              </SelectTrigger>
              <SelectContent>
                {VERSION_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* 分组筛选 — 扁平多选列表 */}
          {showScopeFilter && (
          <div className="relative" ref={scopeDropdownRef}>
            <Tooltip delayDuration={1000} open={scopeDropdownOpen ? false : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setScopeDropdownOpen(prev => !prev)}
                    className="flex items-center justify-between gap-1 w-32 h-9 px-3 border border-gray-200 rounded-[4px] bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate text-left">
                      {getScopeDisplayText()}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${scopeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px]">
                  <p className="break-words">{getScopeDisplayText()}</p>
                </TooltipContent>
              </Tooltip>
            {scopeDropdownOpen && (() => {
              const groupOnlyFilters = scopeFilters.filter(id => id !== '__public__' && id !== '__none__' && id !== '__ungrouped__');
              const hasUngrouped = scopeFilters.includes('__ungrouped__');
              const allGroupIds = groups.map(g => g.id);
              // 全部分组 = 所有分组 + 未分组
              const isAllGroupSelected = scopeFilters.length === 0 || (allGroupIds.every(id => groupOnlyFilters.includes(id)) && hasUngrouped);
              const selectedCount = groupOnlyFilters.length + (hasUngrouped ? 1 : 0);
              const isSomeGroupSelected = selectedCount > 0 && !isAllGroupSelected;
              const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(scopeSearchQuery.toLowerCase()));
              const showUngrouped = !scopeSearchQuery || '未分组'.includes(scopeSearchQuery);

              return (
              <div className="absolute left-0 top-full mt-1 w-[220px] bg-white border border-gray-200 rounded-[4px] shadow-lg z-50 py-1">
                {/* 搜索框 */}
                <div className="px-2 pb-1.5 pt-1.5">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      placeholder="搜索分组..."
                      value={scopeSearchQuery}
                      onChange={(e) => setScopeSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 h-8 text-sm border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                </div>
                {/* 全部分组 */}
                {!scopeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAllGroupSelected) {
                        // 全选 → 取消全部
                        setScopeFilters(['__none__']);
                      } else {
                        // 非全选 → 选中所有（全部分组 + 未分组）
                        setScopeFilters([...allGroupIds, '__ungrouped__']);
                      }
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isAllGroupSelected ? 'bg-blue-600 border-blue-600' : isSomeGroupSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {isAllGroupSelected && <Check className="w-3 h-3 text-white" />}
                      {isSomeGroupSelected && <div className="w-2 h-0.5 bg-white rounded-sm" />}
                    </div>
                    <span>全部分组</span>
                  </button>
                )}
                {/* 分组列表 */}
                <div className="max-h-[200px] overflow-y-auto">
                  {filteredGroups.map(group => {
                    const isSelected = isAllGroupSelected || groupOnlyFilters.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setScopeFilters(prev => {
                            const cleaned = prev.filter(id => id !== '__public__' && id !== '__none__');
                            const hasUng = cleaned.includes('__ungrouped__');
                            const grpOnly = cleaned.filter(id => id !== '__ungrouped__');
                            // 如果当前是"全部"(空数组)，点击某项 = 取消该项
                            if (prev.length === 0) {
                              const remaining = allGroupIds.filter(id => id !== group.id);
                              return [...remaining, '__ungrouped__'];
                            }
                            const next = grpOnly.includes(group.id)
                              ? grpOnly.filter(id => id !== group.id)
                              : [...grpOnly, group.id];
                            const combined = hasUng ? [...next, '__ungrouped__'] : next;
                            if (combined.length === 0) return ['__none__'];
                            // 全部选中 → 重置为空（全部分组）
                            if (next.length === allGroupIds.length && hasUng) return [];
                            return combined;
                          });
                          setCurrentPage(1);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="truncate text-left" title={group.name}>{group.name}</span>
                      </button>
                    );
                  })}
                  {/* 未分组 */}
                  {showUngrouped && (
                    <button
                      type="button"
                      onClick={() => {
                        setScopeFilters(prev => {
                          const cleaned = prev.filter(id => id !== '__public__' && id !== '__none__');
                          const grpOnly = cleaned.filter(id => id !== '__ungrouped__');
                          const hadUng = cleaned.includes('__ungrouped__');
                          // 如果当前是"全部"(空数组)，点击未分组 = 取消它
                          if (prev.length === 0) {
                            return [...allGroupIds]; // 保留所有分组，移除未分组
                          }
                          if (hadUng) {
                            // 取消未分组
                            const result = grpOnly.length > 0 ? grpOnly : ['__none__'];
                            return result;
                          } else {
                            // 选中未分组
                            const combined = [...grpOnly, '__ungrouped__'];
                            // 全选判断
                            if (grpOnly.length === allGroupIds.length) return [];
                            return combined;
                          }
                        });
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        (isAllGroupSelected || hasUngrouped) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {(isAllGroupSelected || hasUngrouped) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-gray-500">未分组</span>
                    </button>
                  )}
                  {filteredGroups.length === 0 && !showUngrouped && scopeSearchQuery && (
                    <p className="text-xs text-gray-400 py-3 text-center">没有匹配的分组</p>
                  )}
                </div>
                {/* 底部统计 + 清除筛选 */}
                {selectedCount > 0 && !isAllGroupSelected && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs">
                    <span className="text-gray-500">已选 {selectedCount} 个分组</span>
                    <button
                      type="button"
                      onClick={() => { setScopeFilters([]); setCurrentPage(1); }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      清除筛选
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
          )}
          {singleStatusFilter ? (
            /* ── MCP 场景：单选下拉，「全部下发状态」「未下发」「下发失败」「待更新」 ── */
            <Select
              value={
                statusFilters.length === 0
                  ? '__all__'
                  : statusFilters.length === 1
                    ? statusFilters[0]
                    : statusFilters.length === 2 && statusFilters.includes('not_distributed') && statusFilters.includes('failed')
                      ? '__default__'
                      : '__all__'
              }
              onValueChange={(value) => {
                if (value === '__all__') {
                  setStatusFilters([]);
                } else if (value === '__default__') {
                  setStatusFilters(['not_distributed', 'failed']);
                } else {
                  setStatusFilters([value as FilterOption]);
                }
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="全部下发状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部下发状态</SelectItem>
                <SelectItem value="__default__">未下发+下发失败</SelectItem>
                <SelectItem value="not_distributed">未下发</SelectItem>
                <SelectItem value="failed">下发失败</SelectItem>
                <SelectItem value="pending_update">待更新</SelectItem>
              </SelectContent>
            </Select>
          ) : (
          <div className="relative" ref={filterDropdownRef}>
            <Tooltip delayDuration={1000} open={filterDropdownOpen ? false : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setFilterDropdownOpen(prev => !prev)}
                    className="flex items-center justify-between gap-1 w-36 h-9 px-3 border border-gray-200 rounded-[4px] bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate text-left">{getFilterDisplayText()}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px]">
                  <p className="break-words">{getFilterDisplayText()}</p>
                </TooltipContent>
              </Tooltip>
            {filterDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-[4px] shadow-lg z-50 py-1">
                {/* 全部状态选项 — toggle：点击全选，再次点击取消全部 */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilters(prev => {
                      if (isAllStatusSelected) {
                        // 当前是全选状态 → 取消所有选中
                        return ['__none__'] as any;
                      }
                      // 非全选 → 全选（选中所有3项）
                      return [];
                    });
                    setCurrentPage(1);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isAllStatusSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isAllStatusSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span>全部下发状态</span>
                </button>
                {FILTER_OPTIONS.map(opt => {
                  const isOptSelected = isAllStatusSelected || (!(statusFilters as any).includes('__none__') && statusFilters.includes(opt.key));
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setStatusFilters(prev => {
                          // 处理 __none__ 状态（全不选）
                          const cleaned = (prev as any).filter((k: string) => k !== '__none__') as FilterOption[];
                          if (prev.length === 0) {
                            // 当前是"全部状态"（空数组），点击某项 = 取消该项，选中其余所有
                            return FILTER_OPTIONS.filter(o => o.key !== opt.key).map(o => o.key);
                          }
                          if (prev.length === FILTER_OPTIONS.length) {
                            // 当前所有选项都显式选中，也视为全选，点击 = 取消该项
                            return FILTER_OPTIONS.filter(o => o.key !== opt.key).map(o => o.key);
                          }
                          const next = cleaned.includes(opt.key)
                            ? cleaned.filter(k => k !== opt.key)
                            : [...cleaned, opt.key];
                          // 如果全选了所有状态，等同于"全部状态"，重置为空
                          if (next.length === FILTER_OPTIONS.length) {
                            return [];
                          }
                          return next;
                        });
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isOptSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {isOptSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>

        {/* 实例列表 */}
        <div className="border border-gray-200 rounded-[4px] max-h-[340px] overflow-y-auto">
          {/* 全选复选框 — 跨页全选 */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <Checkbox
              checked={isAllSelected}
              // @ts-ignore – indeterminate prop
              indeterminate={isIndeterminate}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium text-gray-900">
              全选（{selectedInFilterCount}/{totalCount}）
            </span>
          </div>

          {/* 实例项 */}
          {pagedInstances.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              暂无匹配的实例
            </div>
          ) : (
            pagedInstances.map(instance => (
              <div
                key={instance.id}
                className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <Checkbox
                    checked={selectedInstances.includes(instance.id)}
                    onCheckedChange={() => handleSelectInstance(instance.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 truncate">{instance.name}</span>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{instance.id}</span>
                  </div>
                  {/* Agent 类型和版本信息 — MCP 场景显示 */}
                  {showVersionFilter && instance.agentType && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {instance.agentType}{instance.agentVersion ? `(${instance.agentVersion})` : ''}
                    </div>
                  )}
                  {!hideCreatorAndGroup && (
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">创建人：{instance.createdBy}</span>
                    {(() => {
                      const groupText = instance.groupIds && instance.groupIds.length > 0
                        ? instance.groupIds.filter(gId => gId !== '__public__').map(gId => getGroupName(gId)).join('、')
                        : '';
                      const displayText = groupText || '-';
                      return (
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-gray-500 max-w-[180px] truncate inline-block align-bottom cursor-default">
                              分组：{displayText}
                            </span>
                          </TooltipTrigger>
                          {displayText !== '-' && displayText.length > 10 && (
                            <TooltipContent side="top" className="max-w-[320px]">
                              <p className="break-words">分组：{displayText}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })()}
                  </div>
                  )}
                </div>
                <div className="flex-shrink-0 self-center">
                  {getStatusDisplay(instance)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 分页控件 */}
        <div className="flex items-center justify-between text-sm text-gray-500 pt-1">
          <div className="flex items-center gap-1.5">
            <span>共 {totalCount} 条，每页</span>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setCurrentPage(1); }}>
              <SelectTrigger className="w-16 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>条</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="px-2 text-gray-600">{safeCurrentPage} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={selectedInstances.length === 0}
          >
            确认下发（{selectedInstances.length}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 二次确认弹窗 */}
    <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            风险提示
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-[4px] px-4 py-3">
                <p className="text-sm text-amber-700 leading-relaxed">
                  配置 MCP 会修改 <code className="px-1 py-0.5 bg-amber-100/60 rounded text-xs font-mono">~/.openclaw/openclaw.json</code> 文件中的 <code className="px-1 py-0.5 bg-amber-100/60 rounded text-xs font-mono">mcp.servers</code> 相关配置，修改后需重启 gateway 生效，将会导致实例短暂不可用，可能影响正在运行的任务。
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">请输入<span className="font-semibold text-gray-900">「确认下发」</span>后开始执行。</p>
                <Input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="确认下发"
                  className="mt-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && confirmInput === '确认下发') {
                      handleConfirmDistribute();
                    }
                  }}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setConfirmDialogOpen(false); setConfirmInput(''); }}>
            取消
          </AlertDialogCancel>
          <Button
            onClick={handleConfirmDistribute}
            disabled={confirmInput !== '确认下发'}
          >
            确认下发
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
