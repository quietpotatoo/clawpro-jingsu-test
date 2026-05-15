/**
 * NotificationPanel - 顶部导航的消息通知面板
 *
 * 设计来源：Figma 「公共组件/导航」-> 「图标文本」（节点 297:3275 消息通知）
 *           面板内部样式沿用原 TenantLayout 内的设计语言（保留原有体验）
 *
 * 用法：
 *   <NotificationPanel isAdmin={isAdmin} mockNotifications={MOCK} />
 *
 * 说明：
 *   - 触发按钮：铃铛 + 未读红点
 *   - 弹层：定位 fixed right-4 top-[72px]（顶部导航 64 + 8 间距）
 *   - 通知数据完全由 props 提供；组件本身只管面板状态
 */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Copy, X } from "lucide-react";
import NavIconButton from "./NavIconButton";
import { BellIcon } from "./NavIcons";

export type NotificationCategory = "success" | "failure" | "notice";

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  category: NotificationCategory;
  read: boolean;
  actionHref?: string;
  actionLabel?: string;
}

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { label: string; icon: React.ReactNode; bgColor: string; textColor: string }
> = {
  success: {
    label: "成功",
    icon: <span style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>✓</span>,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
  },
  failure: {
    label: "错误",
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle" }}>
        <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    bgColor: "bg-red-50",
    textColor: "text-red-700",
  },
  notice: {
    label: "通知",
    icon: <span style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>ℹ</span>,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
};

export interface NotificationPanelProps {
  /** 初始通知列表（组件内部维护本地态：标记已读/删除均为本地，刷新即恢复） */
  notifications: Notification[];
  /** 是否管理员（保留对外参数，便于上层根据角色决定推送哪些通知） */
  isAdmin?: boolean;
  /** 自定义触发按钮位置（默认 fixed 右上偏移） */
  panelOffsetTop?: number;
}

export default function NotificationPanel({
  notifications: initialNotifications,
  panelOffsetTop = 72,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | NotificationCategory>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const hasUnread = notifications.some((n) => !n.read);

  // 点击弹窗外部关闭
  useEffect(() => {
    if (!showPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showPanel]);

  const handleMarkRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const handleMarkAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const handleDelete = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const handleClearAll = () => setNotifications([]);

  const handleCopy = (notif: Notification) => {
    navigator.clipboard.writeText(notif.message).then(() => {
      setCopiedId(notif.id);
      handleMarkRead(notif.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const tabs: { key: "all" | NotificationCategory; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "success", label: "成功" },
    { key: "failure", label: "错误" },
  ];

  const filteredNotifs = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeTab);

  const unreadCountFor = (key: "all" | NotificationCategory) =>
    key === "all"
      ? notifications.filter((n) => !n.read).length
      : notifications.filter((n) => n.category === key && !n.read).length;

  return (
    <div className="relative">
      <NavIconButton
        icon={<BellIcon />}
        title="消息通知"
        showDot={hasUnread}
        onClick={() => setShowPanel((p) => !p)}
      />

      {showPanel && (
        <div
          ref={panelRef}
          className="fixed right-4 w-80 bg-white rounded-[4px] shadow-xl border border-gray-100 flex flex-col z-[200]"
          style={{
            top: panelOffsetTop,
            maxHeight: filteredNotifs.length > 4 ? "400px" : undefined,
          }}
        >
          {/* Header + Tabs */}
          <div className="px-3 pt-3 pb-0 flex-shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-semibold text-gray-900 text-xs">消息通知</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >全部删除</button>
                <span className="text-gray-200 text-xs">|</span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >全部已读</button>
              </div>
            </div>
            <div className="flex gap-0.5 border-b border-gray-100">
              {tabs.map((tab) => {
                const count = unreadCountFor(tab.key);
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors relative",
                      isActive
                        ? "text-blue-600 bg-blue-50/60"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={[
                          "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold",
                          isActive
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >{count}</span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="overflow-y-auto flex-1"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db #f3f4f6" }}
          >
            {filteredNotifs.length === 0 ? (
              <div className="p-6 text-center">
                <BellIcon size={32} style={{ color: "#d1d5db", margin: "0 auto" }} />
                <p className="text-xs text-gray-400 mt-2">暂无消息</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredNotifs.map((notif) => {
                  const catCfg = CATEGORY_CONFIG[notif.category];
                  const isCopied = copiedId === notif.id;
                  return (
                    <div
                      key={notif.id}
                      className="px-3 py-2.5 hover:bg-gray-50/70 transition-colors relative"
                      onMouseEnter={() => setHoveredId(notif.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={[
                            "text-xs flex-1 leading-relaxed line-clamp-2 transition-colors",
                            notif.read ? "text-gray-400" : "text-gray-700",
                          ].join(" ")}
                          title={notif.message}
                        >{notif.message}</p>
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
                        ><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={[
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                              catCfg.bgColor,
                              catCfg.textColor,
                            ].join(" ")}
                          >
                            {catCfg.icon}
                            {catCfg.label}
                          </span>
                          <span className="text-gray-400" style={{ fontSize: "11px" }}>
                            {notif.timestamp}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {notif.actionHref && hoveredId === notif.id && (
                            <Link href={notif.actionHref}>
                              <button
                                onClick={() => {
                                  handleMarkRead(notif.id);
                                  setShowPanel(false);
                                }}
                                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                title="前往查看"
                              >
                                {notif.actionLabel || "前往查看"}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </Link>
                          )}
                          {!notif.read && hoveredId === notif.id && (
                            <button
                              onClick={() => handleMarkRead(notif.id)}
                              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="标为已读"
                            >
                              <Check className="w-3 h-3" />已读
                            </button>
                          )}
                          {notif.category === "failure" && (
                            <button
                              onClick={() => handleCopy(notif)}
                              className={[
                                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors",
                                isCopied
                                  ? "text-green-600 bg-green-50"
                                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                              ].join(" ")}
                              title="复制详情"
                            >
                              {isCopied ? (
                                <><Check className="w-3 h-3" />已复制</>
                              ) : (
                                <><Copy className="w-3 h-3" />复制</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
