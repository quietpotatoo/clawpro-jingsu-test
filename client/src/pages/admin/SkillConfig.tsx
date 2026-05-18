/**
 * SkillConfig - 管控端技能配置页
 * Design: 「流动蓝图」Fluid Blueprint
 * 四个 Tab：初始技能包（即将开放）、技能安装来源（现有功能）、公共技能库（即将开放）、企业技能库（即将开放）
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Puzzle,
  Pencil,
  X,
  Check,
  PackagePlus,
  RefreshCw,
  Upload,
  HardDrive,
  Download,
  Globe,
  Zap,
} from "lucide-react";
import SkillInitialPackageTab from "./SkillLibrary/SkillInitialPackageTab";
import SkillRolesTab from "./SkillRolesTab";

// ── Tab 定义 ──────────────────────────────────────────────
const TABS = [
  {
    id: "preset",
    label: "初始技能包",
    description: "配置每个实例自动预装的技能集合，支持从公共技能库和企业技能库中挑选。",
    comingSoon: false,
  },
  {
    id: "roles",
    label: "角色设定",
    description: "创建和管理角色预设，用户在创建实例时可选择管理员配置好的角色，快速获得对应技能组合。",
    comingSoon: false,
  },
  {
    id: "source",
    label: "技能安装来源",
    description: "控制用户在实例配置页中可以从哪些来源浏览和安装新技能。",
    comingSoon: false,
  },
];

// ── 初始技能包 介绍卡片（2张）────────────────────────────
const PRESET_CARDS = [
  {
    id: "pick",
    title: "从多来源挑选技能",
    description:
      "从多个公共技能库以及企业私有技能库中自由挑选技能，组合成每个 Agent 开箱即用的初始技能集合",
    icon: PackagePlus,
    color: "#1447E6",
  },
  {
    id: "manage",
    title: "灵活管理技能增删",
    description:
      "随时对初始技能包进行技能的添加和移除，灵活调整每个 Agent 的预装技能组合，适应企业需求变化",
    icon: RefreshCw,
    color: "#34C759",
  },
];

// ── 公共技能库 介绍卡片（2张）────────────────────────────
const PUBLIC_CARDS = [
  {
    id: "browse",
    title: "多渠道公共技能市场",
    description:
      "从多个公共技能库中浏览和挑选技能，按需组合形成适合企业实际场景的公共技能库，避免团队自行搜索安装的重复劳动",
    icon: Globe,
    color: "#1447E6",
  },
  {
    id: "speed",
    title: "海量技能自由选配",
    description:
      "汇聚数万个开箱即用的 Skill，涉及文件处理、代码执行、数据分析等多个领域，按需挑选组合，打造专属于企业的定制化 Agent 数字助理",
    icon: Zap,
    color: "#FF9500",
  },
];

// ── 企业技能库 介绍卡片（3张）────────────────────────────
const LIBRARY_CARDS = [
  {
    id: "upload",
    title: "上传企业 Skill",
    description:
      "支持企业自定义 Skill 压缩包上传与版本控制，构建企业私有技能仓库，确保核心资产仅限内部调用",
    icon: Upload,
    color: "#1447E6",
  },
  {
    id: "bucket",
    title: "自有存储桶",
    description:
      "采用企业私有存储模式，一键授权创建腾讯云专属存储桶，数据物理隔离，支持内网高速互联",
    icon: HardDrive,
    color: "#AF52DE",
  },
  {
    id: "broadcast",
    title: "一键批量下发",
    description:
      "将企业技能库中的最新技能批量下发至所有云服务器，统一技能环境，分钟级配置同步，大幅降低运维成本",
    icon: Download,
    color: "#FF9500",
  },
];

// ── 介绍卡片组件 ──────────────────────────────────────────
function ComingSoonCards({
  cards,
}: {
  cards: { id: string; title: string; description: string; icon: React.ElementType; color: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-[4px] border border-gray-100 p-6 hover:shadow-md transition-shadow"
            style={{
              boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-[4px] flex items-center justify-center flex-shrink-0"
                style={{ background: card.color }}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 mb-1">{card.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 技能安装来源 Tab 内容（保持原有功能） ─────────────────
function SkillSourceTab() {
  const [skillhubUrl, setSkillhubUrl] = useState("https://clawhub.agent.com");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(skillhubUrl);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEdit = () => {
    setDraft(skillhubUrl);
    setEditing(true);
    setErrorMessage("");
  };

  const handleSave = () => {
    const trimmedUrl = draft.trim();
    if (!trimmedUrl) {
      setSkillhubUrl("");
      setEditing(false);
      setErrorMessage("");
      return;
    }
    try {
      new URL(trimmedUrl);
    } catch {
      setErrorMessage("请输入完整的 URL 地址（如：https://example.com）");
      return;
    }
    setSkillhubUrl(trimmedUrl);
    setEditing(false);
    setErrorMessage("");
  };

  const handleCancel = () => {
    setDraft(skillhubUrl);
    setEditing(false);
    setErrorMessage("");
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (errorMessage) setErrorMessage("");
  };

  return (
    <div
      className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
      style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
    >
      {/* 卡片标题 */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-50">
        <div className="w-7 h-7 rounded-[4px] bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
          <Puzzle className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-semibold text-gray-900">SkillHub 地址</h2>
      </div>

      {/* 内容区 */}
      <div className="px-6 py-6">
        <p className="text-xs text-gray-400 mb-3">
          填写企业自建或采购的 SkillHub 服务地址，用户的技能市场将从此地址加载可用技能列表。若留空，用户将默认使用 ClawHub 官方技能库。
        </p>

        {editing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder="https://clawhub.yourcompany.com"
                className={`flex-1 font-mono text-sm ${errorMessage ? "border-red-500" : ""}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button
                size="sm"
                onClick={handleSave}
                className="gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="gap-1 text-gray-500">
                <X className="w-3.5 h-3.5" />
                取消
              </Button>
            </div>
            {errorMessage && <p className="text-red-500 text-xs">{errorMessage}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-[4px] bg-gray-50 font-mono text-sm text-gray-700">
              {skillhubUrl || <span className="text-gray-400 font-sans">未配置</span>}
            </div>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-[4px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="编辑"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function SkillConfig() {
  const [activeTab, setActiveTab] = useState("preset");

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="page-enter max-w-5xl">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">技能配置</h1>
      </div>

      {/* Tab 切换器 */}
      <div className="flex items-center gap-1 mb-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.comingSoon && (
              <span
                className="font-medium text-gray-500 bg-white border border-gray-300 px-1.5 py-0.5 rounded"
                style={{ fontSize: "10px" }}
              >
                即将开放
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 描述（仅一行） */}
      <div className="flex items-center gap-3 mt-3 mb-6">
        <p className="text-sm text-gray-500 leading-relaxed">{currentTab.description}</p>

      </div>

      {/* Tab 内容 */}
      {activeTab === "preset" && (
        <SkillInitialPackageTab onPackagesChange={() => {}} />
      )}
      {activeTab === "roles" && (
        <SkillRolesTab />
      )}
      {activeTab === "source" && <SkillSourceTab />}

    </div>
  );
}
