import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Upload, X, ChevronDown, ChevronRight, Loader, FileText, Download, Search as SearchIcon, Check, ShieldCheck, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import JSZip from 'jszip';
import { Skill, type SkillScope } from './types';
import { DEFAULT_CATEGORIES, MOCK_GROUPS } from './mockData';
import { downloadSampleSkillZip } from './downloadUtils';

interface SkillUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (skill: Skill) => void;
  existingSlugs?: string[];
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
  
  // 检查第一行是否为 ---
  if (lines[0] !== '---') {
    return null;
  }

  const result: { name?: string; description?: string } = {};
  
  // 从第二行开始解析 name 和 description
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('---')) {
      break;
    }
    
    if (line.startsWith('name:')) {
      result.name = line.substring(5).trim();
    } else if (line.startsWith('description:')) {
      result.description = line.substring(12).trim();
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

// 真实 ZIP 文件解析
// 可读取内容的文本文件扩展名
const TEXT_EXTENSIONS = ['.md', '.mdx', '.xml', '.json', '.txt', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.py', '.js', '.ts', '.css', '.html', '.htm', '.svg', '.env', '.gitignore', '.dockerfile'];

const isTextFile = (name: string) => {
  const lower = name.toLowerCase();
  if (!lower.includes('.') && !lower.includes('/')) return true; // Dockerfile, Makefile 等
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

    // 遍历 ZIP 中的所有文件
    loaded.forEach((relativePath, zipEntry) => {
      // 跳过文件夹
      if (zipEntry.dir) {
        return;
      }

      // 跳过系统文件（Mac 系统文件）
      if (relativePath.startsWith('__MACOSX/') || relativePath.endsWith('.DS_Store')) {
        return;
      }

      // 检查是否是 SKILL.md（不区分大小写）
      if (relativePath.toLowerCase().endsWith('skill.md')) {
        skillmdFound = true;
      }

      fileEntries.push({ relativePath, zipEntry });
    });

    // 异步读取所有文本文件的内容
    for (const { relativePath, zipEntry } of fileEntries) {
      const size = (zipEntry as any)._data ? (zipEntry as any)._data.uncompressedSize : 0;
      let content: string | undefined;

      // 对文本文件读取内容
      if (isTextFile(relativePath)) {
        try {
          content = await zipEntry.async('text');
        } catch {
          // 读取失败则不填充 content
        }
      }

      files.push({ name: relativePath, size, content });
    }

    // 排序文件列表，SKILL.md 放第一个
    files.sort((a, b) => {
      if (a.name.toLowerCase() === 'skill.md') return -1;
      if (b.name.toLowerCase() === 'skill.md') return 1;
      return a.name.localeCompare(b.name);
    });

    // 从已读取的文件中获取 SKILL.md 内容
    if (skillmdFound) {
      const skillmdFile = files.find(f => f.name.toLowerCase().endsWith('skill.md'));
      if (skillmdFile?.content) {
        skillmdContent = skillmdFile.content;
      }
    }

    const skillmdParsed = skillmdContent ? parseSkillMd(skillmdContent) : undefined;

    return {
      files,
      skillmdContent,
      skillmdParsed: skillmdParsed || undefined,
    };
  } catch (error) {
    return {
      files: [],
      error: `ZIP 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
};

export default function SkillUploadDialog({ open, onOpenChange, onConfirm, existingSlugs = [], defaultSecurityScan = true, onDefaultSecurityScanChange = () => {} }: SkillUploadDialogProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当对话框关闭时，清空上传状态
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUploadedFiles([]);
      setExpandedFile(null);
      setFormData({
        slug: '',
        name: '',
        description: '',
        version: '1.0.0',
        categories: [],
        scope: 'public',
        groupIds: [],
      });
      setGroupSearchQuery('');
      setEnableSecurityScan(defaultSecurityScan);
    }
    onOpenChange(newOpen);
  };
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    version: '1.0.0',
    categories: [] as string[],
    scope: 'public' as SkillScope,
    groupIds: [] as string[],
  });
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [enableSecurityScan, setEnableSecurityScan] = useState(defaultSecurityScan);

  const hasSuccessfulUpload = uploadedFiles.some(f => f.status === 'success');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // 新上传时删除旧的
    setUploadedFiles([]);
    setExpandedFile(null);
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;

      if (!fileName.endsWith('.zip')) {
        newFiles.push({
          name: fileName,
          size: file.size,
          status: 'error',
          error: '只支持 ZIP 文件',
        });
        continue;
      }

      // 创建解析中的文件项
      const uploadedFile: UploadedFile = {
        name: fileName,
        size: file.size,
        status: 'parsing',
      };

      newFiles.push(uploadedFile);
    }

    setUploadedFiles([...uploadedFiles, ...newFiles]);

    // 异步解析文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.zip')) continue;

      const parseResult = await parseZipFile(file);
      
      // 检查是否存在 SKILL.md
      const hasSKILLMd = parseResult.files.some(f => f.name.toLowerCase().endsWith('skill.md'));
      
      setUploadedFiles(prev => {
        const updated = [...prev];
        const fileIndex = updated.findIndex(f => f.name === file.name);
        
        if (fileIndex !== -1) {
          if (parseResult.error) {
            // ZIP 解析失败
            updated[fileIndex] = {
              name: file.name,
              size: file.size,
              status: 'error',
              error: parseResult.error,
            };
          } else if (!hasSKILLMd) {
            // 没有 SKILL.md
            updated[fileIndex] = {
              name: file.name,
              size: file.size,
              status: 'error',
              error: '不存在 SKILL.md 文件，请修改后重试',
              files: parseResult.files,
            };
          } else {
            // 解析成功
            updated[fileIndex] = {
              name: file.name,
              size: file.size,
              status: 'success',
              files: parseResult.files,
              skillmdContent: parseResult.skillmdContent,
              skillmdParsed: parseResult.skillmdParsed,
            };

            // 自动填充表单数据
            if (parseResult.skillmdParsed?.name && !formData.name) {
              setFormData(prev => ({ ...prev, name: parseResult.skillmdParsed!.name! }));
            }
            if (parseResult.skillmdParsed?.description && !formData.description) {
              setFormData(prev => ({ ...prev, description: parseResult.skillmdParsed!.description! }));
            }
          }
        }
        
        return updated;
      });
    }
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // 新上传时删除旧的
    setUploadedFiles([]);
    setExpandedFile(null);

    const folderName = '文件夹上传';
    
    // 创建解析中的文件夹项
    setUploadedFiles([{
      name: folderName,
      size: 0,
      status: 'parsing',
    }]);

    // 异步处理文件夹上传
    setTimeout(async () => {
      const fileList: { name: string; size: number; content?: string }[] = [];
      let skillmdContent: string | undefined;
      let skillmdFound = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        let content: string | undefined;

        // 对文本文件读取内容
        if (isTextFile(relativePath)) {
          try {
            content = await file.text();
          } catch {
            // 读取失败则不填充 content
          }
        }

        fileList.push({
          name: relativePath,
          size: file.size,
          content,
        });

        // 检查是否是 SKILL.md
        if (relativePath.toLowerCase().endsWith('skill.md')) {
          const pathParts = relativePath.split('/');
          if (pathParts.length === 2 && pathParts[0] && pathParts[1].toLowerCase() === 'skill.md') {
            skillmdFound = true;
            skillmdContent = content || await file.text();
          }
        }
      }

      // 保留所有文件，但不显示根目录本身
      const displayFiles = fileList.filter(f => {
        const pathParts = f.name.split('/');
        return pathParts.length > 1; // 排除根目录
      }).map(f => {
        const pathParts = f.name.split('/');
        return {
          name: pathParts.slice(1).join('/'), // 移除根目录前缀
          size: f.size,
          content: f.content,
        };
      });

      const skillmdParsed = skillmdContent ? parseSkillMd(skillmdContent) : undefined;

      if (!skillmdFound) {
        setUploadedFiles(prev => prev.map(f => 
          f.name === folderName 
            ? {
                name: folderName,
                size: 0,
                status: 'error',
                error: '不存在 Skill.md 文件或者不在根目录下，请修改后重试',
                files: displayFiles,
              }
            : f
        ));
      } else {
        setUploadedFiles(prev => prev.map(f => 
          f.name === folderName 
            ? {
                name: folderName,
                size: 0,
                status: 'success',
                files: displayFiles,
                skillmdContent,
                skillmdParsed: skillmdParsed || undefined,
              }
            : f
        ));

        // 自动填充表单数据
        if (skillmdParsed?.name && !formData.name) {
          setFormData(prev => ({ ...prev, name: skillmdParsed.name! }));
        }
        if (skillmdParsed?.description && !formData.description) {
          setFormData(prev => ({ ...prev, description: skillmdParsed.description! }));
        }
      }
    }, 0);
  };

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.name !== fileName));
    // 删除文件时，也清空表单数据
    setFormData({
      slug: '',
      name: '',
      description: '',
      version: '1.0.0',
      categories: [],
      scope: 'public',
      groupIds: [],
    });
    setGroupSearchQuery('');
  };

  const handlePublish = () => {
    const successFiles = uploadedFiles.filter(f => f.status === 'success');
    if (successFiles.length === 0) {
      toast.error('请先上传有效的 Skill ZIP 文件');
      return;
    }

    if (!formData.slug || !formData.name || !formData.version) {
      toast.error('请填写所有必填字段');
      return;
    }

    // 校验 slug 格式
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      toast.error('slug 仅支持小写字母/数字/连字符 -');
      return;
    }

    // 校验 slug 是否重复
    if (existingSlugs.includes(formData.slug)) {
      toast.error('该 slug 已存在，请修改后重试');
      return;
    }

    const successFile = uploadedFiles.find(f => f.status === 'success');

    const newSkill: Skill = {
      id: `skill-${Date.now()}`,
      slug: formData.slug,
      name: formData.name,
      description: formData.description,
      version: formData.version,
      categories: formData.categories,
      scope: formData.scope,
      groupIds: formData.scope === 'public' ? [] : formData.groupIds,
      uploadTime: new Date(),
      content: successFile?.skillmdContent || `# ${formData.name}\n\n${formData.description}`,
      versions: [formData.version],
      files: successFile?.files || [],
      securityInfo: enableSecurityScan
        ? { overallStatus: 'scanning', engines: [] }
        : { overallStatus: 'not_scanned', engines: [] },
    };

    onConfirm(newSkill);

    // 显示成功提示
    toast.success('技能发布成功');

    // 重置表单
    setUploadedFiles([]);
    setFormData({
      slug: '',
      name: '',
      description: '',
      version: '1.0.0',
      categories: [],
      scope: 'public',
      groupIds: [],
    });
    setGroupSearchQuery('');
    onOpenChange(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files) {
      const event = {
        target: { files },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  };

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[532px] max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>发布新技能</DialogTitle>
          </DialogHeader>

        <div className="space-y-6">
          {/* 文件上传区域 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">选择上传方式</Label>

            <div
              onDragOver={uploadedFiles.length > 0 ? undefined : handleDragOver}
              onDrop={uploadedFiles.length > 0 ? undefined : handleDrop}
              className={`border-2 border-dashed rounded-[4px] p-8 text-center transition-colors ${
                uploadedFiles.length > 0
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              <Upload className={`w-8 h-8 mx-auto mb-2 ${
                uploadedFiles.length > 0 ? 'text-gray-300' : 'text-gray-400'
              }`} />
              <p className={`text-sm mb-2 ${
                uploadedFiles.length > 0 ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {uploadedFiles.length > 0 ? '如需替换，请先删除下方文件' : '点击或拖拽文件上传'}
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
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadedFiles.length > 0}
                >
                  上传 ZIP
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploadedFiles.length > 0}
                >
                  选择文件夹
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                onChange={handleFolderSelect}
                className="hidden"
                {...({ webkitdirectory: '' } as any)}
              />
            </div>
          </div>

          {/* 已上传文件列表 */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">已上传文件</Label>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.name} className="border border-gray-200 rounded-[4px] overflow-hidden">
                    {/* 文件项头部 */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        {file.status !== 'parsing' && (
                          <button
                            onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
                            className="flex items-center gap-1"
                          >
                            {expandedFile === file.name ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        )}
                        {file.status === 'parsing' && null}

                        <div className="flex items-center gap-2">
                          {file.status === 'success' && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {file.status === 'error' && (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          {file.status === 'parsing' && (
                            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                          )}
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
                        {file.status === 'success' && (
                          <span className="text-xs font-medium text-green-600">成功</span>
                        )}
                        {file.status === 'error' && (
                          <span className="text-xs font-medium text-red-600">失败</span>
                        )}
                        {file.status !== 'parsing' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(file.name)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 文件详情展开 */}
                    {expandedFile === file.name && file.files && file.status !== 'parsing' && (
                      <div className="border-t border-gray-200 bg-white p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-700">查看文件列表</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {file.files.map((f) => (
                            <div key={f.name} className="flex justify-between text-xs text-gray-600">
                              <span>{f.name}</span>
                              <span>{(f.size / 1024).toFixed(2)} KB</span>
                            </div>
                          ))}
                        </div>

                        {file.skillmdParsed && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">SKILL.md 校验通过</p>
                            <div className="text-xs text-green-600 space-y-1">
                              {file.skillmdParsed.name && (
                                <p>
                                  <span className="font-medium">name:</span> {file.skillmdParsed.name}
                                </p>
                              )}
                              {file.skillmdParsed.description && (
                                <p>
                                  <span className="font-medium">description:</span>{' '}
                                  {file.skillmdParsed.description}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 提示文字 - 只有在没有上传文件时显示 */}
          {uploadedFiles.length === 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-[4px]">
              <p className="text-sm text-blue-600 font-medium">请先上传 Skill 文件，然后填写技能信息</p>
            </div>
          )}

          {/* 技能信息表单 - 只有在上传成功后才启用 */}
          <div className={`space-y-4 border-t border-gray-200 pt-4 ${!hasSuccessfulUpload ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <Label className="text-base font-semibold">技能信息</Label>
            </div>

            <div>
              <Label htmlFor="slug" className="text-sm">
                唯一标识 (slug) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                disabled={!hasSuccessfulUpload}
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="e.g., doc-summarizer-1"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">仅支持小写字母/数字/连字符 - 。企业内唯一，发布后不可修改。</p>
            </div>

          <div>
              <Label htmlFor="name" className="text-sm">
                显示名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                disabled={!hasSuccessfulUpload}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 文档总结助手"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm">
                描述
              </Label>
              <Textarea
                id="description"
                disabled={!hasSuccessfulUpload}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="技能的简要描述"
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="version" className="text-sm">
                版本号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="version"
                disabled={!hasSuccessfulUpload}
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="e.g., 1.0.0"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">分类</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DEFAULT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    disabled={!hasSuccessfulUpload}
                    onClick={() => {
                      if (!hasSuccessfulUpload) return;
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
                    } ${!hasSuccessfulUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    disabled={!hasSuccessfulUpload}
                    onClick={() => {
                      if (!hasSuccessfulUpload) return;
                      setFormData(prev => ({ ...prev, scope: 'public', groupIds: [] }));
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                      formData.scope === 'public'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    } ${!hasSuccessfulUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    全部用户
                  </button>
                  <button
                    disabled={!hasSuccessfulUpload}
                    onClick={() => {
                      if (!hasSuccessfulUpload) return;
                      setFormData(prev => ({ ...prev, scope: 'private' }));
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
                      formData.scope === 'private'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    } ${!hasSuccessfulUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    按分组
                  </button>

                  {/* 选择按分组后，右侧出现下拉选择器 */}
                  {formData.scope === 'private' && hasSuccessfulUpload && (
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

            {/* 安全检测 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="security-scan"
                  checked={enableSecurityScan}
                  onCheckedChange={(checked) => setEnableSecurityScan(checked === true)}
                  disabled={!hasSuccessfulUpload}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="security-scan" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handlePublish} 
            disabled={!hasSuccessfulUpload}
          >
            发布 Skill
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}