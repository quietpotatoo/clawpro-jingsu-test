/**
 * SkillRolesTab - 角色设定管理
 * 功能：拖拽排序、开关可见性、编辑角色、删除角色、新增自定义角色、应用范围
 */
import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  X,
  Search,
  Check,
  CheckCircle2,
  RefreshCw,
  Package,
  Star,
  ChevronDown,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  MOCK_ROLES,
} from "@/lib/mockData";
import type { Role, RoleSkill } from "@/lib/mockData";
import { PUBLIC_SKILLS, type PublicSkill } from "./SkillLibrary/publicSkillMockData";
import { MOCK_SKILLS, DEFAULT_CATEGORIES, MOCK_GROUPS } from "./SkillLibrary/mockData";
import type { SkillScope } from "./SkillLibrary/types";

// ── 应用范围展示徽章 ──────────────────────────────────────
function ScopeBadges({ role }: { role: Role }) {
  const isPublic = role.scope === 'public' || !role.groupIds || role.groupIds.length === 0;
  if (isPublic) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
        全部用户
      </span>
    );
  }
  const groupNames = role.groupIds.map(gid => MOCK_GROUPS.find(g => g.id === gid)?.name || gid);
  const firstName = groupNames[0] || '';
  const rest = groupNames.length - 1;
  const tooltipText = groupNames.join('，');

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-default">
          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full max-w-[100px] truncate">
            {firstName}
          </span>
          {rest > 0 && (
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full whitespace-nowrap">
              +{rest}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

// ── 编辑应用范围 Popover（列表行内编辑）──────────────────────
function EditRoleScopePopover({
  role,
  onConfirm,
}: {
  role: Role;
  onConfirm: (scope: SkillScope, groupIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftScope, setDraftScope] = useState<SkillScope>('public');
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setDraftScope(role.scope || 'public');
      setDraftGroupIds([...(role.groupIds || [])]);
      setSearchQuery('');
    }
    setOpen(v);
  };

  const filteredGroups = MOCK_GROUPS.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleGroup = (gid: string) => {
    setDraftGroupIds(prev =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
    );
  };

  const isConfirmDisabled = draftScope === 'private' && draftGroupIds.length === 0;

  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onConfirm(draftScope, draftScope === 'public' ? [] : draftGroupIds);
    setOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <ScopeBadges role={role} />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip delayDuration={1000}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 text-gray-400 hover:text-gray-900 rounded transition-colors flex-shrink-0"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">编辑应用范围</TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-68 p-0"
          align="start"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 pt-3.5 pb-2.5 space-y-2.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => setDraftScope('public')}
                className={`flex-1 px-2.5 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                  draftScope === 'public'
                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                全部用户
              </button>
              <button
                onClick={() => setDraftScope('private')}
                className={`flex-1 px-2.5 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                  draftScope === 'private'
                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                按分组
              </button>
            </div>
            {draftScope === 'private' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索分组…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-[4px] bg-gray-50 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-colors"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                  {filteredGroups.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-3">无匹配分组</p>
                  ) : (
                    filteredGroups.map((group) => {
                      const checked = draftGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          onClick={() => toggleGroup(group.id)}
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
                    })
                  )}
                </div>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] text-gray-400">已选 {draftGroupIds.length} 个分组</p>
                  {draftGroupIds.length > 0 && (
                    <button onClick={() => { setDraftGroupIds([]); setSearchQuery(''); }} className="text-[11px] text-blue-500 hover:text-blue-600 hover:underline">
                      清除筛选
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-gray-100">
            <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={() => setOpen(false)}>取消</Button>
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              disabled={isConfirmDisabled}
              onClick={handleConfirm}
            >
              确认
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Mock 最新版本查询 ──────────────────────────────────────
/** 根据技能名称和来源查询最新可用版本 */
function getLatestVersionInfo(skillName: string, source: "公共" | "企业"): { latestVersion: string; updateNote: string } | null {
  if (source === "公共") {
    const pubSkill = PUBLIC_SKILLS.find(s => s.name === skillName || s.slug === skillName);
    if (pubSkill) {
      return { latestVersion: `v${pubSkill.version}`, updateNote: `公共技能 ${pubSkill.nameZh || pubSkill.name} 的最新版本更新` };
    }
  } else {
    const entSkill = MOCK_SKILLS.find(s => s.name === skillName || s.slug === skillName);
    if (entSkill) {
      const note = entSkill.versionHistory?.[0]?.changeLog || `企业技能 ${entSkill.name} 的最新版本更新`;
      return { latestVersion: `v${entSkill.version}`, updateNote: note };
    }
  }
  return null;
}

/** 比较 vA > vB （去掉 v 前缀） */
function versionGt(vA: string, vB: string): boolean {
  const a = vA.replace(/^v/, '').split('.').map(Number);
  const b = vB.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

/** 检查技能是否有新版本 */
function checkSkillUpdate(skill: RoleSkill): { hasUpdate: boolean; latestVersion?: string; updateNote?: string } {
  const info = getLatestVersionInfo(skill.name, skill.source);
  if (!info) return { hasUpdate: false };
  if (versionGt(info.latestVersion, skill.version)) {
    return { hasUpdate: true, latestVersion: info.latestVersion, updateNote: info.updateNote };
  }
  return { hasUpdate: false };
}

// ── 批量更新弹窗 ──────────────────────────────────────────
interface UpdatableSkill {
  index: number;
  skill: RoleSkill;
  latestVersion: string;
  updateNote: string;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;

function BatchUpdateDialog({
  open,
  updatableSkills,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  updatableSkills: UpdatableSkill[];
  onConfirm: (selectedIndices: number[]) => void;
  onCancel: () => void;
}) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 初始化：默认选中全部
  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      setPageSize(20);
      setSelectedIndices(new Set(updatableSkills.map(s => s.index)));
    }
  }, [open, updatableSkills]);

  const totalPages = Math.max(1, Math.ceil(updatableSkills.length / pageSize));
  const pagedSkills = updatableSkills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 当前页全选
  const currentPageIndices = pagedSkills.map(s => s.index);
  const allPageSelected = currentPageIndices.length > 0 && currentPageIndices.every(idx => selectedIndices.has(idx));

  const toggleAll = () => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        currentPageIndices.forEach(idx => next.delete(idx));
      } else {
        currentPageIndices.forEach(idx => next.add(idx));
      }
      return next;
    });
  };

  const toggleOne = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIndices));
    setSelectedIndices(new Set());
    setCurrentPage(1);
  };

  const handleCancel = () => {
    setSelectedIndices(new Set());
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
                pagedSkills.map((item) => {
                  const checked = selectedIndices.has(item.index);
                  return (
                    <div
                      key={item.index}
                      onClick={() => toggleOne(item.index)}
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
                        {item.skill.name}
                      </span>
                      {/* 类型 */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 w-fit ${
                          item.skill.source === '公共'
                            ? 'text-blue-600 border-blue-200 bg-blue-50'
                            : 'text-purple-600 border-purple-200 bg-purple-50'
                        }`}
                      >
                        {item.skill.source}
                      </Badge>
                      {/* 新版本 */}
                      <span className="font-mono text-xs text-gray-600 font-medium">{item.latestVersion}</span>
                      {/* 原版本 */}
                      <span className="font-mono text-xs text-gray-400">{item.skill.version}</span>
                      {/* 更新说明 */}
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-gray-500 line-clamp-2 block">
                            {item.updateNote}
                          </span>
                        </TooltipTrigger>
                        {item.updateNote !== '-' && (
                          <TooltipContent side="top" className="max-w-[360px]">
                            <p className="text-xs whitespace-pre-wrap">{item.updateNote}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  );
                })
              )}
            </div>

            {/* 分页控件 */}
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
                {selectedIndices.size > 0 && (
                  <span className="text-gray-500 ml-1.5">
                    已选 {selectedIndices.size} 条记录
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
            disabled={selectedIndices.size === 0}
          >
            确认刷新{selectedIndices.size > 0 ? `（${selectedIndices.size} 个）` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sortable Row ────────────────────────────────────────
function SortableRoleRow({
  role,
  onToggle,
  onEdit,
  onDelete,
  onScopeChange,
}: {
  role: Role;
  onToggle: (id: string) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onScopeChange: (id: string, scope: SkillScope, groupIds: string[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isDragging ? "bg-blue-50/30 shadow-sm" : ""}`}
    >
      {/* Drag Handle */}
      <td className="w-10 px-3 py-4">
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      {/* Name — clickable to open edit */}
      <td className="px-4 py-4">
        <button
          onClick={() => onEdit(role)}
          className="font-semibold text-sm text-gray-900 hover:text-blue-600 hover:underline transition-colors text-left"
        >
          {role.name}
        </button>
      </td>
      {/* Description */}
      <td className="px-4 py-4 max-w-[320px]">
        <div className="text-xs text-gray-400 truncate">{role.description}</div>
      </td>
      {/* 应用范围 */}
      <td className="px-4 py-4">
        <EditRoleScopePopover
          role={role}
          onConfirm={(scope, groupIds) => onScopeChange(role.id, scope, groupIds)}
        />
      </td>
      {/* Visible toggle */}
      <td className="px-4 py-4">
        <Switch
          checked={role.visible}
          onCheckedChange={() => onToggle(role.id)}
        />
      </td>
      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(role)}
            className="p-1.5 rounded-[4px] text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(role)}
            className="p-1.5 rounded-[4px] text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── 公共技能库添加弹窗（与初始技能包交互一致）──────────────
const MOCK_FAVORITES: PublicSkill[] = PUBLIC_SKILLS.slice(0, 5);

function RoleAddPublicSkillDialog({
  open,
  existingSkillNames,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  existingSkillNames: string[];
  onConfirm: (skills: RoleSkill[]) => void;
  onCancel: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSkill = (skillId: string) => {
    setSelectedIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleConfirm = () => {
    const newSkills: RoleSkill[] = selectedIds.map(id => {
      const skill = MOCK_FAVORITES.find(s => s.id === id)!;
      return { name: skill.name, version: `v${skill.version}`, source: "公共" as const };
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

        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            我的收藏
          </div>
        </div>

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
                const isAlreadyAdded = existingSkillNames.includes(skill.name);
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
                    <div className="flex items-center gap-2 mb-1.5 pr-8">
                      <span className="font-mono font-medium text-sm text-gray-900 truncate min-w-0">{skill.name}</span>
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">v{skill.version}</span>
                    </div>
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

// ── 企业技能库添加弹窗（支持应用范围筛选）──────────────

function RoleAddEnterpriseSkillDialog({
  open,
  existingSkillNames,
  onConfirm,
  onCancel,
  /** 当前角色的应用范围，用于预设筛选 */
  roleScope,
  roleGroupIds,
}: {
  open: boolean;
  existingSkillNames: string[];
  onConfirm: (skills: RoleSkill[]) => void;
  onCancel: () => void;
  roleScope?: SkillScope;
  roleGroupIds?: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 应用范围多选筛选
  const [scopeFilters, setScopeFilters] = useState<string[]>([]);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开时根据角色应用范围预设筛选
  // 规则：【全部用户】默认必勾选
  // 如果角色是【全部用户】的，只勾选【全部用户】，不再多勾其他
  // 如果角色不是【全部用户】的，勾选【全部用户】+ 该角色关联的分组
  useEffect(() => {
    if (open) {
      if (roleScope === 'public' || !roleGroupIds || roleGroupIds.length === 0) {
        // 全部用户的角色：只勾选【全部用户】
        setScopeFilters(['__public__']);
      } else {
        // 非全部用户的角色：勾选【全部用户】+ 关联分组
        setScopeFilters(['__public__', ...roleGroupIds]);
      }
      setScopeDropdownOpen(false);
      setScopeSearchQuery('');
    }
  }, [open, roleScope, roleGroupIds]);

  const toggleSkill = (skillId: string) => {
    setSelectedIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleConfirm = () => {
    const newSkills: RoleSkill[] = selectedIds.map(id => {
      const skill = MOCK_SKILLS.find(s => s.id === id)!;
      return { name: skill.name, version: `v${skill.version}`, source: "企业" as const };
    });
    onConfirm(newSkills);
    setSelectedIds([]);
    setActiveCategory('all');
    setSearchQuery('');
    setScopeFilters([]);
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
    // 应用范围筛选
    let matchScope = true;
    if (scopeFilters.length > 0) {
      const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
      const allSelected = allIds.every(id => scopeFilters.includes(id));
      if (!allSelected) {
        matchScope = false;
        if (scopeFilters.includes('__public__') && s.scope === 'public') {
          matchScope = true;
        }
        const selectedGroupIds = scopeFilters.filter(f => f !== '__public__');
        if (selectedGroupIds.length > 0 && s.groupIds) {
          if (selectedGroupIds.some(gid => s.groupIds.includes(gid))) {
            matchScope = true;
          }
        }
      }
    }
    return matchCategory && matchSearch && matchScope;
  });

  // 获取筛选显示文本
  const getScopeFilterLabel = () => {
    const allIds = ['__public__', ...MOCK_GROUPS.map(g => g.id)];
    const allSelected = allIds.every(id => scopeFilters.includes(id));
    if (scopeFilters.length === 0 || allSelected) return '全部应用范围';
    if (scopeFilters.includes('__public__') && scopeFilters.length === 1) return '全部用户';
    return `已选 ${scopeFilters.filter(f => f !== '__public__').length + (scopeFilters.includes('__public__') ? 1 : 0)} 项`;
  };

  const renderSkillCard = (skill: typeof MOCK_SKILLS[0]) => {
    const isAlreadyAdded = existingSkillNames.includes(skill.name);
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
          {/* 应用范围标签 - 右上角（已添加的技能不显示，右上角只显示"已添加"） */}
          {!isAlreadyAdded && (
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
          )}
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
          {/* 搜索框 + 应用范围筛选 + 刷新 */}
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
            {/* 应用范围多选下拉 */}
            <div className="relative" ref={scopeDropdownRef}>
              <Tooltip delayDuration={1000} open={scopeDropdownOpen ? false : undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setScopeDropdownOpen(prev => !prev)}
                    className="flex items-center justify-between gap-1 min-w-[10rem] max-w-[16rem] h-9 px-3 border border-gray-200 rounded-[4px] bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate text-left text-xs">{getScopeFilterLabel()}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${scopeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px]">
                  <p className="break-words text-xs">{getScopeFilterLabel()}</p>
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

// ── Edit/Create Role Modal ──────────────────────────────
const NAME_MAX_LEN = 8;

function RoleEditModal({
  open,
  role,
  onClose,
  onSave,
}: {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSave: (role: Role) => void;
}) {
  const isNew = role === null;
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [description, setDescription] = useState("");
  const [soul, setSoul] = useState("");
  const [skills, setSkills] = useState<RoleSkill[]>([]);
  const [visible, setVisible] = useState(true);
  const [scope, setScope] = useState<SkillScope>('public');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [showAddPublicDialog, setShowAddPublicDialog] = useState(false);
  const [showAddEnterpriseDialog, setShowAddEnterpriseDialog] = useState(false);
  const [showBatchUpdateDialog, setShowBatchUpdateDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Reset form when dialog opens
  if (open && !initialized) {
    setName(role?.name ?? "");
    setNameError("");
    setDescription(role?.description ?? "");
    setSoul(role?.soul ?? "");
    setSkills(role?.skills ? [...role.skills] : []);
    setVisible(role?.visible ?? true);
    setScope(role?.scope ?? 'public');
    setGroupIds(role?.groupIds ? [...role.groupIds] : []);
    setGroupSearchQuery('');
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

  const handleNameChange = (val: string) => {
    if (val.length > NAME_MAX_LEN) {
      setNameError(`角色名称不超过 ${NAME_MAX_LEN} 个字`);
      return;
    }
    setName(val);
    setNameError("");
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("请输入角色名称");
      return;
    }
    if (name.trim().length > NAME_MAX_LEN) {
      toast.error(`角色名称不超过 ${NAME_MAX_LEN} 个字`);
      return;
    }
    // 保存时清除 previousVersion，使得再次编辑时不再显示"(原vX.X.X)"
    const cleanedSkills = skills.map(s => {
      const { previousVersion, ...rest } = s;
      return rest;
    });
    onSave({
      id: role?.id ?? `role-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      soul: soul.trim(),
      skills: cleanedSkills,
      visible,
      scope,
      groupIds: scope === 'public' ? [] : groupIds,
    });
    onClose();
  };

  const removeSkill = (idx: number) => {
    setSkills(skills.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleAddSkills = (newSkills: RoleSkill[]) => {
    setSkills([...skills, ...newSkills]);
    setShowAddPublicDialog(false);
    setShowAddEnterpriseDialog(false);
    setIsDirty(true);
  };

  // 单技能刷新
  const handleRefreshSingleSkill = (idx: number) => {
    const skill = skills[idx];
    const result = checkSkillUpdate(skill);
    if (result.hasUpdate && result.latestVersion) {
      setSkills(prev => prev.map((s, i) => i === idx ? { ...s, previousVersion: s.previousVersion || s.version, version: result.latestVersion!, latestVersion: result.latestVersion, updateNote: result.updateNote } : s));
      setIsDirty(true);
      toast.success(`${skill.name} 已更新至 ${result.latestVersion}`);
    }
  };

  // 获取可更新技能列表
  const getUpdatableSkills = (): UpdatableSkill[] => {
    const list: UpdatableSkill[] = [];
    skills.forEach((skill, idx) => {
      const result = checkSkillUpdate(skill);
      if (result.hasUpdate && result.latestVersion) {
        list.push({ index: idx, skill, latestVersion: result.latestVersion, updateNote: result.updateNote || '' });
      }
    });
    return list;
  };

  // 批量更新确认
  const handleBatchUpdateConfirm = (selectedIndices: number[]) => {
    setSkills(prev => prev.map((s, i) => {
      if (selectedIndices.includes(i)) {
        const result = checkSkillUpdate(s);
        if (result.hasUpdate && result.latestVersion) {
          return { ...s, previousVersion: s.previousVersion || s.version, version: result.latestVersion, latestVersion: result.latestVersion, updateNote: result.updateNote };
        }
      }
      return s;
    }));
    setIsDirty(true);
    setShowBatchUpdateDialog(false);
    toast.success(`已更新 ${selectedIndices.length} 个技能`);
  };

  const filteredGroupsForEdit = MOCK_GROUPS.filter(g =>
    g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "自定义角色" : `编辑角色 — ${role?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                角色名称
                <span className="text-xs text-gray-300 font-normal ml-1.5">{name.length}/{NAME_MAX_LEN}</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例如：营养师、法律顾问..."
                className={`mt-1.5 bg-gray-50 ${nameError ? "border-red-400" : ""}`}
                autoFocus={isNew}
                maxLength={NAME_MAX_LEN}
              />
              {nameError && (
                <p className="text-xs text-red-500 mt-1">{nameError}</p>
              )}
            </div>

            {/* Description — use Textarea for auto wrap */}
            <div>
              <Label className="text-sm font-medium text-gray-700">角色描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="一句话描述角色的核心能力"
                className="mt-1.5 min-h-[60px] resize-none bg-gray-50"
                rows={2}
              />
            </div>

            {/* Soul */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                角色灵魂
                <span className="text-gray-400 font-normal ml-1.5">— 定义智能体的人格、价值观与行为准则</span>
              </Label>
              <Textarea
                value={soul}
                onChange={(e) => setSoul(e.target.value)}
                placeholder="描述角色的人格特质、专业领域和行为准则..."
                className="mt-1.5 min-h-[80px] resize-none bg-gray-50"
                rows={3}
              />
            </div>

            {/* 应用范围 — 放在角色技能上面 */}
            <div>
              <Label className="text-sm font-medium text-gray-700">应用范围</Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setScope('public'); setGroupIds([]); }}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                      scope === 'public'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    全部用户
                  </button>
                  <button
                    onClick={() => setScope('private')}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                      scope === 'private'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    按分组
                  </button>

                  {/* 选择按分组后，右侧出现下拉选择器 */}
                  {scope === 'private' && (
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
                          {filteredGroupsForEdit.map(group => {
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
                          {filteredGroupsForEdit.length === 0 && (
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

            {/* Skills */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                角色技能
                <span className="text-gray-400 font-normal ml-1.5">— 赋予智能体专业执行能力的技能工具</span>
              </Label>
              <div className="mt-1.5 border border-gray-200 rounded-[4px] overflow-hidden">
                <div className="px-4 border-b border-gray-100 flex items-center justify-between" style={{ minHeight: '48px' }}>
                  <span className="text-sm font-medium text-gray-700">
                    技能列表（共 {skills.length} 个）
                  </span>
                  <div className="flex items-center gap-2">
                    {/* 批量刷新按钮 */}
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updatable = getUpdatableSkills();
                            if (updatable.length === 0) {
                              toast.info('所有技能已是最新版本');
                            } else {
                              setShowBatchUpdateDialog(true);
                            }
                          }}
                          className="h-7 px-3 text-xs gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          批量刷新
                          {(() => {
                            const count = getUpdatableSkills().length;
                            return count > 0 ? (
                              <span className="ml-0.5 px-1.5 py-0 rounded-full text-[10px] bg-green-100 text-green-600 font-medium">
                                {count}
                              </span>
                            ) : null;
                          })()}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        检查并批量刷新技能到最新版本
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {skills.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">该角色还没有技能</p>
                    <p className="text-xs mt-1">可从公共技能库或企业技能库添加</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {skills.map((skill, idx) => {
                      const updateResult = checkSkillUpdate(skill);
                      const wasRefreshed = !!skill.previousVersion;
                      return (
                        <div key={`${skill.name}-${idx}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 rounded-[4px] bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-gray-800">
                                {skill.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  skill.source === '公共'
                                    ? 'text-blue-600 border-blue-200 bg-blue-50'
                                    : 'text-purple-600 border-purple-200 bg-purple-50'
                                }`}
                              >
                                {skill.source}
                              </Badge>
                              {wasRefreshed ? (
                                <span className="font-mono text-[10px]">
                                  <span className="text-green-600 font-medium">{skill.version}</span>
                                  <span className="text-gray-400 ml-0.5">(原{skill.previousVersion})</span>
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] text-gray-400">{skill.version}</span>
                              )}
                            </div>
                          </div>
                          {/* 刷新按钮 */}
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => updateResult.hasUpdate ? handleRefreshSingleSkill(idx) : undefined}
                                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                                  updateResult.hasUpdate
                                    ? 'text-green-500 hover:text-green-600 hover:bg-green-50 cursor-pointer'
                                    : 'text-gray-300 cursor-default'
                                }`}
                                title={updateResult.hasUpdate ? '有新版本，点击刷新' : '已是最新'}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {updateResult.hasUpdate
                                ? `有新版本 ${updateResult.latestVersion}，点击刷新`
                                : '已是最新版本'}
                            </TooltipContent>
                          </Tooltip>
                          {/* 删除按钮 */}
                          <button
                            onClick={() => removeSkill(idx)}
                            className="w-7 h-7 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="从角色中移除"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
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
            </div>

            {/* Visible */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700">用户可见</Label>
                <p className="text-xs text-gray-400 mt-0.5">启用后，员工创建 Agent 时可选择此角色</p>
              </div>
              <Switch checked={visible} onCheckedChange={setVisible} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button
              onClick={handleSave}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RoleAddPublicSkillDialog
        open={showAddPublicDialog}
        existingSkillNames={skills.map(s => s.name)}
        onConfirm={handleAddSkills}
        onCancel={() => setShowAddPublicDialog(false)}
      />

      <RoleAddEnterpriseSkillDialog
        open={showAddEnterpriseDialog}
        existingSkillNames={skills.map(s => s.name)}
        onConfirm={handleAddSkills}
        onCancel={() => setShowAddEnterpriseDialog(false)}
        roleScope={scope}
        roleGroupIds={groupIds}
      />

      <BatchUpdateDialog
        open={showBatchUpdateDialog}
        updatableSkills={getUpdatableSkills()}
        onConfirm={handleBatchUpdateConfirm}
        onCancel={() => setShowBatchUpdateDialog(false)}
      />
    </>
  );
}

// ── Main Tab ────────────────────────────────────────────
export default function SkillRolesTab() {
  const [roles, setRoles] = useState<Role[]>([...MOCK_ROLES]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [isNewRole, setIsNewRole] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  // 应用范围筛选（多选 checkbox）
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  const allScopeKeys = ['public', ...MOCK_GROUPS.map(g => g.id)];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRoles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggle = (id: string) => {
    setRoles(roles.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsNewRole(false);
    setShowEdit(true);
  };

  const handleNew = () => {
    setEditingRole(null);
    setIsNewRole(true);
    setShowEdit(true);
  };

  const handleSave = (saved: Role) => {
    if (isNewRole) {
      setRoles([saved, ...roles]);
      toast.success(`角色「${saved.name}」已创建`);
    } else {
      setRoles(roles.map((r) => (r.id === saved.id ? saved : r)));
      toast.success(`角色「${saved.name}」已更新`);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setRoles(roles.filter((r) => r.id !== deleteTarget.id));
    toast.success(`角色「${deleteTarget.name}」已删除`);
    setDeleteTarget(null);
  };

  const handleScopeChange = (id: string, scope: SkillScope, groupIds: string[]) => {
    setRoles(roles.map(r => r.id === id ? { ...r, scope, groupIds } : r));
    toast.success('应用范围修改成功');
  };

  // 筛选后的角色列表（多选）
  const filteredRoles = roles.filter(role => {
    if (selectedScopes.size === 0) return true; // 无筛选 = 全部
    const isAllSelected = allScopeKeys.length > 0 && allScopeKeys.every(k => selectedScopes.has(k));
    if (isAllSelected) return true;
    // 检查是否匹配勾选的任意范围
    const isPublicRole = role.scope === 'public' || !role.groupIds || role.groupIds.length === 0;
    if (selectedScopes.has('public') && isPublicRole) return true;
    if (!isPublicRole && role.groupIds) {
      for (const gid of role.groupIds) {
        if (selectedScopes.has(gid)) return true;
      }
    }
    return false;
  });

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-bold text-gray-900">角色列表</div>
        <div className="flex items-center gap-3">
          {/* 应用范围筛选 */}
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
                      : allScopeKeys.every(k => selectedScopes.has(k))
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
                    : allScopeKeys.every(k => selectedScopes.has(k))
                      ? '全部应用范围'
                      : Array.from(selectedScopes).map(s => s === 'public' ? '全部用户' : MOCK_GROUPS.find(g => g.id === s)?.name || s).join('、')}
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
                  {/* 底部：已选数量 + 清除 */}
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
          <Button
            onClick={handleNew}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            自定义角色
          </Button>
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
        style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-10 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">角色名称</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">角色描述</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">应用范围</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">用户可见</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">操作</th>
              </tr>
            </thead>
            <SortableContext
              items={filteredRoles.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {filteredRoles.map((role) => (
                  <SortableRoleRow
                    key={role.id}
                    role={role}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={setDeleteTarget}
                    onScopeChange={handleScopeChange}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
        <div className="px-4 py-3 border-t border-gray-50 text-sm text-gray-400">
          共 {filteredRoles.length} 个角色{selectedScopes.size > 0 ? `（筛选中，全部 ${roles.length} 个）` : ''}
        </div>
      </div>

      {/* Edit/Create Modal */}
      <RoleEditModal
        open={showEdit}
        role={isNewRole ? null : editingRole}
        onClose={() => setShowEdit(false)}
        onSave={handleSave}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色「{deleteTarget?.name}」吗？删除后，已选择该角色的 Agent 不受影响，但新创建的 Agent 将无法再选择此角色。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
