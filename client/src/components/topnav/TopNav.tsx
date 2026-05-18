/**
 * TopNav - 用户端顶部导航壳
 *
 * 设计来源：Figma 公共组件/导航（节点 358:2322 / 297:3719）
 * 视觉规范：
 *   - 容器：高 64px，padding 12px 28px，背景 #FFFFFF（带 95% 半透 + 模糊），
 *           底边 1px solid #E2E8F0
 *   - 布局：左 Logo 区 + 中央 segmented Tabs + 右侧功能图标 + 用户菜单
 *
 * 用法（推荐）：
 *
 *   <TopNav
 *     centerTabs={CENTER_NAV_ITEMS}
 *     activeTabIndex={activeIndex}
 *     onTabChange={(idx) => navigate(items[idx].path)}
 *     right={
 *       <>
 *         <NavIconButton icon="help" title="使用指南" onClick={...} />
 *         <NavDivider />
 *         <NotificationPanel isAdmin={isAdmin} />
 *         <NavDivider />
 *         <NavIconButton icon="switch-admin" label="切换管控端" onClick={...} />
 *         <NavDivider />
 *         <UserMenu user={...} />
 *       </>
 *     }
 *   />
 *
 * 也可直接在外层组合：见 TenantLayout。
 */
import React from "react";
import { Link } from "wouter";

export interface TopNavProps {
  /** 中央 Tab 列表（可选；不传则不渲染中央区） */
  center?: React.ReactNode;
  /** 右侧功能区（图标按钮 / 用户菜单等） */
  right?: React.ReactNode;
  /** 左侧 Logo 点击跳转，默认 "/" */
  logoHref?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 右侧图标按钮之间的竖向分隔线（Figma Vector 5/6/7）
 * 颜色 #E2E8F0，高 13.33px，宽 1px。
 */
export function NavDivider() {
  return (
    <span
      aria-hidden
      className="inline-block h-[14px] w-px bg-[#E2E8F0] flex-shrink-0"
    />
  );
}

export default function TopNav({
  center,
  right,
  logoHref = "/",
  className = "",
}: TopNavProps) {
  return (
    <header
      className={`fixed left-0 right-0 z-50 h-[64px] bg-white/95 backdrop-blur-md ${className}`}
      style={{
        top: 0,
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <div className="h-full flex items-center justify-between px-10 relative">
        {/* 左：Logo —— 与 Landing 页 navbar-brand 完全一致：
            28×28 图标 + 22.12px Be Vietnam Pro 600 文字 + gap 8px。
            资源直接复用 landing 的 /landing-assets/60.svg，避免重复资产。 */}
        <Link href={logoHref}>
          <div
            className="flex items-center cursor-pointer transition-opacity hover:opacity-90"
            style={{ gap: 8 }}
          >
            <img
              src="/landing-assets/60.svg"
              alt="ClawPro"
              width={28}
              height={28}
              draggable={false}
              className="select-none"
            />
            <span
              className="select-none"
              style={{
                fontSize: "22.12px",
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 600,
                color: "#000",
                lineHeight: 1,
              }}
            >
              ClawPro
            </span>
          </div>
        </Link>

        {/* 中：Segmented Tabs
            用绝对定位钉在 header 水平正中，避免左右两侧宽度差异（如管理员多一个"切换管控端"按钮、
            用户名长短差异）把中央 Tab 推离视觉中心。外壳 pointer-events-none，
            仅交互子元素 pointer-events-auto，防止遮挡两侧点击。 */}
        {center && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="pointer-events-auto">
              {center}
            </div>
          </div>
        )}

        {/* 右：功能图标 + 用户菜单 */}
        <div className="flex items-center gap-3">
          {right}
        </div>
      </div>
    </header>
  );
}
