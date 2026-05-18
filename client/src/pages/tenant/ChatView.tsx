/**
 * ChatView - 对话视图组件
 * Design: 「流动蓝图」Fluid Blueprint
 * - 左侧 OpenClaw 列表 / 浏览器模式下极简 rail
 * - 中间对话区（欢迎态 + 对话态 + 输入框）
 * - 右侧云端浏览器区（MVP：执行中可查看，空闲时可操作）
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  MoreVertical,
  Settings,
  RefreshCw,
  HardDriveDownload,
  Trash2,
  RotateCcw,
  Terminal,
  UserMinus,
  Send,
  Plus,
  Mic,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ArrowRight,
  MessageSquarePlus,
  Maximize2,
  Minimize2,
  Monitor,
  Eye,
  MousePointerClick,
  X,
  Info,
  CheckCircle2,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

// Types - must match MyOpenClaw
// 产品要求：页面主工作态只保留 3 种

type OpenClawStatus = "creating" | "createFail" | "running" | "shutdown" | "loading" | "loadFail" | "maintaining" | "pending";
type WorkspaceMode = "chat" | "chat_with_browser" | "browser_fullscreen";
type BrowserSite = "home" | "search" | "news" | "docs";

type BrowserTaskState = "idle" | "running";
type BrowserPanelStatus = "loading" | "ready";
type BrowserStartupMockMode = "default" | "always_success" | "random_fail_sg_or_package";

interface OpenClawItem {
  id: string;
  instanceId: string;
  name: string;
  status: OpenClawStatus;
  createdAt: string;
  model: string;
  modelVersion: string;
  channels: any[];
  skills: any[];
  op?: string;
  roleName?: string;
  agentType?: string;
  os_name?: string;
  osName?: string;
  imageOsName?: string;
  browserSecurityGroupReady?: boolean;
  securityGroupPorts?: Array<string | number>;
  browserRequiredPorts?: Array<string | number>;
  browserComponentInstallReady?: boolean;
  browserLaunchReady?: boolean;
  browserStartupFailStep?: BrowserStartupStepKey;
  browserStartupFailReason?: string;
  browserStartupMockMode?: BrowserStartupMockMode;
  browserStartupRandomFailSteps?: BrowserStartupStepKey[];
  browserReady?: boolean;
  desktopReady?: boolean;
  desktopInstalling?: boolean;
  desktopError?: string | null;
  groupId?: string;
  groupName?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface BrowserPanelState {
  mode: WorkspaceMode;
  taskState: BrowserTaskState;
  panelStatus: BrowserPanelStatus;
  panelLoadProgress: number;
  site: BrowserSite;
  url: string;
  pageTitle: string;
  pageDescription: string;
  addressInput: string;
  activeQuery: string;
  lastSyncedAt: string;
  liveCaption: string;
  lastUserAction: string;
  statusNote: string;
  isManualOperating: boolean;
}

interface BrowserScenarioStep {
  delay: number;
  patch: Partial<BrowserPanelState>;
}

type BrowserStartupStepKey = "imageCheck" | "componentCheck" | "policyCheck";
type BrowserStartupStepStatus = "waiting" | "running" | "success" | "failed";
type BrowserStartupFlowStatus = "idle" | "running" | "success" | "failed";
type CloudBrowserRefreshPhase = "awaiting_transition" | "unstable" | "stable_refresh_pending" | "stable_refreshing";

interface CloudBrowserRefreshTracker {
  clawId: string;
  phase: CloudBrowserRefreshPhase;
}

interface BrowserStartupModalState {
  visible: boolean;
  targetClawId: string | null;
  flowStatus: BrowserStartupFlowStatus;
  activeStep: BrowserStartupStepKey | null;
  failedStep: BrowserStartupStepKey | null;
  failureReason: string;
  steps: Record<BrowserStartupStepKey, BrowserStartupStepStatus>;
}

const BROWSER_SUPPORTED_OS_NAMES = new Set(["ubuntu24.04x86_64", "ubuntu24.04x86_64_openclaw"]);
const BROWSER_REQUIRED_PORTS = ["5901", "6080"];
const BROWSER_STARTUP_STEP_ORDER: BrowserStartupStepKey[] = ["imageCheck", "componentCheck", "policyCheck"];
const BROWSER_STARTUP_VISIBLE_STEP_ORDER: BrowserStartupStepKey[] = ["imageCheck", "componentCheck", "policyCheck"];
const BROWSER_STARTUP_STEP_META: Record<BrowserStartupStepKey, {
  title: string;
  successText: string;
  failureText: string;
  runningText: string;
}> = {
  imageCheck: {
    title: "检查镜像",
    successText: "当前云服务器镜像满足云桌面启动条件。",
    failureText: "当前实例暂不支持云桌面，仅支持 Ubuntu 24.04 镜像的 OpenClaw。",
    runningText: "正在检查实例镜像…",
  },
  componentCheck: {
    title: "检查运行组件",
    successText: "运行组件已就绪。",
    failureText: "运行组件准备失败，请重试。",
    runningText: "正在检查运行组件…",
  },
  policyCheck: {
    title: "校验组件状态及访问策略",
    successText: "组件状态与访问策略校验通过，可继续进入。",
    failureText: "安全组入方向规则未放通 6080 端口，请联系管理员处理后重试。",
    runningText: "正在校验组件状态及访问策略…",
  },
};
const BROWSER_STARTUP_STEP_DURATION: Record<BrowserStartupStepKey, number> = {
  imageCheck: 520,
  componentCheck: 980,
  policyCheck: 720,
};

const createInitialBrowserStartupSteps = (): Record<BrowserStartupStepKey, BrowserStartupStepStatus> => ({
  imageCheck: "waiting",
  componentCheck: "waiting",
  policyCheck: "waiting",
});


const createInitialBrowserStartupState = (): BrowserStartupModalState => ({
  visible: false,
  targetClawId: null,
  flowStatus: "idle",
  activeStep: null,
  failedStep: null,
  failureReason: "",
  steps: createInitialBrowserStartupSteps(),
});

const UNSUPPORTED_BROWSER_OS_NAME = "centos7.9_x86_64";
const MOCK_CLAW_NAME_CREATING = "创建中示例";
const MOCK_CLAW_NAME_RUNNING = "运行中示例";
const MOCK_CLAW_NAME_LOADING = "加载中示例";
const MOCK_CLAW_NAME_LONG_SUCCESS = "这是一个名称非常非常长的智能助手用来测试超长文本截断效果";
// 记录每个 mock 实例触发“启动云端浏览器”流程的次数，用于实现“首次失败、重试成功”等分流效果
const mockBrowserStartupAttemptCount = new Map<string, number>();
// 记录每个 mock 实例触发「云桌面升级」的次数，用于模拟首次失败、重试成功
const mockDesktopUpgradeAttemptCount = new Map<string, number>();
const DESKTOP_UPGRADE_DURATION = 2800;
const BROWSER_RANDOM_FAIL_STEPS: BrowserStartupStepKey[] = ["componentCheck", "policyCheck"];
const CLOUD_BROWSER_REINSTALL_AUTO_REFRESH_INTERVAL = 1600;
const CLOUD_BROWSER_REINSTALL_TRANSITION_TIMEOUT = 30000;

const pickRandomBrowserFailStep = (steps: BrowserStartupStepKey[]) => {
  if (steps.length === 0) return undefined;
  return steps[Math.floor(Math.random() * steps.length)];
};

const applyDemoBrowserMockFields = (claw: OpenClawItem): OpenClawItem => {
  if (claw.name === MOCK_CLAW_NAME_CREATING) {
    // 分流测试：ready=true && accessible=false → 连接异常弹窗
    return {
      ...claw,
      status: "running",
      os_name: "ubuntu24.04x86_64_openclaw",
      browserSecurityGroupReady: true,
      browserComponentInstallReady: true,
      browserLaunchReady: false,
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
    };
  }

  if (claw.name === MOCK_CLAW_NAME_LOADING) {
    // 分流测试：ready=true && accessible=true → 直接进入云端浏览器
    // 同时作为「云桌面升级」demo 分流：browserReady=true && desktopReady=false → 进入云端浏览器并展示顶部升级提示条
    return {
      ...claw,
      status: "running",
      os_name: "ubuntu24.04x86_64_openclaw",
      browserSecurityGroupReady: true,
      browserComponentInstallReady: true,
      browserLaunchReady: true,
      browserStartupMockMode: "always_success",
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
      browserReady: true,
      desktopReady: false,
      desktopInstalling: false,
      desktopError: null,
    };
  }

  if (claw.name === MOCK_CLAW_NAME_RUNNING) {
    // 分流演示：启动检测第 1 个可见步骤（imageCheck + componentCheck）失败。
    // 通过将 browserComponentInstallReady=false，让 browserVncCheck.ready=false，
    // 从而点击小电脑后走 startBrowserStartupFlow，并在 componentCheck 这一步触发失败。
    return {
      ...claw,
      status: "running",
      os_name: "ubuntu24.04x86_64",
      browserSecurityGroupReady: true,
      browserComponentInstallReady: false,
      browserLaunchReady: true,
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
    };
  }

  if (claw.name === MOCK_CLAW_NAME_LONG_SUCCESS) {
    // 分流测试：ready=false → 完整检测 / 准备弹窗
    // 注意：不要设置 browserStartupMockMode="always_success"，否则 resolveBrowserStartupAttemptClaw
    // 会把 browserSecurityGroupReady 强制覆盖回 true，导致弹窗瞬间全部通过而看不到“准备/检测”过程。
    // 具体“首次失败、重试成功”的分流，放在 resolveBrowserStartupAttemptClaw 里根据 attempt 计数处理。
    return {
      ...claw,
      status: "running",
      os_name: "ubuntu24.04x86_64_openclaw",
      browserSecurityGroupReady: false,
      browserComponentInstallReady: true,
      browserLaunchReady: true,
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
    };
  }

  return claw;
};

const resolveBrowserStartupAttemptClaw = (claw: OpenClawItem): OpenClawItem => {
  const mockClaw = applyDemoBrowserMockFields(claw);

  // 超长名称示例：首次检测失败（policyCheck），第二次及以后重试成功
  if (mockClaw.name === MOCK_CLAW_NAME_LONG_SUCCESS) {
    const prevAttempt = mockBrowserStartupAttemptCount.get(mockClaw.name) ?? 0;
    const currentAttempt = prevAttempt + 1;
    mockBrowserStartupAttemptCount.set(mockClaw.name, currentAttempt);

    if (currentAttempt === 1) {
      return {
        ...mockClaw,
        browserSecurityGroupReady: false,
        browserComponentInstallReady: true,
        browserLaunchReady: true,
        browserStartupFailStep: "policyCheck",
        browserStartupFailReason: BROWSER_STARTUP_STEP_META.policyCheck.failureText,
      };
    }

    return {
      ...mockClaw,
      browserSecurityGroupReady: true,
      browserComponentInstallReady: true,
      browserLaunchReady: true,
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
    };
  }

  if (mockClaw.browserStartupMockMode === "always_success") {
    return {
      ...mockClaw,
      browserSecurityGroupReady: true,
      browserComponentInstallReady: true,
      browserLaunchReady: true,
      browserStartupFailStep: undefined,
      browserStartupFailReason: undefined,
    };
  }

  if (mockClaw.browserStartupMockMode === "random_fail_sg_or_package") {
    const failStep = pickRandomBrowserFailStep(mockClaw.browserStartupRandomFailSteps ?? BROWSER_RANDOM_FAIL_STEPS);
    return {
      ...mockClaw,
      browserSecurityGroupReady: true,
      browserComponentInstallReady: true,
      browserLaunchReady: true,
      browserStartupFailStep: failStep,
      browserStartupFailReason: failStep ? BROWSER_STARTUP_STEP_META[failStep].failureText : undefined,
    };
  }

  return mockClaw;
};

const getClawBrowserOsName = (claw?: OpenClawItem | null) => claw?.os_name ?? claw?.osName ?? claw?.imageOsName ?? "";

const isCloudBrowserSupportedImage = (claw?: OpenClawItem | null) => {
  if (!claw) return false;
  const osName = getClawBrowserOsName(claw);
  if (!osName) {
    return claw.status === "running";
  }
  return BROWSER_SUPPORTED_OS_NAMES.has(osName);
};

const hasCloudBrowserSecurityRule = (claw?: OpenClawItem | null) => {
  if (!claw) return false;
  if (typeof claw.browserSecurityGroupReady === "boolean") {
    return claw.browserSecurityGroupReady;
  }

  const portList = claw.securityGroupPorts ?? claw.browserRequiredPorts;
  if (Array.isArray(portList) && portList.length > 0) {
    const normalizedPorts = portList.map((port) => String(port));
    return BROWSER_REQUIRED_PORTS.every((port) => normalizedPorts.includes(port));
  }

  return true;
};

const getAdminAllowCloudBrowserEnabled = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("admin_allow_cloud_browser") === "true";
};

const createSyntheticRefreshStatusEvent = () => ({
  preventDefault() {},
  stopPropagation() {},
}) as React.MouseEvent<HTMLButtonElement>;

// 前端模拟：云端浏览器环境是否已准备就绪（browser-vnc-check）
// 仅作为入口分流依据：镜像 / 组件 / 安全组全部就绪时视为 ready。
const browserVncCheck = (claw: OpenClawItem | null | undefined): { ready: boolean } => {
  if (!claw) return { ready: false };
  if (!isCloudBrowserSupportedImage(claw)) return { ready: false };
  if (claw.browserComponentInstallReady === false) return { ready: false };
  if (!hasCloudBrowserSecurityRule(claw)) return { ready: false };
  return { ready: true };
};

// 前端模拟：云端浏览器连接是否可用（browser-vnc-access）
// 仅用于 ready=true 之后判断连接可达性。
const browserVncAccess = (claw: OpenClawItem | null | undefined): { accessible: boolean } => {
  if (!claw) return { accessible: false };
  if (claw.browserLaunchReady === false) return { accessible: false };
  return { accessible: true };
};

const getBrowserStartupFailureReason = (claw: OpenClawItem, step: BrowserStartupStepKey) => {
  if (claw.browserStartupFailStep === step) {
    return claw.browserStartupFailReason || BROWSER_STARTUP_STEP_META[step].failureText;
  }

  if (step === "imageCheck" && !isCloudBrowserSupportedImage(claw)) {
    return BROWSER_STARTUP_STEP_META.imageCheck.failureText;
  }

  if (step === "componentCheck" && claw.browserComponentInstallReady === false) {
    return BROWSER_STARTUP_STEP_META.componentCheck.failureText;
  }

  if (step === "policyCheck" && !hasCloudBrowserSecurityRule(claw)) {
    return BROWSER_STARTUP_STEP_META.policyCheck.failureText;
  }

  return "";
};

const STATUS_CONFIG: Record<OpenClawStatus, {
  label: string;
  dotColor?: string;
  bgColor: string;
  textColor: string;
  tooltipText?: string;
  isDisabled: boolean;
  isGrayAvatar: boolean;
}> = {
  creating: { label: "创建中", dotColor: "#1447E6", bgColor: "rgba(20,71,230,0.10)", textColor: "#0055cc", tooltipText: "正在创建中，请稍候", isDisabled: true, isGrayAvatar: false },
  createFail: { label: "创建失败", dotColor: "#FF3B30", bgColor: "rgba(255,59,48,0.10)", textColor: "#c0392b", tooltipText: "创建失败，可删除后重新创建", isDisabled: true, isGrayAvatar: true },
  running: { label: "运行中", dotColor: "#34C759", bgColor: "rgba(52,199,89,0.12)", textColor: "#1a8c3a", isDisabled: false, isGrayAvatar: false },
  shutdown: { label: "已关机", dotColor: "#9CA3AF", bgColor: "rgba(156,163,175,0.15)", textColor: "#4b5563", tooltipText: "已关机，如需恢复请联系管理员", isDisabled: true, isGrayAvatar: true },
  loading: { label: "加载中", dotColor: "#1447E6", bgColor: "rgba(20,71,230,0.10)", textColor: "#0055cc", tooltipText: "加载中，请稍候", isDisabled: true, isGrayAvatar: false },
  loadFail: { label: "加载失败", dotColor: "#FF3B30", bgColor: "rgba(255,59,48,0.10)", textColor: "#c0392b", tooltipText: "加载失败，可点击重试恢复", isDisabled: true, isGrayAvatar: true },
  maintaining: { label: "维护中", dotColor: "#FF9500", bgColor: "rgba(255,149,0,0.10)", textColor: "#b8640a", tooltipText: "维护中，请稍候", isDisabled: true, isGrayAvatar: false },
  pending: { label: "待处理", dotColor: "#FF3B30", bgColor: "rgba(255,59,48,0.10)", textColor: "#c0392b", tooltipText: "已停用，请联系管理员处理", isDisabled: true, isGrayAvatar: true },
};

const MOCK_QUICK_COMMANDS = [
  "帮我搜索下今天的新闻",
  "总结这份报告的核心结论",
  "帮我写一份项目进度周报",
  "查一下 OpenClaw 的使用文档",
];

const COMMAND_LIST = [
  { command: "/new", label: "新建会话" },
  { command: "/compact", label: "压缩上下文" },
  { command: "/status", label: "查看状态" },
  { command: "/commands", label: "全部指令" },
];

const CLOUD_BROWSER_HOME = "https://cloud.tencent.com/";
const CHAT_PANE_DEFAULT_WIDTH = 420;
const CHAT_PANE_MIN_WIDTH = 320;
const CHAT_PANE_MAX_WIDTH = 640;
const BROWSER_PANE_MIN_WIDTH = 520;
const RESIZE_HANDLE_WIDTH = 8;

const formatSyncTime = () =>
  new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const createDefaultBrowserState = (claw?: OpenClawItem, clawId?: string): BrowserPanelState => ({
  mode: "chat",
  taskState: "idle",
  panelStatus: "ready",
  panelLoadProgress: 100,
  site: "home",
  url: CLOUD_BROWSER_HOME,
  pageTitle: "腾讯云",
  pageDescription: claw ? `已连接 ${claw.name} 对应的云端浏览器，默认保持在腾讯云页面。` : `已连接当前 OpenClaw 实例，默认保持在腾讯云页面。`,
  addressInput: CLOUD_BROWSER_HOME,
  activeQuery: "",
  lastSyncedAt: formatSyncTime(),
  liveCaption: "当前为查看态，可实时查看 AI 的云端操作画面。",
  lastUserAction: clawId ? `已打开 ${CLOUD_BROWSER_HOME}` : "已打开腾讯云首页",
  statusNote: "空闲",
  isManualOperating: false,
});

const buildBrowserScenario = (prompt: string): { steps: BrowserScenarioStep[]; totalDuration: number; finalAction: string } => ({
  steps: [
    {
      delay: 250,
      patch: {
        site: "home",
        url: CLOUD_BROWSER_HOME,
        pageTitle: "腾讯云",
        pageDescription: "正在进入腾讯云页面并准备执行任务。",
        addressInput: CLOUD_BROWSER_HOME,
        activeQuery: "",
        liveCaption: "正在打开腾讯云页面...",
        lastUserAction: "AI 正在进入腾讯云页面",
        statusNote: "执行中",
        lastSyncedAt: formatSyncTime(),
      },
    },
    {
      delay: 1200,
      patch: {
        site: "search",
        url: CLOUD_BROWSER_HOME,
        pageTitle: "腾讯云",
        pageDescription: `正在腾讯云页面内处理「${prompt}」。`,
        addressInput: CLOUD_BROWSER_HOME,
        activeQuery: prompt,
        liveCaption: `正在处理「${prompt}」...`,
        lastUserAction: "AI 正在腾讯云页面内执行任务",
        statusNote: "执行中",
        lastSyncedAt: formatSyncTime(),
      },
    },
  ],
  totalDuration: 2200,
  finalAction: `已在腾讯云页面完成「${prompt}」`,
});

const getMockAssistantReply = (prompt: string) => `收到，我已经在腾讯云页面里开始处理「${prompt}」，你可以在右侧继续查看执行过程。`;

// Status dot for sidebar list
const StatusDotSmall = ({ status }: { status: OpenClawStatus }) => {
  const cfg = STATUS_CONFIG[status];
  if (status === "loading") {
    return (
      <span
        className="inline-block flex-shrink-0 animate-spin"
        style={{
          borderWidth: "1.5px",
          borderStyle: "solid",
          borderColor: `${cfg.dotColor} transparent transparent transparent`,
          width: "6px",
          height: "6px",
          borderRadius: "50%",
        }}
      />
    );
  }

  if (status === "creating") {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
        style={{ background: cfg.dotColor, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
      />
    );
  }

  return <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: cfg.dotColor }} />;
};

const StatusBadgeSmall = ({ status }: { status: OpenClawStatus }) => {
  const cfg = STATUS_CONFIG[status];
  const badge = (
    <span
      className="inline-flex h-[18px] items-center gap-1 px-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 leading-none"
      style={{ background: cfg.bgColor, color: cfg.textColor, fontSize: "10px" }}
    >
      <StatusDotSmall status={status} />
      {cfg.label}
    </span>
  );

  if (cfg.tooltipText && status !== "running") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex flex-shrink-0">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {cfg.tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
};

const TypingIndicator = () => (
  <div className="flex items-center gap-1 py-2 px-1">
    <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" style={{ animationDelay: "0ms" }} />
    <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" style={{ animationDelay: "150ms" }} />
    <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" style={{ animationDelay: "300ms" }} />
  </div>
);

const BrowserStartupStepItem = ({
  title,
  status,
  helperText,
}: {
  title: string;
  status: BrowserStartupStepStatus;
  helperText: string;
}) => {
  const icon = status === "success"
    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
    : status === "failed"
      ? <TriangleAlert className="w-5 h-5 text-amber-500" />
      : status === "running"
        ? <LoaderCircle className="w-5 h-5 text-blue-500 animate-spin" />
        : <div className="w-5 h-5 rounded-full border-2 border-gray-200" />;

  const textClass = status === "failed"
    ? "text-amber-500 font-medium"
    : status === "success"
      ? "text-gray-600"
      : status === "running"
        ? "text-blue-600 font-medium"
        : "text-gray-400";

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </div>
      <span className={`text-xs leading-5 ${textClass}`}>
        {title}：{helperText}
      </span>
    </div>
  );
};

interface ChatViewProps {
  claws: OpenClawItem[];
  onDeleteConfirm: (claw: { id: string; name: string; status: OpenClawStatus }) => void;
  onRestartConfirm: (claw: { id: string; name: string }) => void;
  onReinstallConfirm: (claw: { id: string; name: string }) => void;
  onRemoveRoleConfirm: (claw: { id: string; name: string; roleName: string }) => void;
  onRetry: (id: string, name: string) => void;
  allowTerminal: boolean;
  refreshingIds: Set<string>;
  onRefreshStatus: (e: React.MouseEvent, id: string, name: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  // 多分组模式
  groupMode?: "normal" | "multi-group";
  getClawGroupPermissions?: (claw: OpenClawItem) => { allowTerminal: boolean; allowChatView: boolean; panelAccess: string } | null;
}

export default function ChatView({
  claws,
  onDeleteConfirm,
  onRestartConfirm,
  onReinstallConfirm,
  onRemoveRoleConfirm,
  onRetry,
  allowTerminal,
  refreshingIds,
  onRefreshStatus,
  isFullscreen,
  onToggleFullscreen,
  groupMode = "normal",
  getClawGroupPermissions,
}: ChatViewProps) {
  const [, navigate] = useLocation();
  const effectiveClaws = useMemo(() => claws.map(applyDemoBrowserMockFields), [claws]);
  const sortedClaws = [...effectiveClaws].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  // [006] 侧栏列表无限滚动：每次加载 30 条，滚动到底自动加载下一批
  const SIDEBAR_PAGE_SIZE = 30;
  const [sidebarLoadedCount, setSidebarLoadedCount] = useState(SIDEBAR_PAGE_SIZE);
  const [sidebarIsLoadingMore, setSidebarIsLoadingMore] = useState(false);
  const sidebarSentinelRef = useRef<HTMLDivElement>(null);
  // 侧栏当前已渲染的 claws（按时间倒序，扁平不分组，本期改造点）
  const sidebarVisibleClaws = useMemo(
    () => sortedClaws.slice(0, sidebarLoadedCount),
    [sortedClaws, sidebarLoadedCount]
  );
  const sidebarHasMore = sidebarVisibleClaws.length < sortedClaws.length;

  const [selectedClawId, setSelectedClawId] = useState<string | null>(() => {
    if (sortedClaws.length === 0) return null;
    // 默认选中第一个 OpenClaw 类型的实例，没有则选第一个
    const firstOpenclaw = sortedClaws.find((c) => !c.agentType || c.agentType === "openclaw");
    return (firstOpenclaw ?? sortedClaws[0]).id;
  });
  const [chatMap, setChatMap] = useState<Record<string, ChatMessage[]>>({});
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [browserMap, setBrowserMap] = useState<Record<string, BrowserPanelState>>({});
  const [inputText, setInputText] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const [isTenantHeaderVisible, setIsTenantHeaderVisible] = useState(true);
  const [leftPaneWidth, setLeftPaneWidth] = useState(CHAT_PANE_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [browserStartupModal, setBrowserStartupModal] = useState<BrowserStartupModalState>(createInitialBrowserStartupState);
  const [browserVncAccessErrorModal, setBrowserVncAccessErrorModal] = useState<{ visible: boolean; targetClawId: string | null }>({ visible: false, targetClawId: null });
  const [isCloudBrowserPolicyEnabled, setIsCloudBrowserPolicyEnabled] = useState(getAdminAllowCloudBrowserEnabled);
  const [cloudBrowserEntryPosition, setCloudBrowserEntryPosition] = useState<{ top: number; left: number } | null>(null);
  const [cloudBrowserRefreshTracker, setCloudBrowserRefreshTracker] = useState<CloudBrowserRefreshTracker | null>(null);
  // 主动刷新锁：按钮点击后短暂禁用按钮，防止重复触发；不触发全屏 loading 占位
  const [manualRefreshLockedClawId, setManualRefreshLockedClawId] = useState<string | null>(null);
  const manualRefreshLockTimerRef = useRef<number | null>(null);

  // —— 云桌面升级（demo 专属的运行时状态覆盖层）——
  // key: clawId。这里只覆盖 desktopReady / desktopInstalling / desktopError 三个字段，
  // mock 层的 browserReady 仍由 applyDemoBrowserMockFields 提供。
  type DesktopRuntimeState = {
    desktopReady?: boolean;
    desktopInstalling?: boolean;
    desktopError?: string | null;
  };
  const [desktopRuntimeMap, setDesktopRuntimeMap] = useState<Record<string, DesktopRuntimeState>>({});
  const [desktopUpgradePromptDismissed, setDesktopUpgradePromptDismissed] = useState<Set<string>>(new Set());
  const [desktopUpgradeConfirmOpen, setDesktopUpgradeConfirmOpen] = useState(false);
  const desktopUpgradeTimersRef = useRef<Record<string, number>>({});

  const prevClawsCountRef = useRef(effectiveClaws.length);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);
  const clawsRef = useRef(effectiveClaws);
  const browserTaskTimersRef = useRef<Record<string, number[]>>({});
  const browserPanelLoadTimersRef = useRef<Record<string, number[]>>({});
  const browserStartupTimersRef = useRef<number[]>([]);
  const cloudBrowserStableRefreshSeenRef = useRef(false);
  const tenantHeaderRef = useRef<HTMLElement | null>(null);
  const tenantMainRef = useRef<HTMLElement | null>(null);
  const tenantHeaderHideTimerRef = useRef<number | null>(null);
  const tenantLayoutRestoreRef = useRef<{
    header: {
      transform: string;
      opacity: string;
      transition: string;
      willChange: string;
      pointerEvents: string;
    };
    main: {
      paddingTop: string;
      transition: string;
    };
  } | null>(null);

  const selectedBrowserMode: WorkspaceMode = selectedClawId ? browserMap[selectedClawId]?.mode ?? "chat" : "chat";
  const shouldAutoHideTenantHeader = selectedBrowserMode !== "chat";
  const isInstanceSwitchLocked = selectedBrowserMode !== "chat";

  const clampLeftPaneWidth = useCallback((nextWidth: number, containerWidth: number) => {
    const maxWidthByContainer = containerWidth > 0 ? containerWidth - BROWSER_PANE_MIN_WIDTH - RESIZE_HANDLE_WIDTH : CHAT_PANE_MAX_WIDTH;
    const effectiveMaxWidth = Math.max(CHAT_PANE_MIN_WIDTH, Math.min(CHAT_PANE_MAX_WIDTH, maxWidthByContainer));
    return Math.min(Math.max(nextWidth, CHAT_PANE_MIN_WIDTH), effectiveMaxWidth);
  }, []);

  useEffect(() => {
    clawsRef.current = effectiveClaws;
  }, [effectiveClaws]);

  // [006] 列表数据变化时（如新建 / 删除），重置侧栏分页到首批
  useEffect(() => {
    setSidebarLoadedCount(SIDEBAR_PAGE_SIZE);
  }, [effectiveClaws.length]);

  // [006] 侧栏无限滚动：哨兵元素进入视口时加载下一批
  // 注：showFullListSidebar 在 1937 行才声明，这里不能依赖；侧栏未显示时哨兵未挂载，sentinel 为 null 会自动 early return
  useEffect(() => {
    if (!sidebarHasMore) return;
    const sentinel = sidebarSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && sidebarHasMore && !sidebarIsLoadingMore) {
          setSidebarIsLoadingMore(true);
          // 模拟一小段加载时间，让转圈圈可见；接入真实后端接口时改为 await fetchList(nextPage) 后再 setLoadedCount
          window.setTimeout(() => {
            setSidebarLoadedCount((prev) => prev + SIDEBAR_PAGE_SIZE);
            setSidebarIsLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: "100px" } // 提前 100px 触发，体验更顺滑
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sidebarHasMore, sidebarIsLoadingMore]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncCloudBrowserPolicy = () => {
      setIsCloudBrowserPolicyEnabled(getAdminAllowCloudBrowserEnabled());
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "admin_allow_cloud_browser") {
        syncCloudBrowserPolicy();
      }
    };

    syncCloudBrowserPolicy();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncCloudBrowserPolicy);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncCloudBrowserPolicy);
    };
  }, []);

  useEffect(() => {
    if (effectiveClaws.length === 0) {
      setSelectedClawId(null);
      prevClawsCountRef.current = 0;
      return;
    }

    if (!isInstanceSwitchLocked && effectiveClaws.length > prevClawsCountRef.current && prevClawsCountRef.current > 0) {
      setSelectedClawId(sortedClaws[0]?.id ?? null);
    }

    if (selectedClawId && !effectiveClaws.find((claw) => claw.id === selectedClawId)) {
      setSelectedClawId(sortedClaws[0]?.id ?? null);
    }

    if (!selectedClawId && effectiveClaws.length > 0) {
      setSelectedClawId(sortedClaws[0]?.id ?? null);
    }

    prevClawsCountRef.current = effectiveClaws.length;
  }, [effectiveClaws, isInstanceSwitchLocked, selectedClawId, sortedClaws]);

  const getDefaultBrowserState = useCallback((clawId: string) => {
    const claw = clawsRef.current.find((item) => item.id === clawId);
    return createDefaultBrowserState(claw, clawId);
  }, []);

  const updateBrowserState = useCallback(
    (clawId: string, updater: (prev: BrowserPanelState) => BrowserPanelState) => {
      setBrowserMap((prev) => ({
        ...prev,
        [clawId]: updater(prev[clawId] ?? getDefaultBrowserState(clawId)),
      }));
    },
    [getDefaultBrowserState],
  );

  useEffect(() => {
    setBrowserMap((prev) => {
      const next = { ...prev };
      let changed = false;
      const aliveIds = new Set(effectiveClaws.map((claw) => claw.id));

      effectiveClaws.forEach((claw) => {
        if (!next[claw.id]) {
          next[claw.id] = createDefaultBrowserState(claw);
          changed = true;
        }
      });

      Object.keys(next).forEach((clawId) => {
        if (!aliveIds.has(clawId)) {
          delete next[clawId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [effectiveClaws]);

  const clearBrowserTaskTimers = useCallback((clawId?: string) => {
    if (clawId) {
      (browserTaskTimersRef.current[clawId] ?? []).forEach((timer) => window.clearTimeout(timer));
      delete browserTaskTimersRef.current[clawId];
      return;
    }

    Object.values(browserTaskTimersRef.current).forEach((timers) => {
      timers.forEach((timer) => window.clearTimeout(timer));
    });
    browserTaskTimersRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      clearBrowserTaskTimers();
    };
  }, [clearBrowserTaskTimers]);

  const clearBrowserPanelLoadTimers = useCallback((clawId?: string) => {
    if (clawId) {
      (browserPanelLoadTimersRef.current[clawId] ?? []).forEach((timer) => window.clearTimeout(timer));
      delete browserPanelLoadTimersRef.current[clawId];
      return;
    }

    Object.values(browserPanelLoadTimersRef.current).forEach((timers) => {
      timers.forEach((timer) => window.clearTimeout(timer));
    });
    browserPanelLoadTimersRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      clearBrowserPanelLoadTimers();
    };
  }, [clearBrowserPanelLoadTimers]);

  const clearBrowserStartupTimers = useCallback(() => {
    browserStartupTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    browserStartupTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearBrowserStartupTimers();
    };
  }, [clearBrowserStartupTimers]);

  const requestClawStatusRefresh = useCallback((claw: OpenClawItem) => {
    onRefreshStatus(createSyntheticRefreshStatusEvent(), claw.id, claw.name);
  }, [onRefreshStatus]);

  useEffect(() => {
    if (!cloudBrowserRefreshTracker) {
      cloudBrowserStableRefreshSeenRef.current = false;
      return;
    }

    const trackedClaw = effectiveClaws.find((claw) => claw.id === cloudBrowserRefreshTracker.clawId) ?? null;
    if (!trackedClaw) {
      cloudBrowserStableRefreshSeenRef.current = false;
      setCloudBrowserRefreshTracker(null);
      return;
    }

    const isTrackedClawRefreshing = refreshingIds.has(trackedClaw.id);

    if (cloudBrowserRefreshTracker.phase === "awaiting_transition") {
      if (trackedClaw.status !== "running") {
        setCloudBrowserRefreshTracker({ clawId: trackedClaw.id, phase: "unstable" });
        return;
      }

      const timeoutId = window.setTimeout(() => {
        setCloudBrowserRefreshTracker((prev) => (
          prev?.clawId === trackedClaw.id && prev.phase === "awaiting_transition"
            ? null
            : prev
        ));
      }, CLOUD_BROWSER_REINSTALL_TRANSITION_TIMEOUT);

      return () => window.clearTimeout(timeoutId);
    }

    if (cloudBrowserRefreshTracker.phase === "unstable") {
      if (trackedClaw.status === "running") {
        cloudBrowserStableRefreshSeenRef.current = false;
        setCloudBrowserRefreshTracker({ clawId: trackedClaw.id, phase: "stable_refresh_pending" });
        return;
      }

      if (isTrackedClawRefreshing) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        requestClawStatusRefresh(trackedClaw);
      }, 1600);

      return () => window.clearTimeout(timeoutId);
    }

    if (cloudBrowserRefreshTracker.phase === "stable_refresh_pending") {
      if (isTrackedClawRefreshing) {
        return;
      }

      requestClawStatusRefresh(trackedClaw);
      setCloudBrowserRefreshTracker({ clawId: trackedClaw.id, phase: "stable_refreshing" });
      return;
    }

    if (isTrackedClawRefreshing) {
      cloudBrowserStableRefreshSeenRef.current = true;
      return;
    }

    if (cloudBrowserStableRefreshSeenRef.current) {
      cloudBrowserStableRefreshSeenRef.current = false;
      setCloudBrowserRefreshTracker(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cloudBrowserStableRefreshSeenRef.current = false;
      setCloudBrowserRefreshTracker((prev) => (
        prev?.clawId === trackedClaw.id && prev.phase === "stable_refreshing"
          ? null
          : prev
      ));
    }, CLOUD_BROWSER_REINSTALL_AUTO_REFRESH_INTERVAL);

    return () => window.clearTimeout(timeoutId);
  }, [cloudBrowserRefreshTracker, effectiveClaws, refreshingIds, requestClawStatusRefresh]);

  const startBrowserPanelLoading = useCallback((clawId: string) => {
    clearBrowserPanelLoadTimers(clawId);
    updateBrowserState(clawId, (prev) => ({
      ...prev,
      panelStatus: "loading",
      panelLoadProgress: 8,
      isManualOperating: false,
      liveCaption: "云端浏览器启动中，请稍候。",
      statusNote: "启动中",
      lastUserAction: "正在启动云端浏览器",
      lastSyncedAt: formatSyncTime(),
    }));

    const progressSteps = [
      { delay: 160, progress: 18 },
      { delay: 360, progress: 34 },
      { delay: 700, progress: 58 },
      { delay: 1080, progress: 74 },
      { delay: 1460, progress: 84 },
      { delay: 1860, progress: 89 },
    ];

    browserPanelLoadTimersRef.current[clawId] = progressSteps.map((step) =>
      window.setTimeout(() => {
        updateBrowserState(clawId, (prev) => ({
          ...prev,
          panelStatus: prev.taskState === "running" ? prev.panelStatus : "loading",
          panelLoadProgress: Math.max(prev.panelLoadProgress, step.progress),
        }));
      }, step.delay),
    );

    const finishTimer = window.setTimeout(() => {
      updateBrowserState(clawId, (prev) => ({
        ...prev,
        panelStatus: "ready",
        panelLoadProgress: 100,
        isManualOperating: false,
        liveCaption: prev.taskState === "running" ? prev.liveCaption : "当前为查看态，可实时查看 AI 的云端操作画面。",
        statusNote: prev.taskState === "running" ? prev.statusNote : "空闲",
        lastUserAction: prev.taskState === "running" ? prev.lastUserAction : "已连接云端浏览器",
        lastSyncedAt: formatSyncTime(),
      }));
      delete browserPanelLoadTimersRef.current[clawId];
    }, 2140);

    browserPanelLoadTimersRef.current[clawId] = [...(browserPanelLoadTimersRef.current[clawId] ?? []), finishTimer];
  }, [clearBrowserPanelLoadTimers, updateBrowserState]);

  const clearTenantHeaderHideTimer = useCallback(() => {
    if (tenantHeaderHideTimerRef.current !== null) {
      window.clearTimeout(tenantHeaderHideTimerRef.current);
      tenantHeaderHideTimerRef.current = null;
    }
  }, []);

  const applyTenantHeaderVisibility = useCallback((visible: boolean) => {
    const header = tenantHeaderRef.current;
    if (!header) return;

    const main = tenantMainRef.current;
    setIsTenantHeaderVisible(visible);
    header.style.transform = visible ? "translateY(0)" : "translateY(calc(-100% - 8px))";
    header.style.opacity = visible ? "1" : "0";
    header.style.pointerEvents = visible ? "auto" : "none";

    if (main) {
      main.style.paddingTop = visible ? "64px" : "0px";
    }
  }, []);

  const showTenantHeader = useCallback(() => {
    clearTenantHeaderHideTimer();
    applyTenantHeaderVisibility(true);
  }, [applyTenantHeaderVisibility, clearTenantHeaderHideTimer]);

  const hideTenantHeader = useCallback(() => {
    clearTenantHeaderHideTimer();
    applyTenantHeaderVisibility(false);
  }, [applyTenantHeaderVisibility, clearTenantHeaderHideTimer]);

  const scheduleHideTenantHeader = useCallback(
    (delay = 120) => {
      clearTenantHeaderHideTimer();
      tenantHeaderHideTimerRef.current = window.setTimeout(() => {
        applyTenantHeaderVisibility(false);
        tenantHeaderHideTimerRef.current = null;
      }, delay);
    },
    [applyTenantHeaderVisibility, clearTenantHeaderHideTimer],
  );

  useEffect(() => {
    const header = document.querySelector("header.fixed.top-0.left-0.right-0.z-50") as HTMLElement | null;
    const main = document.querySelector("main.pt-16") as HTMLElement | null;

    if (!header) return;

    tenantHeaderRef.current = header;
    tenantMainRef.current = main;
    tenantLayoutRestoreRef.current = {
      header: {
        transform: header.style.transform,
        opacity: header.style.opacity,
        transition: header.style.transition,
        willChange: header.style.willChange,
        pointerEvents: header.style.pointerEvents,
      },
      main: {
        paddingTop: main?.style.paddingTop ?? "",
        transition: main?.style.transition ?? "",
      },
    };

    header.style.transition = "transform 180ms ease, opacity 180ms ease";
    header.style.willChange = "transform, opacity";
    if (main) {
      main.style.transition = "padding-top 180ms ease";
    }

    const handleHeaderMouseEnter = () => showTenantHeader();
    const handleHeaderMouseLeave = () => {
      if (!shouldAutoHideTenantHeader) return;
      scheduleHideTenantHeader();
    };

    header.addEventListener("mouseenter", handleHeaderMouseEnter);
    header.addEventListener("mouseleave", handleHeaderMouseLeave);

    if (shouldAutoHideTenantHeader) {
      hideTenantHeader();
    } else {
      showTenantHeader();
    }

    return () => {
      clearTenantHeaderHideTimer();
      header.removeEventListener("mouseenter", handleHeaderMouseEnter);
      header.removeEventListener("mouseleave", handleHeaderMouseLeave);

      const restore = tenantLayoutRestoreRef.current;
      if (restore) {
        header.style.transform = restore.header.transform;
        header.style.opacity = restore.header.opacity;
        header.style.transition = restore.header.transition;
        header.style.willChange = restore.header.willChange;
        header.style.pointerEvents = restore.header.pointerEvents;
        if (main) {
          main.style.paddingTop = restore.main.paddingTop;
          main.style.transition = restore.main.transition;
        }
      }

      tenantHeaderRef.current = null;
      tenantMainRef.current = null;
      tenantLayoutRestoreRef.current = null;
    };
  }, [clearTenantHeaderHideTimer, hideTenantHeader, scheduleHideTenantHeader, shouldAutoHideTenantHeader, showTenantHeader]);

  const setClawTyping = useCallback((clawId: string, value: boolean) => {
    setTypingMap((prev) => {
      if (prev[clawId] === value) return prev;
      return { ...prev, [clawId]: value };
    });
  }, []);

  const selectedClaw = effectiveClaws.find((claw) => claw.id === selectedClawId) ?? null;
  const currentMessages = selectedClawId ? chatMap[selectedClawId] ?? [] : [];
  const currentIsTyping = selectedClawId ? typingMap[selectedClawId] ?? false : false;
  const currentBrowserState = selectedClawId ? browserMap[selectedClawId] ?? getDefaultBrowserState(selectedClawId) : null;

  // —— 当前实例的云桌面升级状态（视图层）——
  const selectedDesktopRuntime: DesktopRuntimeState = selectedClawId ? desktopRuntimeMap[selectedClawId] ?? {} : {};
  const selectedDesktopReady = selectedClaw
    ? (selectedDesktopRuntime.desktopReady ?? selectedClaw.desktopReady ?? false)
    : false;
  const selectedDesktopInstalling = selectedClaw
    ? (selectedDesktopRuntime.desktopInstalling ?? selectedClaw.desktopInstalling ?? false)
    : false;
  const selectedDesktopError = selectedClaw
    ? (selectedDesktopRuntime.desktopError !== undefined
        ? selectedDesktopRuntime.desktopError
        : (selectedClaw.desktopError ?? null))
    : null;
  const selectedBrowserReady = selectedClaw
    ? (selectedClaw.browserReady ?? false)
    : false;
  const isUpgradePromptDismissed = selectedClawId
    ? desktopUpgradePromptDismissed.has(selectedClawId)
    : false;
  // 升级提示条是否展示（升级中/失败时不再响应"关闭"状态，保持强可见）
  const showUpgradeIdlePrompt = selectedBrowserReady
    && !selectedDesktopReady
    && !selectedDesktopInstalling
    && !selectedDesktopError
    && !isUpgradePromptDismissed;
  const showUpgradeInstallingPrompt = selectedBrowserReady && !selectedDesktopReady && selectedDesktopInstalling;
  const showUpgradeErrorPrompt = selectedBrowserReady && !selectedDesktopReady && !!selectedDesktopError && !selectedDesktopInstalling;
  const showUpgradePromptBar = showUpgradeIdlePrompt || showUpgradeInstallingPrompt || showUpgradeErrorPrompt;
  const workspaceMode: WorkspaceMode = currentBrowserState?.mode ?? "chat";
  const isRunning = selectedClaw?.status === "running";
  const isBrowserPanelLoading = currentBrowserState?.panelStatus === "loading";
  const isBrowserTaskRunning = currentBrowserState?.taskState === "running";
  const isBrowserOperationLocked = !currentBrowserState || isBrowserPanelLoading || isBrowserTaskRunning;
  const isBrowserManualOperating = !!currentBrowserState?.isManualOperating && !isBrowserOperationLocked;
  const isBrowserReadonly = isBrowserOperationLocked || !currentBrowserState?.isManualOperating;
  const isBrowserToolbarBusy = isBrowserPanelLoading || isBrowserTaskRunning;
  // 主动刷新锁定：刷新按下后，工具条上所有按钮都进入禁用态，防止期间误操作
  const isManualRefreshLocked = !!selectedClawId && manualRefreshLockedClawId === selectedClawId;
  const isBrowserOperationButtonDisabled = isBrowserOperationLocked || isManualRefreshLocked;
  const browserOperationButtonLabel = isBrowserTaskRunning ? "进入操作" : isBrowserManualOperating ? "退出操作" : "进入操作";
  const browserStartupTargetClaw = browserStartupModal.targetClawId ? effectiveClaws.find((claw) => claw.id === browserStartupModal.targetClawId) ?? null : null;
  const isCloudBrowserImageSupported = isCloudBrowserSupportedImage(selectedClaw);
  const canShowCloudBrowserEntry = workspaceMode === "chat" && isRunning && isCloudBrowserImageSupported;
  const isSelectedClawReinstallRefreshing = !!selectedClawId
    && cloudBrowserRefreshTracker?.clawId === selectedClawId
    && cloudBrowserRefreshTracker.phase !== "awaiting_transition";
  const shouldShowCloudBrowserEntry = workspaceMode === "chat" && (canShowCloudBrowserEntry || isSelectedClawReinstallRefreshing);
  const isCloudBrowserEntryDisabled = shouldShowCloudBrowserEntry && (isSelectedClawReinstallRefreshing || !canShowCloudBrowserEntry || !isCloudBrowserPolicyEnabled);
  const cloudBrowserEntryTooltip = isSelectedClawReinstallRefreshing
    ? "系统重装中，请稍后"
    : canShowCloudBrowserEntry && !isCloudBrowserPolicyEnabled
      ? "管理员未开启功能"
      : "云桌面";
  const chatPaneStyle = workspaceMode === "chat_with_browser"
    ? {
        width: `${leftPaneWidth}px`,
        minWidth: `${CHAT_PANE_MIN_WIDTH}px`,
        maxWidth: `${CHAT_PANE_MAX_WIDTH}px`,
      }
    : undefined;

  useEffect(() => {
    if (!selectedClawId || !currentBrowserState?.isManualOperating) return;
    if (currentBrowserState.mode !== "chat" && currentBrowserState.taskState !== "running") return;

    updateBrowserState(selectedClawId, (prev) => {
      if (!prev.isManualOperating) return prev;
      if (prev.mode !== "chat" && prev.taskState !== "running") return prev;

      return {
        ...prev,
        isManualOperating: false,
        liveCaption: prev.taskState === "running" ? prev.liveCaption : "当前为查看态，可实时查看 AI 的云端操作画面。",
        statusNote: prev.taskState === "running" ? prev.statusNote : "空闲",
        lastUserAction: prev.taskState === "running" ? prev.lastUserAction : "已收起云端浏览器",
        lastSyncedAt: formatSyncTime(),
      };
    });
  }, [currentBrowserState?.isManualOperating, currentBrowserState?.mode, currentBrowserState?.taskState, selectedClawId, updateBrowserState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!canShowCloudBrowserEntry || isFullscreen) {
      setCloudBrowserEntryPosition(null);
      return;
    }

    const updateCloudBrowserEntryPosition = () => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      setCloudBrowserEntryPosition({
        top: rect.top,
        left: Math.min(rect.right + 12, window.innerWidth - 56),
      });
    };

    updateCloudBrowserEntryPosition();

    const resizeObserver = typeof ResizeObserver !== "undefined" && workspaceRef.current
      ? new ResizeObserver(() => updateCloudBrowserEntryPosition())
      : null;

    if (resizeObserver && workspaceRef.current) {
      resizeObserver.observe(workspaceRef.current);
    }

    window.addEventListener("resize", updateCloudBrowserEntryPosition);
    window.addEventListener("scroll", updateCloudBrowserEntryPosition, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCloudBrowserEntryPosition);
      window.removeEventListener("scroll", updateCloudBrowserEntryPosition, true);
    };
  }, [isFullscreen, shouldShowCloudBrowserEntry]);

  const closeBrowserStartupModal = useCallback(() => {
    clearBrowserStartupTimers();
    setBrowserStartupModal(createInitialBrowserStartupState());
  }, [clearBrowserStartupTimers]);

  const enterBrowserWorkspace = useCallback((clawId: string) => {
    updateBrowserState(clawId, (prev) => ({
      ...prev,
      mode: "chat_with_browser",
      panelStatus: "ready",
      panelLoadProgress: 100,
      isManualOperating: false,
      liveCaption: prev.taskState === "running" ? prev.liveCaption : "当前为查看态，可实时查看 AI 的云端操作画面。",
      statusNote: prev.taskState === "running" ? prev.statusNote : "空闲",
      lastUserAction: prev.taskState === "running" ? prev.lastUserAction : "已连接云端浏览器",
      lastSyncedAt: formatSyncTime(),
    }));
  }, [updateBrowserState]);

  const runBrowserStartupFlow = useCallback((claw: OpenClawItem, stepIndex = 0) => {
    const step = BROWSER_STARTUP_STEP_ORDER[stepIndex];
    if (!step) {
      setBrowserStartupModal((prev) => ({
        ...prev,
        flowStatus: "success",
        activeStep: null,
      }));
      return;
    }

    setBrowserStartupModal((prev) => ({
      ...prev,
      visible: true,
      targetClawId: claw.id,
      flowStatus: "running",
      activeStep: step,
      failedStep: null,
      failureReason: "",
      steps: {
        ...prev.steps,
        [step]: "running",
      },
    }));

    const timer = window.setTimeout(() => {
      const failureReason = getBrowserStartupFailureReason(claw, step);

      if (failureReason) {
        setBrowserStartupModal((prev) => ({
          ...prev,
          visible: true,
          targetClawId: claw.id,
          flowStatus: "failed",
          activeStep: null,
          failedStep: step,
          failureReason,
          steps: {
            ...prev.steps,
            [step]: "failed",
          },
        }));
        clearBrowserStartupTimers();
        return;
      }

      setBrowserStartupModal((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [step]: "success",
        },
      }));

      runBrowserStartupFlow(claw, stepIndex + 1);
    }, BROWSER_STARTUP_STEP_DURATION[step]);

    browserStartupTimersRef.current.push(timer);
  }, [clearBrowserStartupTimers]);

  const startBrowserStartupFlow = useCallback((claw: OpenClawItem) => {
    const attemptClaw = resolveBrowserStartupAttemptClaw(claw);

    clearBrowserStartupTimers();
    setBrowserStartupModal({
      visible: true,
      targetClawId: attemptClaw.id,
      flowStatus: "running",
      activeStep: null,
      failedStep: null,
      failureReason: "",
      steps: createInitialBrowserStartupSteps(),
    });

    const kickoffTimer = window.setTimeout(() => {
      runBrowserStartupFlow(attemptClaw, 0);
    }, 120);

    browserStartupTimersRef.current.push(kickoffTimer);
  }, [clearBrowserStartupTimers, runBrowserStartupFlow]);

  const handleConfirmBrowserStartup = useCallback(() => {
    if (!browserStartupModal.targetClawId || browserStartupModal.flowStatus !== "success") return;
    enterBrowserWorkspace(browserStartupModal.targetClawId);
    closeBrowserStartupModal();
  }, [browserStartupModal.flowStatus, browserStartupModal.targetClawId, closeBrowserStartupModal, enterBrowserWorkspace]);

  const handleRetryBrowserStartup = useCallback(() => {
    if (!browserStartupTargetClaw) return;
    startBrowserStartupFlow(browserStartupTargetClaw);
  }, [browserStartupTargetClaw, startBrowserStartupFlow]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (workspaceMode !== "chat_with_browser") return;
      event.preventDefault();
      setIsResizing(true);
    },
    [workspaceMode],
  );

  const handleSelectClaw = useCallback(
    (clawId: string) => {
      // 产品规则：浏览器打开后锁定当前实例，不允许继续切换
      if (workspaceMode !== "chat") {
        toast.message("请先收起云端浏览器，再切换 OpenClaw 实例");
        return;
      }
      setSelectedClawId(clawId);
    },
    [workspaceMode],
  );

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, currentIsTyping, scrollToBottom]);

  useEffect(() => {
    if (!showCommands) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (commandsRef.current && !commandsRef.current.contains(event.target as Node)) {
        setShowCommands(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCommands]);

  useEffect(() => {
    if (workspaceMode !== "chat_with_browser") {
      if (isResizing) {
        setIsResizing(false);
      }
      return;
    }

    const syncPaneWidth = () => {
      const containerWidth = workspaceRef.current?.clientWidth ?? 0;
      setLeftPaneWidth((prev) => clampLeftPaneWidth(prev, containerWidth));
    };

    syncPaneWidth();
    window.addEventListener("resize", syncPaneWidth);
    return () => window.removeEventListener("resize", syncPaneWidth);
  }, [clampLeftPaneWidth, isResizing, workspaceMode]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (workspaceMode !== "chat_with_browser") return;

      const containerRect = workspaceRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      setLeftPaneWidth(clampLeftPaneWidth(event.clientX - containerRect.left, containerRect.width));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [clampLeftPaneWidth, isResizing, workspaceMode]);

  const appendMessage = useCallback((clawId: string, message: ChatMessage) => {
    setChatMap((prev) => ({
      ...prev,
      [clawId]: [...(prev[clawId] ?? []), message],
    }));
  }, []);

  const queueAssistantReply = useCallback(
    (clawId: string, prompt: string, reply: string, withBrowserMotion = true) => {
      clearBrowserTaskTimers(clawId);
      setClawTyping(clawId, true);

      let totalDuration = 1000;
      let finalAction = "已完成任务";

      if (withBrowserMotion) {
        const scenario = buildBrowserScenario(prompt);
        totalDuration = scenario.totalDuration;
        finalAction = scenario.finalAction;

        updateBrowserState(clawId, (prev) => ({
          ...prev,
          taskState: "running",
          isManualOperating: false,
          liveCaption: "OpenClaw 正在执行任务...",
          statusNote: "执行中",
          lastUserAction: "AI 正在接管浏览器",
          lastSyncedAt: formatSyncTime(),
        }));

        browserTaskTimersRef.current[clawId] = scenario.steps.map((step) =>
          window.setTimeout(() => {
            updateBrowserState(clawId, (prev) => ({
              ...prev,
              ...step.patch,
            }));
          }, step.delay),
        );
      } else {
        totalDuration = 700 + Math.round(Math.random() * 350);
        browserTaskTimersRef.current[clawId] = [];
      }

      const finishTaskTimer = window.setTimeout(() => {
        if (withBrowserMotion) {
          updateBrowserState(clawId, (prev) => ({
            ...prev,
            taskState: "idle",
            isManualOperating: false,
            liveCaption: "执行完成，可继续查看当前浏览器画面。",
            statusNote: "空闲",
            lastUserAction: finalAction,
            lastSyncedAt: formatSyncTime(),
          }));
        }
      }, totalDuration);

      const replyTimer = window.setTimeout(() => {
        appendMessage(clawId, {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: Date.now(),
        });
        setClawTyping(clawId, false);
      }, totalDuration + 260);

      browserTaskTimersRef.current[clawId] = [
        ...(browserTaskTimersRef.current[clawId] ?? []),
        finishTaskTimer,
        replyTimer,
      ];
    },
    [appendMessage, clearBrowserTaskTimers, setClawTyping, updateBrowserState],
  );

  const sendPrompt = useCallback(
    (prompt: string) => {
      if (!selectedClawId || !prompt.trim() || currentIsTyping) return;

      const content = prompt.trim();
      appendMessage(selectedClawId, {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      });

      queueAssistantReply(selectedClawId, content, getMockAssistantReply(content), workspaceMode !== "chat" && currentBrowserState?.panelStatus === "ready");
    },
    [appendMessage, currentBrowserState?.panelStatus, currentIsTyping, queueAssistantReply, selectedClawId, workspaceMode],
  );

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendPrompt(inputText);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
    }
  };

  const handleQuickCommand = (command: string) => {
    if (!selectedClawId || currentIsTyping) return;
    sendPrompt(command);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const element = e.target;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  };

  const handleNewChat = () => {
    if (!selectedClawId || currentIsTyping) return;
    setShowNewChatConfirm(true);
  };

  const confirmNewChat = () => {
    if (!selectedClawId) return;

    setShowNewChatConfirm(false);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: "/new",
      timestamp: Date.now(),
    };

    setChatMap((prev) => ({
      ...prev,
      [selectedClawId]: [userMessage],
    }));

    queueAssistantReply(selectedClawId, "/new", "好的，已新建会话。之前的对话上下文已清空，我们重新开始吧！", false);
  };

  const handleSendCommand = (command: string) => {
    if (!selectedClawId || currentIsTyping) return;

    setShowCommands(false);
    appendMessage(selectedClawId, {
      id: `msg-${Date.now()}`,
      role: "user",
      content: command,
      timestamp: Date.now(),
    });

    const responseMap: Record<string, string> = {
      "/new": "好的，已新建会话。之前的对话上下文已清空，我们重新开始吧！",
      "/compact": "已压缩上下文，当前保留最近 10 条对话记录。",
      "/status": `当前状态：${selectedClaw?.status === "running" ? "运行中" : "不可对话"} | 最近同步：${currentBrowserState?.lastSyncedAt ?? formatSyncTime()}`,
      "/commands": "可用指令：\n/new — 新建会话\n/compact — 压缩上下文\n/status — 查看状态\n/commands — 全部指令",
    };

    queueAssistantReply(selectedClawId, command, responseMap[command] || "未知指令，请输入 /commands 查看全部指令。", false);
  };

  const handleTrackedClawReinstallConfirm = useCallback((claw: { id: string; name: string }) => {
    if (claw.id === selectedClawId) {
      cloudBrowserStableRefreshSeenRef.current = false;
      setCloudBrowserRefreshTracker({ clawId: claw.id, phase: "awaiting_transition" });
    }

    onReinstallConfirm(claw);
  }, [onReinstallConfirm, selectedClawId]);

  const setWorkspaceModeForSelectedClaw = (nextMode: WorkspaceMode) => {
    if (!selectedClawId) return;
    updateBrowserState(selectedClawId, (prev) => ({ ...prev, mode: nextMode }));
  };

  const handleOpenBrowser = () => {
    if (!selectedClawId || !selectedClaw) return;
    if (isSelectedClawReinstallRefreshing) return;
    if (selectedClaw.status !== "running") return;
    if (!isCloudBrowserSupportedImage(selectedClaw)) return;
    if (!isCloudBrowserPolicyEnabled) return;

    // 统一原则：无论是存量实例还是新实例、是否已升级为云桌面，
    // 点击小电脑进入云端操作环境前，都必须先经过启动检测弹窗（可用性检查）。
    //
    // 分流规则：
    //   A. desktopReady=true：强制走启动检测弹窗 → 通过后进入云桌面
    //   B. desktopReady=false && browserReady=true（存量升级场景）：
    //      强制走启动检测弹窗 → 通过后进入原云端浏览器 → 顶部展示升级提示条（由渲染层控制）
    //   C. desktopReady=false && browserReady=false：沿用原启动/检测流程
    //
    // 关键约束：点击小电脑不会直接进入浏览器，也不会弹升级确认弹窗，也不会自动启动升级。
    const runtime = desktopRuntimeMap[selectedClawId] ?? {};
    const desktopReady = runtime.desktopReady ?? selectedClaw.desktopReady ?? false;
    const browserReady = selectedClaw.browserReady ?? false;

    // 场景 A / B：无论云桌面是否就绪、原云端浏览器是否可用，都强制走启动检测弹窗，
    // 避免 fast-path 跳过可用性检查。
    if (desktopReady || browserReady) {
      startBrowserStartupFlow(selectedClaw);
      return;
    }

    // 场景 C 走原有分流（未标记升级能力的实例）：
    // 1. browser-vnc-check.ready=false → 完整检测 / 准备弹窗
    // 2. ready=true && browser-vnc-access.accessible=true → 直接进入
    // 3. ready=true && accessible=false → 轻量“连接异常”弹窗
    const { ready } = browserVncCheck(selectedClaw);
    if (!ready) {
      startBrowserStartupFlow(selectedClaw);
      return;
    }

    const { accessible } = browserVncAccess(selectedClaw);
    if (accessible) {
      enterBrowserWorkspace(selectedClawId);
      return;
    }

    setBrowserVncAccessErrorModal({ visible: true, targetClawId: selectedClawId });
  };

  // —— 云桌面升级：派发/执行 ——
  const runDesktopUpgradeTask = useCallback((clawId: string, clawName: string) => {
    // 防并发：已有升级定时器则不重复派发
    if (desktopUpgradeTimersRef.current[clawId]) return;

    setDesktopRuntimeMap((prev) => ({
      ...prev,
      [clawId]: {
        ...(prev[clawId] ?? {}),
        desktopInstalling: true,
        desktopError: null,
      },
    }));

    const timer = window.setTimeout(() => {
      delete desktopUpgradeTimersRef.current[clawId];

      // mock：首次升级失败，重试成功
      const prevAttempt = mockDesktopUpgradeAttemptCount.get(clawName) ?? 0;
      const currentAttempt = prevAttempt + 1;
      mockDesktopUpgradeAttemptCount.set(clawName, currentAttempt);
      const shouldFailThisAttempt = currentAttempt === 1 && clawName === MOCK_CLAW_NAME_LOADING;

      if (shouldFailThisAttempt) {
        setDesktopRuntimeMap((prev) => ({
          ...prev,
          [clawId]: {
            ...(prev[clawId] ?? {}),
            desktopInstalling: false,
            desktopReady: false,
            desktopError: "网络超时，云桌面升级未成功",
          },
        }));
        toast.error("云桌面升级失败，您可以稍后重试");
        return;
      }

      // 升级成功
      setDesktopRuntimeMap((prev) => ({
        ...prev,
        [clawId]: {
          ...(prev[clawId] ?? {}),
          desktopReady: true,
          desktopInstalling: false,
          desktopError: null,
        },
      }));
      toast.success("云桌面升级成功");
      // 升级成功后自动进入云桌面（复用现有浏览器工作区承载）
      enterBrowserWorkspace(clawId);
    }, DESKTOP_UPGRADE_DURATION);

    desktopUpgradeTimersRef.current[clawId] = timer;
  }, [enterBrowserWorkspace]);

  const handleOpenDesktopUpgradeConfirm = useCallback(() => {
    if (!selectedClawId) return;
    const runtime = desktopRuntimeMap[selectedClawId] ?? {};
    // 升级中不允许重复点击
    if (runtime.desktopInstalling) return;
    setDesktopUpgradeConfirmOpen(true);
  }, [desktopRuntimeMap, selectedClawId]);

  const handleConfirmDesktopUpgrade = useCallback(() => {
    if (!selectedClawId || !selectedClaw) return;
    setDesktopUpgradeConfirmOpen(false);
    runDesktopUpgradeTask(selectedClawId, selectedClaw.name);
  }, [runDesktopUpgradeTask, selectedClaw, selectedClawId]);

  const handleRetryDesktopUpgrade = useCallback(() => {
    if (!selectedClawId || !selectedClaw) return;
    const runtime = desktopRuntimeMap[selectedClawId] ?? {};
    if (runtime.desktopInstalling) return;
    runDesktopUpgradeTask(selectedClawId, selectedClaw.name);
  }, [desktopRuntimeMap, runDesktopUpgradeTask, selectedClaw, selectedClawId]);

  const handleDismissUpgradePrompt = useCallback(() => {
    if (!selectedClawId) return;
    setDesktopUpgradePromptDismissed((prev) => {
      if (prev.has(selectedClawId)) return prev;
      const next = new Set(prev);
      next.add(selectedClawId);
      return next;
    });
  }, [selectedClawId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(desktopUpgradeTimersRef.current).forEach((t) => window.clearTimeout(t));
      desktopUpgradeTimersRef.current = {};
      if (manualRefreshLockTimerRef.current !== null) {
        window.clearTimeout(manualRefreshLockTimerRef.current);
        manualRefreshLockTimerRef.current = null;
      }
    };
  }, []);

  const handleToggleBrowserFullscreen = () => {
    if (!selectedClawId || isBrowserPanelLoading) return;
    if (manualRefreshLockedClawId === selectedClawId) return;
    setWorkspaceModeForSelectedClaw(workspaceMode === "browser_fullscreen" ? "chat_with_browser" : "browser_fullscreen");
  };

  const handleCollapseBrowser = () => {
    if (!selectedClawId) return;
    if (manualRefreshLockedClawId === selectedClawId) return;
    clearBrowserPanelLoadTimers(selectedClawId);
    updateBrowserState(selectedClawId, (prev) => ({
      ...prev,
      mode: "chat",
      panelStatus: "ready",
      panelLoadProgress: 100,
      isManualOperating: false,
      liveCaption: prev.taskState === "running" ? prev.liveCaption : "当前为查看态，可实时查看 AI 的云端操作画面。",
      lastSyncedAt: formatSyncTime(),
    }));
  };

  const handleToggleManualOperation = () => {
    if (!selectedClawId) return;
    if (manualRefreshLockedClawId === selectedClawId) return;

    updateBrowserState(selectedClawId, (prev) => {
      if (prev.taskState === "running" || prev.panelStatus === "loading") {
        return prev.isManualOperating
          ? {
              ...prev,
              isManualOperating: false,
            }
          : prev;
      }

      const nextManualOperating = !prev.isManualOperating;
      return {
        ...prev,
        isManualOperating: nextManualOperating,
        liveCaption: nextManualOperating
          ? "已进入操作态，您可直接进入云端环境操作。"
          : "当前为查看态，可实时查看 AI 的云端操作画面。",
        lastUserAction: nextManualOperating ? "已进入人工操作" : "已退出人工操作",
        lastSyncedAt: formatSyncTime(),
      };
    });
  };

  const handleBrowserRefresh = () => {
    if (!selectedClawId || isBrowserPanelLoading) return;
    if (manualRefreshLockedClawId === selectedClawId) return;

    // 主动刷新：仅更新同步时间和最近操作记录，不触发全屏 loading 占位。
    // 刷新按钮在锁定期间禁用，防止用户短时间内重复点击。
    updateBrowserState(selectedClawId, (prev) => ({
      ...prev,
      lastUserAction: "手动刷新云端画面",
      lastSyncedAt: formatSyncTime(),
    }));

    setManualRefreshLockedClawId(selectedClawId);
    if (manualRefreshLockTimerRef.current !== null) {
      window.clearTimeout(manualRefreshLockTimerRef.current);
    }
    manualRefreshLockTimerRef.current = window.setTimeout(() => {
      setManualRefreshLockedClawId(null);
      manualRefreshLockTimerRef.current = null;
    }, 1600);
  };

  const renderBrowserContent = () => {
    if (!selectedClaw || !currentBrowserState) return null;

    if (currentBrowserState.panelStatus === "loading") {
      return (
        <div
          className="flex min-h-[480px] w-full items-center justify-center rounded-[28px] border border-gray-200 bg-gray-100"
          style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.6)" }}
        >
          <div className="w-full max-w-md px-8">
            <p className="mb-4 text-center text-sm text-gray-500">
              请稍等，云端浏览器启动中，预计需要 1 ~ 2 分钟
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${currentBrowserState.panelLoadProgress}%`,
                  // allow-inline-gradient: 进度条填充色（非按钮，SKILL §8.1 白名单）
                  background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)",
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex min-h-[480px] w-full items-center justify-center rounded-[28px] border border-gray-200 bg-gray-100"
        style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,0.6)" }}
      >
        <span className="text-lg font-medium tracking-[0.08em] text-gray-500">云端操作画面</span>
      </div>
    );
  };

  const showFullListSidebar = workspaceMode === "chat";
  const showBrowserPane = workspaceMode !== "chat";
  const showChatPane = workspaceMode !== "browser_fullscreen";
  const isWorkspaceFullscreen = workspaceMode !== "chat" || (workspaceMode === "chat" && isFullscreen);
  const workspaceTopClass = shouldAutoHideTenantHeader && !isTenantHeaderVisible ? "top-0" : "top-16";

  return (
    <>
      {shouldAutoHideTenantHeader && (
        <div
          className="fixed left-1/2 top-0 z-[45] flex h-5 w-24 -translate-x-1/2 items-start justify-center"
          onMouseEnter={showTenantHeader}
          onMouseLeave={() => scheduleHideTenantHeader(180)}
          aria-hidden="true"
        >
          <div className={`mt-1 h-1 w-16 rounded-full bg-gray-300/80 transition-all duration-200 ${isTenantHeaderVisible ? "opacity-0" : "opacity-100"}`} />
        </div>
      )}

      {shouldShowCloudBrowserEntry && (isFullscreen || cloudBrowserEntryPosition) && (
        <div
          className={isFullscreen ? `fixed right-4 ${workspaceTopClass} z-50` : "fixed z-20"}
          style={
            isFullscreen
              ? undefined
              : cloudBrowserEntryPosition
                ? { top: cloudBrowserEntryPosition.top, left: cloudBrowserEntryPosition.left }
                : undefined
          }
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={isCloudBrowserEntryDisabled ? undefined : handleOpenBrowser}
                aria-label={cloudBrowserEntryTooltip}
                aria-disabled={isCloudBrowserEntryDisabled}
                data-disabled={isCloudBrowserEntryDisabled ? "true" : "false"}
                className={`flex h-10 w-10 items-center justify-center rounded-[4px] border bg-white/95 backdrop-blur-sm transition-all duration-150 ${
                  isCloudBrowserEntryDisabled
                    ? "cursor-not-allowed border-gray-200 text-gray-300"
                    : "border-gray-200 text-gray-400 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                }`}
                style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}
              >
                <Monitor className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="start" className="text-xs">
              {cloudBrowserEntryTooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <div
      ref={workspaceRef}
      className={`flex bg-white overflow-hidden transition-all duration-300 ease-in-out ${
        isWorkspaceFullscreen
          ? `fixed inset-0 ${workspaceTopClass} z-40 rounded-none border-none`
          : "rounded-[4px] border border-gray-100"
      }`}
      style={
        workspaceMode !== "chat" || (workspaceMode === "chat" && isFullscreen)
          ? { boxShadow: "none" }
          : { boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)", height: "calc(100vh - 200px)", minHeight: "560px" }
      }
    >

      {showFullListSidebar && (
        <div className="w-64 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white">
          <div className="px-3 h-10 flex items-center">
            <span className="text-xs font-medium text-gray-700">选择 Agent</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}>
            {effectiveClaws.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-xs text-gray-400">暂无 Agent</p>
              </div>
            ) : (
              <div>
                {/* [006] 侧栏列表：扁平按时间倒序 + 无限滚动分批加载（每批 30 条） */}
                {sidebarVisibleClaws.map((claw) => {
                  const isSelected = claw.id === selectedClawId;
                  const isConfigEnabled = claw.status === "running";
                  const isNonOpenclaw = claw.agentType === "hermes" || claw.agentType === "lightclawace";
                  const isHermes = claw.agentType === "hermes";
                  // 多分组模式下检查 chatView 权限
                  const groupPerms = getClawGroupPermissions?.(claw);
                  const isGroupChatDisabled = groupMode === "multi-group" && groupPerms && !groupPerms.allowChatView;
                  const isDisabledForChat = isHermes || !!isGroupChatDisabled;

                  return (
                    <Tooltip key={claw.id}>
                      <TooltipTrigger asChild>
                    <div
                      className={`relative mx-2 my-2 px-3 py-2.5 transition-all duration-150 group/item rounded-[4px] ${
                        isDisabledForChat ? "cursor-default opacity-50" : "cursor-pointer"
                      } ${
                        isSelected ? "bg-blue-50" : "bg-gray-100/70 hover:bg-gray-100"
                      }`}
                      style={
                        isSelected
                          ? { boxShadow: "0 2px 8px rgba(20,71,230,0.1)", border: "1px solid rgba(20,71,230,0.25)" }
                          : { boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid transparent" }
                      }
                      onClick={() => { if (!isDisabledForChat) handleSelectClaw(claw.id); }}
                    >
                      {/* Agent Type Tag - 右上角融合卡片内 */}
                      <span
                        className="absolute -top-px -right-px z-10 text-[9px] font-semibold px-2 py-0.5 whitespace-nowrap"
                        style={{
                          background: isSelected ? "rgba(20,71,230,0.08)" : "#EAECF0",
                          color: isSelected ? "rgba(20,71,230,0.5)" : "#9CA3AF",
                          borderTopRightRadius: "0.75rem",
                          borderBottomLeftRadius: "0.75rem",
                          boxShadow: "none"
                        }}
                      >
                        {claw.agentType === "hermes" ? "Hermes Agent" : claw.agentType === "lightclawace" ? "Lightclaw ACE" : "OpenClaw"}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0 mt-3">
                        <h4 className={`text-sm font-medium truncate ${isSelected ? "text-blue-700" : "text-gray-900"}`}>{claw.name}</h4>
                        <StatusBadgeSmall status={claw.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 min-w-0">
                        {claw.roleName && (
                          <span
                            className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, rgba(20,71,230,0.08), rgba(88,86,214,0.05))", color: "#5c6b7a", border: "1px solid rgba(20,71,230,0.1)", fontSize: "10px" }}
                          >
                            {claw.roleName}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 truncate">{claw.instanceId}</span>
                      </div>
                      {/* 分组信息 - 始终显示 */}
                      <p className="text-xs text-gray-400 mt-0.5">分组：{groupMode === "multi-group" ? (claw.groupName || "A公司 / 技术部 / 前端组") : "默认"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">创建于 {claw.createdAt}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={`flex items-center gap-1 text-xs h-6 px-0 rounded-[4px] transition-colors ${
                                isConfigEnabled ? "text-blue-600 hover:bg-blue-100/60 cursor-pointer" : "text-gray-300 cursor-not-allowed"
                              }`}
                              disabled={!isConfigEnabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isConfigEnabled) navigate(`/openclaw/${claw.id}`);
                              }}
                            >
                              <Settings className="w-3 h-3" />
                              详细配置
                            </button>
                          </TooltipTrigger>
                          {!isConfigEnabled && (
                            <TooltipContent side="bottom" className="text-xs">
                              当前状态不支持进入详细配置
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={`w-6 h-6 rounded-[4px] flex items-center justify-center transition-colors flex-shrink-0 ${
                                isSelected ? "text-blue-500 hover:text-blue-700 hover:bg-blue-100/60" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200/60"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {claw.status === "running" ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestartConfirm({ id: claw.id, name: claw.name }); }}>
                                <RotateCcw className="w-4 h-4 mr-2 text-gray-500" />
                                重启
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="opacity-40 cursor-not-allowed">
                                <RotateCcw className="w-4 h-4 mr-2 text-gray-400" />
                                重启
                              </DropdownMenuItem>
                            )}
                            {claw.status === "running" ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTrackedClawReinstallConfirm({ id: claw.id, name: claw.name }); }}>
                                <HardDriveDownload className="w-4 h-4 mr-2 text-gray-500" />
                                {isNonOpenclaw ? "重新安装 Agent" : "重新安装"}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="opacity-40 cursor-not-allowed">
                                <HardDriveDownload className="w-4 h-4 mr-2 text-gray-400" />
                                {isNonOpenclaw ? "重新安装 Agent" : "重新安装"}
                              </DropdownMenuItem>
                            )}
                            {(() => {
                              // 多分组模式下检查当前 claw 的分组终端权限
                              const groupPerms = getClawGroupPermissions?.(claw);
                              const canTerminal = groupMode === "multi-group" && groupPerms
                                ? groupPerms.allowTerminal
                                : allowTerminal;
                              if (!canTerminal) return null;
                              return claw.status === "running" ? (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/terminal/${claw.id}`, "_blank"); }}>
                                  <Terminal className="w-4 h-4 mr-2 text-gray-500" />
                                  进入终端
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled className="opacity-40 cursor-not-allowed">
                                  <Terminal className="w-4 h-4 mr-2 text-gray-400" />
                                  进入终端
                                </DropdownMenuItem>
                              );
                            })()}
                            {claw.roleName && claw.roleName !== "通用助手" && claw.status === "running" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemoveRoleConfirm({ id: claw.id, name: claw.name, roleName: claw.roleName! }); }}>
                                <UserMinus className="w-4 h-4 mr-2 text-gray-500" />
                                移除角色
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {claw.status === "loadFail" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRetry(claw.id, claw.name); }}>
                                <RefreshCw className="w-4 h-4 mr-2 text-gray-500" />
                                重试恢复
                              </DropdownMenuItem>
                            )}
                            {["creating", "loading", "pending"].includes(claw.status) ? (
                              <DropdownMenuItem disabled className="opacity-40 cursor-not-allowed text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDeleteConfirm({ id: claw.id, name: claw.name, status: claw.status }); }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    </TooltipTrigger>
                    {isHermes && (
                      <TooltipContent side="right" className="text-xs">
                        Hermes 暂不支持对话视图
                      </TooltipContent>
                    )}
                    {!isHermes && isGroupChatDisabled && (
                      <TooltipContent side="right" className="text-xs">
                        该分组未开启对话视图权限
                      </TooltipContent>
                    )}
                    </Tooltip>
                  );
                })}
                {/* [006] 滚动哨兵 + 加载状态 */}
                {sidebarHasMore && (
                  <div ref={sidebarSentinelRef} className="py-3 flex items-center justify-center">
                    {sidebarIsLoadingMore ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        加载中...
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">下滑加载更多</span>
                    )}
                  </div>
                )}
                {!sidebarHasMore && sortedClaws.length > SIDEBAR_PAGE_SIZE && (
                  <div className="py-3 text-center">
                    <span className="text-xs text-gray-300">已加载全部 {sortedClaws.length} 个 Agent</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showChatPane && (
        <div
          className={`min-w-0 flex flex-col ${
            workspaceMode === "chat" ? "flex-1" : "flex-shrink-0"
          }`}
          style={chatPaneStyle}
        >
          {!selectedClaw ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">请选择一个 OpenClaw 开始对话</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100 flex-shrink-0 bg-white/90 backdrop-blur-sm">
                <div className="min-w-0 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedClaw.name}</h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{selectedClaw.instanceId}</p>
                  </div>
                  <div className="flex-shrink-0 self-center">
                    <StatusBadgeSmall status={selectedClaw.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isRunning && (
                    <button
                      onClick={handleNewChat}
                      disabled={currentIsTyping}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      新建会话
                    </button>
                  )}

                </div>
              </div>

              <div className={`flex-1 overflow-y-auto ${workspaceMode === "chat" ? "px-8 py-6" : "px-5 py-5"}`} style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}>
                {currentMessages.length === 0 ? (
                  isRunning ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663415970324/bygiZj33T3TUvGMBPvApKE/lobster_3d_8f2c189d.png"
                        alt="OpenClaw"
                        className="w-28 h-28 mb-1 object-contain"
                        draggable={false}
                      />
                      <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                        你好，今天我们来做些什么呢？
                      </h2>
                      <div className="flex flex-col gap-2 w-full max-w-md">
                        {MOCK_QUICK_COMMANDS.map((command) => (
                          <button
                            key={command}
                            onClick={() => handleQuickCommand(command)}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[4px] border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 text-left group/cmd"
                            disabled={currentIsTyping}
                          >
                            <span className="text-blue-500 flex-shrink-0">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-sm text-gray-700 group-hover/cmd:text-gray-900">{command}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full pb-16">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663415970324/bygiZj33T3TUvGMBPvApKE/lobster_offline_v7_3c1d942c.png"
                        alt="OpenClaw Offline"
                        className="w-28 h-28 mb-4 object-contain"
                        draggable={false}
                      />
                      <p className="text-base font-medium text-gray-900 mb-1">当前 OpenClaw 未在运行中，暂时无法对话</p>
                      <p className="text-xs text-gray-400 mb-4">你可以刷新状态查看最新情况或选择其他 OpenClaw</p>
                      {selectedClaw.status === "loadFail" ? (
                        <Button onClick={() => onRetry(selectedClaw.id, selectedClaw.name)} variant="claw-outline" size="claw-sm" className="text-xs">
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          重试恢复
                        </Button>
                      ) : (
                        <button
                          onClick={(e) => onRefreshStatus(e, selectedClaw.id, selectedClaw.name)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] border border-gray-200 bg-white text-sm text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all duration-150"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(selectedClaw.id) ? "animate-spin" : ""}`} />
                          刷新状态
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div className={`mx-auto space-y-6 ${workspaceMode === "chat" ? "max-w-3xl" : "max-w-full"}`}>
                    {currentMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "user" ? (
                          <div className="max-w-[78%] px-4 py-2.5 rounded-[4px] bg-gray-100 text-sm text-gray-900 leading-relaxed">
                            {message.content}
                          </div>
                        ) : (
                          <div className="max-w-[90%] text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </div>
                        )}
                      </div>
                    ))}
                    {currentIsTyping && (
                      <div className="flex justify-start">
                        <TypingIndicator />
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {isRunning && (
                <div className={`flex-shrink-0 ${workspaceMode === "chat" ? "px-8 pb-4" : "px-4 pb-4"}`}>
                  <div className="bg-white rounded-[4px] border border-gray-200 relative" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleTextareaInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="发送消息开始对话"
                      rows={2}
                      className="w-full px-4 pt-3 pb-2 text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none bg-transparent"
                      style={{ minHeight: "56px", maxHeight: "120px" }}
                      disabled={currentIsTyping}
                    />
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="flex items-center gap-0.5">
                        <button className="w-7 h-7 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        <div className="relative" ref={commandsRef}>
                          <button
                            onClick={() => setShowCommands((prev) => !prev)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xs font-medium"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            指令库
                            {showCommands ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                          </button>
                          {showCommands && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-[4px] border border-gray-200 py-1.5 z-50" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                              {COMMAND_LIST.map((item) => (
                                <button
                                  key={item.command}
                                  onClick={() => handleSendCommand(item.command)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
                                >
                                  <span className="text-xs font-mono text-gray-900">{item.command}</span>
                                  <span className="text-xs text-gray-400">{item.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button className="w-7 h-7 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleSend}
                          disabled={!inputText.trim() || currentIsTyping}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-all duration-150 disabled:opacity-30"
                          // allow-inline-gradient: 圆形发送按钮非标准矩形按钮，属于 SKILL §8.1 白名单场景}
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-gray-400 mt-2" style={{ fontSize: "10px" }}>
                    发送任务后，如已打开云端浏览器，你可以在右侧实时查看执行过程
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {workspaceMode === "chat_with_browser" && (
        <div
          role="separator"
          aria-label="调整会话区与浏览器区宽度"
          aria-orientation="vertical"
          className={`group relative flex w-2 shrink-0 cursor-col-resize items-stretch justify-center transition-colors duration-150 ${
            isResizing ? "bg-blue-50/70" : "hover:bg-blue-50/40"
          }`}
          onMouseDown={handleResizeStart}
        >
          <span
            className={`my-4 w-px rounded-full transition-colors duration-150 ${
              isResizing ? "bg-blue-300" : "bg-gray-200 group-hover:bg-gray-300"
            }`}
          />
        </div>
      )}

      {showBrowserPane && selectedClaw && currentBrowserState && (
        <div
          className="flex-1 min-w-0 flex flex-col bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))]"
          style={workspaceMode === "chat_with_browser" ? { minWidth: `${BROWSER_PANE_MIN_WIDTH}px` } : undefined}
        >
          {/* 产品规则：浏览器相关按钮全部归浏览器工具条 */}
          <div className="h-12 border-b border-gray-100 flex items-center justify-between px-4 bg-white/90 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Monitor className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-900">云桌面</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleToggleManualOperation}
                disabled={isBrowserOperationButtonDisabled}
                className={`h-8 rounded-[4px] px-3 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isBrowserOperationButtonDisabled
                    ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                    : isBrowserManualOperating
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                }`}
              >
                {isBrowserManualOperating ? <Eye className="w-3.5 h-3.5" /> : <MousePointerClick className="w-3.5 h-3.5" />}
                {browserOperationButtonLabel}
              </button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleBrowserRefresh}
                    disabled={isBrowserPanelLoading || isManualRefreshLocked}
                    className="w-8 h-8 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-35 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">重新连接 / 刷新画面</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleBrowserFullscreen}
                    disabled={isBrowserPanelLoading || isManualRefreshLocked}
                    className="w-8 h-8 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-35 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                  >
                    {workspaceMode === "browser_fullscreen" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {workspaceMode === "browser_fullscreen" ? "退出云桌面全屏" : "云桌面全屏"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCollapseBrowser}
                    disabled={isManualRefreshLocked}
                    className="w-8 h-8 rounded-[4px] flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-35 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">收起云桌面</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* —— 云桌面升级提示条（信息提示风格，不遮挡浏览器主体）—— */}
          {showUpgradePromptBar && (
            <div
              className={`flex-shrink-0 border-b px-4 py-2 ${
                showUpgradeErrorPrompt
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-100 bg-blue-50/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <Info
                  className={`w-4 h-4 shrink-0 ${
                    showUpgradeErrorPrompt ? "text-amber-500" : "text-blue-500"
                  }`}
                />
                <span
                  className={`text-xs leading-5 min-w-0 ${
                    showUpgradeErrorPrompt ? "text-amber-700" : "text-blue-700"
                  }`}
                >
                  {showUpgradeInstallingPrompt
                    ? "云桌面升级中，升级完成后将自动进入云桌面。"
                    : showUpgradeErrorPrompt
                      ? "云桌面暂未升级成功，您可以稍后重试。"
                      : "可升级为云桌面。升级后将在保留浏览器能力的基础上，支持桌面级操作。"}
                </span>

                {showUpgradeInstallingPrompt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 cursor-not-allowed ml-auto">
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    升级中
                  </span>
                ) : showUpgradeErrorPrompt ? (
                  <button
                    type="button"
                    onClick={handleRetryDesktopUpgrade}
                    className="text-xs font-medium text-amber-700 underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                  >
                    重试升级
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenDesktopUpgradeConfirm}
                      className="text-xs font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:decoration-solid hover:text-blue-700 transition-all"
                    >
                      一键升级
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissUpgradePrompt}
                      aria-label="关闭升级提示"
                      className="ml-auto w-6 h-6 rounded-[4px] flex items-center justify-center text-blue-400/70 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}


          <div
            className="relative flex-1 min-h-0 overflow-hidden"
            onClickCapture={(e) => {
              if (isBrowserReadonly) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div className="relative h-full overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}>
              <div className={`${isBrowserReadonly ? "pointer-events-none select-none " : ""}relative flex min-h-full items-center`}>
                <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    {isBrowserReadonly ? <Eye className="w-3.5 h-3.5" /> : <MousePointerClick className="w-3.5 h-3.5" />}
                    <span>{currentBrowserState.liveCaption}</span>
                  </div>
                </div>
                {renderBrowserContent()}
              </div>
            </div>

            {/* —— 云桌面升级中遮罩（仅覆盖云端操作画面区域，阻止用户继续操作当前云端浏览器）—— */}
            {showUpgradeInstallingPrompt && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-white/55 backdrop-blur-[1.5px]"
                role="status"
                aria-live="polite"
                aria-busy="true"
                // 捕获所有交互事件，避免穿透到下层浏览器画面
                onClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDownCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onWheelCapture={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="inline-flex flex-col items-center gap-3 px-6 py-4">
                  {/* 动态 spinner：纯 CSS 旋转圆环，无静态图标 */}
                  <span
                    aria-hidden="true"
                    className="block h-6 w-6 rounded-full border-[2px] border-gray-200 border-t-blue-500"
                    style={{ animation: "desktop-upgrade-spin 0.9s linear infinite" }}
                  />

                  {/* 唯一核心文案 */}
                  <p className="text-[13px] leading-5 text-gray-700">
                    正在升级为云桌面，完成后将自动进入，请稍候…
                  </p>

                  {/* 克制的非精确进度条 */}
                  <div className="relative h-[3px] w-40 overflow-hidden rounded-full bg-gray-200/70">
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-blue-500/80"
                      style={{ animation: "desktop-upgrade-indeterminate 1.4s ease-in-out infinite" }}
                    />
                  </div>
                </div>

                {/* CSS 动画（就地内联定义，不污染全局） */}
                <style>{`
                  @keyframes desktop-upgrade-indeterminate {
                    0%   { transform: translateX(-120%); }
                    100% { transform: translateX(360%); }
                  }
                  @keyframes desktop-upgrade-spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      <Dialog
        open={browserStartupModal.visible}
        onOpenChange={(open: boolean) => {
          if (!open) {
            closeBrowserStartupModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-semibold text-gray-900">启动云桌面</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-2.5 rounded-[4px] border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-blue-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <span>您可通过云桌面查看 AI 的云端操作过程，并在需要时进入操作。</span>
            </div>

            <p className="text-sm text-gray-500">
              启动前将会依次完成以下检查，检查通过后即可进入：
            </p>

            <div className="space-y-2.5 py-1">
              {(() => {
                // 展示层最小改动：将内部 3 个原子步骤合并成 2 个用户可见步骤
                //  - 第 1 个可见步骤：合并 imageCheck + componentCheck，命名为“检查云服务器环境及运行组件”
                //  - 第 2 个可见步骤：policyCheck，命名为“检查云端连接状态”
                // 底层检测流程/时序/随机失败/分流逻辑完全不变。
                type VisibleStepDef = {
                  key: string;
                  title: string;
                  innerKeys: BrowserStartupStepKey[];
                  runningText: string;
                  successText: string;
                  defaultFailureText: string;
                };
                const visibleSteps: VisibleStepDef[] = [
                  {
                    key: "envAndComponent",
                    title: "检查云服务器环境及运行组件",
                    innerKeys: ["imageCheck", "componentCheck"],
                    runningText: "正在检查云服务器环境及运行组件…",
                    successText: "云服务器环境及运行组件已就绪。",
                    defaultFailureText: "云服务器环境或运行组件检查失败，请重试。",
                  },
                  {
                    key: "browserConnection",
                    title: "检查云端连接状态",
                    innerKeys: ["policyCheck"],
                    runningText: "正在检查云端连接状态…",
                    successText: "云端连接状态正常，可继续进入。",
                    defaultFailureText: "当前云端连接不可用，请稍后重试。",
                  },
                ];

                return visibleSteps.map((vs) => {
                  const innerStatuses = vs.innerKeys.map((k) => browserStartupModal.steps[k]);
                  const failedInnerKey = vs.innerKeys.find(
                    (k) => browserStartupModal.steps[k] === "failed" && browserStartupModal.failedStep === k,
                  );

                  let aggStatus: BrowserStartupStepStatus;
                  if (failedInnerKey || innerStatuses.some((s) => s === "failed")) {
                    aggStatus = "failed";
                  } else if (innerStatuses.some((s) => s === "running")) {
                    aggStatus = "running";
                  } else if (innerStatuses.every((s) => s === "success")) {
                    aggStatus = "success";
                  } else {
                    aggStatus = "waiting";
                  }

                  let helperText: string;
                  if (aggStatus === "failed") {
                    // 优先展示后端/流程传回的 failureReason（如 message），否则兜底文案
                    helperText = browserStartupModal.failureReason || vs.defaultFailureText;
                  } else if (aggStatus === "success") {
                    helperText = vs.successText;
                  } else if (aggStatus === "running") {
                    helperText = vs.runningText;
                  } else {
                    helperText = "等待执行";
                  }

                  return (
                    <BrowserStartupStepItem
                      key={vs.key}
                      title={vs.title}
                      status={aggStatus}
                      helperText={helperText}
                    />
                  );
                });
              })()}
            </div>
          </div>

          <DialogFooter className="justify-center gap-3 pt-1 sm:justify-center sm:space-x-0">
            <Button
              variant="claw-outline"
              size="claw-sm"
              onClick={closeBrowserStartupModal}
              className="px-6"
            >
              取消
            </Button>

            {browserStartupModal.flowStatus === "failed" ? (
              <Button
                variant="claw-primary"
                size="claw-sm"
                onClick={handleRetryBrowserStartup}
                className="px-6"
              >
                重试
              </Button>
            ) : browserStartupModal.flowStatus === "success" ? (
              <Button
                variant="claw-primary"
                size="claw-sm"
                onClick={handleConfirmBrowserStartup}
                className="px-6"
              >
                立即进入
              </Button>
            ) : (
              <Button
                variant="claw-primary"
                size="claw-sm"
                disabled
                className="px-6"
              >
                校验中...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          animation: typingBounce 1.4s ease-in-out infinite;
        }
      `}</style>

      <AlertDialog open={showNewChatConfirm} onOpenChange={setShowNewChatConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认新建会话？</AlertDialogTitle>
            <AlertDialogDescription>
              新建会话后，当前会话记录会被清空。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmNewChat}
              className={buttonVariants({ variant: "claw-primary", size: "claw-sm" })}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={browserVncAccessErrorModal.visible}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setBrowserVncAccessErrorModal({ visible: false, targetClawId: null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>云端浏览器连接异常</AlertDialogTitle>
            <AlertDialogDescription>
              当前云端浏览器连接不可用，请稍后重试。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setBrowserVncAccessErrorModal({ visible: false, targetClawId: null })}
            >
              我知道了
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* —— 升级为云桌面：确认弹窗 —— */}
      <AlertDialog
        open={desktopUpgradeConfirmOpen}
        onOpenChange={(open: boolean) => {
          if (!open) setDesktopUpgradeConfirmOpen(false);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg leading-none font-semibold text-gray-900">
              确认升级
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="pt-2 text-sm text-gray-700 leading-relaxed">
                升级后可使用浏览器、桌面操作和文件处理能力。升级期间暂不可使用当前云端操作环境，请在合适时间操作。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel onClick={() => setDesktopUpgradeConfirmOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDesktopUpgrade}
              className={buttonVariants({ variant: "claw-primary", size: "claw-sm" })}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
