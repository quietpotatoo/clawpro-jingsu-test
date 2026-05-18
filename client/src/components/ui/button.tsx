import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button 组件
 *
 * 在 shadcn 默认 variant/size 之外，扩展了一组「ClawPro Figma 按钮规范」变体（前缀 `claw-`），
 * 严格对齐设计稿 Figma ComponentSet 317:1051「按钮」。
 *
 * 设计令牌（来自 Figma 317:1051）：
 *   ┌─────────────────────────┬──────────────────────────────────────────────────────────────┐
 *   │ Token                   │ Value                                                         │
 *   ├─────────────────────────┼──────────────────────────────────────────────────────────────┤
 *   │ claw-outline / bg       │ #FFFFFF                                                       │
 *   │ claw-outline / hover bg │ linear-gradient(90deg, #FFFFFF 0%, #F2F5FF 100%)              │
 *   │ claw-outline / border   │ 1px solid #E5E5E5                                             │
 *   │ claw-outline / hover    │ 1px solid #D8E1FF                                             │
 *   │ claw-outline / text     │ #020617                                                       │
 *   │ claw-primary / bg       │ linear-gradient(90deg, #020617 70%, #1447E6 100%)             │
 *   │ claw-primary / hover bg │ linear-gradient(90deg, #020617 70%, #0A226F 100%)             │
 *   │ claw-primary / text     │ #FFFFFF                                                       │
 *   │ 圆角                     │ 4px（已由基类提供）                                            │
 *   │ icon size               │ 16×16（已由基类 [&_svg:not([size-])]:size-4 提供）              │
 *   └─────────────────────────┴──────────────────────────────────────────────────────────────┘
 *
 * 使用示例：
 *   <Button variant="claw-outline" size="claw">  // 36 高 / 24 padding / 8 gap
 *     <Settings /> 详细配置
 *   </Button>
 *
 *   <Button variant="claw-outline" size="claw-square">  // 48×36 仅图标
 *     <RefreshCw />
 *   </Button>
 *
 *   <Button variant="claw-primary" size="claw-lg">  // 40 高 / 18 padding / 16 gap
 *     <Plus /> 创建 Agent
 *   </Button>
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[4px] text-sm font-medium transition-all disabled:cursor-not-allowed disabled:pointer-events-auto [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "[background:linear-gradient(90deg,#020617_70%,#1447E6_110%)] text-white font-normal border-0 " +
          "hover:[background:linear-gradient(90deg,#020617_70%,#0A226F_110%)] " +
          "active:[background:linear-gradient(90deg,rgba(255,255,255,0.2),rgba(255,255,255,0.2)),linear-gradient(90deg,#020617_70%,#0A226F_110%)] " +
          "disabled:[background:linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.3)),linear-gradient(90deg,#020617_70%,#0A226F_110%)] disabled:text-white/50 disabled:opacity-100",
        destructive:
          "bg-[#d42a1e] text-white font-normal border-0 " +
          "hover:bg-[#b91c1c] " +
          "active:bg-[#991b1b] " +
          "disabled:bg-[#d42a1e]/40 disabled:text-white/60 disabled:opacity-100",
        outline:
          "bg-white border border-[#e5e5e5] text-[#020617] font-normal " +
          "hover:bg-[#f5f5f5] hover:border-[#e3e3e3] " +
          "active:bg-white active:border-[#e3e3e3] " +
          "disabled:bg-white disabled:border-[#e5e5e5] disabled:text-[rgba(2,6,23,0.3)] disabled:opacity-100",
        secondary:
          "bg-[#f5f5f5] border border-[#e3e3e3] text-[#020617] font-normal " +
          "hover:bg-[#ebebeb] hover:border-[#d4d4d4] " +
          "active:bg-[#e0e0e0] " +
          "disabled:bg-[#f5f5f5] disabled:text-[rgba(2,6,23,0.3)] disabled:opacity-100",
        ghost:
          "text-[#020617] font-normal " +
          "hover:bg-[#f5f5f5] " +
          "active:bg-[#ebebeb] " +
          "disabled:text-[rgba(2,6,23,0.3)] disabled:opacity-100",
        link:
          "text-[#1447e6] font-normal underline-offset-4 " +
          "hover:underline " +
          "active:text-[#0a226f] " +
          "disabled:text-[rgba(20,71,230,0.4)] disabled:opacity-100 disabled:no-underline",

        /* ============================================================== */
        /*  Figma「按钮」ComponentSet 317:1051 对齐变体                       */
        /* ============================================================== */

        /**
         * 线性描边（次级按钮）
         * - normal: 白底 + #E5E5E5 边 + #020617 字
         * - hover : #f5f5f5 底 + #e3e3e3 边
         * - active: 白底 + #e3e3e3 边
         * - disabled: 白底 + #e5e5e5 边 + rgba(2,6,23,0.3) 字
         */
        "claw-outline":
          "bg-white border border-[#e5e5e5] text-[#020617] font-normal " +
          "hover:bg-[#f5f5f5] hover:border-[#e3e3e3] " +
          "active:bg-white active:border-[#e3e3e3] " +
          "disabled:bg-white disabled:border-[#e5e5e5] disabled:text-[rgba(2,6,23,0.3)] disabled:opacity-100",

        /**
         * 深色填充（主按钮）
         * - normal: 黑→蓝渐变 + 白字
         * - hover : 黑→深蓝渐变
         * - active: 叠加 rgba(255,255,255,0.2)
         * - disabled: 叠加 rgba(255,255,255,0.3) + 半透明白字
         */
        "claw-primary":
          "[background:linear-gradient(90deg,#020617_70%,#1447E6_110%)] text-white font-normal border-0 " +
          "hover:[background:linear-gradient(90deg,#020617_70%,#0A226F_110%)] " +
          "active:[background:linear-gradient(90deg,rgba(255,255,255,0.2),rgba(255,255,255,0.2)),linear-gradient(90deg,#020617_70%,#0A226F_110%)] " +
          "disabled:[background:linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.3)),linear-gradient(90deg,#020617_70%,#0A226F_110%)] disabled:text-white/50 disabled:opacity-100",
      },
      size: {
        default: "h-9 px-6 py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-[4px] gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-10 rounded-[4px] px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",

        /* --------------------------- Figma 尺寸 --------------------------- */

        /** 36×hug (中)，padding 8/24，icon-text gap 8 */
        claw: "h-9 gap-2 px-6 py-2",

        /** 32×hug (小)，padding 4/16，icon-text gap 6 */
        "claw-sm": "h-8 gap-1.5 px-4 py-1",

        /** 40×hug (大)，padding 4/18，icon-text gap 8 */
        "claw-lg": "h-10 gap-2 px-[18px] py-1",

        /** 48×36 纯图标（线性描边方形按钮，卡片角落「刷新」） */
        "claw-square": "h-9 w-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
