/**
 * ChatFull —— 沙盒试验：对话视图放大版（保留顶部导航）
 *
 * 流程位置：欢迎页(/chat-welcome) → 点「开始对话」 → 本页 (/chat)
 *
 * 设计要点：
 *   - 顶部：与欢迎页同款简化 Navbar（保持视觉连续）
 *   - 主体：AgentChat embedded 模式，撑满 Navbar 之外的全部视口
 *     · embedded=true 时 AgentChat 内部 width/height 都是 100%（已内置支持）
 *     · 无外层徽章 / 无固定 1200×768，比独立预览页面"放大"
 *
 * 此文件位于 client/src/pages/sandbox/，是 sandbox/explore-1 分支独有的试验内容。
 * 不修改 AgentChat 本身，仅作为外层壳体使用。
 */
import { useLocation } from "wouter";
import AgentChat from "../tenant/AgentChat";

export default function ChatFull() {
  const [, navigate] = useLocation();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F7F8FB]">
      {/* ───── 顶部 Navbar（与欢迎页同款，保留站点导航） ───── */}
      <nav
        className="flex items-center justify-between px-10 flex-shrink-0"
        style={{
          height: 64,
          background: "rgba(255,255,255,0.85)",
          borderBottom: "1px solid #DFE7F0",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
        }}
      >
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/landing-assets/60.svg"
            alt="ClawPro"
            width={28}
            height={28}
          />
          <span className="text-base font-medium text-[#0A0A0A]">ClawPro</span>
        </div>
        <div className="flex items-center gap-6">
          <div
            className="text-sm text-[#5A6275] hover:text-[#0A0A0A] cursor-pointer transition-colors"
            onClick={() => navigate("/chat-welcome")}
          >
            重新开始
          </div>
          <div
            className="text-sm text-[#5A6275] hover:text-[#0A0A0A] cursor-pointer transition-colors"
            onClick={() => navigate("/")}
          >
            返回首页
          </div>
        </div>
      </nav>

      {/* ───── 对话视图：撑满 Navbar 之外全部空间 ───── */}
      <div className="flex-1 min-h-0 flex p-6">
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden">
          <AgentChat embedded />
        </div>
      </div>
    </div>
  );
}
