// Mock data for the OpenClaw Enterprise Platform

export const SITE_CONFIG = {
  name: "A企业企业版OpenClaw",
  description: "快速创建属于你的24小时AI私人助理",
  logo: "🦞",
  region: "广州",
  ip: "43.128.xx.xx",
  domain: "openclaw.a-company.com",
  tencentUin: "3205597606",
  websiteDescription: "企业级AI助理平台，让每位员工都拥有专属AI助手",
};

export const MOCK_OPENCLAW_LIST = [
  { id: "oc-001", instanceId: "ins-creating01",  name: "创建中示例",                                          creator: "alice@acompany.com",  status: "creating",    agentType: "openclaw",     createdAt: "2026-03-26 09:00:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-002", instanceId: "ins-createfail01", name: "创建失败示例",                                          creator: "bob@acompany.com",    status: "createFail",  agentType: "openclaw",     createdAt: "2026-03-26 09:05:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-003", instanceId: "ins-running01",    name: "运行中示例",                                          creator: "carol@acompany.com",  status: "running",     agentType: "openclaw",     createdAt: "2026-03-01 10:23:45", model: "腾讯云 DeepSeek", modelVersion: "DeepSeek V3 0324", channels: ["飞书"], skills: ["github 1.0.0"], roleName: "设计师" },
  { id: "oc-004", instanceId: "ins-loading01",    name: "加载中示例",                                          creator: "dave@acompany.com",   status: "loading",     agentType: "openclaw",     createdAt: "2026-03-26 09:10:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-005", instanceId: "ins-loadfail01",   name: "加载失败示例",                                          creator: "eve@acompany.com",    status: "loadFail",    agentType: "openclaw",     createdAt: "2026-03-26 09:15:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-006", instanceId: "ins-shutdown01",   name: "已关机示例",                                          creator: "frank@acompany.com",  status: "shutdown",    agentType: "openclaw",     createdAt: "2026-03-05 09:00:00", model: "腾讯云混元",   modelVersion: "混元 Turbo",     channels: [], skills: [], roleName: "开发工程师" },
  { id: "oc-007", instanceId: "ins-maintaining01",name: "维护中示例",                                          creator: "grace@acompany.com",  status: "maintaining", agentType: "openclaw",     createdAt: "2026-03-10 16:45:00", model: "腾讯云混元",   modelVersion: "混元 Pro",       channels: ["企业微信机器人"], skills: [], roleName: "项目经理" },
  { id: "oc-008", instanceId: "ins-pending01",    name: "待处理示例",                                          creator: "henry@acompany.com",  status: "pending",     agentType: "openclaw",     createdAt: "2026-03-26 09:20:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-009", instanceId: "ins-longname01",   name: "这是一个名称非常非常长的智能助手用来测试超长文本截断效果", creator: "ivy@acompany.com",    status: "running",     agentType: "openclaw",     createdAt: "2026-03-28 14:30:00", model: "腾讯云 DeepSeek", modelVersion: "DeepSeek V3 0324", channels: ["企业微信"], skills: ["github 1.0.0"], roleName: "办公能手" },
  { id: "oc-010", instanceId: "ins-hermes01",     name: "Hermes 示例",                                              creator: "jack@acompany.com",   status: "running",     agentType: "hermes",       createdAt: "2026-04-01 10:00:00", model: "",               modelVersion: "",           channels: [], skills: [], roleName: "设计师" },
  { id: "oc-011", instanceId: "ins-hermes02",     name: "Hermes 加载失败示例",                                      creator: "karen@acompany.com",  status: "loadFail",    agentType: "hermes",       createdAt: "2026-04-02 11:00:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-012", instanceId: "ins-lightclaw01",  name: "LightclawACE 示例",                                          creator: "leo@acompany.com",    status: "running",     agentType: "lightclawace", createdAt: "2026-04-03 09:30:00", model: "",               modelVersion: "",           channels: [], skills: [], roleName: "开发工程师" },
  { id: "oc-013", instanceId: "ins-lightclaw02",  name: "LightclawACE 创建中示例",                                      creator: "alice@acompany.com",  status: "creating",    agentType: "lightclawace", createdAt: "2026-04-04 14:00:00", model: "",               modelVersion: "",           channels: [], skills: [] },
  { id: "oc-014", instanceId: "ins-grpdemo01",   name: "多分组示例-前端组",                                            creator: "alice@acompany.com",  status: "running",     agentType: "openclaw",     createdAt: "2026-04-05 10:00:00", model: "腾讯云 DeepSeek", modelVersion: "DeepSeek V3 0324", channels: [], skills: [], groupId: "grp-fe", groupName: "A公司 / 技术部 / 前端组", roleName: "设计师" },
  { id: "oc-015", instanceId: "ins-grpdemo02",   name: "多分组示例-前端研发",                                            creator: "alice@acompany.com",  status: "running",     agentType: "openclaw",     createdAt: "2026-04-05 11:00:00", model: "腾讯云 DeepSeek", modelVersion: "DeepSeek V3 0324", channels: [], skills: [], groupId: "grp-custom", groupName: "前端研发同学", roleName: "项目经理" },
];

export const MOCK_MEMBERS = [
  {
    id: "alice@acompany.com",
    name: "Alice",
    role: "admin",
    status: "active",
    openclawLimit: 5,
    tokenLimit: 100000,
    openclawCount: 2,
    createdAt: "2026-01-15",
  },
  {
    id: "lisi@a-company.com",
    role: "member",
    status: "active",
    openclawLimit: 3,
    tokenLimit: 50000,
    openclawCount: 1,
    createdAt: "2026-01-20",
  },
  {
    id: "wangwu@a-company.com",
    role: "member",
    status: "active",
    openclawLimit: 3,
    tokenLimit: 50000,
    openclawCount: 3,
    createdAt: "2026-02-01",
  },
  {
    id: "zhaoliu@a-company.com",
    role: "member",
    status: "disabled",
    openclawLimit: 3,
    tokenLimit: 50000,
    openclawCount: 0,
    createdAt: "2026-02-10",
  },
];

export const MOCK_MODELS = [
  {
    id: "model-001",
    name: "腾讯云 DeepSeek",
    version: "DeepSeek V3 0324",
    apiKey: "sk-**********************a1b2",
    status: "connected",
    visible: true,
    dailyTokenLimit: 500000,
  },
  {
    id: "model-002",
    name: "腾讯云混元",
    version: "混元 Turbo",
    apiKey: "sk-**********************c3d4",
    status: "connected",
    visible: true,
    dailyTokenLimit: 300000,
  },
  {
    id: "model-003",
    name: "腾讯云 Coding Plan",
    version: "自动",
    apiKey: "sk-**********************e5f6",
    status: "disconnected",
    visible: false,
    dailyTokenLimit: 200000,
  },
];

export const MOCK_CHANNELS = [
  { id: "wework-bot", name: "企业微信机器人", icon: "💼", visible: true },
  { id: "wework-app", name: "企业微信应用", icon: "📱", visible: true },
  { id: "qq", name: "QQ", icon: "🐧", visible: true },
  { id: "feishu", name: "飞书", icon: "🪶", visible: true },
  { id: "dingtalk", name: "钉钉", icon: "📌", visible: false },
];

export const MOCK_DOCS = [
  {
    id: "doc-001",
    title: "OpenClaw 概念介绍",
    addedAt: "2026-01-01",
    addedBy: "系统默认",
    visible: true,
    isDefault: true,
  },
  {
    id: "doc-002",
    title: "企业版 OpenClaw 的功能与特色",
    addedAt: "2026-01-01",
    addedBy: "系统默认",
    visible: true,
    isDefault: true,
  },
  {
    id: "doc-003",
    title: "部署 OpenClaw 指引",
    addedAt: "2026-01-01",
    addedBy: "系统默认",
    visible: true,
    isDefault: true,
  },
  {
    id: "doc-004",
    title: "OpenClaw 进阶玩法",
    addedAt: "2026-01-01",
    addedBy: "系统默认",
    visible: true,
    isDefault: true,
  },
];

export const MOCK_IMAGES = [
  {
    id: "img-001",
    imageId: "img-20260101-001",
    name: "OpenClaw-Enterprise-v2.1",
    status: "active",
    type: "public" as const,
    agentType: "OpenClaw",
    agentVersion: "2026.3.28",
    os: "CentOS 7.9 64位",
    createdAt: "2026-01-15 10:00:00",
    active: true,
  },
  {
    id: "img-002",
    imageId: "img-20260201-002",
    name: "Hermes-Agent-v0.8",
    status: "active",
    type: "public" as const,
    agentType: "HermesAgent",
    agentVersion: "0.8.0",
    os: "Ubuntu 22.04 64位",
    createdAt: "2026-02-01 14:30:00",
    active: true,
  },
];

export const DEFAULT_INBOUND_RULES = [
  { source: "全部IPv4地址", protocol: "ICMP", port: "ALL", policy: "允许", remark: "放通Ping服务" },
  { source: "全部IPv4地址", protocol: "TCP", port: "22", policy: "允许", remark: "放通Linux SSH登录" },
  { source: "全部IPv4地址", protocol: "TCP", port: "80", policy: "允许", remark: "Web服务HTTP (80)，如Apache、Nginx" },
  { source: "全部IPv4地址", protocol: "TCP", port: "443", policy: "允许", remark: "Web服务HTTPS (443)，如Apache、Nginx" },
  { source: "全部IPv4地址", protocol: "TCP", port: "3389", policy: "允许", remark: "Windows远程桌面登录" },
  { source: "全部IPv4地址", protocol: "UDP", port: "3389", policy: "允许", remark: "Windows远程桌面登录优化" },
  { source: "全部IPv4地址", protocol: "TCP", port: "18789", policy: "允许", remark: "" },
  { source: "0.0.0.0/0", protocol: "ALL", port: "ALL", policy: "拒绝", remark: "" },
];

export const DEFAULT_OUTBOUND_RULES = [
  { target: "-", protocol: "ALL", port: "ALL", policy: "允许", remark: "" },
  { target: "0.0.0.0/0", protocol: "ALL", port: "ALL", policy: "拒绝", remark: "" },
];

export const MOCK_AUDIT_LOGS = [
  {
    id: "log-001",
    operator: "alice@acompany.com",
    event: "UpdateBasicInfo",
    action: "/api/admin/basic-info",
    requestTime: "2026-03-09 10:23:45",
    responseTime: "2026-03-09 10:23:45",
    success: true,
    detail: {
      eventId: "6af57777-10bd-4032-b881-f2e2f8872cd0",
      request: '{"siteName":"A企业企业版OpenClaw","description":"企业级AI助理平台"}',
      startDate: "2026-03-09 10:23:45",
      endDate: "2026-03-09 10:23:45",
      duration: "158",
      invokerName: "alice@acompany.com",
      invokerId: "1001",
      action: "/api/admin/basic-info",
      sourceIp: "30.42.219.99",
      success: "true",
      userAgent: "Mozilla/5.0",
    },
  },
  {
    id: "log-002",
    operator: "alice@acompany.com",
    event: "AddMember",
    action: "/api/admin/members",
    requestTime: "2026-03-09 11:05:12",
    responseTime: "2026-03-09 11:05:12",
    success: true,
    detail: {
      eventId: "7bf68888-20cd-5143-c992-g3f3g9983de1",
      request: '{"memberId":"newuser@a-company.com","openclawLimit":3,"tokenLimit":50000}',
      startDate: "2026-03-09 11:05:12",
      endDate: "2026-03-09 11:05:12",
      duration: "92",
      invokerName: "alice@acompany.com",
      invokerId: "1001",
      action: "/api/admin/members",
      sourceIp: "30.42.219.99",
      success: "true",
      userAgent: "Mozilla/5.0",
    },
  },
  {
    id: "log-003",
    operator: "lisi@a-company.com",
    event: "DeleteModel",
    action: "/api/admin/models/model-003",
    requestTime: "2026-03-09 14:30:00",
    responseTime: "2026-03-09 14:30:01",
    success: false,
    detail: {
      eventId: "8cg79999-31de-6254-d003-h4g4h0094ef2",
      request: '{"modelId":"model-003"}',
      startDate: "2026-03-09 14:30:00",
      endDate: "2026-03-09 14:30:01",
      duration: "1203",
      invokerName: "lisi@a-company.com",
      invokerId: "1002",
      action: "/api/admin/models/model-003",
      sourceIp: "30.42.220.15",
      success: "false",
      userAgent: "Mozilla/5.0",
    },
  },
];

export const MOCK_TOKEN_STATS = {
  totalRequests: 12847,
  inputTokens: 3241580,
  outputTokens: 1876320,
  totalTokens: 5117900,
  globalTokenLimit: 10000000,
};

export const MOCK_TOKEN_BY_MEMBER = [
  { memberId: "alice@acompany.com", inputTokens: 1200000, outputTokens: 680000, totalTokens: 1880000, tokenLimit: 100000, ratio: 0.188 },
  { memberId: "lisi@a-company.com", inputTokens: 980000, outputTokens: 560000, totalTokens: 1540000, tokenLimit: 50000, ratio: 0.308 },
  { memberId: "wangwu@a-company.com", inputTokens: 760000, outputTokens: 420000, totalTokens: 1180000, tokenLimit: 50000, ratio: 0.236 },
  { memberId: "zhaoliu@a-company.com", inputTokens: 301580, outputTokens: 216320, totalTokens: 517900, tokenLimit: 50000, ratio: 0.104 },
];

export const MOCK_TOKEN_BY_MODEL = [
  { modelName: "腾讯云 DeepSeek", inputTokens: 1800000, outputTokens: 1000000, totalTokens: 2800000, tokenLimit: 500000, ratio: 0.56 },
  { modelName: "腾讯云混元", inputTokens: 1100000, outputTokens: 650000, totalTokens: 1750000, tokenLimit: 300000, ratio: 0.583 },
  { modelName: "腾讯云 Coding Plan", inputTokens: 341580, outputTokens: 226320, totalTokens: 567900, tokenLimit: 200000, ratio: 0.284 },
];

export const MOCK_OPENCLAW_MONITOR = [
  { id: "oc-001", name: "工作助手", creator: "alice@acompany.com", status: "running", createdAt: "2026-03-01 10:23:45" },
  { id: "oc-002", name: "代码助手", creator: "alice@acompany.com", status: "running", createdAt: "2026-03-03 14:12:00" },
  { id: "oc-003", name: "文档整理助手", creator: "lisi@a-company.com", status: "stopped", createdAt: "2026-03-05 09:00:00" },
  { id: "oc-004", name: "数据分析助手", creator: "wangwu@a-company.com", status: "running", createdAt: "2026-03-06 16:45:00" },
  { id: "oc-005", name: "客服助手", creator: "wangwu@a-company.com", status: "running", createdAt: "2026-03-07 11:20:00" },
];

export const AVAILABLE_MODELS = [
  { value: "tencent-deepseek", label: "腾讯云 DeepSeek", versions: ["DeepSeek V3 0324", "DeepSeek R1", "DeepSeek V2"] },
  { value: "tencent-hunyuan", label: "腾讯云混元", versions: ["混元 TurboS Latest", "混元 Pro", "混元 Lite"] },
  { value: "tencent-coding", label: "腾讯云 Coding Plan", versions: ["自动"] },
];

export const AVAILABLE_SKILLS = [
  "tavily-search 1.0.0",
  "summarize 1.0.0",
  "agent-browser 0.2.0",
  "find-skills 0.1.0",
  "github 1.0.0",
  "obsidian 1.0.0",
  "notion 1.0.0",
  "weather 1.0.0",
  "tencentcloud-lighthouse-skill 1.0.0",
  "tencent-docs 1.0.3",
  "xhs-skill 1.0.15",
  "ai-ppt-generator 1.1.2",
];

// 角色数据
export interface RoleSkill {
  name: string;
  version: string;
  source: "公共" | "企业";
  /** 最新可用版本（来自技能库） */
  latestVersion?: string;
  /** 更新说明 */
  updateNote?: string;
  /** 更新前的原版本（仅在刷新后显示） */
  previousVersion?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  soul: string;
  skills: RoleSkill[];
  visible: boolean;
  /** 应用范围：public=全部用户，private=按分组 */
  scope: 'public' | 'private';
  /** 当 scope=private 时，关联的分组 ID 列表 */
  groupIds: string[];
}

export const MOCK_ROLES: Role[] = [
  {
    id: "role-001",
    name: "行业分析师",
    description: "结构化分析，输出高质量行业洞察",
    soul: "具备麦肯锡级别分析能力，擅长 PEST/波特五力/SWOT 等框架，输出结构化行业洞察报告",
    skills: [
      { name: "data-analyst", version: "v1.8.0", source: "公共" },
      { name: "sql-expert", version: "v1.6.0", source: "公共" },
      { name: "web-search-pro", version: "v3.1.0", source: "公共" },
    ],
    visible: true,
    scope: "public",
    groupIds: [],
  },
  {
    id: "role-002",
    name: "开发工程师",
    description: "精通全栈开发，擅长网站、小程序和应用部署",
    soul: "面向交付闭环的全栈工程师，遵循 CloudBase 原生最佳实践，擅长从原型到部署的完整链路",
    skills: [
      { name: "github", version: "v2.0.0", source: "公共" },
      { name: "code-reviewer", version: "v1.3.0", source: "公共" },
    ],
    visible: true,
    scope: "private",
    groupIds: ["grp-2"],
  },
  {
    id: "role-003",
    name: "设计师",
    description: "美感与功能平衡，用设计解决问题",
    soul: "专业设计师伙伴，遵循信息架构 > 交互逻辑 > 视觉表现的优先级，注重用户体验闭环",
    skills: [
      { name: "self-improving-agent", version: "v1.0.0", source: "公共" },
      { name: "docker-ops", version: "v1.1.0", source: "公共" },
      { name: "email-writer", version: "v2.2.0", source: "公共" },
      { name: "k8s-manager", version: "v1.5.0", source: "公共" },
      { name: "api-tester", version: "v1.5.0", source: "公共" },
    ],
    visible: true,
    scope: "private",
    groupIds: ["grp-3"],
  },
  {
    id: "role-004",
    name: "项目经理",
    description: "覆盖项目全生命周期，从立项到复盘",
    soul: "项目全生命周期管理，支持启动/会议/周报/风险/复盘全流程，确保项目高质量交付",
    skills: [
      { name: "文档总结助手", version: "v0.9.0", source: "企业" },
      { name: "智能翻译工具", version: "v1.0.0", source: "企业" },
      { name: "API 自动化测试", version: "v2.0.0", source: "企业" },
      { name: "代码质量扫描", version: "v1.0.0", source: "企业" },
      { name: "知识库问答", version: "v1.0.0", source: "企业" },
    ],
    visible: true,
    scope: "private",
    groupIds: ["grp-1", "grp-2"],
  },
  {
    id: "role-005",
    name: "办公能手",
    description: "高效办公，熟练处理文档、表格、演示、会议",
    soul: "高效办公 AI 助手，熟练处理 Word/PDF/PPT/Excel/会议记录，提升日常办公效率",
    skills: [
      { name: "ppt-generator", version: "v1.0.0", source: "公共" },
      { name: "security-scanner", version: "v2.0.1", source: "公共" },
      { name: "email-writer", version: "v2.1.0", source: "公共" },
      { name: "web-search-pro", version: "v3.2.1", source: "公共" },
    ],
    visible: false,
    scope: "public",
    groupIds: [],
  },
  {
    id: "role-006",
    name: "内容创作者",
    description: "优秀的图文内容创作者，具备极高审美",
    soul: "优秀的图文内容创作者，审美极高，擅长搜索+写作+配图+润色+发布全链路内容生产",
    skills: [
      { name: "self-improving-agent", version: "v1.0.0", source: "公共" },
      { name: "github", version: "v2.1.0", source: "公共" },
      { name: "data-analyst", version: "v2.0.0", source: "公共" },
      { name: "git-helper", version: "v1.2.0", source: "公共" },
      { name: "code-formatter", version: "v2.5.0", source: "公共" },
    ],
    visible: true,
    scope: "private",
    groupIds: ["grp-1", "grp-3", "grp-4"],
  },
];

// 可供角色选择的技能库
export const PUBLIC_SKILL_POOL = [
  { name: "Data Analysis", description: "全面的数据分析技能", version: "v2.0" },
  { name: "Data Visualization", description: "数据可视化图表生成", version: "v1.5" },
  { name: "SWOT Analyzer", description: "SWOT 分析框架工具", version: "v1.0" },
  { name: "ui-ux-pro-max", description: "专业 UI/UX 设计辅助", version: "v1.0" },
  { name: "Impeccable", description: "设计质量检查工具", version: "v1.2" },
  { name: "taste-skill", description: "审美与品味评估", version: "v1.0" },
  { name: "Vercel web design", description: "现代 Web 设计最佳实践", version: "v1.0" },
  { name: "playwright-cli", description: "浏览器自动化测试", version: "v0.2" },
  { name: "self-improving-agent", description: "自我改进型 Agent 框架", version: "v1.0" },
  { name: "humanizer", description: "文本人性化润色", version: "v1.0" },
  { name: "agent-reach", description: "多平台内容分发", version: "v1.0" },
  { name: "baoyu-infographic", description: "信息图自动生成", version: "v1.0" },
  { name: "web-search-pro", description: "增强型网络搜索", version: "v3.2" },
  { name: "github", description: "GitHub 交互工具", version: "v2.1" },
  { name: "code-reviewer", description: "自动化代码审查", version: "v1.4" },
];

export const ENTERPRISE_SKILL_POOL = [
  { name: "cloudbase", description: "腾讯云 CloudBase 开发工具", version: "v1.0" },
  { name: "pm-project-kickoff", description: "项目启动模板", version: "v1.0" },
  { name: "pm-meeting-minutes", description: "会议纪要自动生成", version: "v1.0" },
  { name: "pm-weekly-report", description: "周报自动汇总", version: "v1.0" },
  { name: "pm-risk-assessment", description: "项目风险评估", version: "v1.0" },
  { name: "pm-retrospective", description: "项目复盘模板", version: "v1.0" },
  { name: "office-documents", description: "Office 文档处理", version: "v1.0" },
  { name: "tencent-docs", description: "腾讯文档集成", version: "v1.0" },
  { name: "tencent-meeting-skill", description: "腾讯会议技能", version: "v1.0" },
  { name: "ima-note", description: "即时笔记工具", version: "v1.0" },
];

// ─── OneID 相关 Mock 数据 ────────────────────────────────────────────────────

/** 是否启用 OneID 模式（Demo 可切换） */
export const HAS_ONEID = true;

/** SSO 登录方式选项 */
export interface SsoImTypeOption {
  value: string;
  label: string;
}

export const MOCK_SSO_IM_TYPE_OPTIONS: SsoImTypeOption[] = [
  { value: "enterprise_wechat", label: "企业微信" },
  { value: "dingtalk", label: "钉钉扫码" },
  { value: "feishu", label: "飞书扫码" },
];

/** 当前已选的登录方式 */
export const MOCK_SSO_IM_TYPES = ["enterprise_wechat", "dingtalk", "feishu"];

/** 部门树节点 */
export interface DepartmentNode {
  id: string;
  name: string;
  path?: string;
  children?: DepartmentNode[];
}

/** Mock 部门树数据 */
export const MOCK_DEPARTMENTS: DepartmentNode[] = [
  {
    id: "dept-root",
    name: "A公司",
    path: "A公司",
    children: [
      {
        id: "dept-tech",
        name: "技术部",
        path: "A公司/技术部",
        children: [
          { id: "dept-fe", name: "前端组", path: "A公司/技术部/前端组" },
          { id: "dept-be", name: "后端组", path: "A公司/技术部/后端组" },
          { id: "dept-ai", name: "AI 团队", path: "A公司/技术部/AI 团队" },
        ],
      },
      {
        id: "dept-product",
        name: "产品部",
        path: "A公司/产品部",
        children: [
          { id: "dept-pm", name: "产品经理组", path: "A公司/产品部/产品经理组" },
          { id: "dept-design", name: "设计组", path: "A公司/产品部/设计组" },
        ],
      },
      {
        id: "dept-ops",
        name: "运营部",
        path: "A公司/运营部",
      },
      {
        id: "dept-hr",
        name: "人力资源部",
        path: "A公司/人力资源部",
      },
    ],
  },
];

/** 带部门信息的成员数据（OneID 模式使用） */
export const MOCK_MEMBERS_WITH_DEPT = [
  { id: "alice@acompany.com", name: "Alice", role: "admin", status: "active", clawLimit: 5, tokenLimit: 100000, clawCount: 2, joinTime: "2026-01-15", department: "A公司/技术部/前端组", departmentId: "dept-fe" },
  { id: "bob@acompany.com", name: "Bob", role: "admin", status: "active", clawLimit: 5, tokenLimit: 100000, clawCount: 1, joinTime: "2026-01-18", department: "A公司/技术部/后端组", departmentId: "dept-be" },
  { id: "lisi@a-company.com", name: "李四", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 1, joinTime: "2026-01-20", department: "A公司/技术部/AI 团队", departmentId: "dept-ai" },
  { id: "wangwu@a-company.com", name: "王五", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 3, joinTime: "2026-02-01", department: "A公司/产品部/产品经理组", departmentId: "dept-pm" },
  { id: "zhaoliu@a-company.com", name: "赵六", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 0, joinTime: "2026-02-10", department: "A公司/产品部/设计组", departmentId: "dept-design" },
  { id: "sunqi@a-company.com", name: "孙七", role: "member", status: "active", clawLimit: 3, tokenLimit: -1, clawCount: 2, joinTime: "2026-02-15", department: "A公司/运营部", departmentId: "dept-ops" },
  { id: "zhouba@a-company.com", name: "周八", role: "member", status: "disabled", clawLimit: 3, tokenLimit: 50000, clawCount: 0, joinTime: "2026-02-20", department: "A公司/人力资源部", departmentId: "dept-hr" },
  { id: "wujiu@a-company.com", name: "吴九", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 1, joinTime: "2026-03-01", department: "A公司/技术部/前端组", departmentId: "dept-fe" },
  { id: "zhengshi@a-company.com", name: "郑十", role: "member", status: "active", clawLimit: 3, tokenLimit: 80000, clawCount: 0, joinTime: "2026-03-05", department: "A公司/技术部/后端组", departmentId: "dept-be" },
  { id: "liuyi@a-company.com", name: "刘一", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 1, joinTime: "2026-03-10", department: "A公司/运营部", departmentId: "dept-ops" },
  { id: "chener@a-company.com", name: "陈二", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 0, joinTime: "2026-03-15", department: "A公司/技术部/AI 团队", departmentId: "dept-ai" },
  { id: "yangsan@a-company.com", name: "杨三", role: "member", status: "active", clawLimit: 3, tokenLimit: 50000, clawCount: 0, joinTime: "2026-03-20", department: "A公司/产品部/设计组", departmentId: "dept-design" },
];

/** 按部门汇总的 Token 消耗数据（Tokens 监控「按部门」Tab 使用） */
export const MOCK_TOKEN_BY_DEPARTMENT = [
  { departmentId: "dept-fe", departmentName: "前端组", path: "A公司/技术部/前端组", requests: 3200, inputTokens: 820000, outputTokens: 450000, totalTokens: 1270000 },
  { departmentId: "dept-be", departmentName: "后端组", path: "A公司/技术部/后端组", requests: 2800, inputTokens: 710000, outputTokens: 390000, totalTokens: 1100000 },
  { departmentId: "dept-ai", departmentName: "AI 团队", path: "A公司/技术部/AI 团队", requests: 4100, inputTokens: 1050000, outputTokens: 600000, totalTokens: 1650000 },
  { departmentId: "dept-pm", departmentName: "产品经理组", path: "A公司/产品部/产品经理组", requests: 1500, inputTokens: 380000, outputTokens: 210000, totalTokens: 590000 },
  { departmentId: "dept-design", departmentName: "设计组", path: "A公司/产品部/设计组", requests: 900, inputTokens: 230000, outputTokens: 130000, totalTokens: 360000 },
  { departmentId: "dept-ops", departmentName: "运营部", path: "A公司/运营部", requests: 600, inputTokens: 151580, outputTokens: 96320, totalTokens: 247900 },
  { departmentId: "dept-hr", departmentName: "人力资源部", path: "A公司/人力资源部", requests: 250, inputTokens: 50000, outputTokens: 30000, totalTokens: 80000 },
];

/** 按分组汇总的 Token 消耗数据 —— 普通模式（manual 分组，树形层级）*/
export interface GroupNode {
  id: string;
  name: string;
  path?: string;
  children?: GroupNode[];
}

export const MOCK_GROUP_TREE_MANUAL: GroupNode[] = [
  { id: "mgrp-product", name: "产品组", path: "产品组" },
  {
    id: "mgrp-rd", name: "研发组", path: "研发组",
    children: [
      { id: "mgrp-rd-fe", name: "研发-前端", path: "研发组/研发-前端" },
      { id: "mgrp-rd-be", name: "研发-后端", path: "研发组/研发-后端" },
    ],
  },
  { id: "mgrp-design", name: "设计组", path: "设计组" },
  { id: "mgrp-ops", name: "产品运营与市场推广团队", path: "产品运营与市场推广团队" },
];

export const MOCK_TOKEN_BY_GROUP_MANUAL = [
  { groupId: "mgrp-product", groupName: "产品组", requests: 1800, inputTokens: 460000, outputTokens: 250000, totalTokens: 710000 },
  { groupId: "mgrp-rd", groupName: "研发组", requests: 5200, inputTokens: 1320000, outputTokens: 780000, totalTokens: 2100000 },
  { groupId: "mgrp-rd-fe", groupName: "研发组/研发-前端", requests: 3100, inputTokens: 790000, outputTokens: 440000, totalTokens: 1230000 },
  { groupId: "mgrp-rd-be", groupName: "研发组/研发-后端", requests: 2600, inputTokens: 680000, outputTokens: 370000, totalTokens: 1050000 },
  { groupId: "mgrp-design", groupName: "设计组", requests: 950, inputTokens: 240000, outputTokens: 135000, totalTokens: 375000 },
  { groupId: "mgrp-ops", groupName: "产品运营与市场推广团队", requests: 720, inputTokens: 182000, outputTokens: 108000, totalTokens: 290000 },
];

/** 按分组汇总的 Token 消耗数据 —— OneID 模式（部门 + 自定义分组，树形层级）*/
export const MOCK_GROUP_TREE_ONEID: GroupNode[] = [
  {
    id: "__section_dept", name: "部门", path: "部门",
    children: [
      {
        id: "dept-root", name: "A公司", path: "A公司",
        children: [
          {
            id: "dept-tech", name: "技术部", path: "A公司/技术部",
            children: [
              { id: "dept-fe", name: "前端组", path: "A公司/技术部/前端组" },
              { id: "dept-be", name: "后端组", path: "A公司/技术部/后端组" },
              { id: "dept-ai", name: "AI 组", path: "A公司/技术部/AI 组" },
            ],
          },
          {
            id: "dept-product", name: "产品部", path: "A公司/产品部",
            children: [
              { id: "dept-pm", name: "产品策划", path: "A公司/产品部/产品策划" },
              { id: "dept-design", name: "设计组", path: "A公司/产品部/设计组" },
              {
                id: "dept-operation", name: "运营组", path: "A公司/产品部/运营组",
                children: [
                  { id: "dept-operation-1", name: "运营一组", path: "A公司/产品部/运营组/运营一组" },
                  { id: "dept-operation-2", name: "运营二组", path: "A公司/产品部/运营组/运营二组" },
                ],
              },
            ],
          },
          { id: "dept-hr", name: "人力资源", path: "A公司/人力资源" },
          { id: "dept-finance", name: "财务部", path: "A公司/财务部" },
        ],
      },
    ],
  },
  {
    id: "__section_group", name: "自定义分组", path: "自定义分组",
    children: [
      {
        id: "og-frontend", name: "前端研发同学", path: "前端研发同学",
        children: [
          { id: "og-fe-web", name: "Web 端", path: "前端研发同学/Web 端" },
          { id: "og-fe-mobile", name: "移动端", path: "前端研发同学/移动端" },
        ],
      },
      {
        id: "og-backend", name: "后端研发同学", path: "后端研发同学",
        children: [
          { id: "og-be-java", name: "Java 方向", path: "后端研发同学/Java 方向" },
          { id: "og-be-go", name: "Go 方向", path: "后端研发同学/Go 方向" },
        ],
      },
      { id: "og-ai-core", name: "AI 核心团队", path: "AI 核心团队" },
    ],
  },
];

export const MOCK_TOKEN_BY_GROUP_ONEID = [
  // 部门
  { groupId: "dept-root", groupName: "A公司", requests: 14200, inputTokens: 3620000, outputTokens: 2060000, totalTokens: 5680000 },
  { groupId: "dept-tech", groupName: "A公司/技术部", requests: 10100, inputTokens: 2580000, outputTokens: 1440000, totalTokens: 4020000 },
  { groupId: "dept-fe", groupName: "A公司/技术部/前端组", requests: 3200, inputTokens: 820000, outputTokens: 450000, totalTokens: 1270000 },
  { groupId: "dept-be", groupName: "A公司/技术部/后端组", requests: 2800, inputTokens: 710000, outputTokens: 390000, totalTokens: 1100000 },
  { groupId: "dept-ai", groupName: "A公司/技术部/AI 组", requests: 4100, inputTokens: 1050000, outputTokens: 600000, totalTokens: 1650000 },
  { groupId: "dept-product", groupName: "A公司/产品部", requests: 3500, inputTokens: 891580, outputTokens: 506320, totalTokens: 1397900 },
  { groupId: "dept-pm", groupName: "A公司/产品部/产品策划", requests: 1500, inputTokens: 380000, outputTokens: 210000, totalTokens: 590000 },
  { groupId: "dept-design", groupName: "A公司/产品部/设计组", requests: 900, inputTokens: 230000, outputTokens: 130000, totalTokens: 360000 },
  { groupId: "dept-operation", groupName: "A公司/产品部/运营组", requests: 1100, inputTokens: 281580, outputTokens: 166320, totalTokens: 447900 },
  { groupId: "dept-operation-1", groupName: "A公司/产品部/运营组/运营一组", requests: 650, inputTokens: 165000, outputTokens: 95000, totalTokens: 260000 },
  { groupId: "dept-operation-2", groupName: "A公司/产品部/运营组/运营二组", requests: 450, inputTokens: 116580, outputTokens: 71320, totalTokens: 187900 },
  { groupId: "dept-hr", groupName: "A公司/人力资源", requests: 250, inputTokens: 50000, outputTokens: 30000, totalTokens: 80000 },
  { groupId: "dept-finance", groupName: "A公司/财务部", requests: 350, inputTokens: 98420, outputTokens: 83680, totalTokens: 182100 },
  // 自定义分组
  { groupId: "og-frontend", groupName: "前端研发同学", requests: 2900, inputTokens: 740000, outputTokens: 410000, totalTokens: 1150000 },
  { groupId: "og-fe-web", groupName: "前端研发同学/Web 端", requests: 1600, inputTokens: 410000, outputTokens: 225000, totalTokens: 635000 },
  { groupId: "og-fe-mobile", groupName: "前端研发同学/移动端", requests: 1300, inputTokens: 330000, outputTokens: 185000, totalTokens: 515000 },
  { groupId: "og-backend", groupName: "后端研发同学", requests: 2500, inputTokens: 640000, outputTokens: 350000, totalTokens: 990000 },
  { groupId: "og-be-java", groupName: "后端研发同学/Java 方向", requests: 1400, inputTokens: 360000, outputTokens: 195000, totalTokens: 555000 },
  { groupId: "og-be-go", groupName: "后端研发同学/Go 方向", requests: 1100, inputTokens: 280000, outputTokens: 155000, totalTokens: 435000 },
  { groupId: "og-ai-core", groupName: "AI 核心团队", requests: 3600, inputTokens: 920000, outputTokens: 520000, totalTokens: 1440000 },
];

/** OpenClaw 列表（带部门信息，OneID 模式使用） */
export const MOCK_CLAWS_WITH_DEPT: Array<{
  id: string;
  instanceId: string;
  name: string;
  creator: string;
  createTime: string;
  status: string;
  department?: string;
  departmentId?: string;
}> = [
  { id: "1",  instanceId: "ins-g83c6wvc", name: "Alice的助手",      creator: "alice@acompany.com",  createTime: "2025-12-01 09:12:34", status: "running",     department: "A公司/技术部/前端组", departmentId: "dept-fe" },
  { id: "2",  instanceId: "ins-h92d7xwe", name: "Bob工作助手",       creator: "bob@acompany.com",    createTime: "2025-12-15 14:05:22", status: "running",     department: "A公司/技术部/后端组", departmentId: "dept-be" },
  { id: "3",  instanceId: "ins-j14e8yvf", name: "Carol的研究助手",   creator: "carol@acompany.com",  createTime: "2026-01-05 10:33:47", status: "shutdown",    department: "A公司/技术部/AI 团队", departmentId: "dept-ai" },
  { id: "4",  instanceId: "ins-k25f9zwg", name: "Dave的代码助手",    creator: "dave@acompany.com",   createTime: "2026-01-20 16:48:09", status: "running",     department: "A公司/产品部/产品经理组", departmentId: "dept-pm" },
  { id: "5",  instanceId: "ins-l36g0axh", name: "Eve的写作助手",     creator: "eve@acompany.com",    createTime: "2026-02-10 08:21:55", status: "createFail",  department: "A公司/产品部/设计组", departmentId: "dept-design" },
  { id: "6",  instanceId: "ins-m47h1byi", name: "Frank的数据助手",   creator: "frank@acompany.com",  createTime: "2026-02-18 11:07:30", status: "running",     department: "A公司/运营部", departmentId: "dept-ops" },
  { id: "7",  instanceId: "ins-n58i2czj", name: "Grace的翻译助手",   creator: "grace@acompany.com",  createTime: "2026-02-25 15:44:18", status: "creating",    department: "A公司/人力资源部", departmentId: "dept-hr" },
  { id: "8",  instanceId: "ins-o69j3dak", name: "Henry的销售助手",   creator: "henry@acompany.com",  createTime: "2026-03-01 09:58:03", status: "running",     department: "A公司/技术部/前端组", departmentId: "dept-fe" },
  { id: "9",  instanceId: "ins-p70k4ebl", name: "Ivy的客服助手",     creator: "ivy@acompany.com",    createTime: "2026-03-05 13:26:41", status: "maintaining", department: "A公司/技术部/后端组", departmentId: "dept-be" },
  { id: "10", instanceId: "ins-q81l5fcm", name: "Jack的会议助手",    creator: "jack@acompany.com",   createTime: "2026-03-08 17:02:15", status: "running",     department: "A公司/技术部/AI 团队", departmentId: "dept-ai" },
  { id: "11", instanceId: "ins-r92m6gdn", name: "Karen的报告助手",   creator: "karen@acompany.com",  createTime: "2026-03-09 10:15:50", status: "loadFail",    department: "A公司/产品部/产品经理组", departmentId: "dept-pm" },
  { id: "12", instanceId: "ins-s03n7heo", name: "Leo的项目助手",     creator: "leo@acompany.com",    createTime: "2026-03-10 08:39:27", status: "running",     department: "A公司/运营部", departmentId: "dept-ops" },
  { id: "13", instanceId: "ins-t14o8ipf", name: "Mia的新助手",       creator: "mia@acompany.com",    createTime: "2026-03-12 11:00:00", status: "loading",     department: "A公司/产品部/设计组", departmentId: "dept-design" },
  { id: "14", instanceId: "ins-u25p9jqg", name: "Noah的分析助手",    creator: "noah@acompany.com",   createTime: "2026-03-13 14:30:00", status: "pending",     department: "A公司/人力资源部", departmentId: "dept-hr" },
];
