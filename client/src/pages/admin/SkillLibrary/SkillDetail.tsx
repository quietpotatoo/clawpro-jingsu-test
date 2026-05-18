'use client';
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Search, Code, Eye, Pencil, Trash2, Download, Info, Loader, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SKILLS, DEFAULT_CATEGORIES, MOCK_GROUPS, MOCK_OPENCLAW_INSTANCES } from './mockData';
import BatchDistributeDialog from './BatchDistributeDialog';
import SkillUpdateDialog from './SkillUpdateDialog';
import DeleteSkillDialog from './DeleteSkillDialog';
import MDXRenderer from '@/components/MDXRenderer';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { type Skill, type DistributionStatus, DISTRIBUTION_STATUS_MAP, SECURITY_STATUS_MAP, type SecurityStatus } from './types';
import {
  getDistributionRecords,
  addDistributionRecord,
  updateDistributionRecord,
  createDistributionRecordId,
  type CachedDistributionRecord,
} from './distributionCache';
import { downloadSkillAsZip } from './downloadUtils';

// 懒加载 react-syntax-highlighter 减少首屏包体积
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

// localStorage 缓存 key（与 SkillListTab 保持一致）
const SKILLS_CACHE_KEY = 'skillhub_enterprise_skills_cache';

interface SkillDetailProps {
  skillId: string;
  onBack: () => void;
  skills?: any[];
  defaultTab?: string;
  onSkillUpdate?: (updatedSkill: Skill) => void;
  onSkillDelete?: (skillId: string) => void;
}

// hljs 亮色主题样式
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

export default function SkillDetail({ skillId, onBack, skills, defaultTab, onSkillUpdate, onSkillDelete }: SkillDetailProps) {
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>('SKILL.md');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [activeDistributionId, setActiveDistributionId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | DistributionStatus>('all');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(defaultTab || 'overview');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [fileViewMode, setFileViewMode] = useState<'preview' | 'source'>('preview');

  const [securityScanDialogOpen, setSecurityScanDialogOpen] = useState(false);
  const skillsArray = skills || MOCK_SKILLS;

  // 从缓存读取下发记录
  const [distributionRecords, setDistributionRecords] = useState<CachedDistributionRecord[]>([]);

  const refreshRecords = useCallback(() => {
    setDistributionRecords(getDistributionRecords(skillId));
  }, [skillId]);

  // 首次加载 + 监听缓存更新
  useEffect(() => {
    refreshRecords();
    const handler = () => refreshRecords();
    window.addEventListener('distribution-cache-updated', handler);
    return () => window.removeEventListener('distribution-cache-updated', handler);
  }, [refreshRecords]);

  // 是否有进行中的下发任务
  const hasInProgress = distributionRecords.some(r => r.status === 'distributing');
  
  // 先从 props 传入的 skills 中查找，找不到再从 localStorage 缓存中查找
  const skill = useMemo(() => {
    let found = skillsArray.find((s: any) => s.id === skillId);
    if (!found) {
      try {
        const cached = localStorage.getItem(SKILLS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          const cachedSkill = parsed.find((s: any) => s.id === skillId);
          if (cachedSkill) {
            found = {
              ...cachedSkill,
              uploadTime: new Date(cachedSkill.uploadTime),
              lastDistributionTime: cachedSkill.lastDistributionTime ? new Date(cachedSkill.lastDistributionTime) : undefined,
            };
          }
        }
      } catch (e) {
        console.warn('从缓存加载 skill 失败:', e);
      }
    }
    return found;
  }, [skillId, skillsArray]);
  
  useEffect(() => {
    if (skill?.versions && skill.versions.length > 0 && !selectedVersion) {
      setSelectedVersion(skill.versions[0]);
    }
  }, [skill?.versions, selectedVersion]);
  
  // 版本切换时重置文件展开状态
  useEffect(() => {
    if (selectedVersion) {
      setExpandedFile('SKILL.md');
      setExpandedDirs(new Set());
    }
  }, [selectedVersion]);

  // 根据选中版本获取文件列表（如选中的是非最新版本，则从 versionHistory 中取）
  const currentVersionFiles = useMemo(() => {
    if (!skill) return [];
    // 如果选中的版本是最新版本（versions[0]）或者没有选中版本，使用 skill.files
    if (!selectedVersion || selectedVersion === skill.versions?.[0]) {
      return skill.files || [];
    }
    // 从 versionHistory 中查找对应版本的文件列表
    const versionRecord = skill.versionHistory?.find(v => v.version === selectedVersion);
    if (versionRecord?.files && versionRecord.files.length > 0) {
      return versionRecord.files;
    }
    // 如果历史版本没有文件记录，回退到当前文件
    return skill.files || [];
  }, [skill, selectedVersion]);

  // 剥离唯一顶层文件夹：如果所有文件都在同一个顶层目录下，则去掉该前缀
  const { processedFiles, strippedPrefix } = useMemo(() => {
    const rawFiles = currentVersionFiles;
    if (rawFiles.length === 0) return { processedFiles: rawFiles, strippedPrefix: '' };
    
    const topDirs = new Set<string>();
    let topFileCount = 0;
    for (const f of rawFiles) {
      const parts = f.name.split('/');
      if (parts.length > 1) {
        topDirs.add(parts[0]);
      } else {
        topFileCount++;
      }
    }
    // 所有文件都在同一个顶层目录下，且没有顶层文件
    if (topDirs.size === 1 && topFileCount === 0) {
      const prefix = [...topDirs][0] + '/';
      return {
        processedFiles: rawFiles.map(f => ({ ...f, name: f.name.slice(prefix.length) })),
        strippedPrefix: prefix,
      };
    }
    return { processedFiles: rawFiles, strippedPrefix: '' };
  }, [currentVersionFiles]);

  // 可展示的文件扩展名（文本类文件）
  const VIEWABLE_EXTENSIONS = ['.md', '.xml', '.json', '.txt', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.py', '.js', '.ts', '.css', '.html', '.htm', '.svg', '.env', '.gitignore', '.dockerfile'];
  
  const isViewableFile = (name: string) => {
    const lower = name.toLowerCase();
    // 没有扩展名的特殊文件也可以查看（如 Dockerfile, Makefile 等）
    if (!lower.includes('.') && !lower.includes('/')) return true;
    return VIEWABLE_EXTENSIONS.some(ext => lower.endsWith(ext));
  };

  const toggleDir = (dirName: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirName)) {
        next.delete(dirName);
      } else {
        next.add(dirName);
      }
      return next;
    });
  };

  // 初始化时仅展开顶层文件夹（与公共技能库一致）
  useEffect(() => {
    if (processedFiles.length) {
      const dirs = new Set<string>();
      for (const file of processedFiles) {
        const parts = file.name.split('/');
        if (parts.length > 1) {
          // 仅展开第一层目录
          dirs.add(parts[0]);
        }
      }
      setExpandedDirs(dirs);
    }
  }, [processedFiles]);

  const renderFileTree = (files: Array<{ name: string; size?: number; content?: string }>) => {
    // 按路径排序，同一文件夹的文件聚在一起
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
    
    // 收集所有文件夹及其层级
    const renderedDirs = new Set<string>();
    const result: React.ReactNode[] = [];
    
    for (const file of sorted) {
      const parts = file.name.split('/');
      const isDir = file.name.endsWith('/');
      const isNested = parts.length > 1 && !isDir;
      const canView = !isDir && isViewableFile(file.name);
      
      // 如果是子目录下的文件，先渲染各层目录头
      if (isNested) {
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join('/');
          if (!renderedDirs.has(dirPath)) {
            renderedDirs.add(dirPath);
            const depth = i - 1;
            const isExpanded = expandedDirs.has(dirPath);
            
            // 检查该目录的所有祖先是否展开，未展开则不渲染
            let ancestorsExpanded = true;
            for (let j = 1; j < i; j++) {
              const ancestor = parts.slice(0, j).join('/');
              if (!expandedDirs.has(ancestor)) {
                ancestorsExpanded = false;
                break;
              }
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
        
        // 检查父目录是否全部展开，否则隐藏该文件
        const parentDir = parts.slice(0, -1).join('/');
        let allParentsExpanded = true;
        for (let i = 1; i < parts.length; i++) {
          const ancestor = parts.slice(0, i).join('/');
          if (!expandedDirs.has(ancestor)) {
            allParentsExpanded = false;
            break;
          }
        }
        if (!allParentsExpanded) continue;
      }
      
      // 跳过纯目录条目
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
              : canView
              ? 'hover:bg-gray-50 text-gray-600 cursor-pointer'
              : 'text-gray-500 cursor-not-allowed opacity-60'
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
  
  // 递归在文件树中查找文件（支持 children 嵌套结构和 path 匹配）
  const findFileInTree = (files: any[], targetName: string): any => {
    for (const f of files) {
      // 同时匹配 name 和 path
      if (f.name === targetName || f.path === targetName) return f;
      if (f.children && f.children.length > 0) {
        const found = findFileInTree(f.children, targetName);
        if (found) return found;
      }
    }
    return null;
  };

  const getFileContent = (fileName: string): string => {
    // 使用当前选中版本的文件列表（而不是始终用最新版本的 skill.files）
    const versionFiles = currentVersionFiles;

    // 对 SKILL.md，也优先从当前版本的文件列表中取
    if (fileName === 'SKILL.md' || fileName.toLowerCase() === 'skill.md') {
      const skillMdFile = versionFiles.find(f => f.name.toLowerCase() === 'skill.md' || f.name.toLowerCase().endsWith('/skill.md'));
      if (skillMdFile?.content) return skillMdFile.content;
      // 如果当前版本是最新版本，回退到 skill.content
      if (!selectedVersion || selectedVersion === skill?.versions?.[0]) {
        return skill?.content || '';
      }
      return '';
    }
    // 如果剥离了顶层文件夹，查找时还原为原始路径
    const originalName = strippedPrefix ? strippedPrefix + fileName : fileName;
    const file = findFileInTree(versionFiles, originalName);
    if (file?.content) return file.content;
    // 也尝试直接用处理后的路径查找
    const file2 = findFileInTree(versionFiles, fileName);
    if (file2?.content) return file2.content;
    return '';
  };

  // 判断文件是否为 Markdown
  const isMarkdownFile = (name: string) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.mdx');
  };

  // 获取文件对应的语法高亮语言
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
  
  const handleDistributionStart = (selectedInstanceIds: string[], selectedInstancesData: any[]) => {
    // 创建新的分发记录并写入缓存
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
    
    // 模拟下发进度
    simulateDistribution(recordId, selectedInstanceIds.length);
  };
  
  const simulateDistribution = (recordId: string, totalCount: number) => {
    let completed = 0;
    const interval = setInterval(() => {
      completed += Math.floor(Math.random() * 3) + 1;
      if (completed >= totalCount) {
        completed = totalCount;
        clearInterval(interval);
        
        // 模拟随机失败一些实例
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
            failReason: idx < successCount ? undefined : '命令下发失败',
          })),
        }));
      } else {
        // 更新进度
        updateDistributionRecord(recordId, (record) => ({
          ...record,
          successCount: completed,
          inProgressCount: totalCount - completed,
        }));
      }
    }, 800);
  };
  
  const handleRetry = (recordId: string) => {
    const record = distributionRecords.find(r => r.id === recordId);
    if (!record) return;
    
    const failedInstances = record.instances.filter(inst => inst.distributionStatus === 'failed');
    
    // 重置失败的实例状态
    updateDistributionRecord(recordId, (r) => ({
      ...r,
      status: 'distributing' as DistributionStatus,
      inProgressCount: failedInstances.length,
      instances: r.instances.map(inst => ({
        ...inst,
        distributionStatus: (inst.distributionStatus === 'failed' ? 'distributing' : inst.distributionStatus) as DistributionStatus,
      })),
    }));
    
    simulateDistribution(recordId, failedInstances.length);
  };

  // 下载 Skill
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

  // 提交安全检测（只更新状态为 scanning，由父组件 SkillListTab 的 useEffect 统一管理自动完成）
  const handleSecurityScan = () => {
    if (!skill) return;
    setSecurityScanDialogOpen(false);
    toast.success('已提交安全检测，预计 5 分钟后完成');

    // 立即变为 scanning，通过 onSkillUpdate 同步给父组件
    const updatedSkill: Skill = {
      ...skill,
      securityInfo: {
        overallStatus: 'scanning',
        engines: [],
      },
    };
    if (onSkillUpdate) onSkillUpdate(updatedSkill);
  };

  // 更新 Skill 回调
  const handleSkillUpdate = (updatedSkill: Skill) => {
    if (onSkillUpdate) {
      onSkillUpdate(updatedSkill);
    }
    // 重置版本选择，让 useEffect 自动选中最新版本
    setSelectedVersion('');
    setUpdateDialogOpen(false);
  };

  // 删除 Skill 回调
  const handleSkillDelete = () => {
    if (!skill) return;
    if (onSkillDelete) {
      onSkillDelete(skill.id);
    }
    toast.success(`Skill「${skill.name}」已删除`);
    setDeleteDialogOpen(false);
    onBack();
  };

  if (!skill) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">技能未找到</p>
        <Button onClick={onBack} className="mt-4">返回列表</Button>
      </div>
    );
  }

  const getCategoryName = (catId: string) => {
    return DEFAULT_CATEGORIES.find((cat: any) => cat.id === catId)?.name || catId;
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
      <div className="bg-white rounded-[4px] border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{skill.name}</h1>
            <p className="text-sm text-gray-500">slug: {skill.slug}</p>
          </div>

          {/* F-06 操作按钮 */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {/* 更新按钮 */}
              <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      onClick={() => setUpdateDialogOpen(true)}
                      disabled={hasInProgress}
                      className={hasInProgress ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      更新
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasInProgress && (
                  <TooltipContent>仅支持状态为正常的 Skill</TooltipContent>
                )}
              </Tooltip>

              {/* 删除按钮 */}
              <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={hasInProgress}
                      className={`${hasInProgress ? 'opacity-50 cursor-not-allowed' : ''} text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200`}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      删除
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasInProgress && (
                  <TooltipContent>仅支持状态为正常的 Skill</TooltipContent>
                )}
              </Tooltip>

              {/* 下载按钮 */}
              <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                下载
              </Button>
          </div>
        </div>
        {/* 标签行：版本、安全检测、分类、应用范围 — 独立行，可向右延伸 */}
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex-shrink-0">
            v{skill.version}
          </span>
          {/* 安全检测状态徽章 */}
          {(() => {
            const secStatus = skill.securityInfo?.overallStatus || 'not_scanned';
            const statusInfo = SECURITY_STATUS_MAP[secStatus];
            if (secStatus === 'not_scanned') {
              return (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 text-gray-400 text-xs font-medium rounded-full">
                    未检测
                  </span>
                  <button
                    onClick={() => setSecurityScanDialogOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                  >
                    <ScanSearch className="w-3 h-3" />
                    检测
                  </button>
                </span>
              );
            }
            if (secStatus === 'scanning') {
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                  <Loader className="w-3 h-3 animate-spin" />
                  安全检测中
                </span>
              );
            }
            const IconComp = secStatus === 'safe' ? ShieldCheck : secStatus === 'suspicious' ? ShieldAlert : ShieldX;
            const reportUrl = skill.securityInfo?.engines?.[0]?.reportUrl;
            return (
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 ${statusInfo.bgColor} ${statusInfo.color} text-xs font-medium rounded-full`}>
                  <IconComp className="w-3.5 h-3.5" />
                  {secStatus === 'safe' ? '通过安全检测' : secStatus === 'suspicious' ? '存在可疑行为' : '存在恶意行为'}
                </span>
                {reportUrl && (
                  <a
                    href={reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    查看报告
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </span>
            );
          })()}
          <div className="flex gap-1 flex-wrap">
            {skill.categories.map((catId: string) => (
              <span
                key={catId}
                className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {getCategoryName(catId)}
              </span>
            ))}
          </div>
          {/* 应用范围 */}
          <span className="text-sm text-gray-400 ml-2">|</span>
          <span className="text-sm text-gray-500 flex-shrink-0">应用范围：</span>
          {skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0 ? (
            <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              全部用户
            </span>
          ) : (
            skill.groupIds.map((gId: string) => (
              <span
                key={gId}
                className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {MOCK_GROUPS.find(g => g.id === gId)?.name || gId}
              </span>
            ))
          )}
        </div>
        {skill.description && (
          <p className="text-sm text-gray-600 mt-3">{skill.description}</p>
        )}
      </div>

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
            <div className="bg-white rounded-[4px] p-6 border border-gray-200">
              <MDXRenderer content={(() => {
                // 如果选中的是最新版本或未选中，用 skill.content
                if (!selectedVersion || selectedVersion === skill.versions?.[0]) {
                  return skill.content || '';
                }
                // 否则从当前版本文件列表中取 SKILL.md 内容
                const versionFiles = currentVersionFiles;
                const skillMdFile = versionFiles.find(f => f.name.toLowerCase() === 'skill.md' || f.name.toLowerCase().endsWith('/skill.md'));
                return skillMdFile?.content || skill.content || '';
              })()} />
            </div>
          </TabsContent>

          {/* 文件列表 Tab */}
          <TabsContent value="files" className="mt-4 p-0">
              <div className="flex h-[47rem] border border-gray-200 rounded-[4px] overflow-hidden bg-white">
                {/* 左列：版本号选择 */}
                <div className="w-[14%] min-w-[120px] border-r border-gray-200 flex flex-col">
                  <div className="bg-gray-50/50 px-3 py-4 border-b border-gray-200 flex items-center">
                    <p className="text-xs font-medium text-gray-900">版本</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {skill.versions?.map((ver: string, idx: number) => {
                      const isLatest = idx === 0;
                      const isSelected = selectedVersion === ver;
                      // 从版本历史中获取详细信息
                      const versionRecord = skill.versionHistory?.find(v => v.version === ver);
                      const dateStr = versionRecord?.date || (() => {
                        const versionDate = new Date(skill.uploadTime);
                        versionDate.setDate(versionDate.getDate() - idx * 14);
                        return `${versionDate.getFullYear()}-${String(versionDate.getMonth() + 1).padStart(2, '0')}-${String(versionDate.getDate()).padStart(2, '0')}`;
                      })();
                      // 安全检测图标：仅最新版本显示当前 skill 的安全状态
                      const secStatus = isLatest ? (skill.securityInfo?.overallStatus || 'not_scanned') : null;
                      return (
                        <button
                          key={ver}
                          onClick={() => setSelectedVersion(ver)}
                          className={`w-full text-left px-3 py-3.5 border-b border-gray-100 transition-colors ${
                            isSelected
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {/* 安全检测状态图标 */}
                            {secStatus && (() => {
                              if (secStatus === 'not_scanned') {
                                return (
                                  <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex flex-shrink-0">
                                        <ShieldCheck className="w-3.5 h-3.5 text-gray-300" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><span className="text-xs">未检测</span></TooltipContent>
                                  </Tooltip>
                                );
                              }
                              if (secStatus === 'scanning') {
                                return (
                                  <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex flex-shrink-0">
                                        <Loader className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><span className="text-xs">安全检测中</span></TooltipContent>
                                  </Tooltip>
                                );
                              }
                              const IconComp = secStatus === 'safe' ? ShieldCheck : secStatus === 'suspicious' ? ShieldAlert : ShieldX;
                              const iconColor = secStatus === 'safe' ? 'text-green-500' : secStatus === 'suspicious' ? 'text-yellow-500' : 'text-red-500';
                              const statusLabel = secStatus === 'safe' ? '安全' : secStatus === 'suspicious' ? '可疑' : '恶意';
                              return (
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex flex-shrink-0">
                                      <IconComp className={`w-3.5 h-3.5 ${iconColor}`} />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><span className="text-xs">安全检测：{statusLabel}</span></TooltipContent>
                                </Tooltip>
                              );
                            })()}
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
                            {/* ℹ️ 图标 hover 展示更新说明 */}
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
                        {/* 源码/预览 切换 */}
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
                          // 源码模式：所有文件类型都使用语法高亮
                          if (fileViewMode === 'source') {
                            const lang = getFileLanguage(expandedFile);
                            // 异步注册语言
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
                          // 预览模式
                          if (isMarkdownFile(expandedFile)) {
                            return (
                              <div className="p-4">
                                <MDXRenderer content={content} />
                              </div>
                            );
                          }
                          // 非 md 文件：预览也使用带行号的语法高亮（与源码一致）
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
              </div>
          </TabsContent>

          {/* 下发记录 Tab */}
          <TabsContent value="distribution" className="mt-4 p-0">
            <div className="bg-white rounded-[4px] p-6 border border-gray-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">下发记录</h3>
                <Button
                  onClick={() => setDistributeDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={hasInProgress}
                  title={hasInProgress ? '有下发任务进行中，请等待完成' : ''}
                >
                  {hasInProgress ? '下发中...' : '批量下发'}
                </Button>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {distributionRecords.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-[4px]">
                  <p className="text-gray-500">还没有下发记录</p>
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
                                : `下发完成，${record.successCount}个下发成功，${record.failedCount}个失败`}
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
                          <>
                            <div className="mb-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                        

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 批量下发对话框 */}
      <BatchDistributeDialog
        open={distributeDialogOpen}
        onOpenChange={setDistributeDialogOpen}
        skillName={skill.name}
        skillVersion={skill.version}
        skillScope={skill.scope}
        skillGroupIds={skill.groupIds}
        onDistributionStart={handleDistributionStart}
        instances={MOCK_OPENCLAW_INSTANCES}
        groups={MOCK_GROUPS}
      />

      {/* 更新对话框 */}
      {skill && (
        <SkillUpdateDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          skill={skill}
          onConfirm={(updatedSkill) => handleSkillUpdate(updatedSkill)}
          defaultSecurityScan={localStorage.getItem('skill_default_security_scan') !== 'false'}
          onDefaultSecurityScanChange={(value) => {
            localStorage.setItem('skill_default_security_scan', String(value));
          }}
        />
      )}

      {/* 删除确认对话框 */}
      <DeleteSkillDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        skillName={skill.name}
        onConfirm={handleSkillDelete}
      />

      {/* 分发详情对话框 */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-96">
          <DialogHeader>
            <DialogTitle>下发详情</DialogTitle>
          </DialogHeader>
          
          {activeDistribution && (
            <div className="space-y-4">
              {/* 筛选器 + 搜索框 */}
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
                  <SelectTrigger className="w-28">
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

              {/* 实例列表 */}
              <div className="border border-gray-200 rounded-[4px] overflow-y-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">实例名称</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700 min-w-[140px]">实例ID</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">状态</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">失败原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstances.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                          没有符合条件的记录
                        </td>
                      </tr>
                    ) : (
                      filteredInstances.map((instance) => (
                        <tr key={instance.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{instance.name}</td>
                          <td className="px-4 py-2 text-gray-600 font-mono whitespace-nowrap">{instance.id}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              DISTRIBUTION_STATUS_MAP[instance.distributionStatus]?.color || 'bg-gray-50 text-gray-500'
                            }`}>
                              {DISTRIBUTION_STATUS_MAP[instance.distributionStatus]?.label || '未下发'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {instance.failReason || '-'}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 安全检测确认弹窗 */}
      <AlertDialog open={securityScanDialogOpen} onOpenChange={setSecurityScanDialogOpen}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              提交安全检测
              <span className="relative group">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 cursor-default">限免</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-[4px] bg-gray-800 text-white text-xs leading-relaxed whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  限时免费，该检测能力正在公测中，暂不收费，<br />后续如需收费，仅对增量检测收费，并及时与您同步收费方式。
                </span>
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              确认对技能「{skill.name}」提交安全检测？检测将由腾讯云 AI Agent 安全进行，通常几分钟内完成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSecurityScan}
             
              className="text-white border-0"
            >
              确认检测
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
