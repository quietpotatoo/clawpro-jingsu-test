import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Search, Grid3x3, List, Send, MoreHorizontal, Download, Trash2, Pencil, Loader, ChevronDown, Check, Edit2, ShieldCheck, ShieldAlert, ShieldX, ScanSearch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';
import { MOCK_SKILLS, DEFAULT_CATEGORIES, MOCK_OPENCLAW_INSTANCES, MOCK_GROUPS } from './mockData';
import SkillUploadDialog from './SkillUploadDialog';
import SkillDetail from './SkillDetail';
import BatchDistributeDialog from './BatchDistributeDialog';
import EditCategoriesDialog from './EditCategoriesDialog';
import EditScopePopover from './EditScopeDialog';
import SkillUpdateDialog from './SkillUpdateDialog';
import DeleteSkillDialog from './DeleteSkillDialog';
import { Skill, type SkillScope, SECURITY_STATUS_MAP, type SecurityStatus } from './types';
import {
  getSkillDistributionSummary,
  addDistributionRecord,
  updateDistributionRecord,
  createDistributionRecordId,
  type CachedDistributionRecord,
  type SkillDistributionSummary,
} from './distributionCache';
import { downloadSkillAsZip } from './downloadUtils';

// localStorage 缓存 key
const SKILLS_CACHE_KEY = 'skillhub_enterprise_skills_cache';
const SKILLS_CACHE_VERSION_KEY = 'skillhub_enterprise_skills_cache_version';
// 当 MOCK 数据结构变更时递增此版本号，强制刷新缓存
const SKILLS_CACHE_VERSION = '8';

// 从 localStorage 加载缓存的 skills
const loadCachedSkills = (): Skill[] => {
  try {
    const cachedVersion = localStorage.getItem(SKILLS_CACHE_VERSION_KEY);
    // 缓存版本不匹配时清除旧缓存，使用最新 MOCK 数据
    if (cachedVersion !== SKILLS_CACHE_VERSION) {
      localStorage.removeItem(SKILLS_CACHE_KEY);
      localStorage.setItem(SKILLS_CACHE_VERSION_KEY, SKILLS_CACHE_VERSION);
      return MOCK_SKILLS;
    }
    const cached = localStorage.getItem(SKILLS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 恢复 Date 对象
      return parsed.map((s: any) => ({
        ...s,
        uploadTime: new Date(s.uploadTime),
        lastDistributionTime: s.lastDistributionTime ? new Date(s.lastDistributionTime) : undefined,
      }));
    }
  } catch (e) {
    console.warn('加载缓存 skills 失败:', e);
  }
  return MOCK_SKILLS;
};

// 保存 skills 到 localStorage
const saveCachedSkills = (skills: Skill[]) => {
  try {
    localStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify(skills));
    localStorage.setItem(SKILLS_CACHE_VERSION_KEY, SKILLS_CACHE_VERSION);
  } catch (e) {
    console.warn('缓存 skills 失败:', e);
  }
};

interface SkillListTabProps {
  onSelectSkill?: (skillId: string) => void;
}

/** 仅当子元素文本溢出（出现 ...）时，hover 1s 后才显示 Tooltip */
function OverflowTooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);

  return (
    <Tooltip
      delayDuration={1000}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const el = triggerRef.current;
          if (el && el.scrollWidth > el.clientWidth) {
            setOpen(true);
          }
          // 没溢出时 open 保持 false，tooltip 不弹
        } else {
          setOpen(false);
        }
      }}
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{content}</TooltipContent>
    </Tooltip>
  );
}

export default function SkillListTab({ onSelectSkill }: SkillListTabProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>(loadCachedSkills);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [defaultTabForDetail, setDefaultTabForDetail] = useState<string>('overview');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [distributeSkillId, setDistributeSkillId] = useState<string | null>(null);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillCategories, setEditingSkillCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateSkillId, setUpdateSkillId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null);
  const [downloadingSkillId, setDownloadingSkillId] = useState<string | null>(null);
  // 安全检测确认弹窗
  const [securityScanDialogOpen, setSecurityScanDialogOpen] = useState(false);
  const [securityScanSkillId, setSecurityScanSkillId] = useState<string | null>(null);
  // 默认行为设置
  const [defaultSecurityScan, setDefaultSecurityScan] = useState<boolean>(() => {
    const saved = localStorage.getItem('skill_default_security_scan');
    return saved !== null ? saved === 'true' : true;
  });
  // 应用范围筛选：含 'public'=全部用户, 含 'grp-xxx'=特定分组（多选）
  // 空 Set = 未选任何范围（按钮显示"选择应用范围"）；全选时包含 public + 所有 groupId
  const allScopeKeys = useMemo(() => ['public', ...MOCK_GROUPS.map(g => g.id)], []);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  // 保存编辑弹窗打开前的滚动位置（含表格水平滚动），关闭后恢复
  const scrollPositionRef = useRef<{ x: number; y: number; tableScrollLeft?: number } | null>(null);
  // 表格水平滚动容器 ref
  const tableScrollRef = useRef<HTMLDivElement>(null);
  // 名称列右侧投影：仅在横向滚动 > 0 时显示
  const [isTableScrolled, setIsTableScrolled] = useState(false);
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsTableScrolled(el.scrollLeft > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [viewMode]);

  // 下发状态缓存：key 是 skillId，value 是摘要
  const [distributionSummaries, setDistributionSummaries] = useState<Record<string, SkillDistributionSummary>>({});

  // skills 变化时同步到 localStorage
  useEffect(() => {
    saveCachedSkills(skills);
  }, [skills]);

  // 追踪已启动检测计时器的 skill ID，避免重复
  const scanTimersRef = useRef<Set<string>>(new Set());

  // 对所有处于 scanning 状态的 skill，mock 10s 后自动随机完成检测（实际提示为预计 5 分钟）
  useEffect(() => {
    const scanningSkills = skills.filter(
      s => s.securityInfo?.overallStatus === 'scanning' && !scanTimersRef.current.has(s.id)
    );
    if (scanningSkills.length === 0) return;

    const timers = scanningSkills.map(s => {
      scanTimersRef.current.add(s.id);
      return setTimeout(() => {
        const rand = Math.random();
        let result: SecurityStatus;
        if (rand < 0.5) result = 'safe';
        else if (rand < 0.8) result = 'suspicious';
        else result = 'malicious';

        const safeDims = [
          { name: '供应链风险', status: 'safe' as const, detail: '未发现可疑的第三方依赖引入或供应链污染行为' },
          { name: '命令执行风险', status: 'safe' as const, detail: '未检测到危险的系统命令调用或子进程执行操作' },
          { name: '网络请求与数据外传', status: 'safe' as const, detail: '未发现未经授权的网络请求或敏感数据外传行为' },
          { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
          { name: 'Prompt 注入风险', status: 'safe' as const, detail: '未发现试图篡改 AI Agent 行为的 Prompt 注入指令' },
          { name: '远程脚本下载执行', status: 'safe' as const, detail: '未检测到从远程服务器下载并执行脚本的行为' },
          { name: '可疑编码/混淆', status: 'safe' as const, detail: '未发现可疑的代码编码混淆或加密逃逸技术' },
          { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
        ];
        const suspiciousDims = [
          { name: '供应链风险', status: 'safe' as const, detail: '未发现可疑的第三方依赖引入或供应链污染行为' },
          { name: '命令执行风险', status: 'suspicious' as const, detail: '检测到潜在的系统命令调用，存在一定风险' },
          { name: '网络请求与数据外传', status: 'safe' as const, detail: '未发现未经授权的网络请求或敏感数据外传行为' },
          { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
          { name: 'Prompt 注入风险', status: 'safe' as const, detail: '未发现试图篡改 AI Agent 行为的 Prompt 注入指令' },
          { name: '远程脚本下载执行', status: 'safe' as const, detail: '未检测到从远程服务器下载并执行脚本的行为' },
          { name: '可疑编码/混淆', status: 'suspicious' as const, detail: '发现部分代码使用了 Base64 编码包裹，需人工确认' },
          { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
        ];
        const maliciousDims = [
          { name: '供应链风险', status: 'malicious' as const, detail: '发现恶意第三方依赖注入，存在供应链污染' },
          { name: '命令执行风险', status: 'malicious' as const, detail: '检测到危险的系统命令调用，执行反弹 shell' },
          { name: '网络请求与数据外传', status: 'malicious' as const, detail: '发现向外部 C2 服务器发送敏感数据' },
          { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
          { name: 'Prompt 注入风险', status: 'suspicious' as const, detail: '发现可能篡改 AI Agent 行为的指令片段' },
          { name: '远程脚本下载执行', status: 'malicious' as const, detail: '检测到从远程服务器下载并执行恶意脚本' },
          { name: '可疑编码/混淆', status: 'malicious' as const, detail: '发现大量代码使用多层编码混淆，隐藏恶意逻辑' },
          { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
        ];

        const dims = result === 'safe' ? safeDims : result === 'suspicious' ? suspiciousDims : maliciousDims;
        const score2 = result === 'safe' ? 85 : result === 'suspicious' ? 55 : 15;
        const engine2Status = result as 'safe' | 'suspicious' | 'malicious';

        setSkills(prev => prev.map(sk =>
          sk.id === s.id && sk.securityInfo?.overallStatus === 'scanning'
            ? {
                ...sk,
                securityInfo: {
                  overallStatus: result,
                  contentHash: Math.random().toString(36).slice(2, 18),
                  engines: [
                    { engineName: '科恩实验室', status: 'safe' as const, reportUrl: '#', score: 92, dimensions: safeDims },
                    { engineName: '云鼎实验室', status: engine2Status, reportUrl: '#', score: score2, dimensions: dims },
                  ],
                },
              }
            : sk
        ));
        scanTimersRef.current.delete(s.id);
        const resultLabel = result === 'safe' ? '安全' : result === 'suspicious' ? '可疑' : '恶意';
        toast.info(`「${s.name}」安全检测完成：${resultLabel}`);
      }, 10000);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [skills]);

  // 点击外部关闭应用范围下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 从缓存加载所有 skill 的下发摘要
  const refreshDistributionSummaries = useCallback(() => {
    const summaries: Record<string, SkillDistributionSummary> = {};
    skills.forEach(s => {
      const summary = getSkillDistributionSummary(s.id);
      if (summary) summaries[s.id] = summary;
    });
    setDistributionSummaries(summaries);
  }, [skills]);

  // 首次加载 + 监听缓存更新事件
  useEffect(() => {
    refreshDistributionSummaries();
    const handler = () => refreshDistributionSummaries();
    window.addEventListener('distribution-cache-updated', handler);
    return () => window.removeEventListener('distribution-cache-updated', handler);
  }, [refreshDistributionSummaries]);

  const getCategoryName = (catId: string) => {
    return DEFAULT_CATEGORIES.find((cat: any) => cat.id === catId)?.name || catId;
  };

  const getGroupName = (groupId: string) => {
    return MOCK_GROUPS.find(g => g.id === groupId)?.name || groupId;
  };

  /** 获取 Skill 的应用范围显示标签数组 */
  const getScopeLabels = (skill: Skill): string[] => {
    if (skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0) {
      return ['全部用户'];
    }
    return skill.groupIds.map(id => getGroupName(id));
  };

  /** 获取 Skill 的应用范围显示文本（用于卡片等单行场景） */
  const getScopeDisplay = (skill: Skill) => {
    return getScopeLabels(skill).join('、');
  };

  const filteredSkills = skills.filter((skill: any) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null ||
      skill.categories.some((catId: string) => catId === selectedCategory);
    // 应用范围筛选（多选）
    let matchesScope = true;
    if (selectedScopes.size === 0) {
      // 没有选中任何范围 → 不筛选，显示全部
      matchesScope = true;
    } else {
      const hasPublic = selectedScopes.has('public');
      const groupScopes = Array.from(selectedScopes).filter(s => s !== 'public');
      // 满足任一选中条件即匹配
      const matchPublic = hasPublic && (skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0);
      const matchGroup = groupScopes.length > 0 && skill.scope === 'private' && skill.groupIds?.some(gid => selectedScopes.has(gid));
      matchesScope = !!(matchPublic || matchGroup);
    }
    return matchesSearch && matchesCategory && matchesScope;
  });

  const sortedSkills = [...filteredSkills].sort((a, b) => {
    return b.uploadTime.getTime() - a.uploadTime.getTime();
  });

  const handleUploadSkill = (skillData: any) => {
    // skillData 已经是 SkillUploadDialog 中构造好的完整 Skill 对象
    // 确保必要字段存在
    const newSkill: Skill = {
      ...skillData,
      id: skillData.id || `skill-${Date.now()}`,
      uploadTime: skillData.uploadTime instanceof Date ? skillData.uploadTime : new Date(),
      versions: skillData.versions || [skillData.version || '1.0.0'],
      files: skillData.files || [],
    };
    setSkills(prev => {
      const updated = [...prev, newSkill];
      // 立即同步缓存，确保不丢数据
      saveCachedSkills(updated);
      return updated;
    });
  };

  // 安全检测提交确认
  const handleSecurityScanConfirm = () => {
    if (!securityScanSkillId) return;
    setSkills(prev => prev.map(s =>
      s.id === securityScanSkillId
        ? { ...s, securityInfo: { overallStatus: 'scanning' as SecurityStatus, engines: [] } }
        : s
    ));
    toast.success('已提交安全检测，预计 5 分钟后完成');
    setSecurityScanDialogOpen(false);
    setSecurityScanSkillId(null);
    // 模拟：10秒后随机变为安全/可疑/恶意（mock 模拟，实际预计 5 分钟）
    const targetId = securityScanSkillId;
    setTimeout(() => {
      const rand = Math.random();
      let result: SecurityStatus;
      if (rand < 0.5) result = 'safe';
      else if (rand < 0.8) result = 'suspicious';
      else result = 'malicious';

      const safeDims = [
        { name: '供应链风险', status: 'safe' as const, detail: '未发现可疑的第三方依赖引入或供应链污染行为' },
        { name: '命令执行风险', status: 'safe' as const, detail: '未检测到危险的系统命令调用或子进程执行操作' },
        { name: '网络请求与数据外传', status: 'safe' as const, detail: '未发现未经授权的网络请求或敏感数据外传行为' },
        { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
        { name: 'Prompt 注入风险', status: 'safe' as const, detail: '未发现试图篡改 AI Agent 行为的 Prompt 注入指令' },
        { name: '远程脚本下载执行', status: 'safe' as const, detail: '未检测到从远程服务器下载并执行脚本的行为' },
        { name: '可疑编码/混淆', status: 'safe' as const, detail: '未发现可疑的代码编码混淆或加密逃逸技术' },
        { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
      ];

      const suspiciousDims = [
        { name: '供应链风险', status: 'safe' as const, detail: '未发现可疑的第三方依赖引入或供应链污染行为' },
        { name: '命令执行风险', status: 'suspicious' as const, detail: '检测到潜在的系统命令调用，存在一定风险' },
        { name: '网络请求与数据外传', status: 'safe' as const, detail: '未发现未经授权的网络请求或敏感数据外传行为' },
        { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
        { name: 'Prompt 注入风险', status: 'safe' as const, detail: '未发现试图篡改 AI Agent 行为的 Prompt 注入指令' },
        { name: '远程脚本下载执行', status: 'safe' as const, detail: '未检测到从远程服务器下载并执行脚本的行为' },
        { name: '可疑编码/混淆', status: 'suspicious' as const, detail: '发现部分代码使用了 Base64 编码包裹，需人工确认' },
        { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
      ];

      const maliciousDims = [
        { name: '供应链风险', status: 'malicious' as const, detail: '发现恶意第三方依赖注入，存在供应链污染' },
        { name: '命令执行风险', status: 'malicious' as const, detail: '检测到危险的系统命令调用，执行反弹 shell' },
        { name: '网络请求与数据外传', status: 'malicious' as const, detail: '发现向外部 C2 服务器发送敏感数据' },
        { name: '文件操作与敏感路径访问', status: 'safe' as const, detail: '未检测到对敏感系统路径或凭证文件的异常访问' },
        { name: 'Prompt 注入风险', status: 'suspicious' as const, detail: '发现可能篡改 AI Agent 行为的指令片段' },
        { name: '远程脚本下载执行', status: 'malicious' as const, detail: '检测到从远程服务器下载并执行恶意脚本' },
        { name: '可疑编码/混淆', status: 'malicious' as const, detail: '发现大量代码使用多层编码混淆，隐藏恶意逻辑' },
        { name: '其他安全风险', status: 'safe' as const, detail: '未检测到其他类别的异常安全风险行为' },
      ];

      const dims = result === 'safe' ? safeDims : result === 'suspicious' ? suspiciousDims : maliciousDims;
      const score = result === 'safe' ? 92 : result === 'suspicious' ? 55 : 15;
      const engineStatus = result as 'safe' | 'suspicious' | 'malicious';

      setSkills(prev => prev.map(s =>
        s.id === targetId && s.securityInfo?.overallStatus === 'scanning'
          ? {
              ...s,
              securityInfo: {
                overallStatus: result,
                contentHash: Math.random().toString(36).slice(2, 18),
                engines: [
                  { engineName: '腾讯云 AI Agent 安全', status: engineStatus, reportUrl: '#', score, dimensions: dims },
                ],
              },
            }
          : s
      ));
      const resultLabel = result === 'safe' ? '安全' : result === 'suspicious' ? '可疑' : '恶意';
      toast.info(`安全检测完成：${resultLabel}`);
    }, 10000);
  };

  const handleViewDetail = (skillId: string) => {
    if (onSelectSkill) {
      onSelectSkill(skillId);
    } else {
      setSelectedSkillId(skillId);
    }
  };

  const handleDistribute = (skillId: string) => {
    setDistributeSkillId(skillId);
    setDistributeDialogOpen(true);
  };

  const handleDistributeStart = (selectedInstanceIds: string[], selectedInstancesData: any[]) => {
    if (!distributeSkillId) return;
    
    // 创建下发记录并写入缓存
    const recordId = createDistributionRecordId();
    const newRecord: CachedDistributionRecord = {
      id: recordId,
      skillId: distributeSkillId,
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
        distributionStatus: 'distributing' as const,
      })),
    };
    addDistributionRecord(newRecord);

    // 关闭对话框
    setDistributeDialogOpen(false);
    
    // 显示下发开始通知
    toast.success('已开始下发流程');

    // 模拟进度更新
    const totalCount = selectedInstanceIds.length;
    let completed = 0;
    const interval = setInterval(() => {
      completed += Math.floor(Math.random() * 3) + 1;
      if (completed >= totalCount) {
        completed = totalCount;
        clearInterval(interval);
        // 模拟随机失败
        const failedCount = Math.floor(Math.random() * 2);
        const successCount = totalCount - failedCount;
        // 完成下发 - 更新缓存
        updateDistributionRecord(recordId, (record) => ({
          ...record,
          successCount,
          failedCount,
          inProgressCount: 0,
          status: failedCount === 0 ? 'success' : 'failed',
          instances: record.instances.map((inst, idx) => ({
            ...inst,
            distributionStatus: idx < successCount ? 'success' as const : 'failed' as const,
          })),
        }));
        toast.success('下发完成');
      } else {
        // 更新进度 - 更新缓存
        updateDistributionRecord(recordId, (record) => ({
          ...record,
          successCount: completed,
          inProgressCount: totalCount - completed,
        }));
      }
    }, 800);
  };

  const handleViewDistributeProgress = () => {
    // 跳转到详情页的下发记录 Tab
    if (distributeSkillId) {
      setSelectedSkillId(distributeSkillId);
      setDistributeDialogOpen(false);
      setDefaultTabForDetail('distribution');
      // 设置默认 Tab 为下发记录
      setTimeout(() => {
        const tabTrigger = document.querySelector('[value="distribution"]') as HTMLElement;
        if (tabTrigger) tabTrigger.click();
      }, 100);
    }
  };

  // 更新 Skill
  const handleUpdate = (skillId: string) => {
    setUpdateSkillId(skillId);
    setUpdateDialogOpen(true);
  };

  const handleSkillUpdated = (updatedSkill: Skill) => {
    setSkills(prev => {
      const updated = prev.map(s => s.id === updatedSkill.id ? updatedSkill : s);
      saveCachedSkills(updated);
      return updated;
    });
    setUpdateDialogOpen(false);
    setUpdateSkillId(null);
  };

  // 删除 Skill
  const handleDelete = (skillId: string) => {
    setDeleteSkillId(skillId);
    setDeleteDialogOpen(true);
  };

  const handleSkillDeleted = () => {
    if (!deleteSkillId) return;
    const skillName = skills.find(s => s.id === deleteSkillId)?.name || '';
    setSkills(prev => {
      const updated = prev.filter(s => s.id !== deleteSkillId);
      saveCachedSkills(updated);
      return updated;
    });
    toast.success(`Skill「${skillName}」已删除`);
    setDeleteDialogOpen(false);
    setDeleteSkillId(null);
  };

  // 下载 Skill
  const handleDownload = async (skill: Skill) => {
    setDownloadingSkillId(skill.id);
    try {
      await downloadSkillAsZip(skill);
      toast.success(`「${skill.name}」下载完成`);
    } catch {
      toast.error('下载失败，请重试');
    } finally {
      setDownloadingSkillId(null);
    }
  };

  /** 检查某个 skill 是否有进行中的下发（用于禁用按钮） */
  const isDistributing = (skillId: string): boolean => {
    const summary = distributionSummaries[skillId];
    return summary?.hasInProgress || false;
  };

  // 如果选中了 Skill，显示详情页
  if (selectedSkillId) {
    return (
      <SkillDetail
        skillId={selectedSkillId}
        skills={skills}
        onBack={() => {
          setSelectedSkillId(null);
          setDefaultTabForDetail('overview');
        }}
        defaultTab={defaultTabForDetail}
        onSkillUpdate={(updatedSkill) => {
          setSkills(prev => {
            const updated = prev.map(s => s.id === updatedSkill.id ? updatedSkill : s);
            saveCachedSkills(updated);
            return updated;
          });
        }}
        onSkillDelete={(id) => {
          setSkills(prev => {
            const updated = prev.filter(s => s.id !== id);
            saveCachedSkills(updated);
            return updated;
          });
          setSelectedSkillId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索和工具栏 */}
      <div className="flex items-center justify-between gap-6">
        {/* 搜索框 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="搜索技能名称或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border border-gray-200"
          />
        </div>

        {/* 应用范围下拉筛选 — 多选 checkbox 层级结构 */}
        <div className="relative" ref={scopeDropdownRef}>
          <Tooltip delayDuration={1000} open={scopeDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setScopeDropdownOpen(prev => !prev)}
                  className="flex items-center justify-between gap-1 min-w-[10rem] max-w-[20rem] h-9 px-3 border border-gray-200 rounded-[4px] bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="truncate text-left">
                    {selectedScopes.size === 0
                      ? '选择应用范围'
                      : selectedScopes.size === allScopeKeys.length && allScopeKeys.every(k => selectedScopes.has(k))
                        ? '全部应用范围'
                        : Array.from(selectedScopes).map(s => s === 'public' ? '全部用户' : MOCK_GROUPS.find(g => g.id === s)?.name || s).join('、')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${scopeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px]">
                <p className="break-words">
                  {selectedScopes.size === 0
                    ? '选择应用范围'
                    : selectedScopes.size === allScopeKeys.length && allScopeKeys.every(k => selectedScopes.has(k))
                      ? '全部应用范围'
                      : Array.from(selectedScopes).map(s => s === 'public' ? '全部用户' : MOCK_GROUPS.find(g => g.id === s)?.name || s).join('、')}
                </p>
              </TooltipContent>
            </Tooltip>
          {scopeDropdownOpen && (() => {
            const filteredGroups = MOCK_GROUPS.filter(g => g.name.toLowerCase().includes(scopeSearchQuery.toLowerCase()));
            const showPublic = !scopeSearchQuery || '全部用户'.includes(scopeSearchQuery);
            const showGroupSection = !scopeSearchQuery || '按分组'.includes(scopeSearchQuery) || filteredGroups.length > 0;

            const toggleScope = (key: string) => {
              setSelectedScopes(prev => {
                const next = new Set(prev);
                if (next.has(key)) {
                  next.delete(key);
                } else {
                  next.add(key);
                }
                return next;
              });
            };

            return (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-[4px] shadow-lg z-50 py-1">
              {/* 搜索框 */}
              <div className="px-2 pb-1.5 pt-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    placeholder="搜索..."
                    value={scopeSearchQuery}
                    onChange={(e) => setScopeSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 h-8 text-sm border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              {/* 全部应用范围 — 全选/全不选切换 */}
              {(!scopeSearchQuery || '全部应用范围'.includes(scopeSearchQuery)) && (() => {
                const isAllSelected = allScopeKeys.length > 0 && allScopeKeys.every(k => selectedScopes.has(k));
                return (
                <button
                  type="button"
                  onClick={() => {
                    if (isAllSelected) {
                      // 全选状态 → 清空所有勾选
                      setSelectedScopes(new Set());
                    } else {
                      // 非全选（包括空Set或部分选中） → 全选
                      setSelectedScopes(new Set(allScopeKeys));
                    }
                    setScopeSearchQuery('');
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                    isAllSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                  }`}>
                    {isAllSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate text-left">全部应用范围</span>
                </button>
                );
              })()}
              {/* 全部用户 区域 */}
              {showPublic && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 select-none">
                    全部用户
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleScope('public')}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                      selectedScopes.has('public') ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedScopes.has('public') && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate text-left">全部用户</span>
                  </button>
                </>
              )}
              {/* 按分组 区域 */}
              {showGroupSection && (
                <>
                  <div className="px-3 pt-2.5 pb-1 text-xs font-medium text-gray-400 select-none">
                    按分组
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {filteredGroups.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleScope(group.id)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                          selectedScopes.has(group.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {selectedScopes.has(group.id) && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className="truncate text-left" title={group.name}>{group.name}</span>
                      </button>
                    ))}
                    {filteredGroups.length === 0 && !showPublic && scopeSearchQuery && (
                      <p className="text-xs text-gray-400 py-2 text-center">没有匹配的结果</p>
                    )}
                  </div>
                </>
              )}
              {/* 底部：已选数量 + 清除筛选 */}
              {selectedScopes.size > 0 && (
                <div className="border-t border-gray-100 mt-1 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">已选 {selectedScopes.size} 个应用范围</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScopes(new Set());
                      setScopeSearchQuery('');
                    }}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    清除
                  </button>
                </div>
              )}
            </div>
            );
          })()}
        </div>

        {/* 视图切换、发布按钮 */}
        <div className="flex items-center justify-end gap-4">

          {/* 视图切换 */}
          <div className="flex items-center gap-1 border border-gray-200 rounded p-1 bg-white">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'card'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="卡片视图"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setUploadDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              + 发布 Skill
            </Button>
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap border-t border-gray-200 pt-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-[4px] text-sm font-medium transition-all border ${
            selectedCategory === null
              ? 'text-white border-transparent'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
          }`}
          style={selectedCategory === null ? { backgroundColor: '#1447E6', borderColor: '#1447E6' } : undefined}
        >
          全部
        </button>
        {categories.map((cat: any) => (
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

      {/* 空状态 */}
      {sortedSkills.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">还没有发布任何 SKILL</p>
          <Button onClick={() => setUploadDialogOpen(true)} className="mt-4">
            + 发布 SKILL
          </Button>
        </div>
      )}

      {/* 卡片视图 */}
      {viewMode === 'card' && sortedSkills.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {sortedSkills.map(skill => {
            const summary = distributionSummaries[skill.id];
            const distributing = isDistributing(skill.id);
            return (
              <div
                key={skill.id}
                onClick={() => handleViewDetail(skill.id)}
                className="rounded-[4px] border border-gray-200 bg-white p-4 transition-all cursor-pointer hover:shadow-md hover:bg-gray-50"
              >
                {/* 名称 + 安全检测图标 + 版本 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{skill.name}</h3>
                    {/* 安全检测小图标 */}
                    {(() => {
                      const secStatus = skill.securityInfo?.overallStatus || 'not_scanned';
                      if (secStatus === 'not_scanned') {
                        return (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex flex-shrink-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <ShieldCheck className="w-3.5 h-3.5 text-gray-300" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <span className="text-xs">未检测</span>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      if (secStatus === 'scanning') {
                        return (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex flex-shrink-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <Loader className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <span className="text-xs">安全检测中</span>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      const statusInfo = SECURITY_STATUS_MAP[secStatus];
                      const IconComp = secStatus === 'safe' ? ShieldCheck : secStatus === 'suspicious' ? ShieldAlert : ShieldX;
                      return (
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex flex-shrink-0 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDefaultTabForDetail('overview');
                                setSelectedSkillId(skill.id);
                              }}
                            >
                              <IconComp className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <span className="text-xs">安全检测：{statusInfo.label}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex-shrink-0">
                    v{skill.version}
                  </span>
                </div>

                {/* 分类 — 灰色胶囊，最多两行 + +n，hover显示全部 */}
                <div className="flex flex-wrap gap-1 mb-3 items-center" style={{ maxHeight: '52px', overflow: 'hidden' }}>
                  {(() => {
                    const maxVisible = 3;
                    const total = skill.categories.length;
                    const visible = skill.categories.slice(0, maxVisible);
                    const overflow = total - maxVisible;
                    return (
                      <>
                        {visible.map((catId: string) => (
                          <span
                            key={catId}
                            className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap"
                          >
                            {getCategoryName(catId)}
                          </span>
                        ))}
                        {overflow > 0 && (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full cursor-default hover:bg-gray-200 transition-colors whitespace-nowrap">
                                +{overflow}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[320px]">
                              <div className="flex flex-wrap gap-1">
                                {skill.categories.map((catId: string) => (
                                  <span key={catId} className="inline-block px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">
                                    {getCategoryName(catId)}
                                  </span>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    );
                  })()}
                  <Tooltip delayDuration={1000}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollPositionRef.current = { x: window.scrollX, y: window.scrollY };
                            setEditingSkillId(skill.id);
                            setEditingSkillCategories(skill.categories);
                            setEditCategoryDialogOpen(true);
                          }}
                          className="p-0.5 text-gray-400 hover:text-gray-900 rounded transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        编辑分类
                      </TooltipContent>
                    </Tooltip>
                </div>

                {/* 描述 */}
                <Tooltip delayDuration={1000}>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2 cursor-default">{skill.description || '-'}</p>
                  </TooltipTrigger>
                  {skill.description && skill.description.length > 60 && (
                    <TooltipContent side="bottom" className="max-w-[320px]">
                      <p className="text-xs whitespace-pre-wrap">{skill.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                {/* 应用范围 — 使用 Popover 编辑 */}
                <div className="flex items-center gap-1 mb-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-gray-400">应用范围：</span>
                  <EditScopePopover
                    groups={MOCK_GROUPS}
                    currentScope={skill.scope || 'public'}
                    currentGroupIds={skill.groupIds || []}
                    scopeLabels={getScopeLabels(skill)}
                    isPublic={skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0}
                    onConfirm={(scope, groupIds) => {
                      setSkills(prev => prev.map(s =>
                        s.id === skill.id ? { ...s, scope, groupIds } : s
                      ));
                      toast.success('应用范围修改成功');
                    }}
                  />
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDistribute(skill.id)}
                    disabled={distributing}
                    className={`h-7 text-xs ${distributing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {distributing ? '下发中' : '下发'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdate(skill.id)}
                    disabled={distributing}
                    className={`h-7 text-xs ${distributing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    更新
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDownload(skill)}
                        disabled={downloadingSkillId === skill.id}
                      >
                        {downloadingSkillId === skill.id
                          ? <Loader className="w-4 h-4 mr-2 animate-spin" />
                          : <Download className="w-4 h-4 mr-2" />}
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(skill.id)}
                        disabled={distributing}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 表格视图 — 名称列固定左侧、操作列固定右侧，中间列可水平滚动 */}
      {viewMode === 'list' && sortedSkills.length > 0 && (
        <div className="bg-white rounded-[4px] border border-gray-200 overflow-hidden" style={{ boxShadow: '0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)' }}>
          <div className="overflow-x-auto" ref={tableScrollRef}>
            <table className="text-sm" style={{ minWidth: '1520px', width: '100%', tableLayout: 'fixed' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 sticky left-0 z-10 relative"
                    style={{ width: '180px', minWidth: '180px' }}
                  >
                    名称/Slug
                    {isTableScrolled && (
                      <>
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200" />
                        <div className="absolute top-0 bottom-0" style={{ right: '-6px', width: '6px', background: 'linear-gradient(to left, transparent, rgba(0,0,0,0.04))' }} />
                      </>
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wide" style={{ width: '150px', minWidth: '150px' }}>状态/下发动态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '80px', minWidth: '80px' }}>版本号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '370px', minWidth: '370px' }}>描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '200px', minWidth: '200px' }}>分类</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '200px', minWidth: '200px' }}>应用范围</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px', minWidth: '120px' }}>最后更新</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 sticky right-0 z-20 relative"
                    style={{ width: '220px', minWidth: '220px' }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="absolute top-0 bottom-0" style={{ left: '-6px', width: '6px', background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.04))' }} />
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSkills.map(skill => {
                  const summary = distributionSummaries[skill.id];
                  const distributing = isDistributing(skill.id);
                  
                  // 下发状态显示：两行结构
                  const hasDistribution = summary && summary.lastDistributionStatus !== 'not_distributed';
                  let statusLine1 = '正常'; // 第一行：状态
                  let statusLine2 = '未下发'; // 第二行：下发进度
                  let statusLine1Color = 'text-gray-700';
                  let statusLine2Color = 'text-gray-400';
                  let statusLine2Bg = ''; // 底色
                  let statusLine2HoverBg = ''; // hover 加深底色
                  if (summary) {
                    if (summary.lastDistributionStatus === 'distributing') {
                      statusLine1 = '下发中';
                      statusLine1Color = 'text-blue-600';
                      statusLine2 = `${summary.lastDistributionProgress || 0}%`;
                      statusLine2Color = 'text-blue-600';
                      statusLine2Bg = 'bg-blue-50';
                      statusLine2HoverBg = 'hover:bg-blue-100';
                    } else if (hasDistribution) {
                      statusLine1 = '正常';
                      statusLine1Color = 'text-gray-700';
                      const total = summary.lastDistributionInstanceCount || 0;
                      const success = summary.lastDistributionSuccessCount ?? total;
                      statusLine2 = `已下发（${success}/${total}成功）`;
                      if (success === total) {
                        statusLine2Color = 'text-green-600';
                        statusLine2Bg = 'bg-green-50';
                        statusLine2HoverBg = 'hover:bg-green-100';
                      } else {
                        statusLine2Color = 'text-yellow-600';
                        statusLine2Bg = 'bg-yellow-50';
                        statusLine2HoverBg = 'hover:bg-yellow-100';
                      }
                    }
                  }

                  return (
                    <tr
                      key={skill.id}
                      onClick={() => handleViewDetail(skill.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group"
                    >
                      {/* 名称 / Slug — 固定左侧 */}
                      <td
                        className="px-4 py-3 bg-white sticky left-0 z-10 group-hover:bg-gray-50 transition-colors relative"
                        style={{ minWidth: '180px', maxWidth: '260px' }}
                      >
                        {isTableScrolled && (
                          <>
                            <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200" />
                            <div className="absolute top-0 bottom-0" style={{ right: '-6px', width: '6px', background: 'linear-gradient(to left, transparent, rgba(0,0,0,0.04))' }} />
                          </>
                        )}
                        <div className="flex items-center gap-1.5">
                          <OverflowTooltip content={skill.name}>
                            <div className="font-medium text-gray-900 truncate max-w-[200px]">{skill.name}</div>
                          </OverflowTooltip>
                          {/* 安全检测小图标：所有状态都显示 */}
                          {(() => {
                            const secStatus = skill.securityInfo?.overallStatus || 'not_scanned';
                            if (secStatus === 'not_scanned') {
                              return (
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex flex-shrink-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                                      <ShieldCheck className="w-3.5 h-3.5 text-gray-300" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <span className="text-xs">未检测</span>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            if (secStatus === 'scanning') {
                              return (
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex flex-shrink-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                                      <Loader className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <span className="text-xs">安全检测中</span>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            const statusInfo = SECURITY_STATUS_MAP[secStatus];
                            const IconComp = secStatus === 'safe' ? ShieldCheck : secStatus === 'suspicious' ? ShieldAlert : ShieldX;
                            return (
                              <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex flex-shrink-0 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDefaultTabForDetail('overview');
                                      setSelectedSkillId(skill.id);
                                    }}
                                  >
                                    <IconComp className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <span className="text-xs">安全检测：{statusInfo.label}</span>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </div>
                        <OverflowTooltip content={skill.slug}>
                          <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[220px]">{skill.slug}</div>
                        </OverflowTooltip>
                      </td>
                      {/* 状态/最近下发进度 */}
                      <td className="px-4 py-3" style={{ minWidth: '150px' }}>
                        <div className={`text-sm font-medium ${statusLine1Color}`}>{statusLine1}</div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasDistribution) {
                              setDefaultTabForDetail('distribution');
                              setSelectedSkillId(skill.id);
                            }
                          }}
                          className={hasDistribution
                            ? `inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${statusLine2Color} ${statusLine2Bg} ${statusLine2HoverBg}`
                            : `text-xs mt-0.5 ${statusLine2Color}`
                          }
                        >
                          {statusLine2}
                        </div>
                      </td>
                      {/* 版本号 */}
                      <td className="px-4 py-3" style={{ minWidth: '80px' }}>
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                          v{skill.version}
                        </span>
                      </td>
                      {/* 描述 */}
                      <td className="px-4 py-3" style={{ minWidth: '370px', maxWidth: '370px', overflow: 'hidden' }}>
                        <Tooltip delayDuration={1000}>
                          <TooltipTrigger asChild>
                            <span
                              className="text-sm text-gray-600 cursor-default block"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-all',
                              }}
                            >{skill.description || '-'}</span>
                          </TooltipTrigger>
                          {skill.description && skill.description.length > 40 && (
                            <TooltipContent side="bottom" className="max-w-[400px]">
                              <p className="text-xs whitespace-pre-wrap">{skill.description}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>
                      {/* 分类 — 灰色胶囊标签，最多两行，超出 +N，hover显示全部 */}
                      <td className="px-4 py-3" style={{ minWidth: '200px' }} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const maxVisible = 3;
                          const total = skill.categories.length;
                          const visible = skill.categories.slice(0, maxVisible);
                          const overflow = total - maxVisible;
                          return (
                            <div className="flex items-center gap-1 flex-wrap" style={{ maxHeight: '52px', overflow: 'hidden' }}>
                              {visible.map((catId: string) => (
                                <span key={catId} className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                                  {getCategoryName(catId)}
                                </span>
                              ))}
                              {overflow > 0 && (
                                <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full cursor-default hover:bg-gray-200 transition-colors whitespace-nowrap">
                                        +{overflow}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[320px]">
                                      <span className="text-xs">
                                        {skill.categories.map((catId: string) => getCategoryName(catId)).join('，')}
                                      </span>
                                    </TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip delayDuration={1000}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        scrollPositionRef.current = { x: window.scrollX, y: window.scrollY, tableScrollLeft: tableScrollRef.current?.scrollLeft };
                                        setEditingSkillId(skill.id);
                                        setEditingSkillCategories(skill.categories);
                                        setEditCategoryDialogOpen(true);
                                      }}
                                      className="p-0.5 text-gray-400 hover:text-gray-900 rounded transition-colors flex-shrink-0"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    编辑分类
                                  </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })()}
                      </td>
                      {/* 应用范围 — 使用 Popover 编辑 */}
                      <td className="px-4 py-3" style={{ minWidth: '140px' }} onClick={(e) => e.stopPropagation()}>
                        <EditScopePopover
                          groups={MOCK_GROUPS}
                          currentScope={skill.scope || 'public'}
                          currentGroupIds={skill.groupIds || []}
                          scopeLabels={getScopeLabels(skill)}
                          isPublic={skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0}
                          onConfirm={(scope, groupIds) => {
                            setSkills(prev => prev.map(s =>
                              s.id === skill.id ? { ...s, scope, groupIds } : s
                            ));
                            toast.success('应用范围修改成功');
                          }}
                        />
                      </td>
                      {/* 最后更新时间 */}
                      <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                        <span className="text-sm text-gray-500">
                          {skill.uploadTime.toLocaleDateString('zh-CN')}
                        </span>
                      </td>
                      {/* 操作 — 固定右侧：下发 / 更新 / 更多(下载、删除) */}
                      <td
                        className="px-4 py-3 bg-white sticky right-0 z-20 group-hover:bg-gray-50 transition-colors relative"
                        style={{ minWidth: '220px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                        <div className="absolute top-0 bottom-0" style={{ left: '-6px', width: '6px', background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.04))' }} />
                        <div className="flex items-center gap-1">
                          {/* 下发按钮 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDistribute(skill.id)}
                            disabled={distributing}
                            className={`h-7 text-xs min-w-[62px] ${distributing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            {distributing ? '下发中' : '下发'}
                          </Button>
                          {/* 更新按钮 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdate(skill.id)}
                            disabled={distributing}
                            className={`h-7 text-xs ${distributing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            更新
                          </Button>
                          {/* 更多下拉：安全检测 / 下载 / 删除 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {/* 安全检测（仅未检测时显示） */}
                              {(skill.securityInfo?.overallStatus === 'not_scanned' || !skill.securityInfo) && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSecurityScanSkillId(skill.id);
                                    setSecurityScanDialogOpen(true);
                                  }}
                                >
                                  <ScanSearch className="w-4 h-4 mr-2" />
                                  安全检测
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDownload(skill)}
                                disabled={downloadingSkillId === skill.id}
                              >
                                {downloadingSkillId === skill.id
                                  ? <Loader className="w-4 h-4 mr-2 animate-spin" />
                                  : <Download className="w-4 h-4 mr-2" />}
                                下载
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(skill.id)}
                                disabled={distributing}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SkillUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onConfirm={handleUploadSkill}
        existingSlugs={skills.map(s => s.slug)}
        defaultSecurityScan={defaultSecurityScan}
        onDefaultSecurityScanChange={(value) => {
          setDefaultSecurityScan(value);
          localStorage.setItem('skill_default_security_scan', String(value));
          toast.success('默认行为已保存');
        }}
      />

      {distributeSkillId && (
        <BatchDistributeDialog
          open={distributeDialogOpen}
          onOpenChange={setDistributeDialogOpen}
          skillName={skills.find(s => s.id === distributeSkillId)?.name || ''}
          skillVersion={skills.find(s => s.id === distributeSkillId)?.version}
          skillScope={skills.find(s => s.id === distributeSkillId)?.scope}
          skillGroupIds={skills.find(s => s.id === distributeSkillId)?.groupIds}
          onDistributionStart={handleDistributeStart}
          instances={MOCK_OPENCLAW_INSTANCES}
          groups={MOCK_GROUPS}
        />
      )}

      {/* 更新对话框 */}
      {updateSkillId && (() => {
        const updateSkill = skills.find(s => s.id === updateSkillId);
        return updateSkill ? (
          <SkillUpdateDialog
            open={updateDialogOpen}
            onOpenChange={(open) => {
              setUpdateDialogOpen(open);
              if (!open) setUpdateSkillId(null);
            }}
            skill={updateSkill}
            onConfirm={handleSkillUpdated}
            defaultSecurityScan={defaultSecurityScan}
            onDefaultSecurityScanChange={(value) => {
              setDefaultSecurityScan(value);
              localStorage.setItem('skill_default_security_scan', String(value));
              toast.success('默认行为已保存');
            }}
          />
        ) : null;
      })()}

      {/* 删除确认对话框 */}
      {deleteSkillId && (
        <DeleteSkillDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteSkillId(null);
          }}
          skillName={skills.find(s => s.id === deleteSkillId)?.name || ''}
          onConfirm={handleSkillDeleted}
        />
      )}

       {/* 编辑分类弹窗 */}
      <EditCategoriesDialog
        open={editCategoryDialogOpen}
        onOpenChange={(open) => {
          setEditCategoryDialogOpen(open);
          if (!open) {
            setEditingSkillId(null);
            setEditingSkillCategories([]);
            // 恢复弹窗打开前的滚动位置
            if (scrollPositionRef.current) {
              const saved = scrollPositionRef.current;
              requestAnimationFrame(() => {
                window.scrollTo(saved.x, saved.y);
                if (saved.tableScrollLeft !== undefined && tableScrollRef.current) {
                  tableScrollRef.current.scrollLeft = saved.tableScrollLeft;
                }
                scrollPositionRef.current = null;
              });
            }
          }
        }}
        categories={categories}
        selectedCategoryIds={editingSkillCategories}
        skillName={editingSkillId ? skills.find(s => s.id === editingSkillId)?.name : undefined}
        onConfirm={(selectedCategoryIds) => {
          if (editingSkillId) {
            setSkills(prev => prev.map(skill => 
              skill.id === editingSkillId 
                ? { ...skill, categories: selectedCategoryIds }
                : skill
            ));
            toast.success('分类修改成功');
            setEditCategoryDialogOpen(false);
            setEditingSkillId(null);
            setEditingSkillCategories([]);
            // 恢复弹窗打开前的滚动位置
            if (scrollPositionRef.current) {
              const saved = scrollPositionRef.current;
              requestAnimationFrame(() => {
                window.scrollTo(saved.x, saved.y);
                if (saved.tableScrollLeft !== undefined && tableScrollRef.current) {
                  tableScrollRef.current.scrollLeft = saved.tableScrollLeft;
                }
                scrollPositionRef.current = null;
              });
            }
          }
        }}
      />

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
              确认对技能「{securityScanSkillId ? skills.find(s => s.id === securityScanSkillId)?.name : ''}」提交安全检测？检测将由腾讯云 AI Agent 安全进行，通常几分钟内完成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSecurityScanDialogOpen(false); setSecurityScanSkillId(null); }}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSecurityScanConfirm}
              className="text-white"
             
            >
              提交检测
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
