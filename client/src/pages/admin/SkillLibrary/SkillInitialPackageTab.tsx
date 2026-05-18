/**
 * 技能初始包 Tab
 * 设计风格：浅色主题，草稿+发布分离，生效开关
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, ArrowLeft, Package, Globe, AlertTriangle,
  CheckCircle2, Clock, ChevronRight, X, AlertCircle, Sparkles,
  Search, RefreshCw, ChevronDown, Check, Edit2, Filter, Users, Pin
} from 'lucide-react';
import { INITIAL_SKILL_PACKAGES_DEFAULT, PUBLIC_SKILLS, type PublicSkill, type SkillInitialPackage, type PackageSkillItem } from './publicSkillMockData';
import { Star } from 'lucide-react';
import { MOCK_SKILLS, DEFAULT_CATEGORIES, MOCK_GROUPS } from './mockData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EditScopePopover from './EditScopeDialog';
import { type SkillScope } from './types';

// ─── 公共技能库添加弹窗 ──────────────────────────────────────────────────────────

// 公共技能库收藏列表（mock）
const MOCK_FAVORITES: PublicSkill[] = PUBLIC_SKILLS.slice(0, 5);

interface AddPublicSkillDialogProps {
  open: boolean;
  existingSkillIds: string[];
  onConfirm: (skills: PackageSkillItem[]) => void;
  onCancel: () => void;
}

function AddPublicSkillDialog({ open, existingSkillIds, onConfirm, onCancel }: AddPublicSkillDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSkill = (skillId: string) => {
    setSelectedIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleConfirm = () => {
    const newSkills: PackageSkillItem[] = selectedIds.map(id => {
      const skill = MOCK_FAVORITES.find(s => s.id === id)!;
      return {
        skillId: skill.id,
        skillName: skill.slug,
        skillNameZh: skill.nameZh,
        source: 'public' as const,
        version: skill.version,
        addedAt: new Date(),
      };
    });
    onConfirm(newSkills);
    setSelectedIds([]);
  };

  const handleCancel = () => {
    setSelectedIds([]);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="!max-w-4xl p-0 overflow-hidden" style={{ height: '640px', display: 'flex', flexDirection: 'column' }}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <DialogTitle>从公共技能库添加</DialogTitle>
        </DialogHeader>

        {/* 收藏分区标题 */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            我的收藏
          </div>
        </div>

        {/* 技能列表 */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {MOCK_FAVORITES.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">还没有收藏任何技能</p>
              <p className="text-xs mt-1">可先前往公共技能库收藏技能</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {MOCK_FAVORITES.map(skill => {
                const isAlreadyAdded = existingSkillIds.includes(skill.id);
                const isSelected = selectedIds.includes(skill.id);
                return (
                  <div
                    key={skill.id}
                    onClick={() => !isAlreadyAdded && toggleSkill(skill.id)}
                    className={`relative rounded-[4px] border p-3 transition-all ${
                      isAlreadyAdded
                        ? 'border-gray-200 bg-gray-100 opacity-40 cursor-not-allowed'
                        : isSelected
                          ? 'border-blue-400 bg-blue-50 cursor-pointer'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {isAlreadyAdded && (
                      <div className="absolute top-2 right-2 text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">已添加</div>
                    )}
                    {/* 技能名称（英文）+ 版本号 */}
                    <div className="flex items-center gap-2 mb-1.5 pr-8">
                      <span className="font-mono font-medium text-sm text-gray-900 truncate min-w-0">{skill.name}</span>
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">v{skill.version}</span>
                    </div>
                    {/* 描述（中文） */}
                    <p className="text-xs text-gray-500 line-clamp-2">{skill.descriptionZh}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-gray-100 shrink-0">
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
          >
            确认添加{selectedIds.length > 0 ? `（${selectedIds.length} 个）` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 企业技能库添加弹窗 ──────────────────────────────────────────────────────────

interface AddEnterpriseSkillDialogProps {
  open: boolean;
  existingSkillIds: string[];
  onConfirm: (skills: PackageSkillItem[]) => void;
  onCancel: () => void;
  /** 当前技能包的应用范围类型 */
  pkgScopeType?: 'public' | 'private';
  /** 当前技能包关联的分组 ID 列表 */
  pkgGroupIds?: string[];
}

function AddEnterpriseSkillDialog({ open, existingSkillIds, onConfirm, onCancel, pkgScopeType, pkgGroupIds }: AddEnterpriseSkillDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  /** 应用范围多选筛选：空数组=全部, ['__none__']=全不选, ['__public__']=全部用户, ['grp-x']=特定分组 */
  const [scopeFilters, setScopeFilters] = useState<string[]>([]);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

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

  // 打开时根据技能包应用范围设置默认筛选
  // 规则：【全部用户】默认必勾选
  // 如果技能包是【全部用户】的，只勾选【全部用户】，不再多勾其他
  // 如果技能包不是【全部用户】的，勾选【全部用户】+ 该包关联的分组
  useEffect(() => {
    if (open) {
      if (pkgScopeType === 'public') {
        // 全部用户的初始技能包：只勾选【全部用户】
        setScopeFilters(['__public__']);
      } else if (pkgScopeType === 'private' && pkgGroupIds && pkgGroupIds.length > 0) {
        // 非全部用户的初始技能包：勾选【全部用户】+ 关联分组
        setScopeFilters(['__public__', ...pkgGroupIds]);
      } else {
        setScopeFilters(['__public__']);
      }
      setScopeDropdownOpen(false);
      setScopeSearchQuery('');
    }
  }, [open, pkgScopeType, pkgGroupIds]);

  const toggleSkill = (skillId: string) => {
    setSelectedIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleConfirm = () => {
    const newSkills: PackageSkillItem[] = selectedIds.map(id => {
      const skill = MOCK_SKILLS.find(s => s.id === id)!;
      return {
        skillId: skill.id,
        skillName: skill.slug,
        skillNameZh: skill.name,
        source: 'enterprise' as const,
        version: skill.version,
        addedAt: new Date(),
      };
    });
    onConfirm(newSkills);
    setSelectedIds([]);
    setActiveCategory('all');
    setSearchQuery('');
  };

  const handleCancel = () => {
    setSelectedIds([]);
    setActiveCategory('all');
    setSearchQuery('');
    setScopeFilters([]);
    setScopeDropdownOpen(false);
    setScopeSearchQuery('');
    onCancel();
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedIds([]);
    setScopeFilters([]);
    setScopeDropdownOpen(false);
    setScopeSearchQuery('');
  };

  const filteredSkills = MOCK_SKILLS.filter(s => {
    const matchCategory = activeCategory === 'all' || s.categories.includes(activeCategory);
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = q === '' || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q);
    // 应用范围筛选（未选或全选时不过滤）
    let matchScope = true;
    if (scopeFilters.length > 0) {
      const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
      const allSelected = allIds.every(id => scopeFilters.includes(id));
      if (!allSelected) {
        matchScope = false;
        if (scopeFilters.includes('__public__') && s.scope === 'public') {
          matchScope = true;
        }
        // 检查技能是否关联了选中的分组
        const selectedGroupIds = scopeFilters.filter(f => f !== '__public__' && f !== '__none__');
        if (selectedGroupIds.length > 0 && s.groupIds) {
          if (selectedGroupIds.some(gid => s.groupIds.includes(gid))) {
            matchScope = true;
          }
        }
      }
    }
    return matchCategory && matchSearch && matchScope;
  });

  const renderSkillCard = (skill: typeof MOCK_SKILLS[0]) => {
    const isAlreadyAdded = existingSkillIds.includes(skill.id);
    const isSelected = selectedIds.includes(skill.id);

    // 应用范围标签
    const scopeLabelsArr: string[] = (skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0)
      ? ['全部用户']
      : skill.groupIds.map(id => MOCK_GROUPS.find(g => g.id === id)?.name || id);
    const isPublicScope = skill.scope === 'public' || !skill.groupIds || skill.groupIds.length === 0;

    return (
      <div
        key={skill.id}
        onClick={() => !isAlreadyAdded && toggleSkill(skill.id)}
        className={`relative rounded-[4px] border p-3 transition-all ${
          isAlreadyAdded
            ? 'border-gray-200 bg-gray-100 opacity-40 cursor-not-allowed'
            : isSelected
              ? 'border-blue-400 bg-blue-50 cursor-pointer'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
        }`}
      >
        {isSelected && (
          <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center z-10">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
        {isAlreadyAdded && (
          <div className="absolute top-2 right-2 text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded z-10">已添加</div>
        )}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm text-gray-900 truncate min-w-0">{skill.name}</span>
            <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">v{skill.version}</span>
          </div>
          {/* 应用范围标签 - 右上角 */}
          <div className="flex items-center gap-1 shrink-0">
            {isPublicScope ? (
              <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-full whitespace-nowrap">
                全部用户
              </span>
            ) : (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-default">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full max-w-[80px] truncate">
                      {scopeLabelsArr[0]}
                    </span>
                    {scopeLabelsArr.length > 1 && (
                      <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full whitespace-nowrap">
                        +{scopeLabelsArr.length - 1}
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                  {scopeLabelsArr.join('，')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{skill.description}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="!max-w-4xl p-0 overflow-hidden" style={{ height: '640px', display: 'flex', flexDirection: 'column' }} onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <DialogTitle>从企业技能库添加</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 搜索框 + 应用范围筛选 + 刷新按钮 */}
          <div className="px-5 pt-3 pb-2 shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索技能名称或描述..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-[4px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            {/* 应用范围多选下拉 — 层级结构：全部应用范围 / 全部用户 / 按分组 */}
            <div className="relative" ref={scopeDropdownRef}>
              <Tooltip delayDuration={1000} open={scopeDropdownOpen ? false : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setScopeDropdownOpen(prev => !prev)}
                    className="flex items-center justify-between gap-1 min-w-[10rem] max-w-[16rem] h-9 px-3 border border-gray-200 rounded-[4px] bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate text-left text-xs">
                      {(() => {
                        const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
                        const allSelected = allIds.every(id => scopeFilters.includes(id));
                        if (scopeFilters.length === 0 || allSelected) return '全部应用范围';
                        if (scopeFilters.includes('__public__') && scopeFilters.length === 1) return '全部用户';
                        const count = scopeFilters.filter(f => f !== '__public__').length + (scopeFilters.includes('__public__') ? 1 : 0);
                        return `已选 ${count} 项`;
                      })()}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${scopeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px]">
                  <p className="break-words text-xs">
                    {(() => {
                      const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
                      const allSelected = allIds.every(id => scopeFilters.includes(id));
                      if (scopeFilters.length === 0 || allSelected) return '全部应用范围';
                      return scopeFilters.map(f => f === '__public__' ? '全部用户' : MOCK_GROUPS.find(g => g.id === f)?.name || f).join('、');
                    })()}
                  </p>
                </TooltipContent>
              </Tooltip>
              {scopeDropdownOpen && (() => {
                const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
                const allSelected = allIds.every(id => scopeFilters.includes(id));
                const filteredGroups = MOCK_GROUPS.filter(g => g.name.toLowerCase().includes(scopeSearchQuery.toLowerCase()));
                const showPublic = !scopeSearchQuery || '全部用户'.includes(scopeSearchQuery);
                const showGroupSection = !scopeSearchQuery || '按分组'.includes(scopeSearchQuery) || filteredGroups.length > 0;

                const toggleScopeItem = (key: string) => {
                  setScopeFilters(prev => {
                    if (prev.includes(key)) return prev.filter(f => f !== key);
                    return [...prev, key];
                  });
                };

                return (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-[4px] shadow-lg z-50 py-1">
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
                    {(!scopeSearchQuery || '全部应用范围'.includes(scopeSearchQuery)) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (allSelected) {
                            setScopeFilters([]);
                          } else {
                            setScopeFilters(allIds);
                          }
                          setScopeSearchQuery('');
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors text-gray-700"
                      >
                        <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                          allSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {allSelected && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className="truncate text-left">全部应用范围</span>
                      </button>
                    )}
                    {/* 全部用户 区域 */}
                    {showPublic && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 select-none">
                          全部用户
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleScopeItem('__public__')}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors text-gray-700"
                        >
                          <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                            scopeFilters.includes('__public__') ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                          }`}>
                            {scopeFilters.includes('__public__') && <Check className="w-3 h-3 text-white" />}
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
                          {filteredGroups.map(group => {
                            const checked = scopeFilters.includes(group.id);
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => toggleScopeItem(group.id)}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors text-gray-700"
                              >
                                <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
                                  checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                }`}>
                                  {checked && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="truncate text-left" title={group.name}>{group.name}</span>
                              </button>
                            );
                          })}
                          {filteredGroups.length === 0 && !showPublic && scopeSearchQuery && (
                            <p className="text-xs text-gray-400 py-2 text-center">没有匹配的结果</p>
                          )}
                        </div>
                      </>
                    )}
                    {/* 底部已选信息 + 清除 */}
                    {scopeFilters.length > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 mt-1">
                        <span className="text-xs text-gray-500">
                          已选 {scopeFilters.filter(f => f !== '__public__').length + (scopeFilters.includes('__public__') ? 1 : 0)} 项
                        </span>
                        <button
                          onClick={() => { setScopeFilters([]); setScopeSearchQuery(''); }}
                          className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          清除
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-[4px] border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-500 hover:text-gray-700"
              title="刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* 分类标签 */}
          <div className="px-5 pb-3 shrink-0 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {DEFAULT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* 技能卡片列表 */}
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {filteredSkills.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredSkills.map(skill => renderSkillCard(skill))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无匹配的技能</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t border-gray-100 shrink-0">
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
          >
            确认添加{selectedIds.length > 0 ? `（${selectedIds.length} 个）` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 新建技能包对话框 ──────────────────────────────────────────────────────────

interface CreatePackageDialogProps {
  open: boolean;
  existingNames: string[];
  onConfirm: (name: string, scopeType: 'public' | 'private', groupIds: string[]) => void;
  onCancel: () => void;
}

function CreatePackageDialog({ open, existingNames, onConfirm, onCancel }: CreatePackageDialogProps) {
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<'public' | 'private'>('public');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  const trimmed = name.trim();

  const handleConfirm = () => {
    if (!trimmed) return;
    if (existingNames.includes(trimmed)) {
      toast.error('初始技能包名称不可重复');
      return;
    }
    if (scopeType === 'private' && groupIds.length === 0) {
      toast.error('请至少选择一个分组');
      return;
    }
    onConfirm(trimmed, scopeType, groupIds);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setScopeType('public');
    setGroupIds([]);
    setGroupSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onCancel(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新建初始技能包</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 my-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">技能包名称</label>
            <Input
              placeholder="例如：全员通用技能包"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
          </div>
          {/* 应用范围 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">应用范围</label>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setScopeType('public'); setGroupIds([]); }}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                    scopeType === 'public'
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  全部用户
                </button>
                <button
                  onClick={() => setScopeType('private')}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                    scopeType === 'private'
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  按分组
                </button>

                {/* 选择按分组后，右侧出现下拉选择器 */}
                {scopeType === 'private' && (
                  <Popover>
                    <Tooltip delayDuration={1000}>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors min-w-[120px]">
                            <span className="truncate">
                              {groupIds.length > 0
                                ? `已选 ${groupIds.length} 个分组`
                                : '选择分组…'}
                            </span>
                            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      {groupIds.length > 0 && (
                        <TooltipContent side="bottom" className="max-w-[280px]">
                          <p className="text-xs leading-relaxed">
                            {groupIds.map(gid => MOCK_GROUPS.find(g => g.id === gid)?.name || gid).join('，')}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <PopoverContent className="w-64 p-0" align="start" sideOffset={6}>
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            placeholder="搜索分组…"
                            value={groupSearchQuery}
                            onChange={(e) => setGroupSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-[4px] bg-gray-50 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {MOCK_GROUPS
                          .filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                          .map(group => {
                            const checked = groupIds.includes(group.id);
                            return (
                              <button
                                key={group.id}
                                onClick={() => {
                                  setGroupIds(prev =>
                                    prev.includes(group.id)
                                      ? prev.filter(id => id !== group.id)
                                      : [...prev, group.id]
                                  );
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-gray-50 transition-colors text-left"
                              >
                                <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                  checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                                }`}>
                                  {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <span className="text-xs text-gray-700 truncate">{group.name}</span>
                              </button>
                            );
                          })}
                        {MOCK_GROUPS.filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 && (
                          <p className="text-[11px] text-gray-400 py-3 text-center">无匹配分组</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                        <p className="text-[11px] text-gray-400">
                          已选 {groupIds.length} 个分组
                        </p>
                        {groupIds.length > 0 && (
                          <button
                            onClick={() => setGroupIds([])}
                            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            清除
                          </button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => { resetForm(); onCancel(); }}>取消</Button>
          <Button onClick={handleConfirm} disabled={!trimmed || (scopeType === 'private' && groupIds.length === 0)}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 发布确认对话框 ────────────────────────────────────────────────────────────

interface PublishConfirmDialogProps {
  open: boolean;
  packageName: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function PublishConfirmDialog({ open, packageName, isActive, onConfirm, onCancel }: PublishConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>确认保存修改</DialogTitle>
        </DialogHeader>
        <div className="my-2">
          <p className="text-sm text-gray-600">
            本次修改将<strong className="text-gray-800">应用于新创建的 Agent</strong>，已创建的 Agent 保持原有初始配置不受影响。
          </p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={onConfirm}>
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认对话框 ────────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  packageName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ open, packageName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <div className="my-2">
          <p className="text-sm text-gray-600">
            确定要删除「<span className="font-medium text-gray-800">{packageName}</span>」吗？删除后不可恢复。
          </p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700">确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 获取技能包的应用范围显示标签数组 */
function getScopeLabels(pkg: SkillInitialPackage): string[] {
  if (pkg.scopeType === 'public' || !pkg.groupIds || pkg.groupIds.length === 0) {
    return ['全部用户'];
  }
  return pkg.groupIds.map(id => MOCK_GROUPS.find(g => g.id === id)?.name || id);
}

/** 判断技能包是否为全员范围 */
function isPublicScope(pkg: SkillInitialPackage): boolean {
  return pkg.scopeType === 'public' || !pkg.groupIds || pkg.groupIds.length === 0;
}

// ─── 版本比对辅助函数 ─────────────────────────────────────────────────────────

/** 获取源库中技能的最新版本 */
function getLatestVersion(skill: PackageSkillItem): string | null {
  if (skill.source === 'public') {
    const pub = PUBLIC_SKILLS.find(s => s.id === skill.skillId);
    return pub?.version ?? null;
  } else {
    const ent = MOCK_SKILLS.find(s => s.id === skill.skillId);
    return ent?.version ?? null;
  }
}

/** 公共技能 mock 更新说明 */
const PUBLIC_SKILL_CHANGELOGS: Record<string, Record<string, string>> = {
  'pub-1': { '1.0.0': '首次发布' },
  'pub-2': { '2.1.0': '1、新增 gh api 高级查询功能\n2、修复 PR 合并冲突检测问题', '2.0.0': '重构核心模块，支持多仓库管理', '1.5.0': '新增 CI/CD 流水线触发功能' },
  'pub-3': { '3.2.1': '1、优化多源聚合排序算法\n2、新增内容摘要提取\n3、修复特定编码下的解析异常', '3.1.0': '新增搜索结果缓存机制' },
  'pub-4': { '1.4.0': '1、新增 TypeScript 深度检查\n2、优化安全漏洞扫描规则\n3、支持自定义审查规则模板', '1.3.0': '新增 Python 类型提示检查' },
  'pub-7': { '1.2.0': '1、新增容器健康检查增强\n2、优化镜像层缓存策略', '1.0.0': '首次发布' },
  'pub-8': { '2.3.0': '1、新增多语言模板库（日/韩/法）\n2、优化语气分析准确率\n3、新增邮件签名管理', '2.1.0': '新增回复建议功能' },
  'pub-9': { '1.6.0': '1、新增多集群统一管理面板\n2、优化 Pod 调试日志实时流\n3、支持 HPA 自动伸缩配置', '1.5.0': '新增 Helm Chart 管理' },
  'pub-10': { '1.1.0': '1、新增图表自动生成\n2、优化主题模板引擎', '1.0.0': '首次发布' },
};

/** 获取企业技能的更新说明（changeLog） */
function getChangeLog(skill: PackageSkillItem, targetVersion: string): string {
  if (skill.source === 'enterprise') {
    const ent = MOCK_SKILLS.find(s => s.id === skill.skillId);
    const vh = ent?.versionHistory?.find(v => v.version === targetVersion);
    return vh?.changeLog || '-';
  }
  // 公共技能也返回 mock 更新说明
  const pubLogs = PUBLIC_SKILL_CHANGELOGS[skill.skillId];
  if (pubLogs && pubLogs[targetVersion]) {
    return pubLogs[targetVersion];
  }
  return '-';
}

/** 判断技能是否有可用更新 */
function hasUpdate(skill: PackageSkillItem): boolean {
  const latest = getLatestVersion(skill);
  return !!latest && latest !== skill.version;
}

// ─── 批量刷新弹窗 ──────────────────────────────────────────────────────────────

interface BatchRefreshDialogProps {
  open: boolean;
  skills: PackageSkillItem[];
  onConfirm: (selectedSkillIds: string[]) => void;
  onCancel: () => void;
}

function BatchRefreshDialog({ open, skills, onConfirm, onCancel }: BatchRefreshDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;
  const [pageSize, setPageSize] = useState<number>(20);

  // 只展示有更新的技能
  const updatableSkills = skills.filter(s => hasUpdate(s));
  const totalPages = Math.max(1, Math.ceil(updatableSkills.length / pageSize));
  const pagedSkills = updatableSkills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 打开弹窗时默认全选当前页
  useEffect(() => {
    if (open) {
      const firstPageSkills = updatableSkills.slice(0, pageSize);
      setSelectedIds(new Set(firstPageSkills.map(s => s.skillId)));
      setCurrentPage(1);
    }
  }, [open]);

  // 当前页全选
  const currentPageIds = pagedSkills.map(s => s.skillId);
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        currentPageIds.forEach(id => next.delete(id));
      } else {
        currentPageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...selectedIds]);
    setSelectedIds(new Set());
    setCurrentPage(1);
  };

  const handleCancel = () => {
    setSelectedIds(new Set());
    setCurrentPage(1);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量刷新技能版本</DialogTitle>
        </DialogHeader>

        {updatableSkills.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">所有技能均为最新版本</p>
            </div>
          </div>
        ) : (
          <>
            {/* 列表容器 */}
            <div className="border border-gray-200 rounded-[4px] max-h-[380px] overflow-y-auto">
              {/* 表头行 — sticky，左侧带全选 checkbox */}
              <div
                className="grid items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-gray-50 sticky top-0 z-20 cursor-pointer hover:bg-gray-100 transition-colors"
                style={{ gridTemplateColumns: '28px 1.3fr 52px 60px 60px 1.8fr' }}
                onClick={toggleAll}
              >
                <div className="flex items-center justify-center">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    allPageSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {allPageSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500">技能名称</span>
                <span className="text-xs font-medium text-gray-500">类型</span>
                <span className="text-xs font-medium text-gray-500">新版本</span>
                <span className="text-xs font-medium text-gray-500">原版本</span>
                <span className="text-xs font-medium text-gray-500">更新说明</span>
              </div>

              {/* 技能列表项 */}
              {pagedSkills.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                  暂无可更新的技能
                </div>
              ) : (
                pagedSkills.map((skill) => {
                  const latest = getLatestVersion(skill)!;
                  const checked = selectedIds.has(skill.skillId);
                  const changeLog = getChangeLog(skill, latest);
                  return (
                    <div
                      key={skill.skillId}
                      onClick={() => toggleOne(skill.skillId)}
                      className={`grid items-center gap-2 px-3 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${checked ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                      style={{ gridTemplateColumns: '28px 1.3fr 52px 60px 60px 1.8fr' }}
                    >
                      {/* 勾选框 */}
                      <div className="flex items-center justify-center">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      {/* 技能名称 */}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {skill.source === 'enterprise' && skill.skillNameZh ? skill.skillNameZh : skill.skillName}
                      </span>
                      {/* 类型 */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 w-fit ${
                          skill.source === 'public'
                            ? 'text-blue-600 border-blue-200 bg-blue-50'
                            : 'text-purple-600 border-purple-200 bg-purple-50'
                        }`}
                      >
                        {skill.source === 'public' ? '公共' : '企业'}
                      </Badge>
                      {/* 新版本 */}
                      <span className="font-mono text-xs text-gray-600 font-medium">v{latest}</span>
                      {/* 原版本 */}
                      <span className="font-mono text-xs text-gray-400">v{skill.version}</span>
                      {/* 更新说明 */}
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-gray-500 line-clamp-2 block">
                            {changeLog}
                          </span>
                        </TooltipTrigger>
                        {changeLog !== '-' && (
                          <TooltipContent side="top" className="max-w-[360px]">
                            <p className="text-xs whitespace-pre-wrap">{changeLog}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  );
                })
              )}
            </div>

            {/* 分页控件 — 像素级复刻下发弹窗 */}
            <div className="flex items-center justify-between text-sm text-gray-500 pt-1">
              <div className="flex items-center gap-1.5">
                <span>共 {updatableSkills.length} 条，每页</span>
                <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[70px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>条</span>
                {selectedIds.size > 0 && (
                  <span className="text-gray-500 ml-1.5">
                    已选 {selectedIds.size} 条记录
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <span className="px-2 text-gray-600">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            确认刷新{selectedIds.size > 0 ? `（${selectedIds.size} 个）` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 技能包详情页 ─────────────────────────────────────────────────────────────

interface PackageDetailViewProps {
  pkg: SkillInitialPackage;
  onBack: () => void;
  onPublish: (pkgId: string) => void;
  onRemoveSkill: (pkgId: string, skillId: string) => void;
}

function PackageDetailView({ pkg, onBack, onPublish, onRemoveSkill }: PackageDetailViewProps) {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [localSkills, setLocalSkills] = useState(pkg.skills);
  const [showAddEnterpriseDialog, setShowAddEnterpriseDialog] = useState(false);
  const [showAddPublicDialog, setShowAddPublicDialog] = useState(false);
  const [showBatchRefreshDialog, setShowBatchRefreshDialog] = useState(false);

  // 当 pkg 变化时同步本地技能列表（例如切换包）
  const handleRemoveLocal = (skillId: string) => {
    setLocalSkills(prev => prev.filter(s => s.skillId !== skillId));
    setIsDirty(true);
  };

  const doSave = () => {
    // 找出被删除的技能并逐一调用 onRemoveSkill
    pkg.skills.forEach(s => {
      if (!localSkills.find(ls => ls.skillId === s.skillId)) {
        onRemoveSkill(pkg.id, s.skillId);
      }
    });
    // 清除 originalVersion 标记（保存后正式生效）
    setLocalSkills(prev => prev.map(s => ({ ...s, originalVersion: undefined })));
    setIsDirty(false);
    setShowPublishConfirm(false);
    toast.success('保存成功');
  };

  const handleSave = () => {
    if (pkg.isActive) {
      // 已生效的技能包：弹出二次确认
      setShowPublishConfirm(true);
    } else {
      // 未生效的技能包：直接保存
      doSave();
    }
  };

  const handleDiscard = () => {
    setLocalSkills(pkg.skills);
    setIsDirty(false);
  };

  const handleAddPublicSkills = (skills: PackageSkillItem[]) => {
    setLocalSkills(prev => [...prev, ...skills]);
    setIsDirty(true);
    setShowAddPublicDialog(false);
  };

  const handleAddEnterpriseSkills = (skills: PackageSkillItem[]) => {
    setLocalSkills(prev => [...prev, ...skills]);
    setIsDirty(true);
    setShowAddEnterpriseDialog(false);
  };

  /** 单个技能刷新到最新版本 */
  const handleRefreshSingle = (skillId: string) => {
    const skill = localSkills.find(s => s.skillId === skillId);
    if (!skill) return;
    const latest = getLatestVersion(skill);
    if (!latest || latest === skill.version) {
      toast.info('当前已是最新版本');
      return;
    }
    setLocalSkills(prev => prev.map(s =>
      s.skillId === skillId
        ? { ...s, originalVersion: s.originalVersion || s.version, version: latest }
        : s
    ));
    setIsDirty(true);
    toast.success(`已刷新至 v${latest}`);
  };

  /** 批量刷新确认 */
  const handleBatchRefreshConfirm = (selectedSkillIds: string[]) => {
    setLocalSkills(prev => prev.map(s => {
      if (!selectedSkillIds.includes(s.skillId)) return s;
      const latest = getLatestVersion(s);
      if (!latest || latest === s.version) return s;
      return { ...s, originalVersion: s.originalVersion || s.version, version: latest };
    }));
    setIsDirty(true);
    setShowBatchRefreshDialog(false);
    toast.success(`已刷新 ${selectedSkillIds.length} 个技能`);
  };

  const scopeLabels = getScopeLabels(pkg);

  // 统计有更新的技能数量
  const updatableCount = localSkills.filter(s => hasUpdate(s)).length;

  return (
    <div className="space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回初始技能包列表
        </button>
      </div>

      {/* 技能包信息 */}
      <div className="bg-white rounded-[4px] border border-gray-100 p-5"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ background: '#1447E6' }}>
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-sm font-semibold text-gray-900">{pkg.name}</h2>
              {pkg.isActive && (
                <span className="badge-running text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  生效中
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Globe className="w-3 h-3" />
              <span>
                {isPublicScope(pkg) ? '全部用户' : scopeLabels.join('、')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 技能列表 */}
      <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="px-4 border-b border-gray-100 flex items-center justify-between" style={{ minHeight: '48px' }}>
          <span className="text-sm font-medium text-gray-700">
            技能列表（共 {localSkills.length} 个）
          </span>
          <div className="flex items-center gap-2">
            {/* 批量刷新按钮 */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchRefreshDialog(true)}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  批量刷新
                  {updatableCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0 rounded-full text-[10px] bg-green-100 text-green-600 font-medium">
                      {updatableCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                检查并批量刷新技能到最新版本
              </TooltipContent>
            </Tooltip>
            {isDirty && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="h-7 px-3 text-xs text-gray-500"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 px-3 text-xs"
                >
                  保存
                </Button>
              </>
            )}
          </div>
        </div>

        {localSkills.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {localSkills.map(skill => {
              const canUpdate = hasUpdate(skill);
              const wasRefreshed = !!skill.originalVersion;
              return (
                <div key={skill.skillId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-[4px] bg-gray-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-800">
                        {skill.source === 'enterprise' && skill.skillNameZh ? skill.skillNameZh : skill.skillName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          skill.source === 'public'
                            ? 'text-blue-600 border-blue-200 bg-blue-50'
                            : 'text-purple-600 border-purple-200 bg-purple-50'
                        }`}
                      >
                        {skill.source === 'public' ? '公共' : '企业'}
                      </Badge>
                      {wasRefreshed ? (
                        <span className="font-mono text-[10px]">
                          <span className="text-green-600 font-medium">v{skill.version}</span>
                          <span className="text-gray-400 ml-0.5">(原v{skill.originalVersion})</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-gray-400">v{skill.version}</span>
                      )}
                    </div>
                  </div>
                  {/* 刷新按钮 */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => canUpdate ? handleRefreshSingle(skill.skillId) : undefined}
                        className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                          canUpdate
                            ? 'text-green-500 hover:text-green-600 hover:bg-green-50 cursor-pointer'
                            : 'text-gray-300 cursor-default'
                        }`}
                        title={canUpdate ? '有新版本，点击刷新' : '已是最新'}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {canUpdate
                        ? `有新版本 v${getLatestVersion(skill)}，点击刷新`
                        : '已是最新版本'}
                    </TooltipContent>
                  </Tooltip>
                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleRemoveLocal(skill.skillId)}
                    className="w-7 h-7 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="从技能包中移除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">该技能包还没有技能</p>
            <p className="text-xs mt-1">可从公共技能库或企业技能库添加</p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddPublicDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            从公共技能库添加
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddEnterpriseDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            从企业技能库添加
          </Button>
        </div>
      </div>

      {/* 公共技能库添加弹窗 */}
      <AddPublicSkillDialog
        open={showAddPublicDialog}
        existingSkillIds={localSkills.map(s => s.skillId)}
        onConfirm={handleAddPublicSkills}
        onCancel={() => setShowAddPublicDialog(false)}
      />

      {/* 企业技能库添加弹窗 */}
      <AddEnterpriseSkillDialog
        open={showAddEnterpriseDialog}
        existingSkillIds={localSkills.map(s => s.skillId)}
        onConfirm={handleAddEnterpriseSkills}
        onCancel={() => setShowAddEnterpriseDialog(false)}
        pkgScopeType={pkg.scopeType}
        pkgGroupIds={pkg.groupIds}
      />

      {/* 批量刷新弹窗 */}
      <BatchRefreshDialog
        open={showBatchRefreshDialog}
        skills={localSkills}
        onConfirm={handleBatchRefreshConfirm}
        onCancel={() => setShowBatchRefreshDialog(false)}
      />

      {/* 保存确认弹窗（仅已生效技能包触发） */}
      <PublishConfirmDialog
        open={showPublishConfirm}
        packageName={pkg.name}
        isActive={pkg.isActive}
        onConfirm={doSave}
        onCancel={() => setShowPublishConfirm(false)}
      />
    </div>
  );
}


// ─── 主组件 ───────────────────────────────────────────────────────────────────

interface SkillInitialPackageTabProps {
  onPackagesChange?: (packages: Array<{ id: string; name: string; isActive: boolean }>) => void;
}

export default function SkillInitialPackageTab({ onPackagesChange }: SkillInitialPackageTabProps) {
  const [packages, setPackages] = useState<SkillInitialPackage[]>(INITIAL_SKILL_PACKAGES_DEFAULT);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 筛选状态：多选 Set，空=全部, 含'public'=全部用户, 含'group-xxx'=特定分组
  const allScopeKeys = useMemo(() => ['public', ...MOCK_GROUPS.map(g => g.id)], []);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

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

  // 找到当前已生效的「全部用户」的技能包
  const activeGlobalPackage = packages.find(p => p.isActive && isPublicScope(p));

  // 通知父组件 packages 变化
  const updatePackages = (newPackages: SkillInitialPackage[]) => {
    setPackages(newPackages);
    onPackagesChange?.(newPackages.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })));
  };

  // 新建技能包
  const handleCreate = (name: string, scopeType: 'public' | 'private', groupIds: string[]) => {
    const scopeDisplay = scopeType === 'public'
      ? '全部用户'
      : groupIds.map(id => MOCK_GROUPS.find(g => g.id === id)?.name || id).join('、');
    const newPkg: SkillInitialPackage = {
      id: `pkg-${Date.now()}`,
      name,
      scope: scopeDisplay,
      scopeType,
      groupIds,
      isActive: false,
      hasDraft: false,
      skills: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    updatePackages([...packages, newPkg]);
    setShowCreateDialog(false);
  };

  // 切换生效开关
  const handleToggleActive = (pkgId: string, value: boolean) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;

    if (!value) {
      // 关闭生效：直接关闭
      updatePackages(packages.map(p => p.id === pkgId ? { ...p, isActive: false } : p));
      return;
    }

    // 打开生效
    if (isPublicScope(pkg)) {
      // 全员范围：需要检查是否已有其他全员生效的
      if (activeGlobalPackage && activeGlobalPackage.id !== pkgId) {
        // 已有其他全员生效的技能包，提示错误，阻止启用
        toast.error('已有其他应用范围为「全部用户」的技能包处于启用状态，请先禁用');
        return;
      }
      // 没有全员生效的，直接启用
      updatePackages(packages.map(p => p.id === pkgId ? { ...p, isActive: true } : p));
    } else {
      // 按分组范围：直接启用（可同时启用任意多个非全员的）
      updatePackages(packages.map(p => p.id === pkgId ? { ...p, isActive: true } : p));
    }
  };

  // 发布修改
  const handlePublish = (pkgId: string) => {
    updatePackages(packages.map(p => p.id === pkgId ? { ...p, hasDraft: false, updatedAt: new Date() } : p));
  };

  // 删除技能包
  const handleDelete = (pkgId: string) => {
    updatePackages(packages.filter(p => p.id !== pkgId));
    setDeleteTarget(null);
  };

  // 从技能包中移除技能
  const handleRemoveSkill = (pkgId: string, skillId: string) => {
    updatePackages(packages.map(p =>
      p.id === pkgId
        ? { ...p, skills: p.skills.filter(s => s.skillId !== skillId), hasDraft: true, updatedAt: new Date() }
        : p
    ));
  };

  // 修改技能包应用范围
  // 默认不改变生效状态，但切换为"全部用户"时默认设为失效
  const handleScopeChange = (pkgId: string, scope: SkillScope, groupIds: string[]) => {
    updatePackages(packages.map(p => {
      if (p.id !== pkgId) return p;
      const scopeType = scope === 'public' ? 'public' : 'private';
      const scopeDisplay = scopeType === 'public'
        ? '全部用户'
        : groupIds.map(id => MOCK_GROUPS.find(g => g.id === id)?.name || id).join('、');
      // 切换为全部用户时，默认设为失效
      const isActive = scopeType === 'public' ? false : p.isActive;
      return { ...p, scopeType, groupIds, scope: scopeDisplay, isActive, updatedAt: new Date() };
    }));
    toast.success('应用范围修改成功');
  };

  // 筛选逻辑 + 排序：置顶生效且全员的技能包，其余按新增时间倒序
  const filteredPackages = packages
    .filter(pkg => {
      if (selectedScopes.size === 0) return true;
      const hasPublic = selectedScopes.has('public');
      const groupScopes = [...selectedScopes].filter(s => s !== 'public');
      const matchPublic = hasPublic && isPublicScope(pkg);
      const matchGroup = groupScopes.length > 0 && pkg.scopeType === 'private' && pkg.groupIds.some(gid => selectedScopes.has(gid));
      return !!(matchPublic || matchGroup);
    })
    .sort((a, b) => {
      const aPinned = a.isActive && isPublicScope(a);
      const bPinned = b.isActive && isPublicScope(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  // 如果选中了技能包，显示详情页
  const selectedPackage = packages.find(p => p.id === selectedPackageId);
  if (selectedPackage) {
    return (
      <PackageDetailView
        pkg={selectedPackage}
        onBack={() => setSelectedPackageId(null)}
        onPublish={handlePublish}
        onRemoveSkill={handleRemoveSkill}
      />
    );
  }

  const deleteTargetPkg = packages.find(p => p.id === deleteTarget);

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 style={{ fontSize: '16px' }} className="font-medium text-gray-700 shrink-0">初始技能包列表</h3>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-[4px] whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
            <span className="text-xs text-blue-600">由腾讯云存储 Agent Storage 提供服务，ClawPro 用户独享初始技能包和企业技能库各 50GB 免费空间</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* 应用范围筛选下拉 — 多选 checkbox */}
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
                        : [...selectedScopes].map(s => s === 'public' ? '全部用户' : MOCK_GROUPS.find(g => g.id === s)?.name || s).join('、')}
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
                      : [...selectedScopes].map(s => s === 'public' ? '全部用户' : MOCK_GROUPS.find(g => g.id === s)?.name || s).join('、')}
                </p>
              </TooltipContent>
            </Tooltip>
            {scopeDropdownOpen && (() => {
              const filteredGroups = MOCK_GROUPS.filter(g => g.name.toLowerCase().includes(scopeSearchQuery.toLowerCase()));
              const showPublic = !scopeSearchQuery || '全部用户'.includes(scopeSearchQuery);
              const showGroupSection = !scopeSearchQuery || '按分组'.includes(scopeSearchQuery) || filteredGroups.length > 0;
              const isAllSelected = allScopeKeys.length > 0 && allScopeKeys.every(k => selectedScopes.has(k));

              const toggleScope = (key: string) => {
                setSelectedScopes(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key); else next.add(key);
                  return next;
                });
              };

              return (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-[4px] shadow-lg z-50 py-1">
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
                  {(!scopeSearchQuery || '全部应用范围'.includes(scopeSearchQuery)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isAllSelected) {
                          setSelectedScopes(new Set());
                        } else {
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
                  )}
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
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            新建
          </Button>
        </div>
      </div>

      {/* 技能包列表 */}
      {filteredPackages.length > 0 ? (
        <div className="space-y-3">
          {filteredPackages.map(pkg => {
            const scopeLabels = getScopeLabels(pkg);
            const isPub = isPublicScope(pkg);
            const isPinned = pkg.isActive && isPub;
            return (
              <div
                key={pkg.id}
                className="bg-white rounded-[4px] border border-gray-100 p-4 transition-all cursor-pointer group hover:shadow-md"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onClick={() => setSelectedPackageId(pkg.id)}
              >
                <div className="flex items-center gap-3">
                  {/* 图标 */}
                  <div className="w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0" style={{ background: '#1447E6' }}>
                    <Package className="w-5 h-5 text-white" />
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isPinned && (
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <span className="text-blue-500 shrink-0">
                              <Pin className="w-3.5 h-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] text-center">
                            默认置顶应用范围为全部用户且生效中的初始技能包。
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{pkg.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{pkg.skills.length} 个技能</span>
                      {/* 应用范围标签 + 编辑 */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <EditScopePopover
                          groups={MOCK_GROUPS}
                          currentScope={pkg.scopeType === 'public' ? 'public' : 'private'}
                          currentGroupIds={pkg.groupIds || []}
                          scopeLabels={scopeLabels}
                          isPublic={isPub}
                          onConfirm={(scope, groupIds) => handleScopeChange(pkg.id, scope, groupIds)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 操作区 */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* 生效开关 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">设为生效</span>
                      <Switch
                        checked={pkg.isActive}
                        onCheckedChange={(v) => handleToggleActive(pkg.id, v)}
                      />
                    </div>

                    {/* 删除按钮 */}
                    {pkg.isActive ? (
                      <Tooltip delayDuration={1000}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {}}
                              className="w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors text-gray-300 cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-center">
                            生效中的技能包不可删除
                          </TooltipContent>
                        </Tooltip>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget(pkg.id)}
                        className="w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 bg-white rounded-[4px] border border-gray-100"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {selectedScopes.size > 0 ? '没有匹配的初始技能包' : '还没有初始技能包'}
          </p>
          {selectedScopes.size === 0 && (
            <>
              <p className="text-xs mt-1">点击「新建」创建第一个初始技能包</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4" />
                新建初始技能包
              </Button>
            </>
          )}
        </div>
      )}

      {/* 新建对话框 */}
      <CreatePackageDialog
        open={showCreateDialog}
        existingNames={packages.map(p => p.name)}
        onConfirm={handleCreate}
        onCancel={() => setShowCreateDialog(false)}
      />

      {/* 删除确认 */}
      {deleteTargetPkg && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          packageName={deleteTargetPkg.name}
          onConfirm={() => handleDelete(deleteTarget!)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
