/**
 * NavIconButton - 顶部导航右侧的图标 / 图标+文本按钮
 *
 * 设计来源：Figma 「图标文本」组件（节点 297:3285、363:5028）
 * 视觉规范：
 *   - padding: 6px 8px、圆角 4px
 *   - 文本：14 / line-height 22 / color #020617
 *   - hover：bg #F1F5F9 + text #020617
 *   - 红点：4x4，绝对定位，#E85C5C
 *
 * 用法：
 *   <NavIconButton icon={<HelpIcon />} title="使用指南" />
 *   <NavIconButton icon={<BellIcon />} title="消息通知" showDot />
 *   <NavIconButton icon={<SwitchAdminIcon />} label="切换管控端" />
 */
import React from "react";

export interface NavIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** 图标节点（推荐使用 currentColor 着色的 SVG，便于 hover 跟随） */
  icon: React.ReactNode;
  /** 文字标签（不传则只显示图标） */
  label?: string;
  /** title 提示（无 label 时建议传） */
  title?: string;
  /** 是否显示右上红点 */
  showDot?: boolean;
  /** 内部 className */
  className?: string;
}

const NavIconButton = React.forwardRef<HTMLButtonElement, NavIconButtonProps>(
  function NavIconButton(
    { icon, label, title, showDot, className = "", ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        title={title ?? label}
        {...rest}
        className={[
          "relative inline-flex items-center gap-2 rounded-[4px]",
          "px-2 py-[6px] text-[14px] leading-[22px]",
          "text-[#020617]/90 hover:text-[#020617] hover:bg-[#F1F5F9]",
          "transition-colors flex-shrink-0",
          className,
        ].join(" ")}
      >
        <span className="inline-flex items-center justify-center flex-shrink-0">
          {icon}
        </span>
        {label && <span className="whitespace-nowrap">{label}</span>}
        {showDot && (
          <span
            aria-hidden
            className="absolute"
            style={{
              top: 6,
              right: 6,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#E85C5C",
            }}
          />
        )}
      </button>
    );
  }
);

export default NavIconButton;
