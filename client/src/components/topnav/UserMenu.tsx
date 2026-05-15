/**
 * UserMenu - 顶部导航右侧的用户菜单
 *
 * 设计来源：Figma 「我的资料」（节点 297:3564 / 297:3460）
 * 视觉规范（严格对齐 Figma）：
 *   - 容器：row、gap 8.89px、padding 4.44px 8.89px
 *   - 头像：31x31 圆形、bg #8CBCF7、首字母为大写字母（PingFang 600、字号 14、color #000）
 *   - 用户名：14 / line-height 22 / #020617，单行居中
 *   - 下拉箭头：14x14、stroke #020617
 *
 * 内置基于 shadcn DropdownMenu 的下拉，菜单项通过 children 自定义。
 *
 * 用法：
 *   <UserMenu username="jingsujiang">
 *     <DropdownMenuItem>重置密码</DropdownMenuItem>
 *   </UserMenu>
 */
import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "./NavIcons";

export interface UserMenuProps {
  username: string;
  /** 头像背景色（默认 Figma 浅蓝 #8CBCF7） */
  avatarBg?: string;
  /** 头像字色（默认 #000） */
  avatarColor?: string;
  /** 头像中显示的首字母（默认取 username 首位） */
  avatarLetter?: string;
  /** 下拉菜单内容（自定义 DropdownMenuItem 等） */
  children?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

export default function UserMenu({
  username,
  avatarBg = "#8CBCF7",
  avatarColor = "#000000",
  avatarLetter,
  children,
  className = "",
}: UserMenuProps) {
  const letter = (avatarLetter ?? username.charAt(0) ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={[
            "inline-flex items-center gap-[9px] rounded-[4px]",
            "px-[9px] py-[4px] hover:bg-[#F1F5F9] transition-colors",
            className,
          ].join(" ")}
        >
          {/* 头像 */}
          <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: 31,
              height: 31,
              borderRadius: "50%",
              background: avatarBg,
              color: avatarColor,
              fontFamily: "PingFang SC, sans-serif",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            {letter}
          </span>
          {/* 用户名（单行居中） */}
          <span className="text-[14px] leading-[22px] text-[#020617] max-w-[160px] truncate">
            {username}
          </span>
          {/* 下拉箭头 */}
          <span className="inline-flex items-center justify-center flex-shrink-0 text-[#020617]/70">
            <ChevronDownIcon size={14} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
