---
name: openclawdesign
description: >
  OpenClaw Enterprise 设计系统规范。当用户要求创建、修改或审查 OpenClaw Enterprise 平台的
  前端页面、组件或 UI 时，必须加载此 Skill 以确保视觉风格、交互模式和代码实现与现有页面完全一致。
  适用于 React + TypeScript + Tailwind CSS v4 + shadcn/ui 技术栈。
---

# OpenClaw Enterprise Design System

> 设计语言：「流动蓝图」Fluid Blueprint
> 技术栈：React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (new-york style) · wouter · lucide-react · recharts · sonner · framer-motion

你是 OpenClaw Enterprise 平台的专属 UI 设计师和前端工程师。你的职责是确保所有新页面、新组件、UI 修改都严格遵循以下设计规范，与现有页面保持视觉和交互的完全一致。

---

## v2 升级日志（2026-05）

本次升级基于最新典型页面（用户端官网首页 / 用户端「我的 Agent」/ 管理端「平台策略」）重写规范。**与 v1 不一致时以 v2 为准**。

| 维度 | v1 | v2 |
|---|---|---|
| 主品牌蓝 | `#007AFF` | **`#1447E6`** |
| 主 CTA 渐变 | `linear-gradient(135deg, #007AFF, #5856D6)` 蓝紫 | **`linear-gradient(90deg, #020617 70%, #1447E6 100%)` 黑→蓝** |
| 用户端页面背景 | 纯白 / `#FAFBFF` | **`linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)`**（全用户端） |
| 圆角最大值 | 16px (`rounded-2xl`) | **4px**（仅保留 `2 / 3 / 4 / full` 四档） |
| 主卡片圆角 | 16px | **4px**（紧凑信息卡） |
| 字体 | Inter + DM Mono | **PingFang SC + Menlo + DIN Alternate(替代 DIN Next LT Pro) + Open Sans** |
| 文字色阶 | gray-900 / 700 / 500 / 400 | **`#0A0A0A` / `#020617` / `#334155` / `#737373` / `#A3A3A3`** |
| 阴影 | 双层柔和 | **三档**：卡片轻量 / Tab 滑块极轻 / 管理端配置卡中等 |
| 响应式 | 简单网格断点 | **新增 1200/1920 三档规则（仅用户端「我的 Agent」）**：>1920 两侧留白 / 1200–1920 自适应 / <1200 整体横滚，全程固定两列；管控端不适用 |

> 历史代码若仍使用 v1 token，需在下次接触时同步迁移到 v2。所有现存原型按 v2 同步替换主色与渐变。

---

## 0. 协作机制：触达即同步（Touch-and-Sync）

> **核心约定**：本仓库存量页面规模大，不依赖一次性的全量重构来对齐设计系统；而是约定"**改到哪个文件、就把那个文件按当前 SKILL 同步刷新一遍**"，让规范升级靠日常迭代自然消化。

### 0.1 AI 行为约定（你——本 skill 的执行者——必须遵守）

每当用户要求你修改 / 审查 / 新增任何 `client/src/**` 下的页面或组件文件，**在动手实现需求之前**，你必须先做以下检查：

1. **读完目标文件**，识别该文件中是否存在与当前 SKILL.md 不一致的写法，重点扫这几类：
   - **卡片层级**：是否仍有手写 `box-shadow` / `border` 的 div 假装是卡片？应改为 `<SurfaceCard>` / `<SurfaceInner>` / `<SurfaceOverlay>` / `<SurfaceConfig>` 语义组件（详见 §4.x 卡片系统）。
   - **阴影 token**：inline `boxShadow` 是否改用 `var(--shadow-card)` / `var(--shadow-inner)` / `var(--shadow-overlay)` / `var(--shadow-config)` / `var(--shadow-segment)` CSS 变量？
   - **色值**：是否仍残留 v1 主色 `#007AFF` / 老 CTA 渐变 `135deg, #007AFF, #5856D6`？应替换为 v2 的 `#1447E6` / `90deg, #020617 70%, #1447E6 100%`。
   - **圆角**：是否还有 `rounded-2xl` / `rounded-xl` ≥ 8px？v2 仅保留 `2 / 3 / 4 / full`。
   - **字体**：是否仍写 `font-mono` / Inter？应使用 `font-din`（数字）/ `font-mono`（已重定向到 Menlo）/ 默认 PingFang SC。
   - **文字色阶**：是否仍用 `text-gray-900/700/500/400`？应使用 v2 五档新色阶。

2. **顺手刷新**：如发现违规，**在完成用户主诉需求的同一次提交中**把违规一起刷掉，不必额外征求许可（这是机制本身已授权的动作）。

3. **遇到合理浮层 / 装饰阴影 / 特殊场景需要保留 inline boxShadow**，加行级豁免注释 `// allow-shadow: <理由>`，自检脚本会放行。

4. **特殊情况下需要拆开做**（例如刷新动作工作量远大于主诉本身、或会引入语义上不安全的改动），**先告知用户**：列出本文件违规清单 + 预估改动量，让用户决定"本次只做主诉 / 一起刷 / 单独排期"。

### 0.2 多人协作约定（人类同学）

- 任何人在改某个页面前，先在 IDE 里加载本 skill（CodeBuddy 会自动加载），AI 会按 §0.1 的检查清单工作。
- 如果是**手工编辑**（不走 AI），改完前最好用 `node scripts/check-card-shadow.cjs` 自检一下当前文件，确保没引入新违规。
- **不要主动发起"全仓批量刷新"PR**——存量违规靠日常迭代分散消化更安全；除非有专门的设计系统升级排期。

### 0.3 自检脚本与豁免

- 脚本位置：`scripts/check-card-shadow.mjs`
- 放行规则：`components/ui/**` 路径白名单 / `var(--shadow-*)` token 引用 / 行级 `// allow-shadow:` 注释
- 当前存量违规快照（v2026.05.14）：**196 处 / ~50 文件**，按本机制随日常迭代消化，不再做集中清理。
- **基线兜底机制**：脚本内置 `BASELINE = 196` 阈值——
  - 违规数 ≤ BASELINE：`exit 0`（CI 通过、允许存量逐步消化）
  - 违规数 > BASELINE：`exit 1`（防止新增违规倒退，必须清理）
  - 任何"触达即同步"刷新清掉一批违规后，**必须同步把脚本内 `BASELINE` 数字往下调**（例如 196 → 190），否则下次新增违规会被误判为"还在基线内"。
  - 严格模式：`STRICT=1 node scripts/check-card-shadow.mjs`，任何违规即报错（用于专项清理时查全量违规）。

---

## 1. 色彩系统

### 1.1 品牌色

| 名称 | 值 | 用途 |
|------|-----|------|
| Brand Blue | **`#1447E6`** | 主色、活跃态、链接、主按钮、Switch 开启 |
| Brand Black | `#020617` | CTA 渐变起点、强调文字 |
| Brand Blue Tint | `#EFF6FF` | 活跃菜单项底色起点 |

**主 CTA 渐变**（全局统一，inline style）：
```css
background: linear-gradient(90deg, #020617 70%, #1447E6 100%);
```
用于：主操作按钮、Hero 区主 CTA、活跃分页按钮。

**活跃菜单项渐变**（管理端侧栏）：
```css
background: linear-gradient(90deg, #EFF6FF 0%, rgba(20,71,230,0.05) 100%);
```

**Logo 容器渐变**（保留蓝系，不再使用紫色）：
```css
background: linear-gradient(135deg, #1447E6, #2563EB);
```

### 1.2 语义色

| 语义 | 色值 | Tailwind 类 | 用途 |
|------|------|-------------|------|
| 成功/运行中 | `#16A34A` | `bg-green-500` (dot), `text-green-600` | 状态徽章、在线指示 |
| 错误/停用 | `#DC2626` | `bg-red-500` (dot), `text-red-600` | 停止状态、危险操作 |
| 警告/待处理 | `#F59E0B` | `bg-yellow-500` (dot), `text-yellow-600` | 待处理状态 |
| 信息提示 | — | `bg-blue-50 border-blue-100 text-blue-600` | 提示横幅 |
| 警告提示 | — | `bg-amber-50 border-amber-100 text-amber-700` | 警告横幅 |

### 1.3 背景色

| 区域 | 色值 | 说明 |
|------|------|------|
| **用户端全局背景** | `linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)` | inline style 设置在最外层 |
| **管理端全局背景** | `#FFFFFF` | 纯白，沿用现状 |
| 卡片/面板 | `#FFFFFF` | 纯白 |
| 表格斑马纹 / 表头 | `bg-gray-50/50` | 极浅灰 |
| Tab 容器底色 | `#F5F5F5` | 灰底白滑块 |

### 1.4 文字层级（按色值）

| 层级 | 色值 | Tailwind 近似 | 用途 |
|------|------|---------------|------|
| 主文字 | `#0A0A0A` | `text-neutral-950` | 标题、卡片标题、主内容 |
| 强调文字 | `#020617` | `text-slate-950` | 数字、关键强调 |
| 次级文字 | `#334155` | `text-slate-700` | 正文、ID、分组名 |
| 辅助文字 | `#737373` | `text-neutral-500` | 时间、描述、分组标题 |
| 极弱文字 | `#A3A3A3` | `text-neutral-400` | 占位符、极弱提示 |
| 活跃 | `#1447E6` | — | 活跃导航、链接 |
| 危险 | `#DC2626` | `text-red-600` | 删除按钮 |

### 1.5 描边

| 用途 | 色值 / 宽度 |
|------|-------------|
| 通用分割线 | `#E5E5E5` / 1px |
| 管理端配置卡描边（L4 SurfaceConfig）| `#E5E5E5` / **0.5px** |
| L2 内嵌卡描边（SurfaceInner）| `#F5F5F5` / 1px |
| **L1 表层卡片**（SurfaceCard）| **无描边**，仅靠 `--shadow-card` 双层柔阴影勾勒（v2026.05 起对齐 Figma 节点 358:2388 调整）|

### 1.6 渐变 Icon 容器配色

每种功能使用固定渐变，不可混用：

| 渐变 | 用途 |
|------|------|
| `from-blue-500 to-blue-600` | 模型、总数统计 |
| `from-green-500 to-green-600` | 通道、运行中 |
| `from-purple-500 to-purple-600` | 技能、输出 |
| `from-indigo-500 to-indigo-600` | 输入 Tokens |
| `from-blue-600 to-purple-600` | 总 Tokens |
| `from-orange-500 to-red-500` | 全局配额消耗 |
| `from-gray-400 to-gray-500` | 已停用 |

---

## 2. 排版系统

### 2.1 字体栈

```css
/* 中文主字体（含正文、标题） */
font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;

/* 等宽 / 步骤标识（Step 1/2/3、代码片段） */
font-family: 'Menlo', 'Consolas', 'Courier New', monospace;

/* 大数字 / 计数（DIN Next LT Pro 商业授权未购，使用免费替代） */
font-family: 'DIN Alternate', 'DIN', 'Helvetica Neue', sans-serif;

/* 英文标签 / Badge（New / Beta） */
font-family: 'Open Sans', 'Helvetica Neue', sans-serif;
```

- 渲染：开启 `antialiased`
- PingFang SC 是 Apple 系统字体，无需引入；其余字体的 webfont 接入见 §14

### 2.2 文字 Token

| Token | 字号 | 字重 | 行高 | Tailwind 等效 | 用途 |
|---|---|---|---|---|---|
| Heading L | 24px | Medium | 1.4 | `text-2xl font-medium` | 页面标题 h1 |
| Heading M | 18px | Medium | 1.4 | `text-lg font-medium` | Dialog 标题、模块标题 |
| Heading S | 16px | Semibold | 1.4 | `text-base font-semibold` | 卡片标题 h2 |
| Paragraph M Medium | 14px | Medium | 1.5 | `text-sm font-medium` | 列表项标题、Label、Tab 文字 |
| Paragraph M | 14px | Regular | 1.5 | `text-sm` | 正文、表格内容 |
| Paragraph S | 13px | Regular | 1.5 | `text-[13px]` | 管理端菜单项、紧凑列表 |
| Paragraph Mini | 12px | Regular | 1.5 | `text-xs` | ID、时间、分组标题、辅助说明 |
| Number L | 24px | Bold | — | `text-2xl font-bold tabular-nums` | 统计大数字（用 DIN Alternate） |
| Mono Step | 14px | Medium | — | `text-sm font-medium` | Step 1/2/3（用 Menlo） |

### 2.3 数字排版

所有数字内容使用 `tabular-nums` 确保等宽对齐。统计大数字额外应用 `font-din`（见 §14 Tailwind 配置）。

---

## 3. 间距系统

### 3.1 页面级

| 区域 | 间距 |
|------|------|
| Admin 内容区 padding | `p-8` (32px) |
| Tenant 内容区 padding | `px-6 py-8` (24px/32px) |
| 标题区到内容区 | `mb-6` 或 `mb-8` |
| Admin max-width | 不限（铺满主内容区 1496px） |
| Tenant 通用 max-width | **`max-w-[1920px] mx-auto`** + 三档响应式 + 左右 80px 占位带（见 §7.4，以「我的 Agent」骨架为基准，所有用户端业务页统一沿用） |

### 3.2 卡片内

| 位置 | 间距 |
|------|------|
| 表单卡片 | `p-8` |
| 管理端配置卡 | `px-6 py-5` 或 `p-6` |
| Agent 卡片 | `p-5` (20px) |
| 卡片 header | `px-6 py-5` |
| 表格 header cells | `px-6 py-3` |
| 表格 body cells | `px-6 py-4` |

### 3.3 元素间

| 上下文 | 间距 |
|--------|------|
| 表单字段间 | `space-y-6` 或 `space-y-4` |
| Label 到 Input | `space-y-2` |
| 按钮组 gap | `gap-3` |
| 图标与文字 | `gap-2` 或 `gap-2.5` |
| 统计卡片 grid | `gap-4` |
| Agent 卡片 grid | `gap-4` |
| 导航项间 | `space-y-0.5` |
| Tab 项间 | `gap-1` |

---

## 4. 圆角系统

**最大圆角不超过 4px，仅保留 `2 / 3 / 4 / full` 四档。**

| Token | 数值 | Tailwind | 适用场景 |
|---|---|---|---|
| `radius-xs` | **2px** | `rounded-[2px]` | 状态徽章（New / Beta）、小色块、状态标签 |
| `radius-sm` | **3px** | `rounded-[3px]` | Tab 活跃滑块、Slider 把手 |
| `radius-md` | **4px** | `rounded-[4px]` | 按钮、输入框、Tab/Switch 容器、Agent 卡片、管理端配置卡、Logo、侧栏菜单项、Dialog、Popover |
| `radius-full` | `9999px / 50%` | `rounded-full` | 标签胶囊、Switch 轨道、头像、进度条、状态点 |

### 选用原则

1. **同一组件家族保持一致**：所有按钮统一 4px，所有主卡片统一 4px。
2. **嵌套关系**：外层圆角 ≥ 内层圆角 + padding（实操中 4px 容器内的活跃元素用 3px）。
3. **胶囊优先**：标签筛选、Switch 轨道、头像、状态点等"容器形态非矩形"元素用 `full`。
4. **不要使用** `rounded-md` (6px) / `rounded-lg` (8px) / `rounded-xl` (12px) / `rounded-2xl` (16px)。所有 v1 中的这些圆角统一降级到 4px 或 full。

---

## 5. 阴影系统（v2.1：Surface 组件强约束）

> **唯一真理源**：`client/src/index.css` 的 `--shadow-card / --shadow-inner / --shadow-overlay / --shadow-config / --shadow-segment` 五个 CSS 变量。
> **唯一卡片 API**：`@/components/ui/Surface` 导出的 `SurfaceCard / SurfaceInner / SurfaceOverlay / SurfaceConfig`。
> 业务页面**禁止**再写 inline `boxShadow:`，**禁止**用 Tailwind `shadow-md / shadow-lg / shadow-xl / shadow-2xl`。

### 5.1 五档语义对照表

| 档位 | 组件 | CSS 变量 | 阴影值 | 适用场景 |
|------|------|---------|--------|---------|
| **L1 表层卡片** | `<SurfaceCard>` | `--shadow-card` | `0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)` | 页面主区块、列表卡、统计卡、Agent 卡、技能广场卡 |
| **L2 内嵌卡片** | `<SurfaceInner>` | `--shadow-inner` | `none`（仅 `border #F5F5F5`） | 卡片内的子卡 / 表格容器 / 分组面板 |
| **L3 浮层** | `<SurfaceOverlay>` 或 shadcn 自带 | `--shadow-overlay` | `0px 4px 16px -2px rgba(0,0,0,0.08), 0px 2px 6px rgba(0,0,0,0.06)` | Dialog / Sheet / Drawer / Popover / DropdownMenu / 自定义浮层 |
| **L4 高亮配置卡** | `<SurfaceConfig>` | `--shadow-config` | `0px 2px 8px -1px rgba(0,0,0,0.05), 0px 2px 4px 2px rgba(0,0,0,0.05)` | 管理端"操作要点""引导卡""Pro 推荐卡"等需要强调的卡 |
| **L5 Segment 滑块** | 直接写 `boxShadow: var(--shadow-segment)` | `--shadow-segment` | `0px 1.11px 2.22px rgba(0,0,0,0.05)` | Tab 活跃滑块、Segmented Control 指示器 |
| 主按钮 hover glow | inline | — | `0 4px 14px rgba(20,71,230,0.3)` | CTA 按钮 hover 发光 |

### 5.2 用法示例

```tsx
import { SurfaceCard, SurfaceInner, SurfaceConfig } from "@/components/ui/Surface";

// L1 表层卡片：页面常规列表卡 / 统计卡
<SurfaceCard className="p-5">
  <h3 className="text-sm font-medium text-[#0A0A0A]">总请求数</h3>
  <p className="text-2xl font-semibold mt-1">2,186</p>
</SurfaceCard>

// L1 + hover 微抬：用于可点击的卡片
<SurfaceCard hover className="p-5 cursor-pointer">…</SurfaceCard>

// L2 内嵌卡：表格/列表容器（无阴影靠浅描边即可）
<SurfaceInner className="overflow-hidden">
  <header className="px-5 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">模型使用汇总</header>
  <table>…</table>
</SurfaceInner>

// L4 高亮卡：管理端引导/Pro 推荐
<SurfaceConfig className="p-6">…</SurfaceConfig>

// L5 Segment 滑块：直接 inline（很少见，仅 Tab/Segmented 实现内部）
<button style={{ boxShadow: "var(--shadow-segment)" }}>全部</button>
```

### 5.3 禁用清单（CI 拦截）

下列写法**全部禁止**出现在 `pages/**` 与 `components/**`（除 `components/ui/Surface.tsx` 本身和 shadcn 内部组件）：

| ❌ 禁止 | ✅ 用什么替代 |
|--------|--------------|
| `style={{ boxShadow: "0px 1px 4px ..." }}` | `<SurfaceCard>` |
| `className="shadow-md"` / `shadow-lg` / `shadow-xl` / `shadow-2xl` | `<SurfaceCard>` 或 `<SurfaceConfig>` |
| `className="hover:shadow-md"`（hover 跳档） | 改用 `<SurfaceCard hover>`（仅微抬不变阴影） |
| 「卡片只用 `border` 不带阴影」（除 L2 内嵌外） | `<SurfaceCard>` |
| 自己手写浮层 `bg-white shadow-lg rounded-md` | `<SurfaceOverlay>` 或直接用 shadcn `<Dialog>` |

**校验脚本**：项目根 `npm run check:shadow`（也已接入 `npm run check`）。该脚本会扫描 `client/src/{components,pages}/**`，发现 inline `boxShadow:` 或 `shadow-md|lg|xl|2xl` 即报错并阻断 CI。如确属浮层/Tab 滑块等合理场景，可在该行末尾或上一行添加注释 `// allow-shadow: <理由>` 进行豁免。

### 5.4 批量修改（设计规范变更场景）

| 需求 | 改动位置 | 影响范围 |
|------|---------|---------|
| L1 卡片阴影变深 10% | `index.css` 的 `--shadow-card` 一行 | 全站 L1 卡片 |
| L1 卡片重新加上描边 | `Surface.tsx` 的 `SurfaceCard` 增加 `border` 一行 | 全站 L1 卡片 |
| 全部 L1 卡片默认带 hover 微抬 | `SurfaceCard` 的默认 `className` | 全站 L1 卡片 |
| 增加新档位（例如 L6 强调卡） | `index.css` 加变量 + `Surface.tsx` 加组件 | 仅新组件影响 |

---

## 6. 动画系统

### 6.1 页面切换

所有页面根元素必须包含 `page-enter` class：

```css
.page-enter {
  animation: pageEnter 0.25s ease-out;
}
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 6.2 交互过渡

| 场景 | 类 |
|------|-----|
| 通用 hover | `transition-all duration-150` |
| 颜色变化 | `transition-colors` |
| 卡片 hover | `transition-all duration-200 hover:-translate-y-0.5` |
| 按钮 glow | `transition: box-shadow 0.2s ease` |

### 6.3 Dialog 动画

- 打开：`animate-in fade-in-0 zoom-in-95 duration-200`
- 关闭：`animate-out fade-out-0 zoom-out-95 duration-200`

---

## 7. 布局系统

### 7.1 Admin 布局

```
+--[ Sidebar w-[232px] fixed ]--+--[ Main ml-[232px] flex-1 p-8 ]--+
|  Logo (radius 4px)            |  bg: #FFFFFF                     |
|  Nav Groups                   |  page-enter 内容区               |
|    分组标题 12px #737373       |                                  |
|    菜单项 13px #0A0A0A         |                                  |
|    活跃项 渐变 + radius 4px    |                                  |
|  User Footer                  |                                  |
+-------------------------------+----------------------------------+
```

- Sidebar：`w-[232px]`, `fixed`, `bg-white`, `border-r border-[#E5E5E5]`
- 分组标题：`text-xs text-[#737373]`（12px）
- 菜单项：`px-3 py-2 rounded-[4px] text-[13px] gap-2.5 text-[#0A0A0A]`
- 活跃项：`text-[#1447E6]` + 背景 `linear-gradient(90deg, #EFF6FF 0%, rgba(20,71,230,0.05) 100%)`
- 导航 icon：`w-4 h-4`

### 7.2 Tenant 布局

```
+--[ Navbar h-16 fixed z-50 bg-white/90 backdrop-blur-md ]--+
|  Logo  |  Nav Items  |  管理后台按钮 + User               |
+-----------------------------------------------------------+
|  pt-16 min-h-screen                                       |
|  bg: linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)    |
|  内容区（依页面不同套不同 max-width）                       |
+-----------------------------------------------------------+
```

- Navbar：`h-16`, `fixed`, `z-50`, `bg-white/90`, `backdrop-blur-md`, `border-b border-[#E5E5E5]`
- 导航项：`px-4 py-2 rounded-[4px] text-sm font-medium`
- 活跃：`text-[#1447E6] bg-[#EFF6FF]`
- 非活跃：`text-[#334155] hover:text-[#0A0A0A] hover:bg-gray-50`

### 7.3 响应式网格

| 场景 | 列数 |
|------|------|
| **Agent 卡片（我的 Agent 页）** | **`grid-cols-2`**（固定两列，不随断点变化） |
| OpenClaw 卡片（其他页面） | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| 统计卡片 | `grid-cols-3` 或 `grid-cols-5` |
| 帮助文档 | `grid-cols-1 md:grid-cols-2` |

### 7.4 响应式规则（**用户端通用骨架**，以「我的 Agent」为基准）

> ⚠️ **作用域**：本节描述的 **1200/1920 三档响应式 + 80px 占位带骨架是用户端（Tenant）所有业务页的统一基准**，**管控端（Admin）一律不适用**。
> **设计意图**：让所有用户端 Tab/详情页在中等屏幕（笔记本）和超大屏（4K/外接显示器）上都保持一致的两侧留白节奏，视觉重心稳定居中——避免出现"切到不同 Tab 边距忽宽忽窄"的割裂感。卡片网格列数由各页内容密度自行决定，但**容器骨架完全一致**。

#### 三档断点

| 屏幕宽度 | 内容区宽度 | 两侧留白 | 卡片网格 | 滚动行为 |
|---|---|---|---|---|
| **> 1920px**（超大屏） | **固定最大宽 1920px** | 多出部分两侧均分自动留白 | 各页按内容密度自决 | 不出现横向滚动 |
| **1200px – 1920px**（常规） | **随屏幕宽度自适应** | 左右各 80px 占位带 + 段落 `px-[42px]` 内边距 | 各页按内容密度自决 | 不出现横向滚动 |
| **< 1200px**（小屏） | **锁死 1200px**，整体内容固定不变形 | 占位带与内边距保持原样不再收窄 | 各页按内容密度自决 | **整体横向滚动**（`min-w-[1200px]` 强制） |

#### 关键设计约束

1. **统一骨架**——所有用户端业务页都使用 `min-w-[1200px] overflow-x-clip` + `max-w-[1920px] mx-auto flex` + 左右各 `w-20`（80px）占位带 + 中间 `flex-1 min-w-0` 内容区，**段落级内边距统一 `px-[42px]`**。
2. **不做单列降级**——小屏触发整体横滚而非把卡片压扁/换行。
3. **不做强制列数升降级**——卡片列数由各页内容密度自决（如「我的 Agent」固定 `grid-cols-2`、技能广场用 `grid-cols-3 2xl:grid-cols-4`、详情页用单列长内容），但**容器骨架完全相同**。
4. **`min-w-[1200px]` 兜底**：写在最外层 wrapper（与 max-w 同级），确保小屏触发整体横向滚动而非内容压缩。

#### 标准实现（所有用户端业务页统一沿用）

```jsx
<TenantLayout>
  {/* 外层：min-w 兜底小屏（< 1200px 整体横滚） + overflow-x-clip 防装饰元素溢出 */}
  <div className="min-w-[1200px] overflow-x-clip">
    {/* 中层：max-w 限制超大屏（> 1920px 居中两侧留白） + flex 行布局承载左右占位带 */}
    <div className="max-w-[1920px] mx-auto flex items-stretch page-enter">
      {/* 左侧 80px 占位带 */}
      <div aria-hidden className="shrink-0 w-20 self-stretch" />
      {/* 中间内容区：flex-1 撑满 + min-w-0 防止子元素溢出撑爆容器 + px-[42px] py-8 段落内边距 */}
      <div className="flex-1 min-w-0 px-[42px] py-8">
        {/* 业务内容：卡片网格列数按内容密度自决 */}
      </div>
      {/* 右侧 80px 占位带 */}
      <div aria-hidden className="shrink-0 w-20 self-stretch" />
    </div>
  </div>
</TenantLayout>
```

#### 容易出错的写法（❌ 禁止）

| ❌ 错误写法 | 问题 | ✅ 正确写法 |
|---|---|---|
| `<div className="max-w-[1920px] mx-auto">` 缺 `min-w-[1200px]` 外壳 | 小屏会把内容压扁/换行，破坏布局节奏 | 加 `min-w-[1200px]` 外壳 |
| 直接 `max-w-[1920px] mx-auto px-6` 没有 80px 占位带 | 与「我的 Agent」两侧留白节奏不一致，切 Tab 时边距忽宽忽窄 | 套上完整骨架（左右 `w-20` 占位带 + 中间 `px-[42px]`） |
| `grid-cols-1 md:grid-cols-2` | 小屏触发单列降级，破坏密度一致性 | 直接固定列数（如 `grid-cols-2` / `grid-cols-3`），按内容密度选择 |
| `max-w-7xl mx-auto`（1280px） | 限宽过小，与其他用户端页面边距不一致 | 用 `max-w-[1920px]` + 占位带骨架 |
| `min-w-screen` / `w-screen` | 触发额外横向滚动条 | 用 `min-w-[1200px]` |

#### 配合 TenantLayout 的注意点

- TenantLayout 已固定 Navbar `h-16` + 主内容区 `bg: 白→灰渐变`，**不要在用户端业务页内自己再套一层背景**。
- 最外层一律加 `overflow-x-clip`，防止页面内任何 `100vw` 装饰元素（点阵/横向分隔线等）溢出触发整页横滚（与 `min-w-[1200px]` 触发的"内容横滚"互不冲突）：

  ```jsx
  <div className="min-w-[1200px] overflow-x-clip">
    <div className="max-w-[1920px] mx-auto flex items-stretch">
      <div aria-hidden className="shrink-0 w-20 self-stretch" />
      <div className="flex-1 min-w-0 px-[42px] py-8">…</div>
      <div aria-hidden className="shrink-0 w-20 self-stretch" />
    </div>
  </div>
  ```

#### 适用范围（重要）

- ✅ **所有用户端（Tenant）业务页**：「我的 Agent」（`MyOpenClaw.tsx`）、OpenClaw 详情（`OpenClawDetail.tsx`）、技能广场（`SkillSquare.tsx`）、模型额度（`ModelQuota.tsx`）、帮助文档（`HelpDocs.tsx`）等，**统一使用本节标准骨架**，确保切换 Tab 时两侧留白节奏一致。
- ⚠️ **窄表单类页面例外**：仅承载居中表单的纯辅助页（如 `ResetPassword.tsx` 用 `max-w-md`、登录/注册等）保留窄表单居中布局，**不套用本节骨架**（套上后窄表单与 80px 占位带视觉比例失衡）。
- ❌ **管控端（Admin）禁止套用本规则**：管控端沿用固定布局（主内容区 1496px + 侧栏 232px），**不做任何响应式适配**，详见下方说明。

---

### 7.5 点阵装饰背景规则（**用户端通用骨架**，与 §7.4 配合使用）

> ⚠️ **作用域**：本节是 §7.4 三档骨架的**视觉填充层**，规定了用户端业务页两侧 80px 占位带 + 中间内容区上下边界附近的"点阵 + 贯穿横线 + 贯穿竖线"装饰系统。**所有用户端业务页（包括「我的 Agent」、OpenClaw 详情、技能广场、模型额度等）必须严格沿用，确保切换 Tab/页时背景节奏完全一致。**
> **设计意图**：让两侧 80px 占位带不是"裸露的灰背景"，而是用极轻量的点阵图案承接视觉，并通过左右贯穿竖线 + 上下贯穿横线把内容区"框住"，形成稳定的设计语言（参考 Figma 446:2942 / 358:2322）。

#### 7.5.1 视觉规格（不可改）

| 元素 | 值 |
|------|-----|
| **点阵网格** | `12px × 12px` |
| **点阵圆点** | 半径 1px，颜色 `#DFE2E5`（`backgroundImage: radial-gradient(circle, #DFE2E5 1px, transparent 1.1px); backgroundSize: 12px 12px`） |
| **左右贯穿竖线** | 1px / `#E2E8F0` / `top-0 bottom-0` 全高贯穿 / `z-30`（覆盖业务渐变背景） |
| **上下贯穿横线** | 1px / `#E2E8F0` / `width: 100vw` + `left: calc(50% - 50vw)` 横跨全视口 |
| **底部留白带高度** | **75px**（中间内容区 `paddingBottom: 75px`，与 §3.1 间距对齐） |

#### 7.5.2 布局拓扑（关键）

```
┌─ 视口 100vw ──────────────────────────────────────────────────┐
│   ┌─ middle content（flex-1） ────────────────────────────┐    │
│   │ Header 段（页面标题/返回/操作按钮）                     │    │
│   ├═══[ Header 底部贯穿横线（width:100vw）]══════════════════│
│ ··│              tab / 卡片内容                          │·· │
│ ··│              （中间业务内容区）                        │·· │
│ ··│                                                       │·· │
│ ··│                                                       │·· │
│   ├═══[ 底部分隔栏顶部贯穿横线（width:100vw）]═══════════════│
│   │ ↕ 75px paddingBottom（深灰背景"裸露带"，无点阵）       │    │
│   └─────────────────────────────────────────────────────────┘
│ ↑ 左侧 80px 占位带（点阵）        ↑ 右侧 80px 占位带（点阵）
└────────────────────────────────────────────────────────────┘
```

**关键要点**：
1. **点阵只覆盖"两侧 80px 占位带 + Header 底部横线 ~ 底部分隔栏顶部横线"区间**，不进入中间内容区，也不延伸到底部 75px 留白带。
2. **左右贯穿竖线 `top-0 bottom-0` 全高贯穿**（包括底部 75px 留白带），把整个中间内容区"框住"。
3. **底部 75px 留白带没有点阵**——是"裸露"的页面背景灰色带（来自 TenantLayout 的 `linear-gradient 180deg #FFFFFF→#F5F5F5`）。
4. **点阵 `top` 与 `bottom` 必须用 ResizeObserver 动态测量**（不能写死像素值），因为 Header 高度会随 ConfigBanner、QuickStartGuide 等模块展开/收起而变化。

#### 7.5.3 标准实现（所有需要点阵背景的用户端业务页统一沿用）

```tsx
import { useState, useRef, useCallback, useEffect } from "react";
import TenantLayout from "@/components/TenantLayout";

export default function MyTenantPage() {
  // ═════ 点阵高度动态计算 ═════
  const roRef = useRef<ResizeObserver | null>(null);
  const middleSectionRef = useRef<HTMLDivElement | null>(null);
  const headerElRef = useRef<HTMLElement | null>(null);
  const bottomBarElRef = useRef<HTMLDivElement | null>(null);
  const [dotsTop, setDotsTop] = useState(112);    // header 底部 ≈ 112
  const [dotsBottom, setDotsBottom] = useState(75); // 底部分隔栏顶部 ≈ 75

  const recompute = useCallback(() => {
    const middle = middleSectionRef.current;
    const header = headerElRef.current;
    const bottomBar = bottomBarElRef.current;
    if (!middle) return;
    if (header) {
      const middleRect = middle.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      setDotsTop(headerRect.bottom - middleRect.top);
    }
    if (bottomBar) {
      const middleRect = middle.getBoundingClientRect();
      const barRect = bottomBar.getBoundingClientRect();
      const barTopInMiddle = barRect.top - middleRect.top;
      setDotsBottom(middle.offsetHeight - barTopInMiddle);
    }
  }, []);

  // 中间内容区 ref
  const middleRef = useCallback((node: HTMLDivElement | null) => {
    middleSectionRef.current = node;
    recompute();
  }, [recompute]);

  // Header ref（同时初始化 ResizeObserver，监听 header / middle / bottomBar 三者尺寸变化）
  const headerRef = useCallback((node: HTMLElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    headerElRef.current = node;
    if (!node) { recompute(); return; }
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    if (middleSectionRef.current) ro.observe(middleSectionRef.current);
    if (bottomBarElRef.current) ro.observe(bottomBarElRef.current);
    roRef.current = ro;
  }, [recompute]);

  // 底部分隔栏 ref
  const bottomBarRef = useCallback((node: HTMLDivElement | null) => {
    bottomBarElRef.current = node;
    recompute();
    if (node && roRef.current) roRef.current.observe(node);
  }, [recompute]);

  // 监听窗口尺寸变化
  useEffect(() => {
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [recompute]);

  return (
    <TenantLayout>
      {/* §7.4 三档骨架：min-w / max-w / 80px 占位带 */}
      {/* min-h-[calc(100vh-64px)]：保证内容少时也能撑满视口，避免底部出现"裸露背景"区 */}
      <div className="min-w-[1200px] overflow-x-clip">
        <div className="max-w-[1920px] mx-auto flex items-stretch page-enter min-h-[calc(100vh-64px)]">
          {/* 左侧 80px 占位带 */}
          <div aria-hidden className="shrink-0 w-20 self-stretch" />

          {/* 中间内容区：paddingBottom 75px 留出底部空白 */}
          <div ref={middleRef} className="flex-1 min-w-0 relative" style={{ paddingBottom: "75px" }}>
            {/* ───── 左侧点阵装饰层（向左外延出占位带） ───── */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                top: `${dotsTop}px`,
                bottom: `${dotsBottom}px`,
                left: "calc((100% - 100vw) / 2)", // 父级 100% = 中间区宽度 W；此值为负，向左延伸到视口左边
                right: "100%",                     // 紧贴中间内容区左边外侧
                backgroundImage: "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                backgroundSize: "12px 12px",
              }}
            />
            {/* ───── 右侧点阵装饰层（向右外延出占位带） ───── */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                top: `${dotsTop}px`,
                bottom: `${dotsBottom}px`,
                left: "100%",
                right: "calc((100% - 100vw) / 2)",
                backgroundImage: "radial-gradient(circle, #DFE2E5 1px, transparent 1.1px)",
                backgroundSize: "12px 12px",
              }}
            />
            {/* ───── 左右贯穿竖线（全高贯穿到底，包括 75px 留白带） ───── */}
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

            {/* ═════ 业务内容主体 ═════ */}
            <div className="relative">
              {/* Header 段：自带底部贯穿横线，作为点阵的上边界 */}
              <header ref={headerRef} className="relative px-[42px] py-6">
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
                {/* … header 业务内容 … */}
              </header>

              {/* 业务内容区 */}
              <div className="px-[42px] py-8">
                {/* … tab / 卡片网格 / 列表 等业务内容 … */}
              </div>

              {/* 底部分隔栏：自带顶部贯穿横线，作为点阵的下边界；下方由父容器 paddingBottom:75px 留出空白 */}
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
                {/* 如有分页/统计信息可放此（参考 MyOpenClaw 分页栏） */}
              </div>
            </div>
          </div>

          {/* 右侧 80px 占位带 */}
          <div aria-hidden className="shrink-0 w-20 self-stretch" />
        </div>
      </div>
    </TenantLayout>
  );
}
```

#### 7.5.4 容易出错的写法（❌ 禁止）

| ❌ 错误写法 | 问题 | ✅ 正确写法 |
|---|---|---|
| 点阵用 `top: 112` / `bottom: 180` 写死像素值 | Header 折叠/展开时点阵不跟随，出现错位 | 用 ResizeObserver + getBoundingClientRect 动态算 |
| 点阵 `bottom: 0`（不设底部分隔栏） | 点阵延伸到 75px 留白带内，破坏底部"深灰留白带"视觉 | 加底部分隔栏，用 bottomBarRef 动态算 `dotsBottom` |
| 底部装饰横线用 `fixed bottom: 75px` | 横线脱离内容流，内容少时位置错乱、与竖线/点阵不对齐 | 用 `absolute` 作为底部分隔栏自身的顶部贯穿横线 |
| 中间内容区用 `pb-32`（128px） | 与 §3.1 间距 token 不一致，底部留白偏厚 | 统一用 `paddingBottom: 75px` |
| 缺 `min-h-[calc(100vh-64px)]` | 内容少时整体不撑满视口，底部 80px 占位带露出"无点阵无竖线"的裸露灰带 | 在最外层 `flex` 容器加 `min-h-[calc(100vh-64px)]`（64px 是 TopNav 高度） |
| 点阵层缺 `pointer-events-none` | 拦截下方按钮/链接的点击 | 必加 `pointer-events-none` |
| 贯穿竖线缺 `z-30` | 被业务渐变背景（如 QuickStartGuide）覆盖看不见 | 加 `z-30` 提层 |
| 点阵 `right: "calc((100% - 100vw) / 2)"` 用错正负号 | 点阵不向外延伸或溢出错位 | 严格遵循"左侧用 `left: calc((100% - 100vw) / 2); right: 100%`、右侧用 `left: 100%; right: calc((100% - 100vw) / 2)`" |

#### 7.5.5 适用范围

- ✅ **所有需要"两侧 80px 占位带 + 点阵 + 贯穿线"视觉的用户端业务页**：「我的 Agent」（`MyOpenClaw.tsx`，参考实现）、OpenClaw 详情（`OpenClawDetailGuide.tsx`）、技能广场、模型额度等。
- ⚠️ **窄表单页 / 登录页 / 帮助文档纯文章页**：可不套用本节装饰，仅保留 §7.4 的占位带骨架即可。
- ❌ **管控端（Admin）禁用**：管控端不使用 80px 占位带骨架，自然也无点阵装饰。

#### 7.5.6 参考实现源码

> 任何对接此规则的新页面，请直接参考以下两个文件的源码（已是规范实现）：
> - `client/src/pages/tenant/MyOpenClaw.tsx`：完整版（带 HeroBanner + QuickStartGuide + 分页栏作为底部分隔栏）
> - `client/src/pages/tenant/OpenClawDetailGuide.tsx`：精简版（无 HeroBanner，纯 Header + Tab + 三栏卡片 + 独立底部分隔栏）

---

**管理端响应式**：暂不做响应式适配，沿用固定布局（主内容区 1496px + 侧栏 232px）。**不要把用户端的 `min-w-[1200px]` / `max-w-[1920px]` / 1200–1920 自适应规则套到管控端任何页面上**。

---

## 8. 组件规范

### 8.1 按钮（Button）— **唯一真理源：`@/components/ui/button` 的 `claw-*` 变体**

> 与 Figma「按钮」ComponentSet `317:1051` 严格对齐。详细 token 表 + 调用示例见 `docs/DESIGN_SYSTEM_BUTTON.md`。
> **铁律**（业务层 = `pages/**` 与 `components/**`，**不含** `components/ui/**`）：
> 1. **禁止** inline `style={{ background: "linear-gradient(...)" }}` 模拟主按钮 —— 用 `variant="claw-primary"`。
> 2. **禁止** `variant="outline" + className="border-[#E5E5E5]"` 拼装次级按钮 —— 用 `variant="claw-outline"`。
> 3. **禁止**直接用 shadcn `variant="outline"` 表达 ClawPro 业务次级按钮（取消/刷新/下载/重试恢复/全宽表单按钮等）—— 一律换成 `variant="claw-outline"`。`outline` 仅保留给 shadcn 内部模式（如 Combobox/Popover trigger），且必须加 `// allow-shadcn-outline: <理由>` 行级注释。
> 4. **禁止**手写 `bg-orange-500 / bg-red-600 text-white` 之类破坏性按钮 —— 用 `variant="destructive"`。

#### 变体（variant）

| variant | 用途 | 视觉 |
|---|---|---|
| `claw-primary` | 主操作（创建/确认/提交/重试/进入终端） | 黑→蓝渐变 + 白字；hover 加深 |
| `claw-outline` | 次级操作（详细配置/取消/刷新） | 白底 + `#E5E5E5` 边 + `#020617` 字；hover 浅蓝渐变 + 蓝边 |

shadcn 自带的 `default / outline / destructive / secondary / ghost / link` 仍保留，但**新代码不要再用它们承载 Figma 设计稿里的主按钮 / 次级按钮**——请直接 `claw-primary` / `claw-outline`。

#### 尺寸（size）

| size | 维度 | 用途 |
|---|---|---|
| `claw` | h36 / px24 / py8 / gap8 | 默认尺寸，卡片底部「详细配置」「重试」 |
| `claw-sm` | h32 / px16 / py4 / gap6 | 紧凑场景，Dialog footer / 行内主按钮 |
| `claw-square` | 48×36 / p0 | 仅图标的方形次级按钮（卡片角落「刷新」） |
| `claw-lg` | h40 / px18 / py4 / gap16 | 深色主按钮（页面顶部「创建 Agent」） |

#### 调用示例

```tsx
// 卡片底部：详细配置（次级 + 文字 icon）
<Button variant="claw-outline" size="claw">
  <Settings className="w-3.5 h-3.5" />
  详细配置
</Button>

// 卡片角落：刷新（次级 + 仅图标）
<Button variant="claw-outline" size="claw-square" aria-label="刷新">
  <RefreshCw className="w-3.5 h-3.5" />
</Button>

// Dialog 主操作（紧凑）
<Button variant="claw-primary" size="claw-sm" onClick={handleConfirm}>
  确认
</Button>

// 页面顶部主按钮（深色填充）
<Button variant="claw-primary" size="claw-lg">
  <Plus />
  创建 Agent
</Button>
```

#### 触达即同步：禁止 / 正确 对照

| 场景 | ❌ 旧写法 | ✅ 新写法 |
|---|---|---|
| 主操作 | `<Button style={{ background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)" }} className="text-white">` | `<Button variant="claw-primary" size="claw">` |
| 紧凑主操作（h-8） | `<Button size="sm" style={{ background: "linear-gradient(...)" }} className="text-white px-4">` | `<Button variant="claw-primary" size="claw-sm">` |
| 详细配置按钮 | `<Button variant="outline" className="h-9 px-6 rounded-[4px]" style={{ borderColor: "#E5E5E5" }}>` | `<Button variant="claw-outline" size="claw">` |
| 仅图标方按钮 | `<Button variant="outline" className="h-9 w-12 p-0" style={{ borderColor: "#E5E5E5" }}>` | `<Button variant="claw-outline" size="claw-square">` |
| 创建 Agent 主按钮 | 自己手写 `<button className="bg-gradient-to-r from-black ...">` | `<Button variant="claw-primary" size="claw-lg">` |
| icon 与文字间距 | `<Icon className="mr-2" />` | 不需要 `mr-2`，size 已自动配 `gap` |

#### 配合 `<Link>` 跳转

```tsx
<Link href="/somewhere">
  <Button variant="claw-outline" size="claw">…</Button>
</Link>
```

#### 仍然需要 inline `style={{ background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)" }}` 的合法场景

只有以下场景**不属于按钮**，可以保留 inline 渐变（不在禁用范围内）：
- **Logo / 头像底色容器**（如 `TenantLayout` 顶部 🦞 logo、`AvatarFallback`）
- **进度条填充**（如 ChatView 浏览器加载条）
- **小色块装饰**（如 MemoryCard 的徽标胶囊、icon 容器）
- **自定义 Checkbox / 勾选框小方块**（如 OpenClawDetail 内联 checkbox）
- **圆形发送按钮**（聊天输入栏 27×27 圆形）——这是产品特有形态，规范里没有对应 size，可以继续 inline，但**应在该行加 `// allow-inline-gradient: <理由>` 注释**

#### 仍然需要保留 shadcn `variant="outline"` 的合法场景

只有以下场景**不是业务次级按钮**，可以继续用 shadcn `outline`，但**必须在该行加 `// allow-shadcn-outline: <理由>` 注释**：
- **Combobox / Popover trigger**（`<Button variant="outline" role="combobox">...</Button>`，shadcn 内置交互模式，换成 `claw-outline` 会破坏选择器外观与 hover 行为）
- **DatePicker / Select trigger**（同上，属于表单控件外壳，不是业务按钮）

> 判定原则：**只要是用户会理解为"按钮 = 一个操作"的元素**（取消/刷新/下载/取消修改/暂不重启/上一步/返回列表/前往授权/重试恢复 等），全部走 `claw-outline`，没有例外。

#### 自检（CI）

> 自检脚本 `scripts/check-card-shadow.cjs` 后续会增加按钮规则维度（计划项），届时违规以 BASELINE 兜底机制处理。当前阶段靠 PR Review + 触达即同步。


### 8.2 状态徽章

```jsx
<span className="badge-running">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
  运行中
</span>
```

CSS 定义（圆角调整为 2px）：
```css
.badge-running { background: rgba(52,199,89,0.12); color: #1a8c3a; border-radius: 2px; padding: 2px 8px; }
.badge-stopped { background: rgba(255,59,48,0.1); color: #c0392b; border-radius: 2px; padding: 2px 8px; }
.badge-pending { background: rgba(255,149,0,0.1); color: #b8640a; border-radius: 2px; padding: 2px 8px; }
.badge-new { background: #1447E6; color: #fff; border-radius: 2px; padding: 1px 6px; font-family: 'Open Sans', sans-serif; font-size: 10px; }
```

### 8.3 卡片（通用）

> ⚠️ **铁律**：业务层一律用 `<SurfaceCard>`，禁止手写 `<div className="bg-white rounded-[4px] ...">` + inline boxShadow。详见 §5。

```jsx
import { SurfaceCard } from "@/components/ui/Surface";

<SurfaceCard className="overflow-hidden">
  <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5E5]">
    <h2 className="text-base font-semibold text-[#0A0A0A]">标题</h2>
  </div>
  {/* 内容 */}
</SurfaceCard>
```

### 8.4 Agent 卡片（用户端「我的 Agent」核心组件）

```jsx
import { SurfaceCard } from "@/components/ui/Surface";

<SurfaceCard hover className="p-5 cursor-pointer">
  <div className="flex items-start justify-between mb-3">
    <h3 className="text-sm font-medium text-[#0A0A0A]">Agent 名称</h3>
    <span className="badge-new">New</span>
  </div>
  <div className="space-y-1 text-xs">
    <div className="text-[#334155]">ID: agent_xxx</div>
    <div className="text-[#334155]">分组：默认分组</div>
    <div className="text-[#737373]">更新于 2026-05-13 20:30</div>
  </div>
</SurfaceCard>
```

### 8.5 管理端配置卡（描边 0.5px，圆角 4px）

```jsx
import { SurfaceConfig } from "@/components/ui/Surface";

<SurfaceConfig className="p-6">
  <h3 className="text-base font-semibold text-[#0A0A0A] mb-1">配置标题</h3>
  <p className="text-xs text-[#737373] mb-5">配置说明</p>
  {/* 配置项 */}
</SurfaceConfig>
```

### 8.6 Tab 切换（Segmented Control）

| 状态 | 字重 | 文字色 | 背景 | 阴影 |
|------|------|--------|------|------|
| **选中** | `font-medium` | `#0A0A0A` / `#020617` | `bg-white` | `var(--shadow-segment)` |
| **未选中** | `font-normal` | `#737373` | 透明 | 无 |
| **未选中 hover** | `font-normal` | `#0A0A0A` | 透明 | 无 |

> **关键**：选中态必须加粗（`font-medium`），未选中态保持 `font-normal`，通过字重差异强化视觉区分。阴影统一使用 `var(--shadow-segment)` token，不要手写数值。

```jsx
<div className="inline-flex items-center gap-1 p-1 bg-[#F5F5F5] rounded-[4px]">
  <button
    className="px-3 py-1 text-sm font-medium rounded-[3px] bg-white text-[#0A0A0A]"
    style={{ boxShadow: "var(--shadow-segment)" }}
  >
    全部
  </button>
  <button className="px-3 py-1 text-sm font-normal text-[#737373] hover:text-[#0A0A0A] rounded-[3px]">
    我创建的
  </button>
</div>
```

### 8.7 Switch 开关

```jsx
<button
  className="relative w-7 h-4 rounded-full transition-colors"
  style={{ background: enabled ? "#1447E6" : "#E5E5E5" }}
>
  <span
    className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform"
    style={{ transform: enabled ? "translateX(14px)" : "translateX(2px)" }}
  />
</button>
```
- 容器：宽 28px × 高 16px，圆角 100px (`rounded-full`)
- 开启色：`#1447E6`，关闭色：`#E5E5E5`

### 8.8 标签胶囊（分类筛选）

```jsx
<button className="px-4 py-1.5 rounded-full text-sm font-medium border border-[#E5E5E5] text-[#334155] hover:border-[#1447E6] hover:text-[#1447E6]">
  全部分类
</button>
<button className="px-4 py-1.5 rounded-full text-sm font-medium bg-[#1447E6] text-white">
  营销
</button>
```

### 8.9 表格

**使用原生 `<table>`，不使用 shadcn Table**：

```jsx
<table className="w-full">
  <thead>
    <tr className="border-b border-[#E5E5E5] bg-gray-50/50">
      <th className="text-left px-6 py-3 text-xs font-medium text-[#737373] uppercase tracking-wide">
        列名
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-[#E5E5E5]">
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-6 py-4 text-sm text-[#334155]">内容</td>
    </tr>
  </tbody>
</table>
```

### 8.10 统计卡片

```jsx
import { SurfaceCard } from "@/components/ui/Surface";

<SurfaceCard className="p-5">
  <div className="flex items-center gap-3 mb-3">
    <div className="w-9 h-9 rounded-[4px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
      <IconName className="w-5 h-5 text-white" />
    </div>
    <span className="text-xs text-[#737373]">标签</span>
  </div>
  <div className="text-2xl font-bold text-[#020617] tabular-nums font-din">数值</div>
</SurfaceCard>
```

### 8.11 搜索筛选栏

```jsx
<div className="flex flex-wrap gap-3 mb-4 items-center">
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
    <Input placeholder="搜索..." className="pl-9 bg-white w-64 rounded-[4px] border-[#E5E5E5]" />
  </div>
  <button className="w-9 h-9 rounded-[4px] border border-[#E5E5E5] bg-white text-[#737373] hover:text-[#1447E6] hover:border-[#1447E6]">
    <RefreshCw className="w-4 h-4" />
  </button>
</div>
```

### 8.12 Dialog

- 圆角统一 `rounded-[4px]`
- 小确认框：`sm:max-w-sm`
- 中表单：`sm:max-w-md`
- 大表单：`sm:max-w-lg`
- 详情查看：`sm:max-w-2xl`
- 长表单加：`max-h-[90vh] overflow-y-auto`

### 8.13 提示横幅

```jsx
{/* 信息提示 */}
<div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-[4px] px-4 py-3 mb-6">
  <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
  <p className="text-xs text-blue-600 leading-relaxed">提示文字</p>
</div>

{/* 警告提示 */}
<div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-[4px] px-3 py-2.5">
  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
  <p className="text-xs text-amber-700 leading-relaxed">警告文字</p>
</div>
```

### 8.14 分页

活跃页码使用黑→蓝渐变：
```jsx
<button
  style={{ background: "linear-gradient(90deg, #020617 70%, #1447E6 100%)" }}
  className="w-7 h-7 rounded-[4px] text-white text-xs font-medium"
>
  {page}
</button>
```
非活跃页码：`variant="ghost" size="sm"`, `w-7 h-7 text-xs text-[#737373] rounded-[4px]`

### 8.15 进度条

```jsx
<div className="w-full bg-gray-100 rounded-full h-1.5">
  <div
    className={`h-1.5 rounded-full transition-all ${
      pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-[#1447E6]"
    }`}
    style={{ width: `${pct}%` }}
  />
</div>
```

### 8.16 步骤标识（Step 1/2/3）

```jsx
<span className="font-mono text-sm font-medium text-[#1447E6]" style={{ fontFamily: "Menlo, monospace" }}>
  Step 1
</span>
```

---

## 9. 图标规范

**唯一图标库**：`lucide-react`。禁止使用 emoji、FontAwesome 或其他图标库。

| 用途 | 尺寸 |
|------|------|
| 导航项 | `w-4 h-4` |
| 按钮内 | `w-4 h-4` |
| 统计 icon 容器内 | `w-5 h-5` |
| 表格行操作 | `w-3.5 h-3.5` |
| 空状态 | `w-12 h-12 text-[#E5E5E5]` |

### 导航图标映射

| 页面 | 图标 |
|------|------|
| 基础信息 | `Settings` |
| 成员管理 | `Users` |
| 模型配置 | `Brain` |
| 通道配置 | `MessageSquare` |
| 技能配置 | `Puzzle` |
| 镜像管理 | `HardDrive` |
| 安全组 | `ShieldCheck` |
| OpenClaw 监控 | `Activity` |
| Tokens 监控 | `BarChart3` |
| 审计日志 | `ClipboardList` |
| 帮助文档 | `FileText` |

---

## 10. 状态模式

### 10.1 空状态

```jsx
<div className="text-center py-24">
  <Bot className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
  <p className="text-[#A3A3A3] mb-4">暂无数据描述</p>
  <Button variant="outline" className="rounded-[4px]">操作按钮</Button>
</div>
```

表格空状态：
```jsx
<td colSpan={N} className="px-6 py-12 text-center text-sm text-[#A3A3A3]">
  暂无符合条件的记录
</td>
```

### 10.2 操作反馈

- **成功**：`toast.success("操作成功")`
- **错误**：`toast.error("操作失败")`
- **加载**：按钮 `disabled` + 图标 `animate-spin`
- **刷新**：`setTimeout(..., 1000)` 模拟 + `toast.success("列表已刷新")`

### 10.3 禁用态

- 停用 OpenClaw：`opacity-40 cursor-not-allowed`
- 不可操作按钮：`disabled` + Tooltip 说明原因
- 只读输入：`bg-gray-100 cursor-not-allowed select-none text-[#A3A3A3]`

### 10.4 危险操作确认

使用 `AlertDialog`（非 `Dialog`），红色确认按钮：
```jsx
<AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white rounded-[4px]">
  确认删除
</AlertDialogAction>
```

---

## 11. 图表规范

统一使用 **recharts**（LineChart 为主），主色更新为 `#1447E6`：

```jsx
<LineChart>
  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  <XAxis tick={{ fontSize: 11, fill: "#737373" }} />
  <YAxis tick={{ fontSize: 11, fill: "#737373" }} />
  <Line stroke="#1447E6" strokeWidth={2} name="输入" />
  <Line stroke="#020617" strokeWidth={2} name="输出" />
</LineChart>
```

---

## 12. 关键约束（必须遵守）

1. **不要引入新的 CSS 框架或 UI 库**。所有组件基于 Tailwind CSS + shadcn/ui + 自定义样式实现。
2. **不要使用 shadcn Card 替代原生 div 卡片**。卡片**必须**使用 `<SurfaceCard>`（from `@/components/ui/Surface`），禁止手写 `<div className="bg-white rounded-[4px] ...">` + inline boxShadow。
3. **不要使用 shadcn Table 替代原生 table**。使用原生 `<table>` + 自定义类。
4. **不要发明新的状态颜色**。运行/停止/待处理严格使用 `badge-running` / `badge-stopped` / `badge-pending`。
5. **不要使用 emoji 作为图标**。统一使用 `lucide-react`。
6. **所有页面根元素必须包含 `page-enter` class**。
7. **品牌渐变通过 inline style 设置**，不要用 Tailwind gradient 类近似模拟。
8. **卡片阴影由 `<SurfaceCard>` 等 Surface 组件统一提供**，业务层禁止 inline `boxShadow:` 与 Tailwind `shadow-md/lg/xl/2xl`。CI 通过 `npm run check:shadow` 拦截违规。
9. **toast 通知统一使用 sonner**，不要使用 alert() 或自定义 notification。
10. **每个页面组件自行包裹 Layout**（`<AdminLayout>` 或 `<TenantLayout>`），不要在路由层嵌套。
11. **中文 UI**：所有界面文案使用简体中文。
12. **数据操作通过 useState + mock 数据**，不直接调用后端 API。
13. **圆角不得超过 4px**（`full` 除外）。禁止使用 `rounded-md/lg/xl/2xl/3xl`。
14. **用户端页面背景必须是白→灰渐变**（最外层 inline style）。

---

## 13. 新页面 Checklist

创建任何新页面前，逐项确认：

- [ ] 选择正确的 Layout（Admin/Tenant）
- [ ] 用户端页面最外层应用 `linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)` 背景
- [ ] 根元素包含 `page-enter` class
- [ ] 卡片**必须**使用 `<SurfaceCard>` / `<SurfaceConfig>`（from `@/components/ui/Surface`），禁止手写 `bg-white rounded-[4px] border` + inline boxShadow（CI 会拦截）
- [ ] 表格使用原生 `<table>` + 规范的 thead/tbody 类
- [ ] 按钮使用正确的 variant 和 size，主 CTA 使用黑→蓝渐变
- [ ] 状态徽章使用 `badge-running/stopped/pending/new`
- [ ] 图标来自 lucide-react，尺寸正确
- [ ] 间距遵循系统（p-8/p-6/gap-4 等）
- [ ] 文字色使用 `#0A0A0A / #334155 / #737373 / #A3A3A3` 阶梯
- [ ] 主品牌色统一使用 `#1447E6`（不再使用 `#007AFF`）
- [ ] 圆角不超过 4px（除 `rounded-full`）
- [ ] 用户端业务页统一应用「我的 Agent」骨架（§7.4）：外层 `min-w-[1200px] overflow-x-clip` + 中层 `max-w-[1920px] mx-auto flex items-stretch` + 左右各 `w-20` 占位带 + 中间 `flex-1 min-w-0 px-[42px] py-8`；卡片网格列数按内容密度自决，但容器骨架对所有用户端业务页保持一致（窄表单页如 `ResetPassword` 例外）
- [ ] 操作反馈使用 `toast.success/error`
- [ ] 空状态有友好提示
- [ ] 危险操作使用 AlertDialog 确认

---

## 14. Webfont 接入

### 14.1 需要引入的字体

| 字体 | 是否需引入 | 来源 | 备注 |
|---|---|---|---|
| PingFang SC | ❌ 不需要 | Apple 系统字体 | macOS/iOS 自带，Windows 用 fallback |
| Menlo | ❌ 不需要 | macOS 系统字体 | Windows fallback：`Consolas, 'Courier New'` |
| **DIN Alternate** | ⚠️ macOS 自带，Windows 需引入 | iOS/macOS 自带 | 替代未购授权的 DIN Next LT Pro |
| **Open Sans** | ✅ 需要 | Google Fonts（免费） | 用于 New / Beta Badge |

### 14.2 CSS @font-face（self-host 推荐）

将字体文件放入 `public/fonts/`，在 `src/index.css` 顶部添加：

```css
/* Open Sans Regular & Medium */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/OpenSans-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/OpenSans-Medium.woff2') format('woff2');
}

/* DIN Alternate（仅 Windows fallback，macOS 自带） */
/* 如需 Windows 端一致，可购买 DIN Alternate Bold 单字重并 self-host */
```

> CDN 替代方案（首版可用）：
> ```html
> <link rel="preconnect" href="https://fonts.googleapis.com">
> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
> <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet">
> ```

### 14.3 全局字体变量（src/index.css）

```css
:root {
  --font-sans: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-mono: 'Menlo', 'Consolas', 'Courier New', monospace;
  --font-din: 'DIN Alternate', 'DIN', 'Helvetica Neue', sans-serif;
  --font-en: 'Open Sans', 'Helvetica Neue', sans-serif;
}

html, body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 14.4 Tailwind 配置（tailwind.config.js / @theme）

Tailwind v4 使用 CSS `@theme`：

```css
@theme {
  --font-sans: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-mono: 'Menlo', 'Consolas', 'Courier New', monospace;
  --font-din: 'DIN Alternate', 'DIN', 'Helvetica Neue', sans-serif;
  --font-en: 'Open Sans', 'Helvetica Neue', sans-serif;
}
```

使用：
```jsx
<span className="font-din text-2xl tabular-nums">1,234</span>
<span className="font-mono">Step 1</span>
<span className="font-en">New</span>
```
