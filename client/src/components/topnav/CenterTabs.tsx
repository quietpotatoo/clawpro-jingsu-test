/**
 * CenterTabs - 中央 segmented 切换控件
 *
 * 设计来源：Figma 「公共组件/导航」中央 Frame 2147227600（节点 297:3468）
 * 视觉规范：
 *   - 容器：高 39px、padding 4px、bg #F5F5F5、radius 4px
 *   - Tab：padding 4px 12px、字号 14、radius 3px
 *     - Active：bg #FFFFFF、color #020617、shadow 0 1px 2px rgba(0,0,0,.05)
 *     - Normal：color #334155
 *
 * 用法：
 *   <CenterTabs
 *     items={[{ label: "我的 Agent", value: "/my-openclaw" }, ...]}
 *     activeValue={location}
 *     onChange={(value) => navigate(value)}
 *   />
 */
import React from "react";

export interface CenterTabItem<V extends string = string> {
  label: string;
  value: V;
  /** 可选：自定义 Active 判断函数，默认严格等于；常用于路由前缀匹配 */
  matches?: (current: string) => boolean;
}

export interface CenterTabsProps<V extends string = string> {
  items: CenterTabItem<V>[];
  activeValue: string;
  onChange?: (value: V, index: number) => void;
  /** 自定义 Active 判断（全局），优先级低于 item.matches */
  isActive?: (item: CenterTabItem<V>, current: string) => boolean;
  className?: string;
}

export default function CenterTabs<V extends string = string>({
  items,
  activeValue,
  onChange,
  isActive,
  className = "",
}: CenterTabsProps<V>) {
  const checkActive = (item: CenterTabItem<V>) => {
    if (item.matches) return item.matches(activeValue);
    if (isActive) return isActive(item, activeValue);
    return item.value === activeValue;
  };

  return (
    <nav
      className={`flex items-center gap-1 p-1 rounded-[4px] ${className}`}
      style={{ background: "#F5F5F5" }}
      role="tablist"
    >
      {items.map((item, idx) => {
        const active = checkActive(item);
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.value, idx)}
            className={[
              "px-3 py-[7px] rounded-[3px] text-[14px] leading-[22px] transition-all duration-150",
              active
                ? "bg-white text-[#020617] font-medium"
                : "text-[#334155] hover:text-[#020617] font-normal",
            ].join(" ")}
            style={
              active
                ? { boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" }
                : undefined
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
