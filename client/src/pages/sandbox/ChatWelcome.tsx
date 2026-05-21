/**
 * ChatWelcome —— 沙盒试验：欢迎页
 *
 * 流程位置：Landing(/) → 点「和 Agent 聊聊」 → 本页 (/chat-welcome) → 点 CTA → 对话页 (/chat)
 *
 * 设计要点：
 *   - 顶部：Landing 同款品牌简化 Navbar（不依赖 landing.css，独立实现）
 *   - 中部：Agent 头像 + 招呼语 + 能力卡（占位文案，待替换）
 *   - 底部：主 CTA「开始对话」→ /chat
 *
 * 此文件位于 client/src/pages/sandbox/，是 sandbox/explore-1 分支独有的试验内容。
 */
import { useLocation } from "wouter";
import { ArrowRight, Sparkles, Code2, FileText, Lightbulb, Wrench } from "lucide-react";

interface CapabilityItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const CAPABILITIES: CapabilityItem[] = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "解答工作问题",
    desc: "随时提问，从专业知识到日常工作经验，我都能给出建议",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "整理与撰写",
    desc: "整理资料、撰写文档、归纳要点，让信息变得清晰可用",
  },
  {
    icon: <Code2 className="w-5 h-5" />,
    title: "调试代码",
    desc: "排查 bug、解释代码、给出实现方案，加速技术开发",
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    title: "设计与优化",
    desc: "设计改版、优化方案、给出多角度建议",
  },
  {
    icon: <Wrench className="w-5 h-5" />,
    title: "更多技能",
    desc: "调用工具、连接系统、执行任务……还有更多等你探索",
  },
];

export default function ChatWelcome() {
  const [, navigate] = useLocation();

  const handleStart = () => {
    navigate("/chat");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, #F0F4FF 0%, #F7F8FB 50%, #FFFFFF 100%)",
      }}
    >
      {/* ───── 顶部 Navbar（Landing 同款简化版） ───── */}
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
        <div
          className="text-sm text-[#5A6275] hover:text-[#0A0A0A] cursor-pointer transition-colors"
          onClick={() => navigate("/")}
        >
          返回首页
        </div>
      </nav>

      {/* ───── 主体内容 ───── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[880px] flex flex-col items-center">
          {/* Agent 头像 */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6 relative"
            style={{
              background:
                "linear-gradient(135deg, #1447E6 0%, #4F8AFF 100%)",
              boxShadow:
                "0 8px 24px -8px rgba(20,71,230,0.40), 0 2px 6px rgba(0,0,0,0.06)",
            }}
          >
            <Sparkles className="w-10 h-10 text-white" strokeWidth={2.2} />
          </div>

          {/* 招呼语 */}
          <h1
            className="text-center font-semibold text-[#0A0A0A] mb-3"
            style={{ fontSize: 36, lineHeight: 1.3, letterSpacing: -0.5 }}
          >
            您好，我是 ClawPro
          </h1>
          <p
            className="text-center text-[#5A6275] mb-12"
            style={{ fontSize: 18, lineHeight: 1.6 }}
          >
            您的 AI 私人助理，随时为您处理工作中的各类任务
          </p>

          {/* 能力卡片网格 */}
          <div
            className="w-full grid gap-4 mb-12"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {CAPABILITIES.map((cap, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 p-5 bg-white rounded-2xl transition-all hover:translate-y-[-2px]"
                style={{
                  border: "1px solid #E9ECF1",
                  boxShadow: "0 1px 4px 0 rgba(0,0,0,0.04)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[#1447E6]"
                  style={{ background: "rgba(20,71,230,0.08)" }}
                >
                  {cap.icon}
                </div>
                <div className="text-base font-medium text-[#0A0A0A] mt-1">
                  {cap.title}
                </div>
                <div
                  className="text-sm text-[#5A6275]"
                  style={{ lineHeight: 1.55 }}
                >
                  {cap.desc}
                </div>
              </div>
            ))}
          </div>

          {/* 主 CTA */}
          <button
            onClick={handleStart}
            className="group flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              height: 52,
              padding: "0 32px",
              background:
                "linear-gradient(163deg, #0A0A0A 51%, #1447E6 100%)",
              borderRadius: 10,
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(20,71,230,0.25)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span>开始对话</span>
            <ArrowRight
              className="w-5 h-5 transition-transform group-hover:translate-x-1"
              strokeWidth={2.2}
            />
          </button>
          <p className="text-xs text-[#8A93A6] mt-4">
            按下回车或点击按钮，开启您的第一次对话
          </p>
        </div>
      </main>
    </div>
  );
}
