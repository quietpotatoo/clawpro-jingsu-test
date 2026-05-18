/**
 * 更新 Skill 对话框（F-02）
 * - 预填当前 Skill 信息
 * - 可编辑 name、description、version、changeLog、categories
 * - changeLog 支持一键生成模板
 * - 可选上传新 ZIP 替换文件
 * - 版本号格式校验 + 必须高于当前版本
 */
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Upload, X, ChevronDown, ChevronRight, Loader, Sparkles, FileText, Download, Search as SearchIcon, Check, ShieldCheck, Settings } from 'lucide-react';
import JSZip from 'jszip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { type Skill, type SkillScope } from './types';
import { DEFAULT_CATEGORIES, MOCK_GROUPS } from './mockData';
import { isValidSemver, compareSemver, downloadSampleSkillZip } from './downloadUtils';

interface SkillUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill;
  onConfirm: (updatedSkill: Skill, changeLog: string) => void;
  defaultSecurityScan?: boolean;
  onDefaultSecurityScanChange?: (value: boolean) => void;
}

interface UploadedFile {
  name: string;
  size: number;
  status: 'success' | 'error' | 'pending' | 'parsing';
  error?: string;
  skillmdContent?: string;
  skillmdParsed?: {
    name?: string;
    description?: string;
  };
  files?: Array<{ name: string; size: number; content?: string }>;
}

// 解析 SKILL.md 文件内容
const parseSkillMd = (content: string): { name?: string; description?: string } | null => {
  const lines = content.split('\n').map(line => line.trim());
  if (lines[0] !== '---') return null;
  const result: { name?: string; description?: string } = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('---')) break;
    if (line.startsWith('name:')) result.name = line.substring(5).trim();
    else if (line.startsWith('description:')) result.description = line.substring(12).trim();
  }
  return Object.keys(result).length > 0 ? result : null;
};

// 可读取内容的文本文件扩展名
const TEXT_EXTENSIONS = ['.md', '.mdx', '.xml', '.json', '.txt', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.py', '.js', '.ts', '.css', '.html', '.htm', '.svg', '.env', '.gitignore', '.dockerfile'];
const isTextFile = (name: string) => {
  const lower = name.toLowerCase();
  if (!lower.includes('.') && !lower.includes('/')) return true;
  return TEXT_EXTENSIONS.some(ext => lower.endsWith(ext));
};

const parseZipFile = async (file: File): Promise<{
  files: Array<{ name: string; size: number; content?: string }>;
  skillmdContent?: string;
  skillmdParsed?: { name?: string; description?: string };
  error?: string;
}> => {
  try {
    const zip = new JSZip();
    const loaded = await zip.loadAsync(file);
    const files: Array<{ name: string; size: number; content?: string }> = [];
    let skillmdContent: string | undefined;
    let skillmdFound = false;
    const fileEntries: Array<{ relativePath: string; zipEntry: JSZip.JSZipObject }> = [];

    loaded.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (relativePath.startsWith('__MACOSX/') || relativePath.endsWith('.DS_Store')) return;
      if (relativePath.toLowerCase().endsWith('skill.md')) skillmdFound = true;
      fileEntries.push({ relativePath, zipEntry });
    });

    for (const { relativePath, zipEntry } of fileEntries) {
      const size = (zipEntry as any)._data ? (zipEntry as any)._data.uncompressedSize : 0;
      let content: string | undefined;
      if (isTextFile(relativePath)) {
        try { content = await zipEntry.async('text'); } catch { /* skip */ }
      }
      files.push({ name: relativePath, size, content });
    }

    files.sort((a, b) => {
      if (a.name.toLowerCase() === 'skill.md') return -1;
      if (b.name.toLowerCase() === 'skill.md') return 1;
      return a.name.localeCompare(b.name);
    });

    if (skillmdFound) {
      const skillmdFile = files.find(f => f.name.toLowerCase().endsWith('skill.md'));
      if (skillmdFile?.content) skillmdContent = skillmdFile.content;
    }

    const skillmdParsed = skillmdContent ? parseSkillMd(skillmdContent) : undefined;
    return { files, skillmdContent, skillmdParsed: skillmdParsed || undefined };
  } catch (error) {
    return { files: [], error: `ZIP 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
};

export default function SkillUpdateDialog({ open, onOpenChange, skill, onConfirm, defaultSecurityScan = true, onDefaultSecurityScanChange = () => {} }: SkillUpdateDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '',
    changeLog: '',
    categories: [] as string[],
    scope: 'public' as SkillScope,
    groupIds: [] as string[],
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [versionError, setVersionError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [enableSecurityScan, setEnableSecurityScan] = useState(defaultSecurityScan);

  // 初始化 - 回显已有文件和当前 Skill 信息
  useEffect(() => {
    if (open && skill) {
      setFormData({
        name: skill.name,
        description: skill.description,
        version: '',
        changeLog: '',
        categories: [...skill.categories],
        scope: skill.scope || 'public',
        groupIds: [...(skill.groupIds || [])],
      });
      setGroupSearchQuery('');
      setEnableSecurityScan(defaultSecurityScan);
      // 回显已有文件
      if (skill.files && skill.files.length > 0) {
        setUploadedFiles([{
          name: '当前文件',
          size: 0,
          status: 'success',
          files: skill.files,
        }]);
      } else {
        setUploadedFiles([]);
      }
      setExpandedFile(null);
      setVersionError('');
    }
  }, [open, skill]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUploadedFiles([]);
      setExpandedFile(null);
      setVersionError('');
    }
    onOpenChange(newOpen);
  };

  // 版本号校验
  const validateVersion = (version: string): string => {
    if (!version) return '';
    if (!isValidSemver(version)) return '版本号格式必须为 x.y.z';
    if (compareSemver(version, skill.version) <= 0) return `新版本号需高于上个版本号 ${skill.version}`;
    return '';
  };

  const handleVersionChange = (value: string) => {
    setFormData(prev => ({ ...prev, version: value }));
    setVersionError(validateVersion(value));
  };

  // 一键生成 changeLog
  const handleGenerateChangeLog = () => {
    const changes: string[] = [];
    let idx = 1;
    if (formData.name !== skill.name) {
      changes.push(`${idx}、修改名称字段`);
      idx++;
    }
    if (formData.description !== skill.description) {
      changes.push(`${idx}、修改描述字段`);
      idx++;
    }
    // 检查是否有新上传文件（非回显的原始文件）
    const hasNewUpload = uploadedFiles.some(f => f.name !== '当前文件' && f.status === 'success');
    if (hasNewUpload) {
      changes.push(`${idx}、更新SKILL文件`);
    }
    if (changes.length === 0) {
      changes.push('无变更');
    }
    setFormData(prev => ({ ...prev, changeLog: changes.join('\n') }));
  };

  // 文件上传处理 (ZIP)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedFiles([]);
    setExpandedFile(null);
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.zip')) {
        newFiles.push({ name: file.name, size: file.size, status: 'error', error: '只支持 ZIP 文件' });
        continue;
      }
      newFiles.push({ name: file.name, size: file.size, status: 'parsing' });
    }
    setUploadedFiles(newFiles);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.zip')) continue;
      const parseResult = await parseZipFile(file);
      const hasSKILLMd = parseResult.files.some(f => f.name.toLowerCase().endsWith('skill.md'));
      setUploadedFiles(prev => {
        const updated = [...prev];
        const fileIndex = updated.findIndex(f => f.name === file.name);
        if (fileIndex !== -1) {
          if (parseResult.error) {
            updated[fileIndex] = { name: file.name, size: file.size, status: 'error', error: parseResult.error };
          } else if (!hasSKILLMd) {
            updated[fileIndex] = { name: file.name, size: file.size, status: 'error', error: '不存在 SKILL.md 文件，请修改后重试', files: parseResult.files };
          } else {
            updated[fileIndex] = { name: file.name, size: file.size, status: 'success', files: parseResult.files, skillmdContent: parseResult.skillmdContent, skillmdParsed: parseResult.skillmdParsed };
          }
        }
        return updated;
      });
    }
    // 清空 input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 文件夹上传处理
  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setUploadedFiles([]);
    setExpandedFile(null);

    const folderName = '文件夹上传';
    setUploadedFiles([{ name: folderName, size: 0, status: 'parsing' }]);

    setTimeout(async () => {
      const fileList: { name: string; size: number; content?: string }[] = [];
      let skillmdContent: string | undefined;
      let skillmdFound = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        let content: string | undefined;
        if (isTextFile(relativePath)) {
          try { content = await file.text(); } catch { /* skip */ }
        }
        fileList.push({ name: relativePath, size: file.size, content });
        if (relativePath.toLowerCase().endsWith('skill.md')) {
          const pathParts = relativePath.split('/');
          if (pathParts.length === 2 && pathParts[1].toLowerCase() === 'skill.md') {
            skillmdFound = true;
            skillmdContent = content || await file.text();
          }
        }
      }

      const displayFiles = fileList.filter(f => f.name.split('/').length > 1).map(f => {
        const pathParts = f.name.split('/');
        return { name: pathParts.slice(1).join('/'), size: f.size, content: f.content };
      });

      const skillmdParsed = skillmdContent ? parseSkillMd(skillmdContent) : undefined;

      if (!skillmdFound) {
        setUploadedFiles(prev => prev.map(f =>
          f.name === folderName
            ? { name: folderName, size: 0, status: 'error', error: '不存在 Skill.md 文件或者不在根目录下，请修改后重试', files: displayFiles }
            : f
        ));
      } else {
        setUploadedFiles(prev => prev.map(f =>
          f.name === folderName
            ? { name: folderName, size: 0, status: 'success', files: displayFiles, skillmdContent, skillmdParsed: skillmdParsed || undefined }
            : f
        ));
      }
    }, 0);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleRemoveFile = (fileName?: string) => {
    if (fileName && fileName !== '当前文件') {
      // 删除新上传的文件，还原为原始文件
      if (skill.files && skill.files.length > 0) {
        setUploadedFiles([{
          name: '当前文件',
          size: 0,
          status: 'success',
          files: skill.files,
        }]);
      } else {
        setUploadedFiles([]);
      }
    } else {
      // 删除"当前文件"，清空列表，上传区恢复可用
      setUploadedFiles([]);
    }
    setExpandedFile(null);
  };

  const handleSave = () => {
    if (!formData.version) {
      toast.error('请填写新版本号');
      return;
    }
    const verErr = validateVersion(formData.version);
    if (verErr) {
      setVersionError(verErr);
      toast.error(verErr);
      return;
    }

    // 获取新的文件列表
    const newUpload = uploadedFiles.find(f => f.name !== '当前文件' && f.status === 'success');
    const newFiles = newUpload?.files || skill.files || [];
    const newContent = newUpload?.skillmdContent || skill.content;

    const updatedSkill: Skill = {
      ...skill,
      name: formData.name,
      description: formData.description,
      version: formData.version,
      categories: formData.categories,
      scope: formData.scope,
      groupIds: formData.scope === 'public' ? [] : formData.groupIds,
      files: newFiles,
      content: newContent,
      versions: [formData.version, ...(skill.versions || [])],
      versionHistory: [
        {
          version: formData.version,
          date: new Date().toISOString().split('T')[0],
          changeLog: formData.changeLog || undefined,
          files: newFiles,
        },
        ...(skill.versionHistory || []),
      ],
      uploadTime: new Date(),
      securityInfo: enableSecurityScan
        ? { overallStatus: 'scanning', engines: [] }
        : skill.securityInfo,
    };

    onConfirm(updatedSkill, formData.changeLog);
    toast.success(`Skill「${skill.name}」已更新至 v${formData.version}`);
    handleOpenChange(false);
  };

  const hasNewUpload = uploadedFiles.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[532px] max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>更新 Skill</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 更新提示 */}
          <div className="text-xs text-gray-900 leading-relaxed space-y-0.5">
            <p>仅更新企业技能库中的技能版本。</p>
            <p>已下发至 agent 实例的技能不会同步升级，需手动重新下发。</p>
          </div>

          {/* 文件替换 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">文件（可选替换）</Label>

            <div
              onDragOver={hasNewUpload ? undefined : (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={hasNewUpload ? undefined : (e: React.DragEvent) => {
                e.preventDefault(); e.stopPropagation();
                const files = e.dataTransfer.files;
                if (files) {
                  const event = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                  handleFileSelect(event);
                }
              }}
              className={`border-2 border-dashed rounded-[4px] p-6 text-center transition-colors ${
                hasNewUpload
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              <Upload className={`w-6 h-6 mx-auto mb-2 ${hasNewUpload ? 'text-gray-300' : 'text-gray-400'}`} />
              <p className={`text-sm mb-2 ${hasNewUpload ? 'text-gray-400' : 'text-gray-600'}`}>
                {hasNewUpload ? '如需替换，请先删除下方文件' : '点击或拖拽文件上传'}
              </p>

              {/* 上传要求 + 下载样例 */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      上传要求
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-4" align="center" side="bottom">
                    <p className="text-sm font-semibold text-gray-900 mb-3">上传要求</p>
                    <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-5">
                      <li>ZIP 包/文件夹 <strong>根目录</strong> 必须包含 SKILL.md 文件（建议 SKILL 大写）</li>
                      <li className="leading-relaxed">
                        SKILL.md 文件需包含 YAML 格式的技能名称和描述，name 和 description 后必须有空格
                        <pre className="mt-1.5 bg-gray-50 border border-gray-200 rounded-[4px] px-3 py-2 text-xs text-gray-700 font-mono whitespace-pre leading-relaxed">
{`---
name: skill-creator
description: this is a skill creator.
---`}
                        </pre>
                      </li>
                      <li>建议文件夹/ZIP 包名称和 name 名称保持一致</li>
                    </ol>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); downloadSampleSkillZip(); toast.success('样例文件下载中...'); }}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载样例
                </button>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={hasNewUpload}>
                  上传 ZIP
                </Button>
                <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()} disabled={hasNewUpload}>
                  选择文件夹
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".zip" multiple onChange={handleFileSelect} className="hidden" />
              <input ref={folderInputRef} type="file" multiple onChange={handleFolderSelect} className="hidden" {...({ webkitdirectory: '' } as any)} />
            </div>
          </div>

          {/* 已上传文件列表 */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.name} className="border border-gray-200 rounded-[4px] overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      {file.status !== 'parsing' && (
                        <button onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)} className="flex items-center gap-1">
                          {expandedFile === file.name ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        {file.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        {file.status === 'parsing' && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {file.status === 'parsing' && '正在解析...'}
                            {file.status === 'success' && file.files && `包含 ${file.files.length} 个文件`}
                            {file.status === 'error' && file.error}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status !== 'parsing' && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(file.name)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {expandedFile === file.name && file.files && file.status !== 'parsing' && (
                    <div className="border-t border-gray-200 bg-white p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">文件列表</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {file.files.map((f) => (
                          <div key={f.name} className="flex justify-between text-xs text-gray-600">
                            <span>{f.name}</span>
                            <span>{(f.size / 1024).toFixed(2)} KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Slug（只读） */}
          <div>
            <Label htmlFor="update-slug" className="text-sm">
              唯一标识 (slug) <span className="text-red-500">*</span>
            </Label>
            <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                  <Input
                    id="update-slug"
                    value={skill.slug}
                    readOnly
                    className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>slug 不允许修改</p>
                </TooltipContent>
              </Tooltip>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="update-name" className="text-sm">
              显示名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="update-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="update-desc" className="text-sm">描述</Label>
            <Textarea
              id="update-desc"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Version */}
          <div>
            <Label htmlFor="update-version" className="text-sm">
              版本号 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="update-version"
              value={formData.version}
              onChange={(e) => handleVersionChange(e.target.value)}
              placeholder={`新版本号需高于上一版本号 ${skill.version}`}
              className={`mt-1 ${versionError ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {versionError && (
              <p className="text-xs text-red-500 mt-1">{versionError}</p>
            )}
          </div>

          {/* 分类 */}
          <div>
            <Label className="text-sm">分类</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DEFAULT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      categories: prev.categories.includes(cat.id)
                        ? prev.categories.filter(id => id !== cat.id)
                        : [...prev.categories, cat.id]
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                    formData.categories.includes(cat.id)
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 应用范围 */}
          <div>
            <Label className="text-sm">应用范围</Label>
            <div className="mt-2 space-y-3">
              {/* 两个胶囊切换按钮 + 下拉框同行 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, scope: 'public', groupIds: [] }))}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                    formData.scope === 'public'
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  全部用户
                </button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, scope: 'private' }))}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                    formData.scope === 'private'
                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  按分组
                </button>

                {/* 选择按分组后，右侧出现下拉选择器 */}
                {formData.scope === 'private' && (
                  <Popover>
                    <Tooltip delayDuration={1000}>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors min-w-[120px]">
                            <span className="truncate">
                              {formData.groupIds.length > 0
                                ? `已选 ${formData.groupIds.length} 个分组`
                                : '选择分组…'}
                            </span>
                            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      {formData.groupIds.length > 0 && (
                        <TooltipContent side="bottom" className="max-w-[280px]">
                          <p className="text-xs leading-relaxed">
                            {formData.groupIds.map(gid => MOCK_GROUPS.find(g => g.id === gid)?.name || gid).join('，')}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <PopoverContent className="w-64 p-0" align="start" sideOffset={6}>
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
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
                            const checked = formData.groupIds.includes(group.id);
                            return (
                              <button
                                key={group.id}
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    groupIds: prev.groupIds.includes(group.id)
                                      ? prev.groupIds.filter(id => id !== group.id)
                                      : [...prev.groupIds, group.id]
                                  }));
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
                          已选 {formData.groupIds.length} 个分组
                        </p>
                        {formData.groupIds.length > 0 && (
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, groupIds: [] }))}
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

          {/* ChangeLog — 放最下面 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="update-changelog" className="text-sm">更新说明</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateChangeLog}
                className="text-blue-600 hover:text-blue-700 h-auto py-1 px-2 text-xs"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                一键生成
              </Button>
            </div>
            <Textarea
              id="update-changelog"
              value={formData.changeLog}
              onChange={(e) => setFormData(prev => ({ ...prev, changeLog: e.target.value }))}
              placeholder="请填写本次更新内容"
              className="mt-1"
              rows={3}
            />
          </div>

          {/* 安全检测 */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="update-security-scan"
                checked={enableSecurityScan}
                onCheckedChange={(checked) => setEnableSecurityScan(checked === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="update-security-scan" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    提交安全检测
                    <span className="relative group">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 cursor-default">限免</span>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-[4px] bg-gray-800 text-white text-xs leading-relaxed whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        限时免费，该检测能力正在公测中，暂不收费，<br />后续如需收费，仅对增量检测收费，并及时与您同步收费方式。
                      </span>
                    </span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-3" align="end" side="top">
                      <p className="text-xs font-medium text-gray-700 mb-2.5">设置默认行为</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">上传/更新时默认</span>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className={`text-[11px] ${!defaultSecurityScan ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>不勾选</span>
                          <Switch
                            checked={defaultSecurityScan}
                            onCheckedChange={(checked) => {
                              onDefaultSecurityScanChange(checked);
                              // 同步当前勾选状态
                              setEnableSecurityScan(checked);
                            }}
                            className="scale-90"
                          />
                          <span className={`text-[11px] ${defaultSecurityScan ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>勾选</span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  开启后将由腾讯云 AI Agent 安全对技能文件进行安全分析，包括代码结构、依赖安全、命令执行、网络请求、文件操作、Prompt 注入等维度的全面审查。检测通常在几分钟内完成。
                </p>
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.version || !!versionError}
           
            className="text-white hover:opacity-90 disabled:opacity-50"
          >
            保存更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
