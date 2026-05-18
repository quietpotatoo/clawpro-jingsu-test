import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Bot,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
// 骨架屏组件
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// 骨架屏行组件 - 5列（复选框、名称/ID、创建人、Agent 类型、记忆管理）
const SkeletonRow: React.FC = () => (
  <tr>
    <td className="w-12 px-4 py-4"><Skeleton className="w-4 h-4 rounded" /></td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-7 h-7 rounded-[4px]" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
    <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-6 py-4"><Skeleton className="h-8 w-48 rounded-full" /></td>
  </tr>
);

// Memory 版本类型
export type MemoryVersion = 'none' | 'free' | 'pro';

// Agent 类型显示名称映射
// 与管控端 Agent 列表（OpenClawMonitor）保持一致：
//   - OpenClaw / openclaw → "OpenClaw"
//   - Hermes / hermes     → "Hermes Agent"
// 兼容大小写两种写法（OcInstance 上的 agentType 历史上用小写，OpenClawMonitor 用大写）。
// 当前仅 OpenClaw / Hermes 支持记忆服务，其它类型不纳入映射，列表数据源也不会下发。
const AGENT_TYPE_DISPLAY: Record<string, string> = {
  openclaw: 'OpenClaw',
  OpenClaw: 'OpenClaw',
  hermes: 'Hermes Agent',
  Hermes: 'Hermes Agent',
};

// Memory 状态类型
// idle: 空闲（未开启）
// enabling: 开启中
// running: 已开启
// closing: 关闭中
// error: 异常
export type MemoryState = 'idle' | 'enabling' | 'running' | 'closing' | 'error';

// 组合状态（用于过滤和显示）
export type MemoryStatus = 'none' | 'free-enabling' | 'free' | 'pro-enabling' | 'pro' | 'closing' | 'error';

// 弹窗类型（去掉 upgrade-to-pro，合并到 enable-pro）
// 增加批量操作弹窗类型
type DialogType = 'none' | 'enable-free' | 'enable-pro' | 'disable' | 'batch-enable-free' | 'batch-enable-pro' | 'batch-disable';

// 三态开关组件
interface TriStateSwitchProps {
  value: 'none' | 'free' | 'pro';
  isTransitioning?: boolean;
  isError?: boolean;
  isProDisabled?: boolean;
  proDisabledReason?: string;
  // 锁定态：不可交互。视觉上复用与「开通中」一致的滑块内 loading，
  // 在当前档位（Pro）的 button 内叠加 spinner，但保留档位文字 —— 用户依然
  // 知道当前档位没变，只是有一个异步任务（插件升级）在后台跑。
  isLocked?: boolean;
  onChange: (newValue: 'none' | 'free' | 'pro') => void;
}

const TriStateSwitch: React.FC<TriStateSwitchProps> = ({
  value,
  isTransitioning = false,
  isError = false,
  isProDisabled = false,
  proDisabledReason,
  isLocked = false,
  onChange,
}) => {
  const options: { key: 'none' | 'free' | 'pro'; label: string }[] = [
    { key: 'none', label: '关闭' },
    { key: 'free', label: 'Free版' },
    { key: 'pro', label: 'Pro版' },
  ];

  // 计算滑块位置
  const getSliderPosition = () => {
    switch (value) {
      case 'none': return 'left-0.5';
      case 'free': return 'left-[calc(33.33%+1px)]';
      case 'pro': return 'left-[calc(66.66%+2px)]';
      default: return 'left-0.5';
    }
  };

  // 计算滑块背景色
  const getSliderBg = () => {
    if (isTransitioning) return 'bg-blue-500';
    if (isError) return 'bg-red-500';
    switch (value) {
      case 'none': return 'bg-gray-500';
      case 'free': return 'bg-blue-500';
      case 'pro': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const handleClick = (key: 'none' | 'free' | 'pro') => {
    if (isTransitioning) return;
    if (isLocked) return;
    if (key === value) return;
    // Pro 禁用时不可切换到 Pro
    if (key === 'pro' && isProDisabled) return;
    // 不支持从 Pro 切换到 Free
    if (value === 'pro' && key === 'free') return;
    onChange(key);
  };

  return (
    <div className={`relative inline-flex items-center h-8 bg-gray-100 rounded-full p-0.5 w-[200px] ${isLocked ? 'opacity-60' : ''}`}>
      {/* 滑块。
          isTransitioning（开启中/关闭中）与 isLocked（插件升级中）共用同一份 loading 视觉：
          滑块内只显示一个旋转图标，对应档位的标签文字同步隐藏，避免双重 loading。
          差异仅在档位含义：transitioning 表示档位正在切换；locked 表示档位不变、仅有后台任务。 */}
      <div
        className={`absolute h-7 w-[calc(33.33%-2px)] rounded-full transition-all duration-200 ${getSliderPosition()} ${getSliderBg()}`}
      >
        {(isTransitioning || isLocked) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          </div>
        )}
      </div>
      
      {/* 选项 */}
      {options.map((opt) => {
        const isActive = value === opt.key;
        const isDisabled = isTransitioning || isLocked ||
          (opt.key === 'pro' && isProDisabled) || 
          (value === 'pro' && opt.key === 'free'); // Pro 不能降级到 Free
        
        // Pro 选项且被禁用时显示 tooltip
        if (opt.key === 'pro' && isProDisabled && !isTransitioning) {
          return (
            <Tooltip key={opt.key}>
              <TooltipTrigger asChild>
                <button
                  className={`relative z-10 flex-1 h-7 text-xs font-medium rounded-full transition-colors
                    ${isActive ? 'text-white' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  {opt.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {proDisabledReason || '不可用'}
              </TooltipContent>
            </Tooltip>
          );
        }
        
        return (
          <button
            key={opt.key}
            onClick={() => handleClick(opt.key)}
            disabled={isDisabled}
            className={`relative z-10 flex-1 h-7 text-xs font-medium rounded-full transition-colors
              ${isActive 
                ? ((isTransitioning || isLocked) ? 'text-white/80' : 'text-white') 
                : isDisabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            {isActive && (isTransitioning || isLocked) ? '' : opt.label}
          </button>
        );
      })}
    </div>
  );
};

export interface OcInstance {
  id: string;
  name: string;
  // 兼容旧的 memoryStatus 字段
  memoryStatus: MemoryStatus;
  // 新增：版本和状态分离
  version: MemoryVersion;
  state: MemoryState;
  memoryId: string;
  enabledAt: string;
  creator?: string;
  errorMessage?: string; // 异常状态时的错误信息
  // Agent 类型：用于在列表中显示对应展示文案（见 AGENT_TYPE_DISPLAY）。
  // 当前仅 OpenClaw / Hermes 支持记忆服务，其它类型不应进入本列表。
  // 未设置时默认视作 openclaw。
  agentType?: 'openclaw' | 'hermes' | string;
  // 记忆插件是否正在异步升级中。与 memoryStatus 解耦：
  // 升级过程不改变 Free / Pro 版本档位，仅在"记忆管理"列叠加一个 loading，
  // 并在升级完成前禁用该实例的一切操作（切换版本、勾选批量等）。
  isPluginUpgrading?: boolean;
}

// 辅助函数：从 memoryStatus 解析出 version 和 state
export function parseMemoryStatus(status: MemoryStatus): { version: MemoryVersion; state: MemoryState } {
  switch (status) {
    case 'none':
      return { version: 'none', state: 'idle' };
    case 'free-enabling':
      return { version: 'free', state: 'enabling' };
    case 'free':
      return { version: 'free', state: 'running' };
    case 'pro-enabling':
      return { version: 'pro', state: 'enabling' };
    case 'pro':
      return { version: 'pro', state: 'running' };
    case 'closing':
      return { version: 'none', state: 'closing' };
    case 'error':
      return { version: 'none', state: 'error' };
    default:
      return { version: 'none', state: 'idle' };
  }
}

interface InstanceTableProps {
  instances: OcInstance[];
  loading?: boolean;
  isProActive?: boolean; // Pro 服务是否已开通
  proSpacesAvailable?: number; // Pro 剩余可用空间数
  onOpenDetail?: (instance: OcInstance) => void;
  onEnableFree?: (instance: OcInstance) => void | Promise<void>;
  // 开启 Pro（若当前是 Free，自动处理数据迁移）
  onEnablePro?: (instance: OcInstance) => void | Promise<void>;
  onDisableMemory?: (instance: OcInstance) => void | Promise<void>;
  // 批量操作回调
  onBatchEnableFree?: (instances: OcInstance[]) => void | Promise<void>;
  onBatchEnablePro?: (instances: OcInstance[]) => void | Promise<void>;
  onBatchDisable?: (instances: OcInstance[]) => void | Promise<void>;
  // 列表工具栏右侧（搜索框左侧）可插入的自定义操作区，用于承载"一键升级记忆插件"等全局入口
  toolbarRight?: React.ReactNode;
}

export const InstanceTable: React.FC<InstanceTableProps> = ({
  instances,
  loading = false,
  isProActive = false,
  proSpacesAvailable = 0,
  onOpenDetail,
  onEnableFree,
  onEnablePro,
  onDisableMemory,
  onBatchEnableFree,
  onBatchEnablePro,
  onBatchDisable,
  toolbarRight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  
  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Gmail 风格：是否选择了全部（跨页）
  const [isSelectAll, setIsSelectAll] = useState(false);
  
  // 记忆状态筛选（合并版本和状态）
  const [selectedMemoryStates, setSelectedMemoryStates] = useState<Set<string>>(new Set(['none', 'free', 'pro', 'transitioning']));
  const [tempSelectedMemoryStates, setTempSelectedMemoryStates] = useState<Set<string>>(new Set(['none', 'free', 'pro', 'transitioning']));
  const [showMemoryFilter, setShowMemoryFilter] = useState(false);
  const [memoryFilterPosition, setMemoryFilterPosition] = useState<{ top: number; left: number } | null>(null);
  const memoryFilterButtonRef = useRef<HTMLButtonElement>(null);
  
  // 弹窗相关状态
  const [dialogType, setDialogType] = useState<DialogType>('none');
  const [targetInstance, setTargetInstance] = useState<OcInstance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const PAGE_SIZE = 10;

  // 将 Set 转为可序列化字符串用于依赖检测
  const selectedMemoryStatesKey = Array.from(selectedMemoryStates).sort().join(',');
  
  // 过滤和分页
  const filteredList = useMemo(() => {
    return instances.filter((oc) => {
      const matchSearch =
        oc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        oc.id.includes(searchQuery);
      
      const { version, state } = parseMemoryStatus(oc.memoryStatus);
      
      // 记忆状态筛选（简化为：未开启、Free 版、Pro 版）
      // 过渡态的实例按其目标版本归类
      let matchMemoryState = false;
      if (state === 'idle' || state === 'error') {
        matchMemoryState = selectedMemoryStates.has('none');
      } else if (version === 'free') {
        // Free 版（包括 running 和过渡态）
        matchMemoryState = selectedMemoryStates.has('free');
      } else if (version === 'pro') {
        // Pro 版（包括 running 和过渡态）
        matchMemoryState = selectedMemoryStates.has('pro');
      } else {
        matchMemoryState = selectedMemoryStates.has('none');
      }
      
      return matchSearch && matchMemoryState;
    });
  }, [instances, searchQuery, selectedMemoryStatesKey, selectedMemoryStates]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const paginatedList = filteredList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('列表已刷新');
    }, 1000);
  };

  // 批量选择逻辑
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // 选中当前页所有可操作的实例（排除过渡态 / 插件升级中）
      const selectableIds = paginatedList
        .filter(oc => {
          const { state } = parseMemoryStatus(oc.memoryStatus);
          return state !== 'enabling' && state !== 'closing' && !oc.isPluginUpgrading;
        })
        .map(oc => oc.id);
      setSelectedIds(new Set(selectableIds));
      setIsSelectAll(false); // 重置全选状态
    } else {
      setSelectedIds(new Set());
      setIsSelectAll(false);
    }
  };

  // Gmail 风格：选择全部（跨页）
  const handleSelectAllPages = () => {
    // 选中所有可操作的实例
    const allSelectableIds = filteredList
      .filter(oc => {
        const { state } = parseMemoryStatus(oc.memoryStatus);
        return state !== 'enabling' && state !== 'closing' && !oc.isPluginUpgrading;
      })
      .map(oc => oc.id);
    setSelectedIds(new Set(allSelectableIds));
    setIsSelectAll(true);
  };

  // Gmail 风格：清除选择
  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectAll(false);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
      setIsSelectAll(false); // 取消单个选择时，清除全选状态
    }
    setSelectedIds(newSet);
  };

  // 获取当前选中的实例
  const selectedInstances = instances.filter(i => selectedIds.has(i.id));
  
  // 判断当前页是否全选
  const selectableInPage = paginatedList.filter(oc => {
    const { state } = parseMemoryStatus(oc.memoryStatus);
    return state !== 'enabling' && state !== 'closing' && !oc.isPluginUpgrading;
  });
  const isAllSelected = selectableInPage.length > 0 && selectableInPage.every(oc => selectedIds.has(oc.id));
  const isPartialSelected = selectableInPage.some(oc => selectedIds.has(oc.id)) && !isAllSelected;

  // Gmail 风格：计算全部可选择的实例数（跨页）
  const allSelectableInstances = filteredList.filter(oc => {
    const { state } = parseMemoryStatus(oc.memoryStatus);
    return state !== 'enabling' && state !== 'closing' && !oc.isPluginUpgrading;
  });
  const totalSelectableCount = allSelectableInstances.length;
  
  // 是否显示「选择全部」提示条：当前页全选了，且还有更多可选
  const showSelectAllBanner = isAllSelected && selectedIds.size < totalSelectableCount && totalSelectableCount > selectableInPage.length;

  // 批量操作 - 打开确认弹窗
  const handleBatchEnableFree = () => {
    // 筛选出可以开启 Free 的实例（未开启的）
    const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'none');
    if (eligibleInstances.length === 0) {
      toast.warning('请选择未开启记忆的实例');
      return;
    }
    // 打开批量开启 Free 确认弹窗
    setDialogType('batch-enable-free');
  };

  const handleBatchEnablePro = () => {
    // 筛选出可以升级 Pro 的实例（未开启或 Free）
    const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'none' || i.memoryStatus === 'free');
    if (eligibleInstances.length === 0) {
      toast.warning('请选择未开启或 Free 版的实例');
      return;
    }
    if (!isProActive) {
      toast.error('请先开通 Memory Pro 服务');
      return;
    }
    if (eligibleInstances.length > proSpacesAvailable) {
      toast.error(`记忆空间不足，当前剩余 ${proSpacesAvailable} 个，需要 ${eligibleInstances.length} 个`);
      return;
    }
    // 打开批量升级 Pro 确认弹窗
    setDialogType('batch-enable-pro');
  };

  const handleBatchDisable = () => {
    // 筛选出可以关闭的实例（已开启 Free 或 Pro）
    const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'free' || i.memoryStatus === 'pro');
    if (eligibleInstances.length === 0) {
      toast.warning('请选择已开启记忆的实例');
      return;
    }
    // 打开批量关闭确认弹窗
    setDialogType('batch-disable');
  };

  // 批量升级记忆插件：已迁移到顶部"一键升级"全局入口，此处不再保留行内/工具栏入口。

  // 打开确认弹窗
  const openDialog = (type: DialogType, instance: OcInstance) => {
    setTargetInstance(instance);
    setDialogType(type);
  };

  // 关闭弹窗
  const closeDialog = () => {
    if (isProcessing) return;
    setDialogType('none');
    setTargetInstance(null);
  };

  // 执行状态变更
  const executeStatusChange = async () => {
    setIsProcessing(true);
    try {
      // 批量操作
      if (dialogType === 'batch-enable-free') {
        const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'none');
        closeDialog();
        setIsProcessing(false);
        setSelectedIds(new Set());
        onBatchEnableFree?.(eligibleInstances);
        return;
      }
      if (dialogType === 'batch-enable-pro') {
        const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'none' || i.memoryStatus === 'free');
        closeDialog();
        setIsProcessing(false);
        setSelectedIds(new Set());
        onBatchEnablePro?.(eligibleInstances);
        return;
      }
      if (dialogType === 'batch-disable') {
        const eligibleInstances = selectedInstances.filter(i => i.memoryStatus === 'free' || i.memoryStatus === 'pro');
        closeDialog();
        setIsProcessing(false);
        setSelectedIds(new Set());
        onBatchDisable?.(eligibleInstances);
        return;
      }

      // 单实例操作
      if (!targetInstance) return;
      
      // 根据弹窗类型调用对应的回调
      switch (dialogType) {
        case 'enable-free':
          // 开启 Free 是异步操作，弹窗立即关闭
          closeDialog();
          setIsProcessing(false);
          onEnableFree?.(targetInstance);
          return;
        case 'enable-pro':
          // 开启 Pro 是异步操作（若当前是 Free，自动迁移数据），弹窗立即关闭
          closeDialog();
          setIsProcessing(false);
          onEnablePro?.(targetInstance);
          return;
        case 'disable':
          await onDisableMemory?.(targetInstance);
          break;
      }
      closeDialog();
    } catch (error) {
      console.error('状态变更失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 确认弹窗组件
  const ConfirmDialog = () => {
    if (dialogType === 'none') return null;
    
    // 关闭弹窗的确认文字输入
    const [confirmText, setConfirmText] = useState('');
    
    // 批量操作时的实例统计
    const batchStats = {
      enableFree: selectedInstances.filter(i => i.memoryStatus === 'none'),
      enablePro: selectedInstances.filter(i => i.memoryStatus === 'none' || i.memoryStatus === 'free'),
      disable: selectedInstances.filter(i => i.memoryStatus === 'free' || i.memoryStatus === 'pro'),
    };
    const hasProInDisable = selectedInstances.some(i => i.memoryStatus === 'pro');
    
    const getDialogConfig = () => {
      // 批量开启 Free
      if (dialogType === 'batch-enable-free') {
        const count = batchStats.enableFree.length;
        return {
          title: '批量开启 Memory Free',
          content: (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm leading-relaxed">
                即将为 <span className="font-semibold text-gray-900">{count}</span> 个 Agent 开启 Memory Free 服务。
              </p>
              <div className="p-3 bg-blue-50 rounded-[4px] border border-blue-100">
                <p className="text-blue-700 text-sm">开启后将重启相关 Gateway 服务，届时会有短暂的服务中断。</p>
              </div>
              {selectedInstances.length > count && (
                <p className="text-xs text-gray-500">
                  注：已选中 {selectedInstances.length} 个 Agent，其中 {selectedInstances.length - count} 个已开启记忆，将被跳过。
                </p>
              )}
            </div>
          ),
          confirmText: '确认开启',
          confirmClass: 'bg-blue-500 hover:bg-blue-600',
          confirmDisabled: false,
        };
      }
      
      // 批量升级 Pro
      if (dialogType === 'batch-enable-pro') {
        const count = batchStats.enablePro.length;
        const fromFreeCount = batchStats.enablePro.filter(i => i.memoryStatus === 'free').length;
        return {
          title: '开启 Memory Pro',
          content: (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm leading-relaxed">
                确认为 <span className="font-semibold text-gray-900">{count}</span> 个 Agent 开启 Memory Pro 服务？
              </p>
              {fromFreeCount > 0 && (
                <p className="text-gray-500 text-sm leading-relaxed">
                  其中 {fromFreeCount} 个 Agent 将从 Free 版升级，数据将自动迁移。
                </p>
              )}
              <p className="text-gray-500 text-sm leading-relaxed">
                开启后将重启 Gateway 服务，届时会有短暂的服务中断。
              </p>
              <div className="p-3 bg-amber-50 rounded-[4px] border border-amber-200">
                <p className="text-amber-700 text-sm">开启 Pro 版后不支持回退到 Free 版</p>
              </div>
              {selectedInstances.length > count && (
                <p className="text-xs text-gray-500">
                  注：已选中 {selectedInstances.length} 个 Agent，其中 {selectedInstances.length - count} 个已是 Pro 版，将被跳过。
                </p>
              )}
            </div>
          ),
          confirmText: '确认开启',
          confirmClass: 'bg-blue-500 hover:bg-blue-600',
          confirmDisabled: false,
        };
      }
      
      // 批量关闭
      if (dialogType === 'batch-disable') {
        const count = batchStats.disable.length;
        const proCount = batchStats.disable.filter(i => i.memoryStatus === 'pro').length;
        const freeCount = count - proCount;
        return {
          title: '批量关闭 Memory 服务',
          content: (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm leading-relaxed">
                即将关闭 <span className="font-semibold text-gray-900">{count}</span> 个 Agent 的 Memory 服务。
              </p>
              {proCount > 0 && freeCount > 0 && (
                <p className="text-gray-500 text-sm">
                  包含 {proCount} 个 Pro 版、{freeCount} 个 Free 版实例。
                </p>
              )}
              <div className="p-3 bg-blue-50 rounded-[4px] border border-blue-100">
                <p className="text-blue-700 text-sm">关闭后将重启相关 Gateway 服务，届时会有短暂的服务中断。</p>
              </div>
              {hasProInDisable ? (
                <div className="p-3 bg-red-50 rounded-[4px] border border-red-200">
                  <p className="text-red-600 text-sm font-medium">
                    {proCount > 0 ? `${proCount} 个 Pro 版实例的` : ''}所有记忆数据将被清除，此操作不可恢复
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm leading-relaxed">
                  Free 版实例的记忆数据将保留在本地，重新开启后可继续使用。
                </p>
              )}
              {/* 二次确认输入框 */}
              <div className="pt-2">
                <label className="block text-sm text-gray-700 mb-2">
                  请输入「<span className="font-medium text-red-600">关闭</span>」以确认：
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="请输入「关闭」"
                  className="w-full px-3 py-2 border border-gray-300 rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              {selectedInstances.length > count && (
                <p className="text-xs text-gray-500">
                  注：已选中 {selectedInstances.length} 个 Agent，其中 {selectedInstances.length - count} 个未开启记忆，将被跳过。
                </p>
              )}
            </div>
          ),
          confirmText: '确认关闭',
          confirmClass: 'bg-red-500 hover:bg-red-600 disabled:bg-red-300',
          confirmDisabled: confirmText !== '关闭',
        };
      }

      // 单实例操作
      if (!targetInstance) return null;
      
      const { version } = parseMemoryStatus(targetInstance.memoryStatus);
      const isFromFree = version === 'free';
      const isProVersion = targetInstance.memoryStatus === 'pro';
      
      switch (dialogType) {
        case 'enable-free':
          return {
            title: '开启 Memory Free',
            content: (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm leading-relaxed">
                  确认为 Agent「<span className="font-medium text-gray-900">{targetInstance.name}</span>」开启 Memory Free 服务？
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  开启后将重启 Gateway 服务，届时会有短暂的服务中断。
                </p>
              </div>
            ),
            confirmText: '确认开启',
            confirmClass: 'bg-blue-500 hover:bg-blue-600',
            confirmDisabled: false,
          };
        case 'enable-pro': {
          return {
            title: '开启 Memory Pro',
            content: (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm leading-relaxed">
                  确认为 Agent「<span className="font-medium text-gray-900">{targetInstance.name}</span>」开启 Memory Pro 服务？
                </p>
                {isFromFree && (
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Free 版的记忆数据将自动迁移到 Pro 版。
                  </p>
                )}
                <p className="text-gray-500 text-sm leading-relaxed">
                  开启后将重启 Gateway 服务，届时会有短暂的服务中断。
                </p>

                <div className="p-3 bg-amber-50 rounded-[4px] border border-amber-200">
                  <p className="text-amber-700 text-sm">开启 Pro 版后不支持回退到 Free 版</p>
                </div>
              </div>
            ),
            confirmText: '确认开启',
            confirmClass: 'bg-blue-500 hover:bg-blue-600',
            confirmDisabled: false,
          };
        }
        case 'disable': {
          return {
            title: '关闭 Memory 服务',
            content: (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm leading-relaxed">
                  确认关闭 Agent「<span className="font-medium text-gray-900">{targetInstance.name}</span>」的 Memory 服务？
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  关闭后将重启 Gateway 服务，届时会有短暂的服务中断。
                </p>
                {isProVersion ? (
                  <div className="p-3 bg-red-50 rounded-[4px] border border-red-200">
                    <p className="text-red-600 text-sm font-medium">所有记忆数据将被清除，此操作不可恢复</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm leading-relaxed">
                    记忆数据将保留在本地，重新开启后可继续使用。
                  </p>
                )}
                {/* 二次确认输入框 */}
                <div className="pt-2">
                  <label className="block text-sm text-gray-700 mb-2">
                    请输入「<span className="font-medium text-red-600">关闭</span>」以确认：
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="请输入「关闭」"
                    className="w-full px-3 py-2 border border-gray-300 rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            ),
            confirmText: '确认关闭',
            confirmClass: 'bg-red-500 hover:bg-red-600 disabled:bg-red-300',
            confirmDisabled: confirmText !== '关闭',
          };
        }
        default:
          return null;
      }
    };

    const config = getDialogConfig();
    if (!config) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div 
          className="bg-white rounded-[4px] w-[420px] max-w-[90vw] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
            <button
              onClick={closeDialog}
              disabled={isProcessing}
              className="p-1 rounded-[4px] hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* 弹窗内容 */}
          <div className="px-6 py-5">
            {config.content}
          </div>
          
          {/* 弹窗底部 */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={closeDialog}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-[4px] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={executeStatusChange}
              disabled={isProcessing || config.confirmDisabled}
              className={`px-4 py-2 text-sm font-medium text-white rounded-[4px] transition-colors disabled:opacity-70 flex items-center gap-2 ${config.confirmClass}`}
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {config.confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 筛选变化重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMemoryStates]);

  // 记忆状态筛选选项配置
  const memoryFilterOptions = [
    { key: 'none', label: '关闭' },
    { key: 'free', label: 'Free版' },
    { key: 'pro', label: 'Pro版' },
  ];

  return (
    <div
      className="bg-white rounded-[4px] border border-gray-100 relative overflow-hidden"
      style={{ boxShadow: '0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)' }}
    >
      {/* 加载遮罩 */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-[4px] z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>正在加载实例状态...</span>
          </div>
        </div>
      )}

      {/* 工具栏 - 符合设计规范的 header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-900">记忆空间列表</h2>
          {/* 批量操作按钮 - 常驻显示 */}
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
            {(() => {
              // 统计选中实例的状态分布
              const noneCount = selectedInstances.filter(i => i.memoryStatus === 'none').length;
              const freeCount = selectedInstances.filter(i => i.memoryStatus === 'free').length;
              const proCount = selectedInstances.filter(i => i.memoryStatus === 'pro').length;
              // 是否有选中且可操作的实例
              const canEnableFree = noneCount > 0;
              const canEnablePro = (noneCount > 0 || freeCount > 0);
              const canDisable = (freeCount > 0 || proCount > 0);
              const hasSelection = selectedIds.size > 0;
              
              return (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleBatchEnableFree}
                        disabled={!hasSelection || !canEnableFree}
                        className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                          hasSelection && canEnableFree
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        批量开通 Free 版{canEnableFree ? `（${noneCount}）` : ''}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {!hasSelection 
                        ? '请先勾选实例' 
                        : !canEnableFree 
                          ? '所选实例均已开通记忆服务'
                          : `为 ${noneCount} 个未开启的实例开通 Free 版`}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleBatchEnablePro}
                        disabled={!hasSelection || !canEnablePro || !isProActive}
                        className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                          hasSelection && canEnablePro && isProActive
                            ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                            : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        批量开通 Pro 版{canEnablePro ? `（${noneCount + freeCount}）` : ''}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {!hasSelection 
                        ? '请先勾选实例' 
                        : !isProActive 
                          ? '请先开通 Memory Pro 服务' 
                          : !canEnablePro
                            ? '所选实例均已开通 Pro 版'
                            : `为 ${noneCount + freeCount} 个实例开通 Pro 版`}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleBatchDisable}
                        disabled={!hasSelection || !canDisable}
                        className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                          hasSelection && canDisable
                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                            : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        }`}
                      >
                        批量关闭{canDisable ? `（${freeCount + proCount}）` : ''}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {!hasSelection 
                        ? '请先勾选实例' 
                        : !canDisable 
                          ? '所选实例均未开通记忆服务'
                          : `关闭 ${freeCount + proCount} 个实例的记忆服务${proCount > 0 ? `（含 ${proCount} 个 Pro 版）` : ''}`}
                    </TooltipContent>
                  </Tooltip>
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {/* 自定义工具栏右侧（位于搜索框左侧）：承载一键升级记忆插件等全局入口 */}
          {toolbarRight}
          {/* 搜索框 - 符合设计规范 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索 Agent 名称或 ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white w-64"
              disabled={loading}
            />
          </div>

          {/* 刷新按钮 - 符合设计规范 */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="w-9 h-9 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 表格 - 使用原生 table */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50 relative">
              {/* 全选复选框 */}
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className={isPartialSelected ? 'data-[state=checked]:bg-blue-500' : ''}
                  ref={(el) => {
                    if (el) {
                      // 设置 indeterminate 状态
                      const input = el.querySelector('button');
                      if (input) {
                        (input as any).dataset.state = isPartialSelected ? 'indeterminate' : (isAllSelected ? 'checked' : 'unchecked');
                      }
                    }
                  }}
                />
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 tracking-wide" style={{ width: '30%' }}>
                <span>Agent 名称/ID</span>
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '25%' }}>
                创建人
              </th>
              {/* Agent 类型 —— 与管控端 Agent 列表保持一致：纯灰色文本，不使用 Badge / 颜色，避免视觉权重抢戏 */}
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 normal-case" style={{ width: '13%' }}>
                Agent 类型
              </th>
              {/* 记忆管理 - 带筛选 */}
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '32%' }}>
                <div className="flex items-center gap-2 relative z-40">
                  记忆管理
                  <button
                    ref={memoryFilterButtonRef}
                    className="p-1 hover:bg-gray-200 rounded"
                    onClick={() => {
                      if (memoryFilterButtonRef.current) {
                        const rect = memoryFilterButtonRef.current.getBoundingClientRect();
                        // 使用 fixed 定位时，直接使用 getBoundingClientRect 的值，不需要加 scrollY/scrollX
                        setMemoryFilterPosition({
                          top: rect.bottom + 8,
                          left: rect.left
                        });
                      }
                      setTempSelectedMemoryStates(new Set(selectedMemoryStates));
                      setShowMemoryFilter(!showMemoryFilter);
                    }}
                  >
                    <Filter className={`w-3.5 h-3.5 ${selectedMemoryStates.size < 3 ? 'text-blue-500' : 'text-gray-400'}`} />
                  </button>
                  {showMemoryFilter && memoryFilterPosition && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowMemoryFilter(false)}
                        style={{ pointerEvents: 'auto' }}
                      />
                      <div 
                        className="fixed w-48 bg-white border border-gray-200 rounded-[4px] shadow-2xl z-50 will-change-transform" 
                        style={{
                          top: `${memoryFilterPosition.top}px`,
                          left: `${memoryFilterPosition.left}px`,
                          pointerEvents: 'auto'
                        }}
                      >
                        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                          {memoryFilterOptions.map((opt) => (
                            <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tempSelectedMemoryStates.has(opt.key)}
                                onChange={(e) => {
                                  const newSet = new Set(tempSelectedMemoryStates);
                                  if (e.target.checked) {
                                    newSet.add(opt.key);
                                  } else {
                                    newSet.delete(opt.key);
                                  }
                                  setTempSelectedMemoryStates(newSet);
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 normal-case">
                                {opt.label}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="border-t border-gray-100 p-2 flex gap-2">
                          <button
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-[4px] hover:bg-gray-50"
                            onClick={() => {
                              setTempSelectedMemoryStates(new Set(['none', 'free', 'pro']));
                            }}
                          >
                            重置
                          </button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedMemoryStates(new Set(tempSelectedMemoryStates));
                              setShowMemoryFilter(false);
                              setCurrentPage(1);
                            }}
                          >
                            确认
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          {/* Gmail 风格：选择全部提示条 */}
          {(showSelectAllBanner || isSelectAll) && (
            <tbody>
              <tr>
                <td colSpan={5} className="px-0 py-0">
                  <div className="bg-blue-50 border-b border-blue-100 px-6 py-2.5 text-center text-sm">
                    {isSelectAll ? (
                      <span className="text-blue-700">
                        已选择全部 <strong>{selectedIds.size}</strong> 个 Agent。
                        <button
                          onClick={handleClearSelection}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
                        >
                          清除选择
                        </button>
                      </span>
                    ) : (
                      <span className="text-blue-700">
                        已选择此页 <strong>{selectableInPage.length}</strong> 个实例。
                        <button
                          onClick={handleSelectAllPages}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
                        >
                          选择全部 {totalSelectableCount} 个 Agent
                        </button>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          )}
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : paginatedList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                  暂无符合条件的实例
                </td>
              </tr>
            ) : (
              paginatedList.map((oc) => {
                const { version, state } = parseMemoryStatus(oc.memoryStatus);
                
                // 判断是否处于过渡态（开启中/关闭中）
                const isMemoryTransitioning = state === 'enabling' || state === 'closing';
                // 插件升级中（异步任务）——不改变记忆版本，但需要禁用所有行内操作
                const isPluginUpgrading = !!oc.isPluginUpgrading;
                // 对外统一视为"过渡态"，复用现有 UI 禁用逻辑
                const isTransitioning = isMemoryTransitioning || isPluginUpgrading;
                // 判断是否异常
                const isError = state === 'error';
                
                // 计算 Switch 当前显示的值
                const getSwitchValue = (): 'none' | 'free' | 'pro' => {
                  if (state === 'closing') return 'none'; // 关闭中显示在未开启位置
                  if (version === 'free' && (state === 'running' || state === 'enabling')) return 'free';
                  if (version === 'pro' && (state === 'running' || state === 'enabling')) return 'pro';
                  return 'none';
                };
                
                // Pro 按钮禁用原因
                const getProDisabledReason = () => {
                  if (version === 'pro' && state === 'running') return null; // Pro 已开启
                  if (!isProActive) return '请先开通 Memory Pro 服务';
                  if (proSpacesAvailable <= 0) return '记忆空间不足';
                  return null;
                };
                const proDisabledReason = getProDisabledReason();
                const isProDisabled = !!proDisabledReason;
                
                // 处理 Switch 切换
                const handleSwitchChange = (newValue: 'none' | 'free' | 'pro') => {
                  const currentValue = getSwitchValue();
                  if (newValue === currentValue) return;
                  
                  if (newValue === 'none') {
                    // 切换到未开启 = 关闭
                    openDialog('disable', oc);
                  } else if (newValue === 'free') {
                    // 切换到 Free
                    openDialog('enable-free', oc);
                  } else if (newValue === 'pro') {
                    // 切换到 Pro（可能是从 none 或 free）
                    openDialog('enable-pro', oc);
                  }
                };
                
                return (
                  <tr key={oc.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* 复选框 */}
                    <td className="w-12 px-4 py-4">
                      <Checkbox
                        checked={selectedIds.has(oc.id)}
                        onCheckedChange={(checked) => handleSelectOne(oc.id, !!checked)}
                        disabled={isTransitioning}
                      />
                    </td>
                    {/* 名称/ID */}
                    <td className="px-6 py-4" style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{oc.name}</div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-xs break-all">{oc.name}</TooltipContent>
                          </Tooltip>
                          {onOpenDetail ? (
                            <button
                              onClick={() => onOpenDetail(oc)}
                              className="text-xs font-mono cursor-pointer text-blue-500 hover:text-blue-700 hover:underline"
                            >
                              {oc.id}
                            </button>
                          ) : (
                            <span className="text-xs font-mono text-blue-500">{oc.id}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* 创建人 */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {oc.creator || '—'}
                    </td>
                    {/* Agent 类型 —— 复用 AGENT_TYPE_DISPLAY 映射，未配置或未知值时回退展示原值 */}
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium text-gray-500">
                        {AGENT_TYPE_DISPLAY[oc.agentType ?? 'openclaw'] ?? (oc.agentType ?? 'OpenClaw')}
                      </span>
                    </td>
                    {/* 记忆管理 - 三态 Switch
                        插件升级中（isLocked）：与「开通中」视觉一致，spinner 直接叠在 Pro 档位标签左侧；
                        档位文字保留，提示用户当前版本未变、仅是后台异步任务在跑。 */}
                    <td className="px-6 py-4">
                      <TriStateSwitch
                        value={getSwitchValue()}
                        isTransitioning={isMemoryTransitioning}
                        isError={isError}
                        isProDisabled={isProDisabled}
                        proDisabledReason={proDisabledReason || undefined}
                        isLocked={isPluginUpgrading}
                        onChange={handleSwitchChange}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 底部：翻页 - 与 Agent 列表保持一致 */}
      {!loading && (
        <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            共 {filteredList.length} 条记录
            {filteredList.length > 0 && `，第 ${currentPage} / ${totalPages} 页`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400 px-2">第 {currentPage} 页</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog />
    </div>
  );
};
