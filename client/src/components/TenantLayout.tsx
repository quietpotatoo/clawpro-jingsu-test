/**
 * TenantLayout - 租户端布局
 *
 * Design: 「流动蓝图」Fluid Blueprint
 * - 用户端背景：linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%) (v2)
 * - 顶部固定导航栏 (64px) — 基于可复用的 TopNav 组合（对照 Figma 358:2322 还原）
 * - 主色 #1447E6
 *
 * 顶部导航相关的视觉/交互全部下沉到 `@/components/topnav`，
 * 本文件只关心：
 *   1) 路由 / 角色相关的状态接入（active tab、isAdmin、modelQuotaEnabled、groupMode）
 *   2) 通知数据（mock）的来源
 *   3) UserMenu 内的下拉菜单项业务文案
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { KeyRound, LogOut, UserCog, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserRole } from "@/contexts/UserRoleContext";
import {
  TopNav,
  NavDivider,
  CenterTabs,
  NavIconButton,
  HelpIcon,
  SwitchAdminIcon,
  NotificationPanel,
  UserMenu,
  type Notification,
} from "@/components/topnav";

// 中央 Tab 导航（Figma 358:2322 中央 segmented：我的 Agent / 技能广场 / 模型额度）
const CENTER_NAV_ITEMS = [
  { label: "我的 Agent", value: "/my-openclaw" },
  { label: "技能广场", value: "/skill-square" },
  { label: "模型额度", value: "/model-quota" },
];

// 右侧图标导航：帮助文档保留为右侧"使用指南"入口（对齐 Figma 358:2322 右侧）
const HELP_DOC_PATH = "/help-docs";

const CURRENT_USER = "alice@acompany.com";

// ==================== Mock 通知 ====================

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1", message: "『Alice的工作助手』TAT 执行命令错误：脚本返回非零退出码 (exit code 1)", timestamp: "2026-03-26 11:05", category: "failure", read: false },
  { id: "n2", message: "『Noah的分析助手』命令执行超时，已自动终止（超时阈值 60s）", timestamp: "2026-03-26 10:42", category: "failure", read: false },
  { id: "n3", message: "『Bob的数据分析』重启失败，实例状态异常，请联系管理员", timestamp: "2026-03-26 09:30", category: "failure", read: false },
  { id: "n4", message: "『Eve的编程助手』TAT Agent 离线，命令下发失败", timestamp: "2026-03-25 17:15", category: "failure", read: false },
  { id: "n5", message: "『Alice的工作助手』API 密钥存在泄露风险，请立即轮换", timestamp: "2026-03-25 14:00", category: "failure", read: false },
  { id: "n6", message: "检测到异常登录行为：账号 bob@bcompany.com 于境外 IP 登录，请确认", timestamp: "2026-03-24 08:55", category: "failure", read: false },
  { id: "n7", message: "『Alice的工作助手』已成功删除", timestamp: "2026-03-23 15:30", category: "success", read: false },
  { id: "n8", message: "『Noah的分析助手』创建成功，已进入运行状态", timestamp: "2026-03-22 10:10", category: "success", read: false },
  { id: "n9", message: "『Bob的数据分析』配置更新成功", timestamp: "2026-03-21 09:00", category: "success", read: false },
  { id: "n10", message: "平台版本已更新至 v2.4.0，新增多模型切换与指令库功能，点击查看更新日志", timestamp: "2026-03-20 09:00", category: "notice", read: false },
];

// [004] 独立化升级完成消息（仅对"兼具管理员身份"的用户端账号推送）
const MIGRATION_NOTIFICATION: Notification = {
  id: "sg-migration-done",
  message: "ClawPro 安全组独立化升级已完成，原规则与绑定 Agent 已迁移至 ClawPro-Default",
  timestamp: "2026-05-05 15:00",
  category: "notice",
  read: false,
  actionHref: "/admin/security-group",
  actionLabel: "前往查看",
};

// ==================== TenantLayout ====================

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { isAdmin, toggleRole } = useUserRole();

  // 多分组模式
  const [groupMode, setGroupMode] = useState<"normal" | "multi-group">(() => {
    return (localStorage.getItem("openclaw_group_mode") as "normal" | "multi-group") || "normal";
  });
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "openclaw_group_mode") {
        setGroupMode((e.newValue as "normal" | "multi-group") || "normal");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 模型额度开关
  const [modelQuotaEnabled, setModelQuotaEnabled] = useState(() => {
    const v = localStorage.getItem("admin_allow_model_quota");
    return v !== null ? v === "true" : true;
  });
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "admin_allow_model_quota") {
        setModelQuotaEnabled(e.newValue !== null ? e.newValue === "true" : true);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 过滤后的中央 Tab
  const visibleCenterNavItems = CENTER_NAV_ITEMS.filter(
    (item) => !(item.value === "/model-quota" && !modelQuotaEnabled)
  );

  // 给中央 Tab 设置基于"路由前缀"的匹配
  const centerItemsWithMatcher = visibleCenterNavItems.map((item) => ({
    ...item,
    matches: (current: string) => {
      if (item.value === "/my-openclaw") {
        // 详情页路由 /openclaw/:id 和 /openclaw-guide 也属于"我的 Agent"
        return current.startsWith("/my-openclaw") || current.startsWith("/openclaw");
      }
      return current.startsWith(item.value);
    },
  }));

  // 通知数据（管理员多推一条独立化消息）
  const notificationData: Notification[] = isAdmin
    ? [MIGRATION_NOTIFICATION, ...MOCK_NOTIFICATIONS]
    : MOCK_NOTIFICATIONS;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)" }}
    >
      {/* [Figma 358:2322] Top Navigation 64px：左 Logo + 中央 Tab + 右图标 */}
      <TopNav
        center={
          <CenterTabs
            items={centerItemsWithMatcher}
            activeValue={location}
            onChange={(value) => navigate(value)}
          />
        }
        right={
          <>
            {/* 使用指南 */}
            <Link href={HELP_DOC_PATH}>
              <NavIconButton icon={<HelpIcon />} title="使用指南" />
            </Link>

            <NavDivider />

            {/* 消息中心 */}
            <NotificationPanel notifications={notificationData} isAdmin={isAdmin} />

            <NavDivider />

            {/* 切换管控端：管理员可见 */}
            {isAdmin && (
              <>
                <Link href="/admin/basic-info">
                  <NavIconButton
                    icon={<SwitchAdminIcon />}
                    label="切换管控端"
                    title="切换至管控端"
                  />
                </Link>
                <NavDivider />
              </>
            )}

            {/* 用户菜单 */}
            <UserMenu username={CURRENT_USER}>
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500">当前账号</p>
                <p className="text-sm font-medium text-gray-900 truncate">{CURRENT_USER}</p>
                <span
                  className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                    isAdmin ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {isAdmin ? "管理员" : "普通成员"}
                </span>
              </div>
              {/* 所在分组 */}
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1.5">所在分组</p>
                <div className="flex flex-wrap gap-1">
                  {groupMode === "multi-group" ? (
                    <>
                      <span
                        className="inline-block text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "rgba(88,86,214,0.10)", color: "#1447E6" }}
                      >A公司 / 技术部 / 前端组</span>
                      <span
                        className="inline-block text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "rgba(88,86,214,0.10)", color: "#1447E6" }}
                      >A公司 / 技术部 / AI 组</span>
                      <span
                        className="inline-block text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "rgba(88,86,214,0.10)", color: "#1447E6" }}
                      >前端研发同学</span>
                    </>
                  ) : (
                    <span
                      className="inline-block text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: "rgba(88,86,214,0.10)", color: "#1447E6" }}
                    >默认</span>
                  )}
                </div>
              </div>
              <DropdownMenuItem onClick={() => (window.location.href = "/reset-password")}>
                <KeyRound className="w-4 h-4 mr-2 text-gray-500" />
                重置密码
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* 演示用：切换角色 */}
              <DropdownMenuItem
                onClick={() => {
                  toggleRole();
                  toast.info(`已切换为${isAdmin ? "普通成员" : "管理员"}视角`);
                }}
              >
                <UserCog className="w-4 h-4 mr-2 text-gray-500" />
                切换为{isAdmin ? "普通成员" : "管理员"}视角
              </DropdownMenuItem>
              {/* 仅管理员：保留旧版"管理后台"快捷入口 */}
              {isAdmin && (
                <DropdownMenuItem onClick={() => (window.location.href = "/admin/basic-info")}>
                  <Settings className="w-4 h-4 mr-2 text-gray-500" />
                  进入管理后台
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toast.info("已退出登录")}
                className="text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </UserMenu>
          </>
        }
      />

      {/* Main Content：上偏移 = 顶部导航 64px */}
      <main className="pt-[64px] min-h-screen">{children}</main>
    </div>
  );
}
