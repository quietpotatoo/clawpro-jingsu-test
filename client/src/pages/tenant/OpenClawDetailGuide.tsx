/**
 * OpenClawDetailGuide - OpenClaw 详情页「基础配置」
 * Figma: node 247:5352（Clawpro 交互稿）
 *
 * 修改记录（2026-05-18）：
 *   1) 背景复用「我的 Agent」的线+点阵背景
 *   2) 左侧纵向 Tab 改为横向 Segmented Control（§8.6 规范）
 *   3) 技能区域新增「安装新技能」弹窗交互（含分类筛选 + 搜索 + 已安装标记）
 *   4) 整体视觉刷新至最新设计规范
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import TenantLayout from "@/components/TenantLayout";
import { SurfaceCard } from "@/components/ui/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Edit3,
  ChevronDown,
  Trash2,
  Search,
  Plus,
  Info,
  ExternalLink,
  RefreshCw,
  X,
  ArrowLeft,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/agent/AgentAvatar";
import { MODEL_PROVIDERS, CHANNEL_OPTIONS } from "@/lib/agentConfigConstants";

// ─── 顶部 Tab 数据（横向 Segmented Control） ─────────────────────────────
type DetailTab = "basic" | "tools" | "memory" | "files" | "doctor";
const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "basic", label: "基础配置" },
  { id: "tools", label: "工具管理" },
  { id: "memory", label: "记忆管理" },
  { id: "files", label: "网盘管理" },
  { id: "doctor", label: "龙虾医院" },
];

// ─── 模拟数据：已接入通道 ─────────────────────────────────────────────────
const MOCK_CHANNELS: { id: string; name: string }[] = [
  { id: "feishu", name: "飞书" },
  { id: "qq", name: "QQ" },
];

// ─── 模拟数据：已安装技能 ─────────────────────────────────────────────────
const MOCK_INSTALLED_SKILLS: { name: string; version: string }[] = [
  { name: "code-interpreter", version: "1.2.0" },
  { name: "image-recognition", version: "0.9.1" },
  { name: "text-to-speech", version: "1.0.0" },
  { name: "pdf-parser", version: "1.1.0" },
  { name: "excel-reader", version: "2.0.0" },
];

// ─── 模拟数据：安装队列（失败） ──────────────────────────────────────────
const MOCK_INSTALL_QUEUE: { name: string; version: string; status: "failed" }[] = [
  { name: "data-analysis", version: "2.0.0", status: "failed" },
  { name: "video-transcribe", version: "0.7.0", status: "failed" },
];

// ─── 技能库数据（弹窗用） ─────────────────────────────────────────────────
type SkillCategory = "all" | "ai" | "dev" | "efficiency" | "data" | "content" | "security" | "collab";
const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ai", label: "AI智能" },
  { id: "dev", label: "开发工具" },
  { id: "efficiency", label: "效率提升" },
  { id: "data", label: "数据分析" },
  { id: "content", label: "内容创作" },
  { id: "security", label: "安全合规" },
  { id: "collab", label: "通讯协作" },
];

interface SkillItem {
  id: string;
  name: string;
  initial: string;
  color: string;
  description: string;
  category: SkillCategory;
  installed: boolean;
}

const SKILL_LIBRARY: SkillItem[] = [
  {
    id: "self-improving",
    name: "Self-Improving Agent",
    initial: "S",
    color: "#7C3AED",
    description: "捕获经验教训、错误和纠正，以实现持续改进。使用时机：（1）命令或操作意外失败；（2）用户纠正……",
    category: "ai",
    installed: false,
  },
  {
    id: "find-skills",
    name: "Find Skills",
    initial: "F",
    color: "#0891B2",
    description: "当用户询问\"如何做某事\"、\"寻找某技能\"或希望扩展功能时，帮助发现并安装智能体技能。",
    category: "ai",
    installed: false,
  },
  {
    id: "github",
    name: "Github",
    initial: "G",
    color: "#059669",
    description: "使用 `gh` CLI 与 GitHub 交互，通过 `gh issue`、`gh pr`、`gh run` 和 `gh api` 管理议题、PR、CI 运行及高级查询。",
    category: "dev",
    installed: false,
  },
  {
    id: "agent-browser",
    name: "Agent Browser",
    initial: "A",
    color: "#D97706",
    description: "基于Rust的快速无头浏览器自动化CLI，支持Node.js回退，允许AI代理通过结构化命令执行页面导航、点击、输入和快照操作。",
    category: "dev",
    installed: false,
  },
  {
    id: "skill-vetter",
    name: "Skill Vetter",
    initial: "S",
    color: "#DC2626",
    description: "AI智能体技能安全预审工具。安装ClawdHub、GitHub等来源技能前，检查风险信号、权限范围及可疑模式。",
    category: "security",
    installed: true,
  },
];

// ─── 已配置徽标 ──────────────────────────────────────────────────────────
function ConfiguredBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-5 px-2 text-xs shrink-0"
      style={{ color: "#16A34A", letterSpacing: "0.015em" }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: "#16A34A" }} />
      已配置
    </span>
  );
}

// ─── 模型选择行 ──────────────────────────────────────────────────────────
function ModelRow({
  provider,
  model,
  showEdit,
  showDelete,
}: {
  provider: string;
  model: string;
  showEdit?: boolean;
  showDelete?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[4px] px-4 py-3.5"
      style={{ background: "#FAFAFA", border: "1px solid #E6E9EF" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "rgba(0,0,0,0.9)" }}>
          {provider}
        </span>
        <span className="text-xs" style={{ color: "rgba(0,0,0,0.3)" }}>
          {model}
        </span>
      </div>
      {showEdit && (
        <button
          className="text-[#737373] hover:text-[#1447E6] transition-colors"
          aria-label="编辑模型"
          onClick={() => toast.info("编辑模型（demo）")}
        >
          <Edit3 className="w-4 h-4" />
        </button>
      )}
      {showDelete && (
        <button
          className="text-[#737373] hover:text-red-500 transition-colors"
          aria-label="删除模型"
          onClick={() => toast.info("删除模型（demo）")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── 通道行 ──────────────────────────────────────────────────────────────
function ChannelRow({ name }: { name: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-[4px] px-4 py-3.5"
      style={{ background: "#FAFAFA", border: "1px solid #E6E9EF" }}
    >
      <div className="flex items-center gap-2">
        <ChevronDown className="w-4 h-4 text-[#737373]" />
        <span className="text-xs font-medium" style={{ color: "rgba(0,0,0,0.9)" }}>
          {name}
        </span>
        <span
          className="inline-flex items-center gap-1.5 h-5 px-2 text-xs"
          style={{ color: "#16A34A" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: "#16A34A" }} />
          运行中
        </span>
      </div>
      <button
        className="text-[#737373] hover:text-red-500 transition-colors"
        aria-label="删除通道"
        onClick={() => toast.info(`删除通道 ${name}（demo）`)}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── 安装新技能弹窗 ──────────────────────────────────────────────────────
function SkillInstallModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [category, setCategory] = useState<SkillCategory>("all");
  const [search, setSearch] = useState("");
  const [addedSkills, setAddedSkills] = useState<string[]>([]);

  const filteredSkills = SKILL_LIBRARY.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = (skillId: string) => {
    setAddedSkills((prev) => [...prev, skillId]);
    toast.success("技能已添加到安装列表");
  };

  const handleInstall = () => {
    if (addedSkills.length === 0) {
      toast.warning("请先添加要安装的技能");
      return;
    }
    toast.success(`开始安装 ${addedSkills.length} 个技能`);
    onOpenChange(false);
    setAddedSkills([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden" showCloseButton={false}>
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <DialogHeader className="p-0 gap-0">
            <DialogTitle className="text-base font-semibold" style={{ color: "#0A0A0A" }}>
              安装新技能
            </DialogTitle>
          </DialogHeader>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#737373] hover:text-[#0A0A0A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 统计 + 技能库跳转 */}
        <div className="px-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#1447E6" }}>
            <Plus className="w-4 h-4" />
            <span>当前添加：{addedSkills.length}个</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" style={{ color: "#1447E6" }} />
              <span className="text-sm" style={{ color: "#0A0A0A" }}>技能库</span>
              <span className="text-xs" style={{ color: "#737373" }}>
                详情可查看
              </span>
              <a
                href="#"
                className="text-xs underline"
                style={{ color: "#0052D9" }}
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("跳转 SkillHub（demo）");
                }}
              >
                SkillHub
              </a>
              <ExternalLink className="w-3 h-3" style={{ color: "#0052D9" }} />
            </div>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "rgba(0,0,0,0.4)" }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="输入 Skill 名称搜索并添加"
              className="h-9 pl-9 rounded-[4px] text-sm"
              style={{ background: "#FFFFFF", borderColor: "#E6E9EF" }}
            />
          </div>
        </div>

        {/* 分类标签 + 排序 */}
        <div className="px-6 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {SKILL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className="px-3 py-1 text-xs rounded-full transition-colors"
                style={{
                  background: category === cat.id ? "#0A0A0A" : "#F5F5F5",
                  color: category === cat.id ? "#FFFFFF" : "#525252",
                  border: category === cat.id ? "none" : "1px solid transparent",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full"
            style={{ background: "transparent", border: "1px solid #E5E5E5", color: "#525252" }}
          >
            综合排序
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* 技能列表 */}
        <div
          className="mx-6 mb-4 rounded-[4px] overflow-hidden max-h-[340px] overflow-y-auto"
          style={{ border: "1px solid #E5E5E5" }}
        >
          {filteredSkills.map((skill, idx) => {
            const isAdded = addedSkills.includes(skill.id);
            return (
              <div key={skill.id}>
                {idx > 0 && <div className="h-px" style={{ background: "#F0F0F0" }} />}
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {/* 左：图标 + 信息 */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-[4px] flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ background: skill.color }}
                    >
                      {skill.initial}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: "#0A0A0A" }}>
                        {skill.name}
                      </span>
                      <span
                        className="text-xs leading-4 line-clamp-2"
                        style={{ color: "#737373" }}
                      >
                        {skill.description}
                      </span>
                    </div>
                  </div>

                  {/* 右：缩略图占位 + 按钮 */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className="w-[72px] h-[48px] rounded-[4px]"
                      style={{ background: "#F5F5F5" }}
                    />
                    {skill.installed ? (
                      <span
                        className="inline-flex items-center px-3 py-1 text-xs rounded-[4px]"
                        style={{ background: "#EAEBED", color: "#737373" }}
                      >
                        已安装
                      </span>
                    ) : isAdded ? (
                      <span
                        className="inline-flex items-center px-3 py-1 text-xs rounded-[4px]"
                        style={{ background: "#E8F5E9", color: "#16A34A" }}
                      >
                        已添加
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(skill.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-[4px] text-white hover:opacity-90 transition-opacity"
                        style={{ background: "#0A0A0A" }}
                      >
                        <Plus className="w-3 h-3" />
                        添加
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部操作栏 */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid #EAEBED" }}
        >
          <Button
            variant="claw-outline"
            size="claw"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <button
            onClick={handleInstall}
            className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-[4px] text-white hover:opacity-90 transition-opacity"
            style={{
              background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)",
            }}
          >
            开始安装
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────
export default function OpenClawDetailGuide() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<DetailTab>("basic");
  const [skillSearch] = useState("");
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [panelDialogOpen, setPanelDialogOpen] = useState(false);

  // ── Model state ──
  const [selectedProvider, setSelectedProvider] = useState(MODEL_PROVIDERS[0].value);
  const [selectedModel, setSelectedModel] = useState(MODEL_PROVIDERS[0].versions[0].value);
  const currentProvider = MODEL_PROVIDERS.find(p => p.value === selectedProvider) || MODEL_PROVIDERS[0];
  const currentVersions = currentProvider.versions;

  type AppliedModel = { id: number; providerLabel: string; versionLabel: string; primary: boolean; adminPreset?: boolean };
  const [appliedModels, setAppliedModels] = useState<AppliedModel[]>([
    { id: 1, providerLabel: "腾讯云 Token Plan 企业版专业套餐", versionLabel: "DeepSeek-V4-Pro", primary: true, adminPreset: true },
  ]);
  const [modelIdCounter, setModelIdCounter] = useState(2);

  const handleProviderChange = (providerValue: string) => {
    setSelectedProvider(providerValue);
    const provider = MODEL_PROVIDERS.find(p => p.value === providerValue);
    if (provider) setSelectedModel(provider.versions[0].value);
  };

  const handleApplyModel = () => {
    const provider = MODEL_PROVIDERS.find(p => p.value === selectedProvider);
    const version = currentVersions.find(v => v.value === selectedModel);
    if (!provider || !version) return;
    const newEntry: AppliedModel = {
      id: modelIdCounter,
      providerLabel: provider.label,
      versionLabel: version.label,
      primary: !appliedModels.some(m => m.primary),
    };
    setAppliedModels(prev => [...prev, newEntry]);
    setModelIdCounter(c => c + 1);
    toast.success("模型已添加");
  };

  const handleDeleteModel = (id: number) => {
    setAppliedModels(prev => prev.filter(m => m.id !== id));
    toast.info("模型已删除");
  };

  // ── Channel state ──
  const [selectedChannel, setSelectedChannel] = useState("wechat");
  const currentChannelConfig = CHANNEL_OPTIONS.find(c => c.value === selectedChannel);

  // 点阵高度计算（复用"我的 Agent"方案）
  // 设计意图：点阵从 header 底部横线开始，到底部分隔栏顶部横线结束（下方 75px 区域为深灰背景）
  const roRef = useRef<ResizeObserver | null>(null);
  const middleSectionRef = useRef<HTMLDivElement | null>(null);
  const headerElRef = useRef<HTMLElement | null>(null);
  const bottomBarElRef = useRef<HTMLDivElement | null>(null);
  const [dotsTop, setDotsTop] = useState(112);
  const [dotsBottom, setDotsBottom] = useState(75);

  const recompute = useCallback(() => {
    const middle = middleSectionRef.current;
    const header = headerElRef.current;
    const bottomBar = bottomBarElRef.current;
    if (!middle) return;
    // top: header 底部 = 点阵起点
    if (header) {
      const middleRect = middle.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      setDotsTop(headerRect.bottom - middleRect.top);
    }
    // bottom: 底部分隔栏顶部 = 点阵终点
    if (bottomBar) {
      const middleRect = middle.getBoundingClientRect();
      const barRect = bottomBar.getBoundingClientRect();
      const barTopInMiddle = barRect.top - middleRect.top;
      setDotsBottom(middle.offsetHeight - barTopInMiddle);
    }
  }, []);

  const middleRef = useCallback((node: HTMLDivElement | null) => {
    middleSectionRef.current = node;
    recompute();
  }, [recompute]);

  const headerRef = useCallback((node: HTMLElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    headerElRef.current = node;
    if (!node) {
      recompute();
      return;
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    if (middleSectionRef.current) ro.observe(middleSectionRef.current);
    if (bottomBarElRef.current) ro.observe(bottomBarElRef.current);
    roRef.current = ro;
  }, [recompute]);

  const bottomBarRef = useCallback((node: HTMLDivElement | null) => {
    bottomBarElRef.current = node;
    recompute();
    if (node && roRef.current) {
      roRef.current.observe(node);
    }
  }, [recompute]);

  useEffect(() => {
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [recompute]);

  return (
    <TenantLayout>
      {/* 用户端通用骨架（§7.4）：min-w-[1200px] + max-w-[1920px] + 80px 占位带
          min-h-[calc(100vh-64px)] 保证内容少时也能撑满视口，避免底部出现没有点阵/竖线的"裸露背景"区 */}
      <div className="min-w-[1200px] overflow-x-clip">
        <div className="max-w-[1920px] mx-auto flex items-stretch page-enter min-h-[calc(100vh-64px)]">
          {/* 左侧 80px 占位带 */}
          <div aria-hidden className="shrink-0 w-20 self-stretch" />

          {/* 中间内容区：与 MyOpenClaw 对齐，paddingBottom 75px 留出底部空白 */}
          <div ref={middleRef} className="flex-1 min-w-0 relative" style={{ paddingBottom: "75px" }}>
            {/* 左侧点阵装饰层：从 Header 底部横线 ~ 底部分隔栏顶部横线（中间区域） */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                top: `${dotsTop}px`,
                bottom: `${dotsBottom}px`,
                left: "calc((100% - 100vw) / 2)",
                right: "100%",
                backgroundImage:
                  "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                backgroundSize: "12px 12px",
              }}
            />
            {/* 右侧点阵装饰层 */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                top: `${dotsTop}px`,
                bottom: `${dotsBottom}px`,
                left: "100%",
                right: "calc((100% - 100vw) / 2)",
                backgroundImage:
                  "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                backgroundSize: "12px 12px",
              }}
            />
            {/* 左右贯穿竖线（top-0 到 bottom-0 全高贯穿） */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 left-0 z-30"
              style={{ width: "1px", backgroundColor: "#E2E8F0" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 right-0 z-30"
              style={{ width: "1px", backgroundColor: "#E2E8F0" }}
            />

            {/* 内容主体 */}
            <div className="relative">
              {/* ======== Header ======== */}
              <header ref={headerRef} className="relative flex items-end justify-between gap-6 px-[42px] py-6">
                {/* Header 底部横线（贯穿全视口） */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    left: "calc(50% - 50vw)",
                    width: "100vw",
                    bottom: 0,
                    height: "1px",
                    backgroundColor: "#E2E8F0",
                  }}
                />

                <div className="flex flex-col gap-4">
                  {/* 返回按钮 */}
                  <button
                    onClick={() => navigate("/my-openclaw")}
                    className="inline-flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
                    style={{ color: "#525252" }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    返回
                  </button>

                  <div className="flex items-center gap-5">
                  {/* 头像 */}
                  <AgentAvatar
                    roleName="设计师"
                    agentName="多分组示例–前端研发"
                    size={64}
                  />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h1
                        className="text-[26px] font-semibold leading-8"
                        style={{ color: "#0A0A0A", letterSpacing: "-0.0385em" }}
                      >
                        多分组示例–前端研发
                      </h1>
                      {/* 运行中徽标 */}
                      <span
                        className="inline-flex items-center gap-1.5 h-5 px-2 text-xs rounded-full"
                        style={{ background: "rgba(22,163,74,0.06)", color: "#16A34A" }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: "#16A34A" }} />
                        运行中
                      </span>
                    </div>
                    <div
                      className="flex items-center flex-wrap"
                      style={{
                        gap: "4px",
                        fontFamily: "PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 400,
                        fontSize: "12px",
                        lineHeight: "20px",
                        color: "#334155",
                      }}
                    >
                      <span
                        className="inline-flex items-center"
                        style={{
                          padding: "2px 6px",
                          borderRadius: "2px",
                          border: "1px solid #DAE0E9",
                          background: "linear-gradient(180deg, #FFFFFF 0%, #F9FBFC 100%)",
                          color: "#334155",
                        }}
                      >
                        通用助手
                      </span>
                      <span style={{ color: "#E2E8F0" }}>｜</span>
                      <span>类型：OpenClaw</span>
                      <span style={{ color: "#E2E8F0" }}>｜</span>
                      <span>ID：ins-grpdemo02</span>
                      <span style={{ color: "#E2E8F0" }}>｜</span>
                      <span>分组：默认</span>
                    </div>
                  </div>
                </div>
                </div>

                {/* 右：操作按钮 */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="claw-outline"
                    size="claw"
                    onClick={() => {
                      toast.success("配置已更新至最新版本");
                    }}
                  >
                    一键更新
                  </Button>
                  <Button
                    variant="claw-outline"
                    size="claw"
                    onClick={() => setPanelDialogOpen(true)}
                  >
                    开启Agent面板
                  </Button>
                  <Button
                    variant="claw-outline"
                    size="claw"
                    onClick={() => navigate("/admin/agent-migration")}
                  >
                    Agent 迁移
                  </Button>
                  <Button
                    variant="claw-primary"
                    size="claw"
                    onClick={() => {
                      localStorage.setItem("openclaw_view_mode", "chat");
                      navigate("/my-openclaw");
                    }}
                  >
                    开始对话
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </header>

              {/* ======== 横向 Segmented Tab（§8.6 规范）======== */}
              <div className="relative px-[42px] py-4">
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-[4px]"
                  style={{ background: "#F5F5F5" }}
                  role="tablist"
                  aria-label="详情页 Tab 切换"
                >
                  {DETAIL_TABS.map((t) => {
                    const active = t.id === activeTab;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3 py-1.5 text-sm rounded-[3px] transition-all duration-150 ${
                          active
                            ? "bg-white text-[#0A0A0A] font-medium"
                            : "text-[#737373] hover:text-[#0A0A0A] font-normal"
                        }`}
                        style={active ? { boxShadow: "var(--shadow-segment)" } : undefined}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ======== 三栏卡片 ======== */}
              <div className="px-[42px] py-8">
              {activeTab === "basic" && (
                <div className="grid grid-cols-3 gap-6">
                  {/* ===== 01/ 模型（Models） ===== */}
                  <SurfaceCard className="flex flex-col p-6 gap-4">
                    {/* 标题区 */}
                    <div
                      className="flex items-start justify-between pb-5 min-h-[76px]"
                      style={{ borderBottom: "1px solid #E5E5E5" }}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2">
                          <span
                            className="text-xl leading-6"
                            style={{ fontFamily: "Menlo, Consolas, 'Courier New', monospace", color: "#1447E6" }}
                          >
                            01/
                          </span>
                          <span className="text-xl font-medium leading-6" style={{ color: "#020617" }}>
                            模型
                          </span>
                          <span className="text-[15px] leading-6" style={{ color: "#D6D6D6" }}>
                            Models
                          </span>
                        </div>
                        <p className="text-sm leading-5" style={{ color: "#737373" }}>
                          Agent 的"大脑"，决定 Agent 的智能水平和能力范围
                        </p>
                      </div>
                      <ConfiguredBadge />
                    </div>

                    {/* 模型厂商选择 */}
                    <Select value={selectedProvider} onValueChange={handleProviderChange}>
                      <SelectTrigger className="w-full rounded-[4px] border-[#E5E5E5]">
                        <SelectValue placeholder="选择模型厂商" />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 模型版本选择 */}
                    {selectedProvider !== "custom" && (
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full rounded-[4px] border-[#E5E5E5]">
                          <SelectValue placeholder="选择模型版本" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentVersions.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* 添加备用模型按钮 */}
                    <button
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[4px] text-sm font-medium transition-colors hover:bg-[#F0F0F0]"
                      style={{ border: "1px dashed #D4D4D8", color: "#0A0A0A" }}
                      onClick={handleApplyModel}
                    >
                      添加备用模型
                    </button>

                    {/* 分割线 + 已应用模型 */}
                    <div className="pt-2 border-t border-[#E5E5E5]">
                      <div className="text-xs mb-2" style={{ color: "#1447E6" }}>
                        已应用模型（{appliedModels.length}）
                      </div>
                      {/* 主模型 */}
                      {appliedModels.filter(m => m.primary).length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs mb-2" style={{ color: "#737373" }}>主模型</div>
                          {appliedModels.filter(m => m.primary).map((model) => (
                            <div
                              key={model.id}
                              className="rounded-[4px] p-3 flex flex-col gap-2"
                              style={{ border: "1px solid #E5E5E5" }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium" style={{ color: "#0A0A0A" }}>
                                    {model.providerLabel}
                                  </span>
                                  <span className="text-xs" style={{ color: "#737373" }}>{model.versionLabel}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-[3px]"
                                    style={{ background: "rgba(22,163,74,0.1)", color: "#16A34A" }}
                                  >
                                    ● 主模型
                                  </span>
                                  <button
                                    className="text-[#737373] hover:text-[#DC2626] transition-colors"
                                    onClick={() => handleDeleteModel(model.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {model.adminPreset && (
                                <span
                                  className="inline-flex self-start items-center px-2 py-0.5 text-xs rounded-[3px]"
                                  style={{ border: "1px solid #E5E5E5", color: "#737373" }}
                                >
                                  管理员预置
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 备选模型 */}
                      {appliedModels.filter(m => !m.primary).length > 0 && (
                        <div>
                          <div className="text-xs mb-2" style={{ color: "#737373" }}>备选模型</div>
                          <div className="space-y-2">
                            {appliedModels.filter(m => !m.primary).map((model) => (
                              <div
                                key={model.id}
                                className="rounded-[4px] p-3 flex items-center justify-between"
                                style={{ border: "1px solid #E5E5E5" }}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium" style={{ color: "#0A0A0A" }}>
                                    {model.providerLabel}
                                  </span>
                                  <span className="text-xs" style={{ color: "#737373" }}>{model.versionLabel}</span>
                                </div>
                                <button
                                  className="text-[#737373] hover:text-[#DC2626] transition-colors"
                                  onClick={() => handleDeleteModel(model.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SurfaceCard>

                  {/* ===== 02/ 通道（Channels） ===== */}
                  <SurfaceCard className="flex flex-col p-6 gap-4">
                    {/* 标题区 */}
                    <div
                      className="flex items-start justify-between pb-5 min-h-[76px]"
                      style={{ borderBottom: "1px solid #E5E5E5" }}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2">
                          <span
                            className="text-xl leading-6"
                            style={{ fontFamily: "Menlo, Consolas, 'Courier New', monospace", color: "#1447E6" }}
                          >
                            02/
                          </span>
                          <span className="text-xl font-medium leading-6" style={{ color: "#020617" }}>
                            通道
                          </span>
                          <span className="text-[15px] leading-6" style={{ color: "#D6D6D6" }}>
                            Channels
                          </span>
                        </div>
                        <p className="text-sm leading-5" style={{ color: "#737373" }}>
                          用户与 Agent 交互的入口，支持微信、QQ、飞书等
                        </p>
                      </div>
                      <ConfiguredBadge />
                    </div>

                    {/* 通道选择下拉 */}
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                      <SelectTrigger className="w-full rounded-[4px] border-[#E5E5E5]">
                        <SelectValue placeholder="选择通道类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNEL_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 前往授权按钮 */}
                    <button
                      className="w-full py-2.5 rounded-[4px] text-sm font-medium transition-colors hover:bg-[#F9F9F9]"
                      style={{ border: "1px solid #E5E5E5", color: "#0A0A0A" }}
                      onClick={() => toast.info("前往授权（demo）")}
                    >
                      前往授权
                    </button>

                    {/* 说明文字（动态跟随选中通道） */}
                    <p className="text-xs leading-relaxed" style={{ color: "#737373" }}>
                      {currentChannelConfig?.descText || "选择通道后查看说明"}
                    </p>
                  </SurfaceCard>

                  {/* ===== 03/ 技能（Skills） ===== */}
                  <SurfaceCard className="flex flex-col p-6 gap-3">
                    <div
                      className="flex items-start justify-between pb-5 min-h-[76px]"
                      style={{ borderBottom: "1px solid #E5E5E5" }}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2">
                          <span
                            className="text-xl leading-6"
                            style={{ fontFamily: "Menlo, Consolas, 'Courier New', monospace", color: "#0052D9" }}
                          >
                            03/
                          </span>
                          <span className="text-xl font-medium leading-6" style={{ color: "#020617" }}>
                            技能
                          </span>
                          <span className="text-[15px] leading-6" style={{ color: "#D6D6D6" }}>
                            Skills
                          </span>
                        </div>
                        <p className="text-sm leading-5" style={{ color: "#737373" }}>
                          为 Agent 添加搜索、绘图等扩展能力
                        </p>
                      </div>
                      <ConfiguredBadge />
                    </div>

                    {/* Skill 搜索输入框 */}
                    <div className="relative">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: "rgba(0,0,0,0.4)" }}
                      />
                      <Input
                        placeholder="请输入准确 Skill 名称"
                        className="h-9 pl-9 rounded-[4px] text-sm"
                        style={{ background: "#FFFFFF", borderColor: "#E6E9EF" }}
                      />
                    </div>

                    {/* 安装技能按钮 */}
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 rounded-[4px] py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                      style={{ background: "#0A0A0A", color: "#FFFFFF" }}
                      onClick={() => setSkillModalOpen(true)}
                    >
                      安装技能
                    </button>

                    {/* 管理员配置提示 */}
                    <div
                      className="flex items-start gap-2 p-3 rounded-[4px]"
                      style={{ background: "#EBF5FF", border: "1px solid #BFDBFE" }}
                    >
                      <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#1447E6" }} />
                      <span className="text-xs leading-4" style={{ color: "#1447E6" }}>
                        管理员配置了
                        <a href="#" className="underline font-medium" onClick={(e) => { e.preventDefault(); toast.info("SkillHub 模型（demo）"); }}>
                          SkillHub模型
                        </a>
                        ，不支持搜索，请输入准确Skill名称
                      </span>
                    </div>

                    {/* 已安装技能列表 */}
                    <div className="flex flex-col gap-3 mt-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium" style={{ color: "rgba(0,0,0,0.8)" }}>
                          已安装技能（{MOCK_INSTALLED_SKILLS.length + 48}）
                        </div>
                      </div>
                      <div
                        className="rounded-[4px] flex flex-col max-h-[200px] overflow-y-auto"
                        style={{ background: "#FAFAFA", border: "1px solid #E6E9EF" }}
                      >
                        {MOCK_INSTALLED_SKILLS.filter((s) =>
                          skillSearch ? s.name.includes(skillSearch) : true,
                        ).map((s, idx) => (
                          <div
                            key={`${s.name}-${idx}`}
                            className="flex items-center px-4 py-2.5 text-sm"
                            style={{
                              color: "#0A0A0A",
                              borderBottom: idx < MOCK_INSTALLED_SKILLS.length - 1 ? "1px solid #F0F0F0" : "none",
                            }}
                          >
                            {s.name} {s.version}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 待安装技能（安装失败队列） */}
                    <div className="flex flex-col gap-3 mt-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium" style={{ color: "rgba(0,0,0,0.8)" }}>
                          待安装技能（{MOCK_INSTALL_QUEUE.length}）
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs hover:opacity-80"
                            style={{ color: "#1447E6" }}
                            onClick={() => toast.info("重试安装（demo）")}
                          >
                            <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                            重试
                          </button>
                          <button
                            className="text-xs hover:opacity-80"
                            style={{ color: "#DC2626" }}
                            onClick={() => toast.info("删除失败项（demo）")}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            删除
                          </button>
                        </div>
                      </div>
                      <div
                        className="rounded-[4px] flex flex-col"
                        style={{ background: "#FAFAFA", border: "1px solid #E6E9EF" }}
                      >
                        {MOCK_INSTALL_QUEUE.map((s, idx) => (
                          <div
                            key={`${s.name}-${idx}`}
                            className="flex items-center justify-between px-4 py-2.5"
                            style={{
                              borderBottom: idx < MOCK_INSTALL_QUEUE.length - 1 ? "1px solid #F0F0F0" : "none",
                            }}
                          >
                            <span className="text-sm" style={{ color: "#0A0A0A" }}>
                              {s.name} {s.version}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-xs"
                              style={{ color: "#DC2626" }}
                            >
                              <Info className="w-3 h-3" />
                              安装失败
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              )}

              {/* 其他 tab 占位 */}
              {activeTab !== "basic" && (
                <SurfaceCard className="p-12">
                  <div className="text-center text-sm" style={{ color: "#A3A3A3" }}>
                    {DETAIL_TABS.find((t) => t.id === activeTab)?.label}
                    内容待开发
                  </div>
                </SurfaceCard>
              )}
              </div>

              {/* 底部分隔栏（对齐 MyOpenClaw 分页栏样式）：自带顶部贯穿全视口横线，
                  作为点阵装饰层的下边界；下方由父容器 paddingBottom:75px 留出空白 */}
              <div ref={bottomBarRef} className="relative mt-6 px-6 py-3 h-9">
                <div
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    left: "calc(50% - 50vw)",
                    width: "100vw",
                    top: 0,
                    height: "1px",
                    backgroundColor: "#E2E8F0",
                  }}
                />
              </div>
            </div>
          </div>

          {/* 右侧 80px 占位带 */}
          <div aria-hidden className="shrink-0 w-20 self-stretch" />
        </div>
      </div>

      {/* 安装新技能弹窗 */}
      <SkillInstallModal open={skillModalOpen} onOpenChange={setSkillModalOpen} />

      {/* 开启 Agent 面板弹窗 */}
      <Dialog open={panelDialogOpen} onOpenChange={setPanelDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">开启面板</DialogTitle>
          </DialogHeader>
          <div className="bg-orange-50 border border-orange-100 rounded-[4px] px-4 py-3">
            <p className="text-sm font-semibold text-orange-600 leading-relaxed">
              访问链接已生成，该链接含有您的 API Key 和加密配置，请勿分享给第三方，以防隐私泄露或资产损失。
            </p>
          </div>
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">WebSocket URL</span>
              <span className="flex-1 text-sm text-foreground font-mono truncate">
                http://43.139.137.45:38341/knmnz8?token=8512b8ef...
              </span>
              <button
                className="p-1.5 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { navigator.clipboard.writeText("http://43.139.137.45:38341/knmnz8?token=8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb"); toast.success("已复制"); }}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">网关令牌</span>
              <span className="flex-1 text-sm text-foreground font-mono truncate">
                8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb
              </span>
              <button
                className="p-1.5 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { navigator.clipboard.writeText("8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb"); toast.success("已复制"); }}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            用浏览器打开 WebSocket URL，如面板需要填入网关令牌，则将网关令牌复制并粘贴过去，即可进入面板。
          </p>
          <div className="flex justify-end pt-2">
            <Button
              variant="claw-primary"
              className="w-full"
              onClick={() => { window.open("http://43.139.137.45:38341/knmnz8?token=8512b8ef93cdfd393ad6af5efa42c1e54981f3cb69f381eb", "_blank"); }}
            >
              立即访问
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
}
