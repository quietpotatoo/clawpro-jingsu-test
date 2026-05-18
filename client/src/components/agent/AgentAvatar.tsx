/**
 * AgentAvatar - 按角色身份渲染的 48x48 头像
 *
 * 对齐 Figma node 517:4002「助手」组件集合：
 *   每个角色头像由两层叠加而成：
 *   1) 渐变背景圆（各角色不同渐变色）
 *   2) 角色专属头像图片（从 /assets/avatars/ 加载）
 *
 * 角色与头像映射（来自 Figma Component Set 517:4002）：
 *   ┌────────────┬──────────────────────┬──────────────────────────────────────┐
 *   │ 角色        │ 头像文件              │ 渐变背景                              │
 *   ├────────────┼──────────────────────┼──────────────────────────────────────┤
 *   │ 默认/通用助手│ avatar-default.png   │ linear-gradient(180deg, #A9C0F4)     │
 *   │ 设计师      │ avatar-designer.png  │ linear-gradient(180deg, #F3ECC4)     │
 *   │ 行业分析师  │ avatar-analyst.png   │ linear-gradient(180deg, #DCDCF2)     │
 *   │ 内容创作者  │ avatar-creator.png   │ linear-gradient(180deg, #EBE7D6)     │
 *   │ 开发工程师  │ avatar-developer.png │ linear-gradient(180deg, #F3ECC4)     │
 *   │ 项目经理    │ avatar-pm.png        │ linear-gradient(180deg, #D7E7CA)     │
 *   │ 运营        │ avatar-operator.png  │ linear-gradient(180deg, #DCDCF2)     │
 *   └────────────┴──────────────────────┴──────────────────────────────────────┘
 */

interface AvatarSpec {
  /** 头像图片路径 */
  src: string;
  /** 渐变背景色 */
  background: string;
}

/**
 * 角色名 → 头像配置。键值与业务侧的 roleName 完全一致；
 * 业务侧若出现别名（如「数据分析师」），在 ROLE_ALIAS 中映射到标准名。
 */
const ROLE_AVATAR: Record<string, AvatarSpec> = {
  默认: {
    src: "/assets/avatars/avatar-default.png",
    background: "linear-gradient(180deg, #A9C0F4 0%, #A9C0F4 100%)",
  },
  通用助手: {
    src: "/assets/avatars/avatar-default.png",
    background: "linear-gradient(180deg, #A9C0F4 0%, #A9C0F4 100%)",
  },
  设计师: {
    src: "/assets/avatars/avatar-designer.png",
    background: "linear-gradient(180deg, #F3ECC4 0%, #F3ECC4 100%)",
  },
  行业分析师: {
    src: "/assets/avatars/avatar-analyst.png",
    background: "linear-gradient(180deg, #DCDCF2 0%, #DCDCF2 100%)",
  },
  内容创作者: {
    src: "/assets/avatars/avatar-creator.png",
    background: "linear-gradient(180deg, #EBE7D6 0%, #EBE7D6 100%)",
  },
  开发工程师: {
    src: "/assets/avatars/avatar-developer.png",
    background: "linear-gradient(180deg, #F3ECC4 0%, #F3ECC4 100%)",
  },
  项目经理: {
    src: "/assets/avatars/avatar-pm.png",
    background: "linear-gradient(180deg, #D7E7CA 0%, #D7E7CA 100%)",
  },
  运营: {
    src: "/assets/avatars/avatar-operator.png",
    background: "linear-gradient(180deg, #DCDCF2 0%, #DCDCF2 100%)",
  },
};

/** 业务侧角色别名 → 标准角色名 */
const ROLE_ALIAS: Record<string, keyof typeof ROLE_AVATAR> = {
  数据分析师: "行业分析师",
  数据分析: "行业分析师",
  数据师: "行业分析师",
  运营助手: "运营",
  产品经理: "项目经理",
  客服助手: "通用助手",
  技术顾问: "开发工程师",
  文案创作: "内容创作者",
  开发: "开发工程师",
  报告: "行业分析师",
  报告生成: "行业分析师",
};

/** 默认兜底：通用助手 */
const DEFAULT_ROLE: keyof typeof ROLE_AVATAR = "通用助手";

interface AgentAvatarProps {
  /** 角色名，如「设计师」「通用助手」 */
  roleName?: string;
  /** Agent 名称（仅用于 aria-label 兜底） */
  agentName?: string;
  /** 尺寸，默认 48 */
  size?: number;
  /** 是否灰显（停用/失败/已关机） */
  grayed?: boolean;
  className?: string;
}

export const AgentAvatar = ({
  roleName,
  agentName,
  size = 48,
  grayed = false,
  className = "",
}: AgentAvatarProps) => {
  // 解析角色名 → AvatarSpec
  const resolvedRole: keyof typeof ROLE_AVATAR = roleName
    ? ROLE_AVATAR[roleName]
      ? (roleName as keyof typeof ROLE_AVATAR)
      : ROLE_ALIAS[roleName] ?? DEFAULT_ROLE
    : DEFAULT_ROLE;
  const spec = ROLE_AVATAR[resolvedRole];

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden transition-opacity ${
        grayed ? "opacity-40 grayscale" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: spec.background,
      }}
      aria-label={roleName || agentName || "Agent 头像"}
    >
      <img
        src={spec.src}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </div>
  );
};
