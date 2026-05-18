/**
 * 覆盖状态徽章 + 就地决策/详情 Popover
 *
 * v2.0 精简状态：
 *   - local：按本节点
 *   - groupOverride：分组覆盖（amber）
 *   - groupConflict：多分组对同唯一型资源冲突（red，可裁决）
 *   - primaryDeptMissing：OneID 主部门失效（red，提示去 OneID 修正）
 */
import React, { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { OverrideStatus, UserOrg, UserOverrideInfo } from "./types";
import { MOCK_EFFECTIVE_CONFIG } from "./mock";

// ─── 状态样式映射 ────────────────────────────────────────────
interface StatusMeta {
  label: string;
  tone: "neutral" | "amber" | "red";
  icon: React.ReactNode;
  desc: string;
  isConflict: boolean;
}

const STATUS_META: Record<OverrideStatus, StatusMeta> = {
  local: {
    label: "按本节点",
    tone: "neutral",
    icon: null,
    desc: "该用户的配置完全来自当前节点本身。",
    isConflict: false,
  },
  groupOverride: {
    label: "分组覆盖",
    tone: "amber",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: "该用户所在分组对某唯一型资源有配置，覆盖了上层默认（优先级：更深分组 > 上层）。",
    isConflict: false,
  },
  groupConflict: {
    label: "分组冲突",
    tone: "red",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: "该用户所属多个分组对同一唯一型资源配置了不同值，需要显式决策（未裁决时按最新绑定兜底）。",
    isConflict: true,
  },
  primaryDeptMissing: {
    label: "主部门缺失",
    tone: "red",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: "该用户的 OneID 主部门无效（为空 / 已被删除）。请在 OneID 侧修正。",
    isConflict: false,
  },
};

const TONE_CLASS: Record<StatusMeta["tone"], string> = {
  neutral: "text-gray-500 bg-gray-50 border border-gray-100",
  amber: "text-amber-600 bg-amber-50 border border-amber-100",
  red: "text-red-600 bg-red-50 border border-red-100",
};

// ─── 徽章 ────────────────────────────────────────────────
function OverrideBadge({ status }: { status: OverrideStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${TONE_CLASS[meta.tone]}`}
    >
      {meta.icon}
      <span>{meta.label}</span>
    </span>
  );
}

// ─── 详情 HoverCard（非冲突） ────────────────────────────
function EffectiveDetailCard({ user }: { user: UserOrg }) {
  const cfg = MOCK_EFFECTIVE_CONFIG[user.userId] ?? {};
  const rows: Array<{ label: string; value: string; source: string }> = [
    { label: "模型", value: (cfg.models ?? []).join(", ") || "—", source: "并集" },
    { label: "通道", value: (cfg.channels ?? []).join(", ") || "—", source: "并集" },
    { label: "安全组", value: cfg.securityGroup ?? "—", source: "最终" },
    { label: "VPC", value: cfg.vpc ?? "—", source: "最终" },
    { label: "记忆", value: cfg.memory ?? "—", source: "最终" },
    { label: "镜像", value: cfg.image ?? "—", source: "最终" },
  ];
  return (
    <div className="w-[420px]">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">
          {user.displayName} · 最终生效配置
        </div>
        <div className="text-xs text-gray-500 mt-1">
          点击右侧「查看配置」可查看完整溯源
        </div>
      </div>
      <div className="px-4 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="py-1.5 font-medium w-16">资源</th>
              <th className="py-1.5 font-medium">最终生效</th>
              <th className="py-1.5 font-medium w-14 text-right">来源</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-gray-50">
                <td className="py-2 text-gray-500">{r.label}</td>
                <td className="py-2 text-gray-900 break-all" title={r.value}>
                  {r.value}
                </td>
                <td className="py-2 text-xs text-gray-400 text-right">
                  {r.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 冲突决策 Popover ────────────────────────────────────
interface ConflictPopoverProps {
  user: UserOrg;
  info: UserOverrideInfo;
  onResolve: (userId: string, winnerResourceId: string) => void;
  triggerChildren: React.ReactNode;
}

function ConflictPopover({
  user,
  info,
  onResolve,
  triggerChildren,
}: ConflictPopoverProps) {
  const candidates = info.conflictCandidates ?? [];
  const defaultWinner =
    info.winnerResourceId ??
    [...candidates].sort(
      (a, b) =>
        new Date(b.latestBindingAt).getTime() -
        new Date(a.latestBindingAt).getTime()
    )[0]?.resourceId ??
    "";

  const [selected, setSelected] = useState<string>(defaultWinner);
  const [open, setOpen] = useState(false);

  React.useEffect(() => {
    if (open) setSelected(defaultWinner);
  }, [open, defaultWinner]);

  const kindLabel: Record<string, string> = {
    vpc: "VPC",
    securityGroup: "安全组",
    memory: "记忆",
    image: "镜像",
  };
  const kindText = kindLabel[info.conflictResourceKind ?? ""] ?? "资源";

  const handleConfirm = () => {
    if (!selected) return;
    onResolve(user.userId, selected);
    setOpen(false);
    toast.success(
      `已为 ${user.displayName} 裁决 ${kindText}：${
        candidates.find((c) => c.resourceId === selected)?.resourceName ?? ""
      }`
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerChildren}</PopoverTrigger>
      <PopoverContent className="w-[440px] p-0" align="start" side="bottom">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div className="text-sm font-semibold text-gray-900">
              {user.displayName} · {kindText} 冲突
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            冲突类型：分组冲突
            {info.isResolved ? (
              <span className="ml-2 text-blue-600">· 已显式决策</span>
            ) : (
              <span className="ml-2 text-amber-600">
                · 尚未决策，按最新绑定兜底
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            同层候选
          </div>
          {candidates.map((c) => (
            <label
              key={c.resourceId}
              className={`flex items-start gap-2.5 p-2.5 rounded-[4px] cursor-pointer border transition-colors ${
                selected === c.resourceId
                  ? "border-blue-300 bg-blue-50/60"
                  : "border-gray-100 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="conflict-winner"
                className="mt-1 accent-blue-600"
                checked={selected === c.resourceId}
                onChange={() => setSelected(c.resourceId)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {c.resourceName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  通过 <span className="text-gray-700">{c.via}</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  最近绑定 {c.latestBindingAt}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <div className="text-xs text-gray-500 leading-relaxed">
            确定后将为该用户写入一条显式决策记录；winner 被删除时自动失效。
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            size="sm"
            className="text-white"
           
            onClick={handleConfirm}
          >
            确定本次选择
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── 主组件 ─────────────────────────────────────────────
interface OverrideCellProps {
  user: UserOrg;
  info: UserOverrideInfo;
  onResolve: (userId: string, winnerResourceId: string) => void;
}

export default function OverrideCell({
  user,
  info,
  onResolve,
}: OverrideCellProps) {
  const meta = STATUS_META[info.status];

  if (info.status === "local") {
    return (
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 cursor-default">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>按本节点</span>
          </span>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="p-0">
          <EffectiveDetailCard user={user} />
        </HoverCardContent>
      </HoverCard>
    );
  }

  if (!meta.isConflict) {
    return (
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <span className="inline-flex items-center cursor-default">
            <OverrideBadge status={info.status} />
          </span>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="p-0">
          <div className="w-[420px]">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <OverrideBadge status={info.status} />
              </div>
              <div className="text-xs text-gray-500 mt-2 leading-relaxed">
                {meta.desc}
              </div>
            </div>
            <EffectiveDetailCard user={user} />
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <ConflictPopover
      user={user}
      info={info}
      onResolve={onResolve}
      triggerChildren={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 group"
        >
          <OverrideBadge status={info.status} />
          <span className="text-xs text-blue-600 group-hover:underline">
            详情
          </span>
        </button>
      }
    />
  );
}
