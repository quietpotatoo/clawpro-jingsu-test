import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import TenantLayout from '@/components/TenantLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SurfaceCard, SurfaceInner } from '@/components/ui/Surface';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// 格式化下载量：>=1000 显示 x.xk，否则原样
function formatDownloadCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

// 获取名称首字符：英文返回大写字母，中文统一返回 'A'
function getSkillInitial(name: string): string | null {
  if (!name) return null;
  const firstChar = name.charAt(0);
  // 英文字母
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }
  // 中文标题统一用 A 替代
  return 'A';
}

// 为不同字母分配不同的渐变色
const LETTER_GRADIENTS: Record<string, string> = {
  A: 'from-blue-500 to-blue-600',
  B: 'from-green-500 to-green-600',
  C: 'from-purple-500 to-purple-600',
  D: 'from-indigo-500 to-indigo-600',
  E: 'from-orange-500 to-orange-600',
  F: 'from-pink-500 to-pink-600',
  G: 'from-teal-500 to-teal-600',
  H: 'from-cyan-500 to-cyan-600',
  I: 'from-blue-600 to-purple-600',
  J: 'from-emerald-500 to-emerald-600',
  K: 'from-violet-500 to-violet-600',
  L: 'from-rose-500 to-rose-600',
  M: 'from-amber-500 to-amber-600',
  N: 'from-blue-500 to-indigo-600',
  O: 'from-green-500 to-teal-600',
  P: 'from-purple-500 to-indigo-600',
  Q: 'from-red-500 to-red-600',
  R: 'from-sky-500 to-sky-600',
  S: 'from-fuchsia-500 to-fuchsia-600',
  T: 'from-lime-500 to-lime-600',
  U: 'from-blue-500 to-cyan-600',
  V: 'from-violet-500 to-purple-600',
  W: 'from-orange-500 to-red-500',
  X: 'from-gray-500 to-gray-600',
  Y: 'from-yellow-500 to-yellow-600',
  Z: 'from-stone-500 to-stone-600',
};

function getLetterGradient(letter: string): string {
  return LETTER_GRADIENTS[letter] || 'from-purple-500 to-purple-600';
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Code,
  Eye,
  Download,
  Loader,
  RefreshCw,
  Puzzle,
  CheckCircle,
  XCircle,
  Circle,
  Clock,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

// 复用管控端数据和组件
import { MOCK_SKILLS, DEFAULT_CATEGORIES, MOCK_OPENCLAW_INSTANCES } from '../admin/SkillLibrary/mockData';
import { type Skill, type DistributionStatus, DISTRIBUTION_STATUS_MAP } from '../admin/SkillLibrary/types';
import {
  getDistributionRecords,
  addDistributionRecord,
  updateDistributionRecord,
  createDistributionRecordId,
  initMockDistributionRecords,
  type CachedDistributionRecord,
} from '../admin/SkillLibrary/distributionCache';
import { downloadSkillAsZip } from '../admin/SkillLibrary/downloadUtils';
import BatchDistributeDialog from '../admin/SkillLibrary/BatchDistributeDialog';
import MDXRenderer from '@/components/MDXRenderer';

// 懒加载 react-syntax-highlighter
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(mod => ({ default: mod.Light as any }))
);
const loadedLanguages = new Set<string>();
const registerLanguage = async (lang: string) => {
  if (loadedLanguages.has(lang)) return;
  loadedLanguages.add(lang);
  try {
    const mod = await import('react-syntax-highlighter');
    const Light = mod.Light as any;
    const langModules: Record<string, () => Promise<any>> = {
      xml: () => import('react-syntax-highlighter/dist/esm/languages/hljs/xml'),
      json: () => import('react-syntax-highlighter/dist/esm/languages/hljs/json'),
      yaml: () => import('react-syntax-highlighter/dist/esm/languages/hljs/yaml'),
      python: () => import('react-syntax-highlighter/dist/esm/languages/hljs/python'),
      javascript: () => import('react-syntax-highlighter/dist/esm/languages/hljs/javascript'),
      typescript: () => import('react-syntax-highlighter/dist/esm/languages/hljs/typescript'),
      bash: () => import('react-syntax-highlighter/dist/esm/languages/hljs/bash'),
      css: () => import('react-syntax-highlighter/dist/esm/languages/hljs/css'),
      ini: () => import('react-syntax-highlighter/dist/esm/languages/hljs/ini'),
      markdown: () => import('react-syntax-highlighter/dist/esm/languages/hljs/markdown'),
    };
    const loader = langModules[lang];
    if (loader) {
      const langMod = await loader();
      Light.registerLanguage(lang, langMod.default);
    }
  } catch { /* 静默降级 */ }
};

// hljs 亮色主题
const hljsStyle: Record<string, React.CSSProperties> = {
  'hljs': { display: 'block', overflowX: 'auto', padding: '1em', background: '#ffffff', color: '#383a42' },
  'hljs-comment': { color: '#a0a1a7', fontStyle: 'italic' },
  'hljs-quote': { color: '#a0a1a7', fontStyle: 'italic' },
  'hljs-keyword': { color: '#a626a4' },
  'hljs-selector-tag': { color: '#a626a4' },
  'hljs-addition': { color: '#50a14f' },
  'hljs-number': { color: '#986801' },
  'hljs-string': { color: '#50a14f' },
  'hljs-meta': { color: '#4078f2' },
  'hljs-literal': { color: '#0184bb' },
  'hljs-doctag': { color: '#a626a4' },
  'hljs-regexp': { color: '#50a14f' },
  'hljs-attr': { color: '#986801' },
  'hljs-attribute': { color: '#50a14f' },
  'hljs-builtin-name': { color: '#e45649' },
  'hljs-name': { color: '#e45649' },
  'hljs-section': { color: '#e45649' },
  'hljs-tag': { color: '#e45649' },
  'hljs-variable': { color: '#e45649' },
  'hljs-template-variable': { color: '#e45649' },
  'hljs-selector-id': { color: '#e45649' },
  'hljs-title': { color: '#4078f2' },
  'hljs-type': { color: '#4078f2' },
  'hljs-symbol': { color: '#4078f2' },
  'hljs-bullet': { color: '#4078f2' },
  'hljs-link': { color: '#4078f2' },
  'hljs-deletion': { color: '#e45649' },
  'hljs-emphasis': { fontStyle: 'italic' },
  'hljs-strong': { fontWeight: 'bold' },
};

// ========== Mock 用户身份（模拟当前用户所属分组） ==========
const CURRENT_USER_GROUP_IDS = ['grp-1', 'grp-2'];

// ========== Mock 下载量数据 ==========
const MOCK_DOWNLOAD_COUNTS: Record<string, number> = {
  'skill-0': 1286,
  'skill-1': 432,
  'skill-2': 867,
  'skill-3': 523,
  'skill-4': 198,
  'skill-5': 945,
  'skill-6': 312,
  'skill-7': 756,
  'skill-8': 89,
  'skill-9': 167,
};

// ========== 排序类型 ==========
type SortType = 'time' | 'downloads';
type ViewMode = 'card' | 'list';

// ========== 过滤可见技能（应用范围过滤） ==========
function getVisibleSkills(skills: Skill[], userGroupIds: string[]): Skill[] {
  return skills.filter(skill => {
    if (skill.scope === 'public') return true;
    // scope=private: 用户分组与技能分组有交集才可见
    if (skill.scope === 'private' && skill.groupIds.length > 0) {
      return skill.groupIds.some(gId => userGroupIds.includes(gId));
    }
    return false;
  });
}

export default function SkillSquare() {
  // 初始化预设下发记录（仅首次、localStorage为空时生效）
  useEffect(() => { initMockDistributionRecords(); }, []);

  // ========== 列表状态 ==========
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortType, setSortType] = useState<SortType>('time');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [skills] = useState<Skill[]>(MOCK_SKILLS);

  // ========== 详情状态 ==========
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<string>('overview');

  // 过滤可见技能
  const visibleSkills = useMemo(
    () => getVisibleSkills(skills, CURRENT_USER_GROUP_IDS),
    [skills]
  );

  // 搜索 + 分类筛选
  const filteredSkills = useMemo(() => {
    let result = visibleSkills;

    // 搜索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }

    // 分类筛选
    if (selectedCategory !== 'all') {
      result = result.filter(s => s.categories.includes(selectedCategory));
    }

    // 排序
    if (sortType === 'time') {
      result = [...result].sort(
        (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
      );
    } else {
      result = [...result].sort(
        (a, b) => (MOCK_DOWNLOAD_COUNTS[b.id] || 0) - (MOCK_DOWNLOAD_COUNTS[a.id] || 0)
      );
    }

    return result;
  }, [visibleSkills, searchQuery, selectedCategory, sortType]);

  // 刷新
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('列表已刷新');
    }, 1000);
  };

  // 如果选中了技能，渲染详情页
  if (selectedSkillId) {
    return (
      <TenantLayout>
        {/* 与「我的 Agent」(MyOpenClaw) 完全一致的外壳骨架：
              · min-w-[1200px] 兜底小屏（整体横滚不重排）
              · max-w-[1920px] mx-auto 大屏限宽（两侧自动均分留白）
              · 内层 flex：左右 w-20 (80px) 占位带 + 中间 flex-1 内容区，
                内容区内部用 px-[42px] py-8，与「我的 Agent」段落内边距对齐 */}
        <div className="min-w-[1200px] overflow-x-clip">
          <div className="max-w-[1920px] mx-auto flex items-stretch page-enter">
            <div aria-hidden className="shrink-0 w-20 self-stretch" />
            <div className="flex-1 min-w-0 px-[42px] py-8">
              <SkillSquareDetail
                skillId={selectedSkillId}
                skills={visibleSkills}
                onBack={() => { setSelectedSkillId(null); setInitialTab('overview'); }}
                initialTab={initialTab}
              />
            </div>
            <div aria-hidden className="shrink-0 w-20 self-stretch" />
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      {/* 与「我的 Agent」(MyOpenClaw) 完全一致的外壳骨架：
            · min-w-[1200px] 兜底小屏（整体横滚不重排）
            · max-w-[1920px] mx-auto 大屏限宽（两侧自动均分留白）
            · 内层 flex：左右 w-20 (80px) 占位带 + 中间 flex-1 内容区
            · 内容区内部用 px-[42px] py-8，与「我的 Agent」段落内边距对齐
            这样技能广场两侧留白与「我的 Agent」完全一致，不会比它更宽。 */}
      <div className="min-w-[1200px] overflow-x-clip">
        <div className="max-w-[1920px] mx-auto flex items-stretch page-enter">
          <div aria-hidden className="shrink-0 w-20 self-stretch" />
          <div className="flex-1 min-w-0 px-[42px] py-8">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">企业技能</h1>
          <p className="text-sm text-gray-500 mt-1">一键选装企业内的优质技能。</p>
        </div>

        {/* 搜索栏 + 筛选 */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          {/* 搜索框 — 加长 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索技能名称或描述..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          {/* 排序 */}
          <Select value={sortType} onValueChange={(v) => setSortType(v as SortType)}>
            <SelectTrigger className="w-32 bg-white">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">发布时间</SelectItem>
              <SelectItem value="downloads">下载量</SelectItem>
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <button
            onClick={handleRefresh}
            className="w-9 h-9 rounded-[4px] border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-[4px] p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors ${
                viewMode === 'card' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors ${
                viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 分类横排按钮 */}
        <div className="flex items-center gap-1.5 mb-6 flex-wrap pl-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-[4px] text-sm font-medium transition-all border ${
              selectedCategory === 'all'
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
            style={selectedCategory === 'all' ? { backgroundColor: '#1447E6', borderColor: '#1447E6' } : undefined}
          >
            全部
          </button>
          {DEFAULT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-[4px] text-sm font-medium transition-all border ${
                selectedCategory === cat.id
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: '#1447E6', borderColor: '#1447E6' } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 技能列表 */}
        {filteredSkills.length === 0 ? (
          <div className="text-center py-24">
            <Puzzle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">暂无符合条件的技能</p>
          </div>
        ) : viewMode === 'card' ? (
          /* 卡片视图：常规 3 列 / 超大屏 4 列（>1600px 时启用，配合 §7.4 三档容器） */
          <div className="grid grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                downloadCount={MOCK_DOWNLOAD_COUNTS[skill.id] || 0}
                onClick={() => setSelectedSkillId(skill.id)}
                onDistStatusClick={() => { setInitialTab('distribution'); setSelectedSkillId(skill.id); }}
              />
            ))}
          </div>
        ) : (
          /* 列表视图 — 紧凑横排布局 */
          <SurfaceCard className="overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filteredSkills.map(skill => (
                <SkillListRow
                  key={skill.id}
                  skill={skill}
                  downloadCount={MOCK_DOWNLOAD_COUNTS[skill.id] || 0}
                  onClick={() => setSelectedSkillId(skill.id)}
                  onDistStatusClick={() => { setInitialTab('distribution'); setSelectedSkillId(skill.id); }}
                />
              ))}
            </div>
          </SurfaceCard>
        )}
          </div>
          <div aria-hidden className="shrink-0 w-20 self-stretch" />
        </div>
      </div>
    </TenantLayout>
  );
}

// ========== 卡片组件 ==========
function SkillCard({
  skill,
  downloadCount,
  onClick,
  onDistStatusClick,
}: {
  skill: Skill;
  downloadCount: number;
  onClick: () => void;
  onDistStatusClick?: () => void;
}) {
  const [distributeOpen, setDistributeOpen] = useState(false);

  // 获取该技能的最新下发状态
  const latestRecord = getDistributionRecords(skill.id)?.[0];
  const distStatus = latestRecord?.status;
  const isDistributing = distStatus === 'distributing';

  const handleDistributeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDistributing) return; // 下发中禁止点击
    setDistributeOpen(true);
  };

  const handleDistributionStart = (selectedInstanceIds: string[], selectedInstancesData: any[]) => {
    const recordId = createDistributionRecordId();
    const newRecord: CachedDistributionRecord = {
      id: recordId,
      skillId: skill.id,
      timestamp: new Date().toISOString(),
      totalCount: selectedInstanceIds.length,
      successCount: 0,
      failedCount: 0,
      inProgressCount: selectedInstanceIds.length,
      status: 'distributing',
      instances: selectedInstancesData.map(inst => ({
        id: inst.id,
        name: inst.name,
        createdBy: inst.createdBy || 'admin',
        distributionStatus: 'distributing' as DistributionStatus,
      })),
    };
    addDistributionRecord(newRecord);
    setDistributeOpen(false);
    toast.success(`已开始下发「${skill.name}」到 ${selectedInstanceIds.length} 个实例`);
    simulateDistribution(recordId, selectedInstanceIds.length);
  };

  const initial = getSkillInitial(skill.name);

  return (
    <>
      <SurfaceCard
        hover
        className="p-5 cursor-pointer"
        onClick={onClick}
      >
        {/* 顶部：图标(字母) + 名称 + 下发按钮 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {initial && (
              <div
                className={`w-9 h-9 rounded-[4px] bg-gradient-to-br ${getLetterGradient(initial)} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-white text-sm font-bold">{initial}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{skill.name}</h3>
                {/* 下发状态图标 */}
                {distStatus && <DistributionStatusIcon status={distStatus} latestRecord={latestRecord} onClick={() => onDistStatusClick?.()} />}
              </div>
              <span className="text-xs text-gray-400">v{skill.version}</span>
            </div>
          </div>
          {isDistributing ? (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <span
                  className="w-8 h-8 rounded-[4px] border border-gray-200 flex items-center justify-center text-gray-300 cursor-not-allowed flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="w-4 h-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent><span className="text-xs">请等待下发完成</span></TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleDistributeClick}
              className="w-8 h-8 rounded-[4px] border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 描述 — 支持展示三行 */}
        <p className="text-sm text-gray-500 line-clamp-3 mb-3">{skill.description}</p>

        {/* 底部：发布时间 + 下载量图标 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(skill.uploadTime)}</span>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Download className="w-3 h-3" />
            <span className="tabular-nums">{formatDownloadCount(downloadCount)}</span>
          </div>
        </div>
      </SurfaceCard>

      {/* 下发弹窗 */}
      <BatchDistributeDialog
        open={distributeOpen}
        onOpenChange={setDistributeOpen}
        skillName={skill.name}
        skillVersion={skill.version}
        onDistributionStart={handleDistributionStart}
        title="下发技能"
        showScopeFilter={false}
        instances={getMyInstances()}
        hideCreatorAndGroup
      />
    </>
  );
}

// ========== 列表行组件 ==========
function SkillListRow({
  skill,
  downloadCount,
  onClick,
  onDistStatusClick,
}: {
  skill: Skill;
  downloadCount: number;
  onClick: () => void;
  onDistStatusClick?: () => void;
}) {
  const [distributeOpen, setDistributeOpen] = useState(false);

  const latestRecord = getDistributionRecords(skill.id)?.[0];
  const distStatus = latestRecord?.status;
  const isDistributing = distStatus === 'distributing';

  const handleDistributeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDistributing) return;
    setDistributeOpen(true);
  };

  const handleDistributionStart = (selectedInstanceIds: string[], selectedInstancesData: any[]) => {
    const recordId = createDistributionRecordId();
    const newRecord: CachedDistributionRecord = {
      id: recordId,
      skillId: skill.id,
      timestamp: new Date().toISOString(),
      totalCount: selectedInstanceIds.length,
      successCount: 0,
      failedCount: 0,
      inProgressCount: selectedInstanceIds.length,
      status: 'distributing',
      instances: selectedInstancesData.map(inst => ({
        id: inst.id,
        name: inst.name,
        createdBy: inst.createdBy || 'admin',
        distributionStatus: 'distributing' as DistributionStatus,
      })),
    };
    addDistributionRecord(newRecord);
    setDistributeOpen(false);
    toast.success(`已开始下发「${skill.name}」到 ${selectedInstanceIds.length} 个实例`);
    simulateDistribution(recordId, selectedInstanceIds.length);
  };

  const initial = getSkillInitial(skill.name);
  // 格式化短日期 250303
  const shortDate = (() => {
    const d = typeof skill.uploadTime === 'string' ? new Date(skill.uploadTime) : skill.uploadTime;
    const y = String(d.getFullYear()).slice(2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  })();

  return (
    <>
      <div
        className="flex items-center px-5 py-5 hover:bg-gray-100/60 transition-colors cursor-pointer gap-4"
        onClick={onClick}
      >
        {/* 左：图标(字母) + 名称 + 描述 */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {initial && (
            <div
              className={`w-9 h-9 rounded-[4px] bg-gradient-to-br ${getLetterGradient(initial)} flex items-center justify-center flex-shrink-0`}
            >
              <span className="text-white text-sm font-bold">{initial}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 truncate">{skill.name}</span>
            </div>
            <p className="text-sm text-gray-400 truncate mt-1">{skill.description}</p>
          </div>
        </div>

        {/* 下载量 */}
        <div className="flex items-center gap-1 flex-shrink-0 text-xs text-gray-400 tabular-nums whitespace-nowrap">
          <Download className="w-3 h-3" />
          {formatDownloadCount(downloadCount)}
        </div>

        {/* 版本+日期 */}
        <div className="flex-shrink-0 text-xs text-gray-400 tabular-nums whitespace-nowrap">
          v{skill.version}({shortDate})
        </div>

        {/* 下发状态图标 — 未下发时也显示置灰图标占位 */}
        {distStatus ? (
          <DistributionStatusIcon status={distStatus} latestRecord={latestRecord} onClick={() => onDistStatusClick?.()} />
        ) : (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default" onClick={(e) => e.stopPropagation()}>
                <Circle className="w-3.5 h-3.5 text-gray-300 hover:text-blue-400 transition-colors" />
              </span>
            </TooltipTrigger>
            <TooltipContent><span className="text-xs">还没下发过</span></TooltipContent>
          </Tooltip>
        )}

        {/* + 按钮 */}
        {isDistributing ? (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span
                className="w-7 h-7 rounded-[4px] border border-gray-200 flex items-center justify-center text-gray-300 cursor-not-allowed flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent><span className="text-xs">请等待下发完成</span></TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleDistributeClick}
            className="w-7 h-7 rounded-[4px] border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <BatchDistributeDialog
        open={distributeOpen}
        onOpenChange={setDistributeOpen}
        skillName={skill.name}
        skillVersion={skill.version}
        onDistributionStart={handleDistributionStart}
        title="下发技能"
        showScopeFilter={false}
        instances={getMyInstances()}
        hideCreatorAndGroup
      />
    </>
  );
}

// ========== 详情页组件 ==========
function SkillSquareDetail({
  skillId,
  skills,
  onBack,
  initialTab = 'overview',
}: {
  skillId: string;
  skills: Skill[];
  onBack: () => void;
  initialTab?: string;
}) {
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>('SKILL.md');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [fileViewMode, setFileViewMode] = useState<'preview' | 'source'>('preview');

  // 下发记录
  const [distributionRecords, setDistributionRecords] = useState<CachedDistributionRecord[]>([]);
  const [activeDistributionId, setActiveDistributionId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | DistributionStatus>('all');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  const refreshRecords = useCallback(() => {
    setDistributionRecords(getDistributionRecords(skillId));
  }, [skillId]);

  useEffect(() => {
    refreshRecords();
    const handler = () => refreshRecords();
    window.addEventListener('distribution-cache-updated', handler);
    return () => window.removeEventListener('distribution-cache-updated', handler);
  }, [refreshRecords]);

  const hasInProgress = distributionRecords.some(r => r.status === 'distributing');

  const skill = useMemo(() => skills.find(s => s.id === skillId), [skillId, skills]);

  useEffect(() => {
    if (skill?.versions && skill.versions.length > 0 && !selectedVersion) {
      setSelectedVersion(skill.versions[0]);
    }
  }, [skill?.versions, selectedVersion]);

  useEffect(() => {
    if (selectedVersion) {
      setExpandedFile('SKILL.md');
      setExpandedDirs(new Set());
    }
  }, [selectedVersion]);

  // 文件列表处理
  const currentVersionFiles = useMemo(() => {
    if (!skill) return [];
    if (!selectedVersion || selectedVersion === skill.versions?.[0]) {
      return skill.files || [];
    }
    const versionRecord = skill.versionHistory?.find(v => v.version === selectedVersion);
    if (versionRecord?.files && versionRecord.files.length > 0) {
      return versionRecord.files;
    }
    return skill.files || [];
  }, [skill, selectedVersion]);

  const { processedFiles, strippedPrefix } = useMemo(() => {
    const rawFiles = currentVersionFiles;
    if (rawFiles.length === 0) return { processedFiles: rawFiles, strippedPrefix: '' };
    const topDirs = new Set<string>();
    let topFileCount = 0;
    for (const f of rawFiles) {
      const parts = f.name.split('/');
      if (parts.length > 1) topDirs.add(parts[0]);
      else topFileCount++;
    }
    if (topDirs.size === 1 && topFileCount === 0) {
      const prefix = [...topDirs][0] + '/';
      return {
        processedFiles: rawFiles.map(f => ({ ...f, name: f.name.slice(prefix.length) })),
        strippedPrefix: prefix,
      };
    }
    return { processedFiles: rawFiles, strippedPrefix: '' };
  }, [currentVersionFiles]);

  const VIEWABLE_EXTENSIONS = ['.md', '.xml', '.json', '.txt', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.py', '.js', '.ts', '.css', '.html', '.htm', '.svg', '.env', '.gitignore', '.dockerfile'];

  const isViewableFile = (name: string) => {
    const lower = name.toLowerCase();
    if (!lower.includes('.') && !lower.includes('/')) return true;
    return VIEWABLE_EXTENSIONS.some(ext => lower.endsWith(ext));
  };

  const isMarkdownFile = (name: string) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.mdx');
  };

  const getFileLanguage = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
      toml: 'toml', py: 'python', js: 'javascript', ts: 'typescript',
      css: 'css', html: 'html', htm: 'html', sh: 'bash', bat: 'batch',
      svg: 'xml', ini: 'ini', cfg: 'ini', conf: 'ini',
    };
    return langMap[ext] || 'text';
  };

  const toggleDir = (dirName: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirName)) next.delete(dirName);
      else next.add(dirName);
      return next;
    });
  };

  useEffect(() => {
    if (processedFiles.length) {
      const dirs = new Set<string>();
      for (const file of processedFiles) {
        const parts = file.name.split('/');
        if (parts.length > 1) dirs.add(parts[0]);
      }
      setExpandedDirs(dirs);
    }
  }, [processedFiles]);

  const findFileInTree = (files: any[], targetName: string): any => {
    for (const f of files) {
      if (f.name === targetName || f.path === targetName) return f;
      if (f.children && f.children.length > 0) {
        const found = findFileInTree(f.children, targetName);
        if (found) return found;
      }
    }
    return null;
  };

  const getFileContent = (fileName: string): string => {
    const versionFiles = currentVersionFiles;
    if (fileName === 'SKILL.md' || fileName.toLowerCase() === 'skill.md') {
      const skillMdFile = versionFiles.find(f => f.name.toLowerCase() === 'skill.md' || f.name.toLowerCase().endsWith('/skill.md'));
      if (skillMdFile?.content) return skillMdFile.content;
      if (!selectedVersion || selectedVersion === skill?.versions?.[0]) {
        return skill?.content || '';
      }
      return '';
    }
    const originalName = strippedPrefix ? strippedPrefix + fileName : fileName;
    const file = findFileInTree(versionFiles, originalName);
    if (file?.content) return file.content;
    const file2 = findFileInTree(versionFiles, fileName);
    if (file2?.content) return file2.content;
    return '';
  };

  const renderFileTree = (files: Array<{ name: string; size?: number; content?: string }>) => {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
    const renderedDirs = new Set<string>();
    const result: React.ReactNode[] = [];

    for (const file of sorted) {
      const parts = file.name.split('/');
      const isDir = file.name.endsWith('/');
      const isNested = parts.length > 1 && !isDir;
      const canView = !isDir && isViewableFile(file.name);

      if (isNested) {
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join('/');
          if (!renderedDirs.has(dirPath)) {
            renderedDirs.add(dirPath);
            const depth = i - 1;
            const isExpanded = expandedDirs.has(dirPath);
            let ancestorsExpanded = true;
            for (let j = 1; j < i; j++) {
              const ancestor = parts.slice(0, j).join('/');
              if (!expandedDirs.has(ancestor)) { ancestorsExpanded = false; break; }
            }
            if (!ancestorsExpanded) continue;
            result.push(
              <button
                key={`dir-${dirPath}`}
                onClick={() => toggleDir(dirPath)}
                className="w-full flex items-center gap-1.5 px-2 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors cursor-pointer"
                style={{ paddingLeft: `${8 + depth * 16}px` }}
              >
                {isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                <span className="truncate font-medium">{parts[i - 1]}</span>
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 ml-auto text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 ml-auto text-gray-400 flex-shrink-0" />
                }
              </button>
            );
          }
        }
        let allParentsExpanded = true;
        for (let i = 1; i < parts.length; i++) {
          const ancestor = parts.slice(0, i).join('/');
          if (!expandedDirs.has(ancestor)) { allParentsExpanded = false; break; }
        }
        if (!allParentsExpanded) continue;
      }
      if (isDir) continue;
      const depth = parts.length - 1;
      result.push(
        <button
          key={file.name}
          onClick={() => canView && setExpandedFile(expandedFile === file.name ? null : file.name)}
          disabled={!canView}
          className={`w-full flex items-center gap-1.5 px-2 py-2 text-xs rounded transition-colors ${
            expandedFile === file.name
              ? 'bg-blue-50 text-blue-700'
              : canView ? 'hover:bg-gray-50 text-gray-600 cursor-pointer' : 'text-gray-500 cursor-not-allowed opacity-60'
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{parts[parts.length - 1]}</span>
        </button>
      );
    }
    return result;
  };

  // 下载
  const handleDownload = async () => {
    if (!skill) return;
    setIsDownloading(true);
    try {
      await downloadSkillAsZip(skill);
      toast.success(`「${skill.name}」下载完成`);
    } catch {
      toast.error('下载失败，请重试');
    } finally {
      setIsDownloading(false);
    }
  };

  // 下发处理
  const handleDistributionStart = (selectedInstanceIds: string[], selectedInstancesData: any[]) => {
    const recordId = createDistributionRecordId();
    const newRecord: CachedDistributionRecord = {
      id: recordId,
      skillId,
      timestamp: new Date().toISOString(),
      totalCount: selectedInstanceIds.length,
      successCount: 0,
      failedCount: 0,
      inProgressCount: selectedInstanceIds.length,
      status: 'distributing',
      instances: selectedInstancesData.map(inst => ({
        id: inst.id,
        name: inst.name,
        createdBy: inst.createdBy || 'admin',
        distributionStatus: 'distributing' as DistributionStatus,
      })),
    };
    addDistributionRecord(newRecord);
    setActiveDistributionId(recordId);
    setDistributeDialogOpen(false);
    simulateDistribution(recordId, selectedInstanceIds.length);
  };

  const getCategoryName = (catId: string) => {
    return DEFAULT_CATEGORIES.find(c => c.id === catId)?.name || catId;
  };

  const activeDistribution = distributionRecords.find(r => r.id === activeDistributionId);
  const filteredInstances = activeDistribution
    ? activeDistribution.instances.filter(inst => {
        const matchesStatus = statusFilter === 'all' || inst.distributionStatus === statusFilter;
        const searchLower = detailSearchQuery.toLowerCase();
        const matchesSearch = !detailSearchQuery ||
          inst.name.toLowerCase().includes(searchLower) ||
          inst.id.toLowerCase().includes(searchLower);
        return matchesStatus && matchesSearch;
      })
    : [];

  if (!skill) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">技能未找到</p>
        <Button onClick={onBack} className="mt-4" variant="claw-outline">返回列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回列表
      </button>

      {/* 技能基本信息 */}
      <SurfaceCard className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{skill.name}</h1>
            <p className="text-sm text-gray-500">slug: {skill.slug}</p>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {/* 下载按钮 */}
            <Button variant="claw-outline" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? <Loader className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              下载
            </Button>
            {/* 下发按钮 */}
            <Button
              variant="claw-primary"
              onClick={() => setDistributeDialogOpen(true)}
              disabled={hasInProgress}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {hasInProgress ? '下发中...' : '下发'}
            </Button>
          </div>
        </div>

        {/* 标签行 */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            v{skill.version}
          </span>
          <div className="flex gap-1 flex-wrap">
            {skill.categories.map(catId => (
              <span key={catId} className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {getCategoryName(catId)}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400 tabular-nums ml-2 flex items-center gap-1">
            <Download className="w-3 h-3" />
            {formatDownloadCount(MOCK_DOWNLOAD_COUNTS[skill.id] || 0)}
          </span>
          <span className="text-xs text-gray-400">
            {formatDate(skill.uploadTime)} 发布
          </span>
        </div>

        {skill.description && (
          <p className="text-sm text-gray-600 mt-3">{skill.description}</p>
        )}
      </SurfaceCard>

      {/* Tab 页面 */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-white p-0 h-auto gap-2 border-b-0">
            <TabsTrigger
              value="overview"
              className="rounded-[4px] px-4 py-1.5 text-sm text-gray-600 bg-white hover:bg-gray-50 border border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-blue-200 transition-colors"
            >
              概述
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="rounded-[4px] px-4 py-1.5 text-sm text-gray-600 bg-white hover:bg-gray-50 border border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-blue-200 transition-colors"
            >
              文件列表
            </TabsTrigger>
            <TabsTrigger
              value="distribution"
              className="rounded-[4px] px-4 py-1.5 text-sm text-gray-600 bg-white hover:bg-gray-50 border border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-blue-200 transition-colors"
            >
              下发记录
            </TabsTrigger>
          </TabsList>

          {/* 概述 Tab */}
          <TabsContent value="overview" className="mt-4 p-0">
            <SurfaceCard className="p-6">
              <MDXRenderer content={(() => {
                if (!selectedVersion || selectedVersion === skill.versions?.[0]) {
                  return skill.content || '';
                }
                const versionFiles = currentVersionFiles;
                const skillMdFile = versionFiles.find(f => f.name.toLowerCase() === 'skill.md' || f.name.toLowerCase().endsWith('/skill.md'));
                return skillMdFile?.content || skill.content || '';
              })()} />
            </SurfaceCard>
          </TabsContent>

          {/* 文件列表 Tab */}
          <TabsContent value="files" className="mt-4 p-0">
            <SurfaceCard className="flex h-[47rem] overflow-hidden">
              {/* 左列：版本选择 */}
              <div className="w-[14%] min-w-[120px] border-r border-gray-200 flex flex-col">
                <div className="bg-gray-50/50 px-3 py-4 border-b border-gray-200 flex items-center">
                  <p className="text-xs font-medium text-gray-900">版本</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {skill.versions?.map((ver: string, idx: number) => {
                    const isLatest = idx === 0;
                    const isSelected = selectedVersion === ver;
                    const versionRecord = skill.versionHistory?.find(v => v.version === ver);
                    const dateStr = versionRecord?.date || '';
                    return (
                      <button
                        key={ver}
                        onClick={() => setSelectedVersion(ver)}
                        className={`w-full text-left px-3 py-3.5 border-b border-gray-100 transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {ver}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              最新
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <p className="text-[10px] text-gray-400">{dateStr}</p>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="ml-auto cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <Info className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[260px] p-3 bg-white text-gray-900 border border-gray-200 shadow-lg text-xs">
                              <p className="font-medium mb-1.5 text-gray-900 text-xs">更新说明</p>
                              <p className="whitespace-pre-line leading-relaxed text-gray-700 text-xs">{versionRecord?.changeLog || '暂无更新说明'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 中列：文件列表 */}
              <div className="w-[22%] min-w-[160px] border-r border-gray-200 flex flex-col">
                <div className="bg-gray-50/50 px-3 py-4 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-900">{selectedVersion || skill.version}</p>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="下载此版本 ZIP"
                  >
                    {isDownloading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderFileTree(processedFiles)}
                </div>
              </div>

              {/* 右列：文件详情 */}
              <div className="flex-1 flex flex-col bg-white">
                {expandedFile ? (
                  <>
                    <div className="bg-gray-50/50 px-3 py-2.5 border-b border-gray-200 flex items-center justify-between min-h-[44px]">
                      <p className="text-xs font-medium text-gray-900">{expandedFile}</p>
                      <div className="flex items-center gap-0.5 bg-gray-200/60 rounded p-0.5">
                        <button
                          onClick={() => setFileViewMode('preview')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            fileViewMode === 'preview'
                              ? 'bg-white text-gray-900 shadow-sm font-medium'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          预览
                        </button>
                        <button
                          onClick={() => setFileViewMode('source')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            fileViewMode === 'source'
                              ? 'bg-white text-gray-900 shadow-sm font-medium'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Code className="w-3 h-3" />
                          源码
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {(() => {
                        const content = getFileContent(expandedFile);
                        if (!content) {
                          return (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <p className="text-sm">文件内容暂无</p>
                            </div>
                          );
                        }
                        if (fileViewMode === 'source') {
                          const lang = getFileLanguage(expandedFile);
                          registerLanguage(lang);
                          return (
                            <Suspense fallback={
                              <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-5 bg-gray-50 p-3 m-0">
                                {content}
                              </pre>
                            }>
                              <SyntaxHighlighter
                                language={lang}
                                style={hljsStyle}
                                showLineNumbers
                                lineNumberStyle={{ color: '#b0b0b0', fontSize: '11px', minWidth: '2.5em', paddingRight: '1em', userSelect: 'none' }}
                                customStyle={{ margin: 0, padding: '12px 0', fontSize: '12px', lineHeight: '1.6', background: '#ffffff', borderRadius: 0 }}
                                wrapLongLines
                              >
                                {content}
                              </SyntaxHighlighter>
                            </Suspense>
                          );
                        }
                        if (isMarkdownFile(expandedFile)) {
                          return (
                            <div className="p-4">
                              <MDXRenderer content={content} />
                            </div>
                          );
                        }
                        const previewLang = getFileLanguage(expandedFile);
                        registerLanguage(previewLang);
                        return (
                          <Suspense fallback={
                            <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-5 bg-gray-50 p-3 m-0">
                              {content}
                            </pre>
                          }>
                            <SyntaxHighlighter
                              language={previewLang}
                              style={hljsStyle}
                              showLineNumbers
                              lineNumberStyle={{ color: '#b0b0b0', fontSize: '11px', minWidth: '2.5em', paddingRight: '1em', userSelect: 'none' }}
                              customStyle={{ margin: 0, padding: '12px 0', fontSize: '12px', lineHeight: '1.6', background: '#ffffff', borderRadius: 0 }}
                              wrapLongLines
                            >
                              {content}
                            </SyntaxHighlighter>
                          </Suspense>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p className="text-sm">选择一个文件查看内容</p>
                  </div>
                )}
              </div>
            </SurfaceCard>
          </TabsContent>

          {/* 下发记录 Tab */}
          <TabsContent value="distribution" className="mt-4 p-0">
            <SurfaceCard className="p-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">下发记录</h3>
              </div>

              <div className="space-y-3 mt-4">
                {distributionRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Puzzle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400">还没有下发记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {distributionRecords.map((record, idx) => {
                      const progress = record.totalCount > 0 ? Math.round((record.successCount / record.totalCount) * 100) : 0;
                      return (
                        <div key={record.id} className="border border-gray-200 rounded-[4px] p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                #{idx + 1} · v{skill.version} {new Date(record.timestamp).toLocaleString('zh-CN')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                                record.status === 'distributing' ? 'bg-blue-50 text-blue-700' :
                                record.successCount === record.totalCount ? 'bg-green-50 text-green-700' :
                                'bg-yellow-50 text-yellow-700'
                              }`}>
                                {record.status === 'distributing'
                                  ? `下发中 ${progress}%`
                                  : `下发完成，${record.successCount}个成功，${record.failedCount}个失败`}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setActiveDistributionId(record.id);
                                  setStatusFilter('all');
                                  setDetailSearchQuery('');
                                  setDetailsOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 h-auto py-1 px-2"
                              >
                                查看详情
                              </Button>
                            </div>
                          </div>

                          {record.status === 'distributing' && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SurfaceCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* 下发弹窗 — 用户端简化版 */}
      <BatchDistributeDialog
        open={distributeDialogOpen}
        onOpenChange={setDistributeDialogOpen}
        skillName={skill.name}
        skillVersion={skill.version}
        onDistributionStart={handleDistributionStart}
        title="下发技能"
        showScopeFilter={false}
        instances={getMyInstances()}
        hideCreatorAndGroup
      />

      {/* 下发详情弹窗 */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>下发详情</DialogTitle>
          </DialogHeader>

          {activeDistribution && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索实例名称/ID..."
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-24 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="distributing">下发中</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                <div className="overflow-y-auto max-h-72">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="w-[25%] px-4 py-2.5 text-left text-xs font-medium text-gray-500">实例名称</th>
                        <th className="w-[30%] px-4 py-2.5 text-left text-xs font-medium text-gray-500">实例ID</th>
                        <th className="w-[18%] px-4 py-2.5 text-left text-xs font-medium text-gray-500">状态</th>
                        <th className="w-[27%] px-4 py-2.5 text-left text-xs font-medium text-gray-500">失败原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstances.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                            暂无符合条件的记录
                          </td>
                        </tr>
                      ) : (
                        filteredInstances.map(instance => (
                          <tr key={instance.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-2.5 text-sm text-gray-900 truncate">{instance.name}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-500 font-mono truncate">{instance.id}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium ${
                                instance.distributionStatus === 'success' ? 'text-green-600' :
                                instance.distributionStatus === 'failed' ? 'text-red-600' :
                                instance.distributionStatus === 'distributing' ? 'text-blue-600' :
                                'text-gray-500'
                              }`}>
                                {DISTRIBUTION_STATUS_MAP[instance.distributionStatus]?.label || '未下发'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-400 truncate">
                              {instance.distributionStatus === 'failed'
                                ? (instance.failReason || '连接超时')
                                : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== 下发状态图标 ==========
function DistributionStatusIcon({ status, latestRecord, onClick }: {
  status: DistributionStatus;
  latestRecord?: CachedDistributionRecord;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const total = latestRecord?.totalCount || 0;
  const success = latestRecord?.successCount || 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  if (status === 'distributing') {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-pointer" onClick={handleClick}>
            <Loader className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          </span>
        </TooltipTrigger>
        <TooltipContent><span className="text-xs">下发中</span></TooltipContent>
      </Tooltip>
    );
  }
  if (status === 'success') {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-pointer" onClick={handleClick}>
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent><span className="text-xs">已下发 ({success}/{total} 成功)</span></TooltipContent>
      </Tooltip>
    );
  }
  if (status === 'failed') {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-pointer" onClick={handleClick}>
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent><span className="text-xs">下发失败 ({success}/{total} 成功)</span></TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

// ========== 工具函数 ==========

/** 格式化日期 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 获取当前用户自己的实例（模拟：用户分组有交集的实例） */
function getMyInstances() {
  return MOCK_OPENCLAW_INSTANCES.filter(inst =>
    inst.groupIds?.some(gId => CURRENT_USER_GROUP_IDS.includes(gId))
  );
}

/** 模拟下发进度 */
function simulateDistribution(recordId: string, totalCount: number) {
  const FAIL_REASONS = ['连接超时', '实例离线', '版本冲突', '磁盘空间不足'];
  let completed = 0;
  const interval = setInterval(() => {
    completed += Math.floor(Math.random() * 3) + 1;
    if (completed >= totalCount) {
      completed = totalCount;
      clearInterval(interval);
      const failedCount = Math.floor(Math.random() * 2);
      const successCount = totalCount - failedCount;
      updateDistributionRecord(recordId, (record) => ({
        ...record,
        successCount,
        failedCount,
        inProgressCount: 0,
        status: (failedCount === 0 ? 'success' : 'failed') as DistributionStatus,
        instances: record.instances.map((inst, idx) => ({
          ...inst,
          distributionStatus: (idx < successCount ? 'success' : 'failed') as DistributionStatus,
          failReason: idx >= successCount ? FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)] : undefined,
        })),
      }));
    } else {
      updateDistributionRecord(recordId, (record) => ({
        ...record,
        successCount: completed,
        inProgressCount: totalCount - completed,
      }));
    }
  }, 800);
}
