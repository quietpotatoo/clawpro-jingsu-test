/**
 * ToolsMcpPanel - 用户端工具管理 Tab · MCP 配置面板
 * 三列布局：第一列 MCP 配置列表 | 第二列留空 | 第三列留空
 */
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceCard } from "@/components/ui/Surface";
import {
  Search,
  Plus,
  RefreshCw,
  Code2,
  Trash2,
  Info,
  CheckCircle2,
  XCircle,
  Wrench,
  AlignLeft,
  Globe,
  Terminal,
  Copy,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

// ── 类型定义 ──────────────────────────────────────────

/** 用户端 MCP 配置项 */
interface UserMCP {
  id: string;
  serverName: string;
  displayName: string;
  description: string;
  /** 连接类型：stdio=本地命令，sse/streamable-http=远程服务 */
  transportType: "stdio" | "sse" | "streamable-http";
  /** 连接状态 */
  status: "connected" | "failed";
  /** 是否启用 */
  enabled: boolean;
  /** 工具列表（仅连接成功时有值） */
  tools: string[];
  /** 报错信息（仅连接失败时有值） */
  errorMessage?: string;
  /** 完整 JSON 配置 */
  configJson: string;
  /** 用户自填参数 */
  userParams: Record<string, string>;
}

/** 企业 MCP 模板（供选配） */
interface EnterpriseMCPTemplate {
  id: string;
  serverName: string;
  displayName: string;
  description: string;
  /** 需用户填写的参数名列表 */
  userRequiredParams: string[];
  /** 完整 JSON 配置模板 */
  configJsonTemplate: string;
}

// ── Mock 数据 ──────────────────────────────────────────

const MOCK_ENTERPRISE_MCP_TEMPLATES: EnterpriseMCPTemplate[] = [
  {
    id: "tpl-1",
    serverName: "gongfeng",
    displayName: "工蜂 MCP 服务",
    description: "通过 MCP 协议连接工蜂代码仓库，支持代码搜索、文件浏览、PR 管理等操作",
    userRequiredParams: ["your-gongfeng-token"],
    configJsonTemplate: JSON.stringify({
      mcp: {
        servers: {
          gongfeng: {
            url: "https://gongfeng.example.com/mcp/sse",
            transportType: "sse",
            headers: { Authorization: "<your-gongfeng-token>" },
            timeout: 60,
          },
        },
      },
    }, null, 2),
  },
  {
    id: "tpl-2",
    serverName: "iwiki",
    displayName: "iWiki 文档服务",
    description: "连接 iWiki 知识库平台，支持文档搜索、内容获取等操作",
    userRequiredParams: ["your-iwiki-token"],
    configJsonTemplate: JSON.stringify({
      mcp: {
        servers: {
          iwiki: {
            url: "https://iwiki.example.com/mcp",
            transportType: "streamable-http",
            headers: { Authorization: "<your-iwiki-token>" },
            timeout: 60,
          },
        },
      },
    }, null, 2),
  },
  {
    id: "tpl-3",
    serverName: "tapd",
    displayName: "TAPD 项目管理",
    description: "连接 TAPD 项目管理平台，支持需求查询、缺陷管理、迭代跟踪等功能",
    userRequiredParams: ["your-tapd-token"],
    configJsonTemplate: JSON.stringify({
      mcp: {
        servers: {
          tapd: {
            url: "https://tapd.example.com/mcp/sse",
            transportType: "sse",
            headers: { Authorization: "Bearer <your-tapd-token>" },
            timeout: 90,
          },
        },
      },
    }, null, 2),
  },
  {
    id: "tpl-4",
    serverName: "cos-storage",
    displayName: "COS 对象存储",
    description: "通过 MCP 协议访问腾讯云 COS 存储桶，支持文件上传、下载、列表等操作",
    userRequiredParams: ["secret-id", "secret-key"],
    configJsonTemplate: JSON.stringify({
      mcp: {
        servers: {
          "cos-storage": {
            url: "https://cos-mcp.example.com/sse",
            transportType: "sse",
            headers: {
              "X-Secret-Id": "<secret-id>",
              "X-Secret-Key": "<secret-key>",
            },
            timeout: 120,
          },
        },
      },
    }, null, 2),
  },
  {
    id: "tpl-5",
    serverName: "wedata",
    displayName: "WeData 数据开发",
    description: "连接 WeData 数据开发治理平台，支持任务查询、数据预览、血缘分析等",
    userRequiredParams: [],
    configJsonTemplate: JSON.stringify({
      mcp: {
        servers: {
          wedata: {
            url: "https://wedata-mcp.example.com/mcp",
            transportType: "streamable-http",
            timeout: 60,
          },
        },
      },
    }, null, 2),
  },
];

const INITIAL_USER_MCPS: UserMCP[] = [
  {
    id: "u-0",
    serverName: "iwiki",
    displayName: "iWiki 文档服务",
    description: "连接 iWiki 知识库平台，支持文档搜索、内容获取等操作",
    transportType: "streamable-http",
    status: "connected",
    enabled: true,
    tools: ["tool_1", "tool_2", "tool_3"],
    configJson: JSON.stringify({
      mcp: {
        servers: {
          iwiki: {
            url: "https://iwiki.example.com/mcp",
            transportType: "streamable-http",
            headers: { Authorization: "iwiki_token_xxx" },
            timeout: 60,
          },
        },
      },
    }, null, 2),
    userParams: { "your-iwiki-token": "iwiki_token_xxx" },
  },
  {
    id: "u-1",
    serverName: "gongfeng",
    displayName: "工蜂 MCP 服务",
    description: "通过 MCP 协议连接工蜂代码仓库，支持代码搜索、文件浏览、PR 管理等操作",
    transportType: "sse",
    status: "connected",
    enabled: true,
    tools: ["search_projects", "get_blob_content", "create_merge_request", "list_branches", "get_commit_info", "get_file_tree", "compare_branches", "list_merge_requests", "get_pipeline_status", "trigger_build"],
    configJson: JSON.stringify({
      mcp: {
        servers: {
          gongfeng: {
            url: "https://gongfeng.example.com/mcp/sse",
            transportType: "sse",
            headers: { Authorization: "ghp_abc123456789" },
            timeout: 60,
          },
        },
      },
    }, null, 2),
    userParams: { "your-gongfeng-token": "ghp_abc123456789" },
  },
  {
    id: "u-2",
    serverName: "tapd",
    displayName: "TAPD 项目管理",
    description: "连接 TAPD 项目管理平台，支持需求查询、缺陷管理、迭代跟踪等功能",
    transportType: "sse",
    status: "failed",
    enabled: true,
    tools: [],
    errorMessage: "连接超时：无法在 90s 内建立 SSE 连接，请检查网络或 Token 是否正确",
    configJson: JSON.stringify({
      mcp: {
        servers: {
          tapd: {
            url: "https://tapd.example.com/mcp/sse",
            transportType: "sse",
            headers: { Authorization: "Bearer invalid_token_xxx" },
            timeout: 90,
          },
        },
      },
    }, null, 2),
    userParams: { "your-tapd-token": "invalid_token_xxx" },
  },
  {
    id: "u-3",
    serverName: "your-mcp",
    displayName: "",
    description: "用户自定义的本地 MCP 服务",
    transportType: "stdio",
    status: "connected",
    enabled: true,
    tools: ["custom_tool_a", "custom_tool_b"],
    configJson: JSON.stringify({
      mcp: {
        servers: {
          "your-mcp": {
            command: "npx",
            args: ["-y", "your-mcp-server"],
            transportType: "stdio",
            timeout: 30,
          },
        },
      },
    }, null, 2),
    userParams: {},
  },
];

// ── 辅助函数 ──────────────────────────────────────────

/** 整理缩进：移除所有行的最小公共前导空白，清理尾部空行 */
function trimCommonIndent(text: string): string {
  const lines = text.replace(/\t/g, '    ').split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  if (nonEmptyLines.length === 0) return text;
  const minIndent = Math.min(...nonEmptyLines.map(l => l.match(/^(\s*)/)?.[1].length ?? 0));
  if (minIndent === 0) return text;
  const trimmed = lines.map(l => (l.trim().length > 0 ? l.slice(minIndent) : '')).join('\n');
  return trimmed.replace(/\n+$/, '');
}

/** 从完整 JSON 中提取指定 server 的内部内容（不含 key 和外层花括号） */
function extractServerValue(fullJson: string, serverName: string): string {
  try {
    const parsed = JSON.parse(fullJson);
    const server = parsed?.mcp?.servers?.[serverName];
    if (!server || typeof server !== 'object') return '';
    const inner = JSON.stringify(server, null, 2);
    const lines = inner.split('\n');
    if (lines.length <= 2) return '';
    return lines.slice(1, -1).map(l => l.replace(/^  /, '')).join('\n');
  } catch {
    return '';
  }
}

/** 将用户编辑的 server 内部内容组装成完整 JSON 字符串 */
function assembleFullJson(serverName: string, serverValueContent: string): string {
  const indentedLines = serverValueContent
    .split('\n')
    .map(line => (line.trim() ? `        ${line}` : ''))
    .join('\n');
  const escapedName = JSON.stringify(serverName);
  return `{\n  "mcp": {\n    "servers": {\n      ${escapedName}: {\n${indentedLines}\n      }\n    }\n  }\n}`;
}

// ── 组件 ──────────────────────────────────────────────

export default function ToolsMcpPanel() {
  // ── 列表状态 ──
  const [mcpList, setMcpList] = useState<UserMCP[]>(INITIAL_USER_MCPS);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  /** 展开工具列表的 MCP id */
  const [expandedToolsId, setExpandedToolsId] = useState<string | null>(null);
  /** 记录每个 MCP 工具列表是否溢出两行 */
  const [overflowMap, setOverflowMap] = useState<Record<string, boolean>>({});
  /** 工具列表容器 ref */
  const toolsRefMap = useRef<Record<string, HTMLDivElement | null>>({});

  // ── 添加 MCP 弹窗 ──
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  /** 当前需填写参数的模板 */
  const [paramTemplate, setParamTemplate] = useState<EnterpriseMCPTemplate | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // ── 查看源码弹窗 ──
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  /** 可编辑的 server 内部字段内容 */
  const [sourceEditorContent, setSourceEditorContent] = useState("");
  const [sourceServerName, setSourceServerName] = useState("");
  const [sourceDisplayName, setSourceDisplayName] = useState("");
  const [sourceMcpId, setSourceMcpId] = useState<string | null>(null);
  const [sourceJsonError, setSourceJsonError] = useState("");

  // ── 删除确认 ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMcpId, setDeleteMcpId] = useState<string | null>(null);

  // ── 重启确认（删除/保存源码/切换开关后弹出） ──
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restartAction, setRestartAction] = useState<"delete" | "save" | "toggle">("save");
  /** 切换开关时记录的 MCP id，取消修改时需要回退 */
  const [toggleRevertId, setToggleRevertId] = useState<string | null>(null);

  // ── 检测工具列表是否溢出两行 ──
  const checkOverflow = useCallback(() => {
    const newMap: Record<string, boolean> = {};
    mcpList.forEach((mcp) => {
      const el = toolsRefMap.current[mcp.id];
      if (el) {
        // scrollHeight 是内容真实高度，clientHeight 是 maxHeight 限制后的可见高度
        newMap[mcp.id] = el.scrollHeight > el.clientHeight + 1;
      }
    });
    setOverflowMap(newMap);
  }, [mcpList]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => checkOverflow());
    return () => cancelAnimationFrame(raf);
  }, [checkOverflow]);

  useEffect(() => {
    const observer = new ResizeObserver(() => checkOverflow());
    Object.values(toolsRefMap.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [checkOverflow]);

  // ── 过滤 ──
  const filteredList = mcpList.filter(
    (m) =>
      m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.serverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── 刷新状态 ──
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      // Mock：随机切换一些 MCP 的连接状态
      setMcpList((prev) =>
        prev.map((m) => {
          if (!m.enabled) return m;
          const rand = Math.random();
          if (rand > 0.7) {
            return {
              ...m,
              status: m.status === "connected" ? "failed" : "connected",
              tools: m.status === "connected" ? [] : ["tool_a", "tool_b"],
              errorMessage: m.status === "connected" ? "连接超时，请检查网络配置" : undefined,
            };
          }
          return m;
        })
      );
      setRefreshing(false);
      toast.success("技能列表已刷新");
    }, 1000);
  }, []);

  // ── 单条刷新连接状态 ──
  const [refreshingSingleId, setRefreshingSingleId] = useState<string | null>(null);
  const handleRefreshSingle = useCallback((mcpId: string) => {
    setRefreshingSingleId(mcpId);
    setTimeout(() => {
      setMcpList((prev) =>
        prev.map((m) => {
          if (m.id !== mcpId || !m.enabled) return m;
          // Mock：随机切换连接状态
          const newStatus = Math.random() > 0.3 ? "connected" : "failed";
          return {
            ...m,
            status: newStatus as "connected" | "failed",
            tools: newStatus === "connected" ? (m.tools.length > 0 ? m.tools : ["tool_a", "tool_b"]) : [],
            errorMessage: newStatus === "failed" ? "连接超时，请检查网络配置" : undefined,
          };
        })
      );
      setRefreshingSingleId(null);
      toast.success("连接状态已刷新");
    }, 800);
  }, []);

  // ── 添加 MCP ──
  const alreadyAddedNames = mcpList.map((m) => m.serverName);
  const availableTemplates = MOCK_ENTERPRISE_MCP_TEMPLATES.filter(
    (t) =>
      !alreadyAddedNames.includes(t.serverName) &&
      (t.displayName.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(addSearchQuery.toLowerCase()))
  );

  const handleSelectTemplate = (tpl: EnterpriseMCPTemplate) => {
    if (tpl.userRequiredParams.length > 0) {
      setParamTemplate(tpl);
      setParamValues({});
    } else {
      // 无需填参数，直接添加
      doAddMCP(tpl, {});
    }
  };

  const doAddMCP = (tpl: EnterpriseMCPTemplate, params: Record<string, string>) => {
    // 替换模板中的 <xxx> 占位符
    let configJson = tpl.configJsonTemplate;
    Object.entries(params).forEach(([key, value]) => {
      configJson = configJson.replace(`<${key}>`, value);
    });

    const newMCP: UserMCP = {
      id: `u-${Date.now()}`,
      serverName: tpl.serverName,
      displayName: tpl.displayName,
      description: tpl.description,
      transportType: (() => {
        try {
          const parsed = JSON.parse(configJson);
          const server = parsed?.mcp?.servers?.[tpl.serverName];
          return server?.transportType || (server?.command ? "stdio" : "sse");
        } catch { return "sse"; }
      })() as "stdio" | "sse" | "streamable-http",
      status: "connected",
      enabled: true,
      tools: ["tool_1", "tool_2", "tool_3"],
      configJson,
      userParams: params,
    };
    setMcpList((prev) => [newMCP, ...prev]);
    setParamTemplate(null);
    setAddDialogOpen(false);
    setAddSearchQuery("");
    toast.success(`MCP「${tpl.displayName}」已添加`);
  };

  // ── 查看源码 ──
  const handleOpenSource = (mcp: UserMCP) => {
    setSourceServerName(mcp.serverName);
    setSourceDisplayName(mcp.displayName || mcp.serverName);
    // 提取 server 内部字段作为可编辑内容
    const inner = extractServerValue(mcp.configJson, mcp.serverName);
    setSourceEditorContent(inner);
    setSourceMcpId(mcp.id);
    setSourceJsonError("");
    setSourceDialogOpen(true);
  };

  const handleSaveSource = (restart: boolean) => {
    // 组装完整 JSON 并校验
    const fullJson = assembleFullJson(sourceServerName, sourceEditorContent);
    try {
      JSON.parse(fullJson);
    } catch {
      setSourceJsonError("JSON 格式错误，无法保存");
      return;
    }
    // 保存配置
    setMcpList((prev) =>
      prev.map((m) => (m.id === sourceMcpId ? { ...m, configJson: fullJson } : m))
    );
    setSourceDialogOpen(false);
    if (restart) {
      toast.success("已保存，正在重启实例…");
      setTimeout(() => toast.success("重启完成"), 2000);
    } else {
      toast("已保存，可稍后手动重启生效");
    }
  };

  // ── 删除 ──
  const handleDelete = (mcpId: string) => {
    setDeleteMcpId(mcpId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = (restart: boolean) => {
    if (!deleteMcpId) return;
    const mcp = mcpList.find((m) => m.id === deleteMcpId);
    setMcpList((prev) => prev.filter((m) => m.id !== deleteMcpId));
    setDeleteDialogOpen(false);
    setDeleteMcpId(null);
    if (restart) {
      toast.success(`MCP「${mcp?.displayName || mcp?.serverName}」已删除，正在重启实例…`);
      setTimeout(() => toast.success("重启完成"), 2000);
    } else {
      toast.success(`MCP「${mcp?.displayName || mcp?.serverName}」已删除，可稍后手动重启生效`);
    }
  };

  // ── 开启/关闭 ──
  const handleToggle = (mcpId: string) => {
    setMcpList((prev) =>
      prev.map((m) => {
        if (m.id !== mcpId) return m;
        return { ...m, enabled: !m.enabled };
      })
    );
    setToggleRevertId(mcpId);
    setRestartAction("toggle");
    setRestartDialogOpen(true);
  };

  const handleRestartCancel = () => {
    // 「取消修改」仅在 toggle 时回退
    if (restartAction === "toggle" && toggleRevertId) {
      setMcpList((prev) =>
        prev.map((m) => {
          if (m.id !== toggleRevertId) return m;
          return { ...m, enabled: !m.enabled };
        })
      );
    }
    setRestartDialogOpen(false);
    setToggleRevertId(null);
  };

  const handleRestartLater = () => {
    setRestartDialogOpen(false);
    setToggleRevertId(null);
    toast("已保存，可稍后手动重启生效");
  };

  const handleRestartNow = () => {
    setRestartDialogOpen(false);
    setToggleRevertId(null);
    toast.success("正在重启实例…");
    setTimeout(() => toast.success("重启完成"), 2000);
  };

  const deleteMcp = mcpList.find((m) => m.id === deleteMcpId);

  // ── 渲染 ──
  return (
    <div className="grid grid-cols-3 gap-5" style={{ minHeight: 0, alignItems: "start" }}>
      {/* ===== 第一列：MCP 配置 ===== */}
      <SurfaceCard
        className="overflow-hidden flex flex-col"
        style={{ height: "749px" }}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-50">
          <div className="flex items-center gap-2 justify-center">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">MCP 配置</h2>
          </div>
        </div>

        {/* 操作栏 */}
        <div className="px-4 pt-4 pb-2 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="搜索 MCP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
            <button
              onClick={() => setAddDialogOpen(true)}
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:border-blue-300 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          {/* 提示 */}
          <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2">
            <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-600 leading-relaxed">
              状态验证仅支持公网访问的 MCP。
              <br />
              本地命令或者内网访问的MCP，需登录实例校验状态。
            </p>
          </div>
        </div>

        {/* 列表区域 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredList.length === 0 ? (
            <div className="text-center py-16">
              <Wrench className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-3">暂无 MCP 配置</p>
              <button
                onClick={() => setAddDialogOpen(true)}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                + 添加 MCP
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredList.map((mcp) => {
                const isExpanded = expandedToolsId === mcp.id;
                return (
                  <div
                    key={mcp.id}
                    className={`rounded-xl border transition-all ${
                      !mcp.enabled
                        ? "border-gray-100 bg-gray-50/50 opacity-60"
                        : mcp.status === "connected"
                          ? "border-gray-100 bg-white hover:border-blue-300 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)]"
                          : "border-red-100 bg-red-50/30 hover:border-red-200"
                    }`}
                    style={{
                      boxShadow: mcp.enabled
                        ? "0 1px 2px rgba(0,0,0,0.04)"
                        : "none",
                    }}
                  >
                    <div className="p-3">
                      {/* 第一行：图标+名称+状态+开关 */}
                      <div className="flex items-center gap-2">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {mcp.transportType === "stdio" ? (
                                <Terminal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              ) : (
                                <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {mcp.transportType === "stdio" ? "本地命令" : "远程服务"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="font-medium text-sm text-gray-900 truncate flex-1">
                          {mcp.displayName || mcp.serverName}
                        </span>
                        {/* 状态指示 */}
                        {mcp.enabled ? (
                          mcp.status === "connected" ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-600 shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              已连接
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-red-500 shrink-0">
                              <XCircle className="w-3 h-3" />
                              连接失败
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-gray-400 shrink-0">已关闭</span>
                        )}
                        <Switch
                          checked={mcp.enabled}
                          onCheckedChange={() => handleToggle(mcp.id)}
                        />
                      </div>

                      {/* 第二行：描述（左）+ 源码/删除按钮（右） */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-gray-500 truncate flex-1 min-w-0 leading-relaxed cursor-default">
                                {mcp.description || "用户自定义 MCP"}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="text-xs max-w-[280px]">
                              {mcp.description || "用户自定义 MCP"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {/* 刷新技能连接状态 */}
                        <TooltipProvider delayDuration={1000}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRefreshSingle(mcp.id)}
                                disabled={refreshingSingleId === mcp.id}
                                className="w-6 h-6 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshingSingleId === mcp.id ? "animate-spin" : ""}`} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">刷新技能连接状态</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {/* 查看源码 */}
                        <button
                          onClick={() => handleOpenSource(mcp)}
                          className="w-6 h-6 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0"
                          title="查看源码"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </button>
                        {/* 删除 */}
                        <button
                          onClick={() => handleDelete(mcp.id)}
                          className="w-6 h-6 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 第三行：工具列表（已连接时显示，收起时限高两行+右下角展开按钮） */}
                      {mcp.enabled && mcp.status === "connected" && mcp.tools.length > 0 && (
                        <div className="mt-1.5 relative">
                          {/* 工具标签容器 */}
                          <div
                            ref={(el) => { toolsRefMap.current[mcp.id] = el; }}
                            className={`flex flex-wrap gap-1 ${!isExpanded ? "overflow-hidden" : ""}`}
                            style={!isExpanded ? { maxHeight: "46px" } : undefined}
                          >
                            {mcp.tools.map((tool) => (
                              <span
                                key={tool}
                                className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-mono rounded whitespace-nowrap"
                              >
                                {tool}
                              </span>
                            ))}
                            {/* 展开后：收起按钮混排在最后一个标签后面 */}
                            {isExpanded && (
                              <button
                                onClick={() => setExpandedToolsId(null)}
                                className="inline-block px-1.5 py-0.5 text-blue-500 hover:text-blue-600 text-[10px] font-medium whitespace-nowrap"
                              >
                                收起
                              </button>
                            )}
                          </div>
                          {/* 未展开 + 有溢出时：右下角绝对定位"展开全部"按钮，带白色渐变遮罩 */}
                          {overflowMap[mcp.id] && !isExpanded && (
                            <button
                              onClick={() => setExpandedToolsId(mcp.id)}
                              className="absolute right-0 bottom-[3px] flex items-center pl-6 pr-0.5 py-0.5 text-blue-500 hover:text-blue-600 text-[10px] font-medium whitespace-nowrap"
                              style={{ background: "linear-gradient(to right, transparent, white 30%)" }}
                            >
                              展开全部
                            </button>
                          )}
                        </div>
                      )}

                      {/* 报错信息（连接失败时展示，独立行+复制按钮） */}
                      {mcp.enabled && mcp.status === "failed" && mcp.errorMessage && (
                        <div className="mt-1.5 flex items-start gap-1.5 px-2.5 py-1.5 bg-red-50 rounded-lg">
                          <p className="text-[11px] text-red-500 leading-relaxed flex-1 min-w-0 line-clamp-2">
                            {mcp.errorMessage}
                          </p>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(mcp.errorMessage || "");
                                    toast.success("已复制错误信息");
                                  }}
                                  className="w-5 h-5 rounded text-red-400 hover:text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors shrink-0 mt-0.5"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">复制错误信息</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SurfaceCard>

      {/* ===== 第二列：留空 ===== */}
      <div />

      {/* ===== 第三列：留空 ===== */}
      <div />

      {/* ===== 添加 MCP 弹窗 — 步骤1：选择 ===== */}
      <Dialog open={addDialogOpen && !paramTemplate} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加 MCP</DialogTitle>
            <DialogDescription>从企业已配置的 MCP 中选配</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索名称或描述..."
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {alreadyAddedNames.length === MOCK_ENTERPRISE_MCP_TEMPLATES.length
                    ? "所有企业 MCP 均已添加"
                    : "没有匹配的 MCP"}
                </p>
              ) : (
                availableTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tpl.displayName}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {tpl.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectTemplate(tpl)}
                      className="w-7 h-7 rounded-md bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 添加 MCP 弹窗 — 步骤2：填写参数 ===== */}
      <Dialog
        open={!!paramTemplate}
        onOpenChange={(open) => {
          if (!open) setParamTemplate(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>填写参数</DialogTitle>
            <DialogDescription>
              「{paramTemplate?.displayName}」需要您填写以下参数
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paramTemplate?.userRequiredParams.map((param) => (
              <div key={param} className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">{param}</label>
                <Input
                  placeholder={`请输入 ${param}`}
                  type="password"
                  value={paramValues[param] || ""}
                  onChange={(e) =>
                    setParamValues((prev) => ({ ...prev, [param]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="claw-outline" onClick={() => setParamTemplate(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!paramTemplate) return;
                const allFilled = paramTemplate.userRequiredParams.every(
                  (p) => (paramValues[p] || "").trim().length > 0
                );
                if (!allFilled) {
                  toast.error("请填写所有必填参数");
                  return;
                }
                doAddMCP(paramTemplate, paramValues);
              }}
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
              className="text-white"
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 查看源码弹窗 ===== */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>查看源码</DialogTitle>
            <DialogDescription>
              名称：{sourceDisplayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* 固化外层 + 可编辑 server 内部字段 的编辑器 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden font-mono text-xs">
              {/* 固定前缀行（不可编辑）— 灰色背景，只显示 "server-name": { */}
              <div className="bg-gray-50 text-gray-400 px-3 py-1.5 border-b border-gray-100 select-none leading-relaxed text-xs whitespace-pre">
                <div><span className="text-gray-500">{`"${sourceServerName}"`}</span>{': {'}</div>
              </div>
              {/* 可编辑区域 */}
              <div className="relative">
                {/* 整理缩进按钮 — 悬浮在编辑区右上角 */}
                <button
                        type="button"
                        onClick={() => setSourceEditorContent(trimCommonIndent(sourceEditorContent))}
                        className="absolute top-1.5 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <AlignLeft className="w-3 h-3" />
                        整理缩进
                      </button>
                <Textarea
                  value={sourceEditorContent}
                  onChange={(e) => {
                    setSourceEditorContent(e.target.value);
                    setSourceJsonError("");
                  }}
                  placeholder="请输入 server 配置字段"
                  className="border-0 rounded-none font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent focus:ring-0 focus:outline-none shadow-none resize-none overflow-auto leading-relaxed min-h-0"
                  style={{ paddingLeft: 'calc(0.75rem + 2ch)', fontSize: '12px', maxHeight: `${10 * 1.625}em` }}
                  spellCheck={false}
                />
              </div>
              {/* 固定后缀行（不可编辑）— 灰色背景 */}
              <div className="bg-gray-50 text-gray-400 px-3 py-1.5 border-t border-gray-100 select-none leading-relaxed text-xs whitespace-pre">
                <div>{'}'}</div>
              </div>
            </div>
            {sourceJsonError && (
              <p className="text-xs text-red-500">{sourceJsonError}</p>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="claw-outline" onClick={() => setSourceDialogOpen(false)} className="text-sm">
              取消
            </Button>
            <Button variant="claw-outline" onClick={() => handleSaveSource(false)}>
              保存但不重启
            </Button>
            <Button
              onClick={() => handleSaveSource(true)}
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
              className="text-white"
            >
              保存并重启实例
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 删除确认弹窗 ===== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>删除 MCP</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 <span className="font-medium text-gray-900">{deleteMcp?.displayName || deleteMcp?.serverName}</span> MCP，删除后将不可使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel className="text-sm">取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
              onClick={() => handleConfirmDelete(false)}
            >
              删除但不重启
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white text-sm"
              onClick={() => handleConfirmDelete(true)}
            >
              删除并重启实例
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== 重启确认弹窗（仅开关切换时弹出） ===== */}
      <Dialog open={restartDialogOpen} onOpenChange={(open) => { if (!open) handleRestartCancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>是否重启以生效？</DialogTitle>
            <DialogDescription>
              修改已保存，需要重启实例后才能生效。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            {restartAction === "toggle" && (
              <Button variant="claw-outline" onClick={handleRestartCancel} className="text-xs">
                取消修改
              </Button>
            )}
            <Button variant="claw-outline" onClick={handleRestartLater} className="text-xs">
              暂不重启
            </Button>
            <Button
              onClick={handleRestartNow}
              style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}
              className="text-white text-xs"
            >
              重启
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
