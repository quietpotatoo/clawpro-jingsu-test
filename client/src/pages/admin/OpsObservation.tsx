/**
 * OpsObservation - 运维观测页面
 * Design: 「流动蓝图」Fluid Blueprint
 * - 标题、副标题、卡片、icon 与其他子页面保持一致
 */
import { useState, useEffect } from "react";
import { AlertCircle, ArrowUpRight, RefreshCw, BarChart3, TrendingUp, Activity, Zap, CheckCircle2, AlertTriangle, Info, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Eye, EyeOff } from "lucide-react";
import { AgentCombobox } from "@/components/OpenClawCombobox";
import { toast } from "sonner";

// Mock data for charts
const logLevelData = [
  { level: "ERROR", count: 498 },
  { level: "WARNING", count: 1974 },
  { level: "INFO", count: 33124 },
  { level: "DEBUG", count: 56937 },
];

const logModuleData = [
  { name: "gateway/channels/qpo...", count: 62413 },
  { name: "gateway/health-monit...", count: 11206 },
  { name: "plugins", count: 1145 },
  { name: "agent/embedded", count: 630 },
  { name: "gateway/channels/fei...", count: 95 },
  { name: "gateway/canvas", count: 9 },
  { name: "browser/server", count: 9 },
  { name: "gmail-watcher", count: 1 },
  { name: "browser/service", count: 1 },
];

const messageProcessData = [
  { time: "01:59", processed: 10, queued: 8 },
  { time: "02:04", processed: 12, queued: 9 },
  { time: "02:09", processed: 11, queued: 7 },
  { time: "02:14", processed: 13, queued: 8 },
  { time: "02:19", processed: 12, queued: 6 },
  { time: "02:24", processed: 14, queued: 7 },
  { time: "02:29", processed: 11, queued: 8 },
  { time: "02:34", processed: 13, queued: 9 },
  { time: "02:39", processed: 12, queued: 7 },
  { time: "02:44", processed: 14, queued: 6 },
];

const queueStatusData = [
  { time: "01:59", depth_avg: 2.0, wait_ms_avg: 1.8 },
  { time: "02:04", depth_avg: 1.9, wait_ms_avg: 1.7 },
  { time: "02:09", depth_avg: 2.1, wait_ms_avg: 1.9 },
  { time: "02:14", depth_avg: 2.0, wait_ms_avg: 1.8 },
  { time: "02:19", depth_avg: 1.8, wait_ms_avg: 1.6 },
  { time: "02:24", depth_avg: 2.0, wait_ms_avg: 1.8 },
  { time: "02:29", depth_avg: 1.9, wait_ms_avg: 1.7 },
  { time: "02:34", depth_avg: 2.1, wait_ms_avg: 1.9 },
  { time: "02:39", depth_avg: 2.0, wait_ms_avg: 1.8 },
  { time: "02:44", depth_avg: 1.9, wait_ms_avg: 1.7 },
];

const runDurationData = [
  { time: "01:59", run_duration_p50: 45000, run_duration_p95: 60000 },
  { time: "02:04", run_duration_p50: 46000, run_duration_p95: 62000 },
  { time: "02:09", run_duration_p50: 44000, run_duration_p95: 59000 },
  { time: "02:14", run_duration_p50: 47000, run_duration_p95: 61000 },
  { time: "02:19", run_duration_p50: 43000, run_duration_p95: 58000 },
  { time: "02:24", run_duration_p50: 45000, run_duration_p95: 60000 },
  { time: "02:29", run_duration_p50: 46000, run_duration_p95: 61000 },
  { time: "02:34", run_duration_p50: 44000, run_duration_p95: 59000 },
  { time: "02:39", run_duration_p50: 47000, run_duration_p95: 62000 },
  { time: "02:44", run_duration_p50: 45000, run_duration_p95: 60000 },
];

const METRIC_CARDS = [
  { title: "消息处理总量", value: "13", unit: "", icon: BarChart3, color: "#10B981" },
  { title: "消息入队", value: "13", unit: "", icon: TrendingUp, color: "#3B82F6" },
  { title: "执行耗时 P95", value: "10s", unit: "", icon: Zap, color: "#F59E0B" },
  { title: "队列深度 P95", value: "0", unit: "", icon: Activity, color: "#8B5CF6" },
  { title: "卡死会话", value: "4", unit: "", icon: AlertCircle, color: "#EF4444" },
];

// 现有观测功能卡片
const EXISTING_OBSERVATION_CARDS = [
  {
    id: "health-monitoring",
    title: "业务运行健康度实时监控",
    description: "聚焦消息处理总量、入队效率与卡死会话，保障系统稳定运行",
    icon: Activity,
    color: "#10B981",
  },
  {
    id: "log-metrics-insight",
    title: "应用日志与 OTEL 指标全景洞察",
    description: "多维度分析日志级别与模块分布，精细化追踪消息处理、队列状态与执行耗时",
    icon: BarChart3,
    color: "#3B82F6",
  },
];

// CLS 新增功能卡片
const CLS_NEW_CARDS = [
  {
    id: "high-cost-session",
    title: "高Token会话实时分析与管控",
    description: "聚焦 TOP 会话的 Token 消耗、轮次分布与耗时特征，精准定位高Token交互，优化模型调用成本与资源效率",
    icon: TrendingUp,
    color: "#F59E0B",
  },
  {
    id: "single-session-cost",
    title: "单会话全链路Token透视",
    description: "拆解每轮交互的 Token 流量与耗时分布，可视化工具调用与上下文膨胀对成本的影响",
    icon: Zap,
    color: "#AF52DE",
  },
  {
    id: "session-global-monitoring",
    title: "会话全局运行态势监控",
    description: "聚合总会话数、平均轮次与工具调用量，多维度洞察渠道与模型分布，实现会话全生命周期可追溯、可分析",
    icon: Activity,
    color: "#34C759",
  },
  {
    id: "session-efficiency",
    title: "会话详情与交互效率精细化分析",
    description: "聚焦单会话 Token 消耗，可视化渠道与模型分布特征，精准定位高Token会话，优化资源配置与调用效率",
    icon: BarChart3,
    color: "#FF9500",
  },
];

// CLS 采集插件版本历史
interface CLSPluginVersion {
  version: string;
  releaseDate: string;
  changelog: string;
  status: 'current' | 'available' | 'deprecated';
}

const CLS_PLUGIN_VERSIONS: CLSPluginVersion[] = [
  { version: "v5", releaseDate: "2026-03-24", changelog: "修复会话追踪精度问题，优化 Token 计算算法", status: "available" },
  { version: "v4", releaseDate: "2026-03-17", changelog: "新增会话全局监控功能，支持多渠道分析", status: "available" },
  { version: "v3", releaseDate: "2026-03-10", changelog: "优化日志采集性能，降低 CPU 占用率", status: "current" },
  { version: "v2", releaseDate: "2026-03-03", changelog: "修复 CLS 连接超时问题", status: "deprecated" },
  { version: "v1", releaseDate: "2026-02-24", changelog: "首次发布 CLS 采集插件", status: "deprecated" },
];

// Legend 说明映射
const legendTooltips: Record<string, string> = {
  "已处理完成的消息数量": "已处理完成：已成功处理完成的消息数量",
  "等待处理的消息数量": "等待处理：等待处理的消息数量",
  "队列长度 P95": "队列长度 P95：95% 的时间队列长度不超过此值，反映队列拥堵程度",
  "等待时间 P95": "等待时间 P95：95% 的消息等待时间不超过此值，反映队列延迟",
  "处理耗时 P50": "处理耗时 P50：50% 的消息处理时间不超过此值，反映最差场景性能与边缘业务的延迟风险",
  "处理耗时 P95": "处理耗时 P95：95% 的消息处理时间不超过此值，反映典型处理性能与大部分业务的实际延迟体验",
};

// Custom Y Axis Tick with Tooltip
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const [showTooltip, setShowTooltip] = useState(false);
  const fullName = logModuleData.find(item => item.name.includes(payload.value.split('...')[0]))?.name || payload.value;
  
  return (
    <g>
      <text 
        x={x} 
        y={y} 
        textAnchor="end" 
        fontSize={12} 
        fill="#6b7280"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ cursor: 'pointer' }}
      >
        {payload.value}
      </text>
      {showTooltip && (
        <foreignObject x={x - 150} y={y - 25} width={140} height={40}>
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-normal break-words">
            {fullName}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  console.log('CustomLegend payload:', payload);
  if (!payload || payload.length === 0) {
    return null;
  }
  return (
    <div className="flex gap-6 justify-center flex-wrap">
      {payload.map((entry: any, index: number) => {
        console.log('Legend entry:', entry);
        return (
          <div key={`legend-${index}`} className="group relative flex items-center gap-2 cursor-help">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-600 inline-block">{entry.name}</span>
            {legendTooltips[entry.name] && (
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded px-2 py-1 z-50 w-max whitespace-nowrap">
                {legendTooltips[entry.name]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 工具函数
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function todayStr() {
  return toDateStr(new Date());
}
function addDays(base: string, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export default function OpsObservation() {
  const today = todayStr();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [refreshing, setRefreshing] = useState(false);
  const [clsEnabled, setClsEnabled] = useState(() => {
    const stored = localStorage.getItem("globalClsEnabled");
    return stored === "true";
  });
  const [isEnablingCls, setIsEnablingCls] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showCloseClsConfirm, setShowCloseClsConfirm] = useState(false);
  const [isClosingCls, setIsClosingCls] = useState(false);
  const [deleteLogTopic, setDeleteLogTopic] = useState(false);
  const [showClsAgreementDialog, setShowClsAgreementDialog] = useState(false);
  const [clsAgreed, setClsAgreed] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [authCheckInterval, setAuthCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [showFreeQuotaDialog, setShowFreeQuotaDialog] = useState(false);
  const [freeQuotaAgreed, setFreeQuotaAgreed] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(""); // Agent 名称筛选
  const [showPluginUpgradeDialog, setShowPluginUpgradeDialog] = useState(false);
  const [selectedPluginVersion, setSelectedPluginVersion] = useState<any>(null);
  const [isUpgradingPlugin, setIsUpgradingPlugin] = useState(false);

  // 当弹窗打开时，自动选中最新版本
  useEffect(() => {
    if (showPluginUpgradeDialog && !selectedPluginVersion) {
      setSelectedPluginVersion(CLS_PLUGIN_VERSIONS[0]); // v5 是最新版本
    }
  }, [showPluginUpgradeDialog]);

  // 处理日期变化
  const handleFromChange = (value: string) => {
    setDateFrom(value);
  };

  const handleToChange = (value: string) => {
    setDateTo(value);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); }, 1000);
  };

  // 监听 localStorage 变化，实现跨页面同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "globalClsEnabled") {
        setClsEnabled(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 监听 clsOpenClicked 标记，显示协议弹窗
  useEffect(() => {
    const checkClsOpen = () => {
      if (localStorage.getItem('clsOpenClicked') === 'true') {
        localStorage.removeItem('clsOpenClicked');
        setShowClsAgreementDialog(true);
      }
    };
    
    // 页面加载时检查
    checkClsOpen();
    
    // 监听 focus 事件
    window.addEventListener('focus', checkClsOpen);
    return () => window.removeEventListener('focus', checkClsOpen);
  }, []);

  const handleOpenCLS = () => {
    // 检查授权状态（从后台缓存数据中获取）
    const isAuthorized = localStorage.getItem('clsAuthorized') === 'true';
    
    if (!isAuthorized) {
      // 未授权，显示授权 Dialog
      setShowAuthDialog(true);
      // 启动自动检测授权状态
      setIsCheckingAuth(true);
      const interval = setInterval(() => {
        const authorized = localStorage.getItem('clsAuthorized') === 'true';
        if (authorized) {
          // 已授权，关闭 Dialog 并继续
          setShowAuthDialog(false);
          setIsCheckingAuth(false);
          clearInterval(interval);
          // 继续开启 CLS 日志服务
          proceedWithClsSetup();
        }
      }, 2000);
      setAuthCheckInterval(interval);
    } else {
      // 已授权，直接继续
      proceedWithClsSetup();
    }
  };

  const proceedWithClsSetup = () => {
    // 显示免费额度 Dialog
    setShowFreeQuotaDialog(true);
    setFreeQuotaAgreed(false);
  };

  const handleGoToAuth = () => {
    // Mock 授权流程：5 秒后自动检测授权完成
    // 不真正打开腾讯云页面，而是模拟授权完成
    // 先显示检测状态
    setIsCheckingAuth(true);
    setAuthCompleted(false);
    
    setTimeout(() => {
      localStorage.setItem('clsAuthorized', 'true');
      // 检测完成，显示完成状态
      setIsCheckingAuth(false);
      setAuthCompleted(true);
      // 1秒后自动关闭Dialog并进入下一步
      setTimeout(() => {
        setShowAuthDialog(false);
        setAuthCompleted(false);
        proceedWithClsSetup();
      }, 1000);
    }, 5000);
  };

  const handleConfirmFreeQuota = () => {
    if (!freeQuotaAgreed) return;
    setShowFreeQuotaDialog(false);
    setIsEnablingCls(true);
    setTimeout(() => {
      setClsEnabled(true);
      localStorage.setItem('globalClsEnabled', 'true');
      setIsEnablingCls(false);
      setShowSuccessMessage(true);
      setFreeQuotaAgreed(false);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }, 1500);
  };

  const handleGoToCalcDetail = () => {
    window.open('https://cloud.tencent.com/document/product/614/45802', '_blank');
  };

  const handleCancelFreeQuota = () => {
    setShowFreeQuotaDialog(false);
    setFreeQuotaAgreed(false);
  };

  const handleConfirmClsAgreement = () => {
    if (!clsAgreed) return;
    setIsEnablingCls(true);
    // 模拟 loading 1.5 秒
    setTimeout(() => {
      setClsEnabled(true);
      localStorage.setItem('globalClsEnabled', 'true');
      setIsEnablingCls(false);
      setShowSuccessMessage(true);
      setShowClsAgreementDialog(false);
      setClsAgreed(false);
      // 3 秒后隐藏成功提示
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }, 1500);
  };

  const handleCancelAuth = () => {
    setShowAuthDialog(false);
    setIsCheckingAuth(false);
    setAuthCompleted(false);
    if (authCheckInterval) {
      clearInterval(authCheckInterval);
      setAuthCheckInterval(null);
    }
  };

  const handleCloseCls = () => {
    setIsClosingCls(true);
    setTimeout(() => {
      setClsEnabled(false);
      localStorage.setItem("globalClsEnabled", "false");
      setIsClosingCls(false);
      setShowCloseClsConfirm(false);
      setDeleteLogTopic(false);
      const message = deleteLogTopic ? "CLS 日志服务已关闭，日志主题资源已删除" : "CLS 日志服务已关闭";
      // toast.success(message);
    }, 1000);
  };

  const handleCloseClsConfirmCancel = () => {
    setShowCloseClsConfirm(false);
    setDeleteLogTopic(false);
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">运维观测</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-9 px-3 text-sm rounded-[4px] border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              style={{ colorScheme: 'light' }}
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          全方位守护系统稳定运行，从被动救火到主动防御
        </p>
        
      </div>

      {/* CLS 日志服务未开启提示 */}
      {!clsEnabled && (
        <>
          {/* CLS 提示弹框 */}
          <div className="bg-blue-50 border border-blue-200 rounded-[4px] p-6 mb-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">运维观测需要开启 CLS 日志服务</h3>
                <p className="text-xs text-blue-700">开启后，为您赠送3个月ClawPro 专属 CLS 日志服务免费额度，预估可覆盖 500台 Agent 机器3个月的日志用量；服务到期后，CLS 将按量计费。<a href="https://cloud.tencent.com/document/product/614/45802" target="_blank" className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">计费详情 <ArrowUpRight className="w-3 h-3" /></a></p>
              </div>
              <Button
                onClick={handleOpenCLS}
                disabled={isEnablingCls}
                className="ml-4 text-xs h-8 px-4 whitespace-nowrap flex-shrink-0"
              >
                {isEnablingCls ? "开启中..." : "开启 CLS 日志服务"}
              </Button>
            </div>
          </div>



          {/* CLS 协议确认弹窗 */}
          <Dialog open={showClsAgreementDialog} onOpenChange={setShowClsAgreementDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>确认免费额度</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="cls-agreement"
                    checked={clsAgreed}
                    onChange={(e) => setClsAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="cls-agreement" className="text-sm text-gray-700 cursor-pointer flex-1">
                    为您赠送三个月ClawPro 专属 CLS 日志服务免费额度，预估可覆盖 700 台 Agent 机器的日志用量；服务到期后，CLS 将按量计费。<a href="https://cloud.tencent.com/document/product/614/45802" target="_blank" className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">计费详情 <ArrowUpRight className="w-3 h-3" /></a>
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowClsAgreementDialog(false);
                    setClsAgreed(false);
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirmClsAgreement}
                  disabled={!clsAgreed || isEnablingCls}
                >
                  {isEnablingCls ? "开启中..." : "确认"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 卡片功能展示 - 现有观测功能 + CLS 新增功能 */}
          <div className="space-y-6 mb-8">
            {/* 第一块：CLS 新增功能 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">开启CLS日志服务后您可以在此处获得以下观测数据：</h4>
              <div className="grid grid-cols-2 gap-4">
                {EXISTING_OBSERVATION_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow"
                      style={{
                        boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0"
                          style={{ background: card.color }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-gray-900 mb-1">
                            {card.title}
                          </h5>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 分割线 */}
            <div className="border-t border-gray-200" />

            {/* 第二块：CLS 新增功能 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">开启CLS日志服务后您还可以在Tokens监控和运维观测页面中获得以下观测数据：</h4>
              <div className="grid grid-cols-2 gap-4">
                {CLS_NEW_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      className="bg-white rounded-[4px] border border-gray-100 p-4 hover:shadow-md transition-shadow"
                      style={{
                        boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0"
                          style={{ background: card.color }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-gray-900 mb-1">
                            {card.title}
                          </h5>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* CLS 采集插件升级对话框 - 移到条件外以便一直可用 */}
      <Dialog open={showPluginUpgradeDialog} onOpenChange={setShowPluginUpgradeDialog}>
        <DialogContent className="max-w-10xl">
          <DialogHeader>
            <DialogTitle>升级 CLS 采集插件</DialogTitle>
            <DialogDescription>选择要升级的版本并查看更新内容</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700" style={{ width: '100px' }}>版本号</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700" style={{ flex: 1 }}>更新内容</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700" style={{ width: '100px' }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {CLS_PLUGIN_VERSIONS.map((v) => {
                  // 只允许选择比当前版本（v3）更高的版本
                  const isUpgradeable = v.status !== 'current' && v.status !== 'deprecated';
                  return (
                  <tr
                    key={v.version}
                    onClick={() => isUpgradeable && setSelectedPluginVersion(v)}
                    className={`border-b border-gray-100 ${
                      isUpgradeable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    } transition-colors ${
                      selectedPluginVersion?.version === v.version
                        ? "bg-blue-50"
                        : isUpgradeable ? "hover:bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap" style={{ width: '100px' }}>{v.version}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap" style={{ flex: 1 }}>{v.changelog}</td>
                    <td className="px-3 py-2 text-center" style={{ width: '100px' }}>
                      {v.status === 'current' && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">当前版本</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPluginUpgradeDialog(false);
                setSelectedPluginVersion(null);
              }}
              disabled={isUpgradingPlugin}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                setIsUpgradingPlugin(true);
                setTimeout(() => {
                  setIsUpgradingPlugin(false);
                  setShowPluginUpgradeDialog(false);
                  if (selectedPluginVersion) {
                    toast.success(`成功升级到 ${selectedPluginVersion?.version}`);
                  }
                }, 2000);
              }}
              disabled={isUpgradingPlugin || !selectedPluginVersion || selectedPluginVersion?.status === 'current'}
            >
              {isUpgradingPlugin ? "升级中..." : "确认升级"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLS 开启成功提示 */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-[4px] px-4 py-3 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 max-w-md">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">✓</div>
            <div>
              <p className="text-sm font-medium text-green-800">CLS 日志服务开启成功</p>
            </div>
          </div>
        </div>
      )}

      {/* 已开启时显示搜索框 + 关闭button */}
      {clsEnabled && (
        <div className="flex items-start justify-between mb-6 gap-4">
          {/* 左侧：Agent 名称筛选 */}
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700 block mb-2">Agent名称：</label>
            <AgentCombobox
              value={selectedAgent}
              onValueChange={setSelectedAgent}
              className="max-w-xs"
            />
          </div>
            {/* 右侧：升级和关闭CLS按钮 */}
          <div className="flex gap-2 mt-6">
            <Button
              onClick={() => setShowPluginUpgradeDialog(true)}
              variant="outline"
              className="text-xs h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 bg-white"
            >
              升级CLS采集插件
            </Button>
            <Button
              onClick={() => setShowCloseClsConfirm(true)}
              variant="outline"
              className="text-xs h-8 px-3 text-red-600 border-red-200 hover:bg-white bg-white"
            >
              关闭CLS服务
            </Button>
          </div>
        </div>
      )}

      {/* Metric Cards - 仅在 CLS 启用时显示 */}
      {clsEnabled && (
        <>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {METRIC_CARDS.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white rounded-[4px] border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-gray-500">{card.title}</span>
                <div className="w-8 h-8 rounded-[4px] flex items-center justify-center" style={{ background: card.color }}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-xs text-gray-400">{card.unit}</div>
            </div>
          );
        })}
      </div>

      {/* Application Logs Dashboard */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">应用日志大盘</h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Log Level Distribution */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">日志级别分布</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={logLevelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Log Module Distribution */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">日志模块分布</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={logModuleData} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* OTEL Metrics Dashboard */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">OTEL 指标大盘</h2>
        <div className="grid grid-cols-3 gap-6">
          {/* Message Processing */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="group relative">
                <h3 className="text-sm font-semibold text-gray-900 cursor-help">消息处理</h3>
                <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  已处理完成：已成功处理完成的消息数量；等待处理：等待处理的消息数量
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={messageProcessData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="processed" name="已处理完成的消息数量" stroke="#10B981" dot={false} />
                <Line type="monotone" dataKey="queued" name="等待处理的消息数量" stroke="#3B82F6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs flex-wrap">
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
                  <span className="text-gray-600">已处理完成的消息数量</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  已成功处理完成的消息数量
                </div>
              </div>
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
                  <span className="text-gray-600">等待处理的消息数量</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  等待处理的消息数量
                </div>
              </div>
            </div>
          </div>

          {/* Queue Status */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="group relative">
                <h3 className="text-sm font-semibold text-gray-900 cursor-help">队列状态</h3>
                <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded px-2 py-1 z-10 w-max">
                  <div>队列长度 P95：95% 的时间队列长度不超过此值，反映队列拥堵程度</div>
                  <div>等待时间 P95：95% 的消息等待时间不超过此值，反映队列延迟</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={queueStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="depth_avg" name="队列长度 P95" stroke="#8B5CF6" dot={false} />
                <Line type="monotone" dataKey="wait_ms_avg" name="等待时间 P95" stroke="#06B6D4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs flex-wrap">
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                  <span className="text-gray-600">队列长度 P95</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  95% 的时间队列长度不超过此值，反映队列拥堵程度
                </div>
              </div>
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#06B6D4' }} />
                  <span className="text-gray-600">等待时间 P95</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  95% 的消息等待时间不超过此值，反映队列延迟
                </div>
              </div>
            </div>
          </div>

          {/* Run Duration */}
          <div className="bg-white rounded-[4px] border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="group relative">
                <h3 className="text-sm font-semibold text-gray-900 cursor-help">执行耗时</h3>
                <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded px-2 py-1 z-10 w-max">
                  <div>处理耗时 P50：50% 的消息处理时间不超过此值，反映最差场景性能与边缘业务的延迟风险</div>
                  <div>处理耗时 P95：95% 的消息处理时间不超过此值，反映典型处理性能与大部分业务的实际延迟体验</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={runDurationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="run_duration_p50" name="处理耗时 P50" stroke="#F59E0B" dot={false} />
                <Line type="monotone" dataKey="run_duration_p95" name="处理耗时 P95" stroke="#EF4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs flex-wrap">
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                  <span className="text-gray-600">处理耗时 P50</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  50% 的消息处理时间不超过此值，反映最差场景性能与边缘业务的延迟风险
                </div>
              </div>
              <div className="group relative cursor-help inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                  <span className="text-gray-600">处理耗时 P95</span>
                </span>
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 bg-gray-900 text-white rounded px-2 py-1 z-50 w-max whitespace-nowrap text-xs">
                  95% 的消息处理时间不超过此值，反映典型处理性能与大部分业务的实际延迟体验
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

        {/* CLS 授权 Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>开通服务授权</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            {!isCheckingAuth && !authCompleted && (
              <p className="text-sm text-gray-700">开启CLS日志服务后您可以获取会话数据和观测数据</p>
            )}
            <div className="space-y-3 flex flex-col items-center min-h-16 justify-center">
              {isCheckingAuth ? (
                <>
                  {/* 检测中的旋转动画 */}
                  <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 text-center">检测中...</p>
                </>
              ) : authCompleted ? (
                <>
                  {/* 检测完成后显示完成 icon */}
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <p className="text-xs text-gray-500 text-center">检测到已授权</p>
                </>
              ) : null}
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancelAuth}>
              取消
            </Button>
            <Button
              onClick={handleGoToAuth}
            >
              前往授权
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 免费额度 Dialog */}
      <Dialog open={showFreeQuotaDialog} onOpenChange={setShowFreeQuotaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>免费额度说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="bg-blue-50 border border-blue-200 rounded-[4px] p-4 space-y-2">
              <p className="text-sm text-gray-700">
                为您赠送<span className="font-semibold text-blue-600">3个月</span>ClawPro 专属 CLS 日志服务免费额度（共<span className="font-semibold text-blue-600">3000U</span>），预估可覆盖 <span className="font-semibold text-blue-600">500台</span> Agent 机器<span className="font-semibold text-blue-600">3个月</span>的日志用量；超过免费额度达到上限或<span className="font-semibold text-blue-600">3个月</span>到期后，CLS 将按量计费。计费详情请参考{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleGoToCalcDetail();
                  }}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  计费详情
                </a>
                。
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={freeQuotaAgreed}
                onChange={(e) => setFreeQuotaAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">我已阅读并同意免费额度说明</span>
            </label>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancelFreeQuota}>
              取消
            </Button>
            <Button
              onClick={handleConfirmFreeQuota}
              disabled={!freeQuotaAgreed}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关闭CLS确认对话框 */}
      <Dialog open={showCloseClsConfirm} onOpenChange={setShowCloseClsConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确定要关闭 CLS 日志服务吗？</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <p className="text-sm text-gray-600">关闭后以下功能将无法使用：</p>
            <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 space-y-2">
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">运维观测：</span>
                <span>支持通过全链路性能监控采集核心运行指标</span>
              </div>
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">会话管理：</span>
                <span>支持通过会话总览、会话链下钻还原及渠道模型分布分析</span>
              </div>
              <div className="text-xs text-gray-700">
                <span className="font-semibold text-red-700">Tokens 监控（按会话）：</span>
                <span>支持从按会话、消息维度查看 tokens、费用使用情况</span>
              </div>
            </div>

            {/* 删除日志主题资源选项 */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="deleteLogTopic" 
                  checked={deleteLogTopic}
                  onCheckedChange={(checked) => setDeleteLogTopic(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="deleteLogTopic" className="text-sm font-medium text-gray-900 cursor-pointer">
                    删除关联的日志主题资源
                  </Label>
                  <div className="space-y-1.5">
                    <div className="flex gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>勾选后将永久删除该日志主题及所有日志数据，数据不可恢复。</span>
                    </div>
                    <div className="flex gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>未删除的日志主题资源会持续产生存储费用。</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCloseClsConfirmCancel}>
              取消
            </Button>
            <Button
              onClick={handleCloseCls}
              disabled={isClosingCls}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClosingCls ? "关闭中..." : "确定关闭"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
