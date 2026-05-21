/**
 * Hero - 首屏 + 卡片堆叠 + 滚动联动卡片1 滑入凹槽
 * 注意：滚动联动逻辑由父组件 index.tsx 集中处理，这里只负责结构
 */
import { useLocation } from "wouter";

const ROLLING_TEXTS = ["工作任务", "信息问答", "资料整理", "设计改版", "调试代码", "工作任务", "信息问答"];

const HERO_VISUAL_CARDS = [
  { src: "/landing-assets/banner/卡片_虚框.png", alt: "" },
  { src: "/landing-assets/banner/卡片2.png", alt: "" },
  { src: "/landing-assets/banner/卡片3.png", alt: "" },
  { src: "/landing-assets/banner/卡片4.png", alt: "" },
  { src: "/landing-assets/banner/卡片5.png", alt: "" },
  { src: "/landing-assets/banner/卡片6.png", alt: "" },
];

export default function Hero() {
  const [, navigate] = useLocation();

  const handleCta = () => {
    // 立即体验 → 跳转到我的 Agent（未登录会被守卫拦截到登录）
    navigate("/my-openclaw");
  };

  return (
    <div className="hero-stage">
      {/* 全屏背景视频 */}
      <video
        className="hero-stage-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/landing-assets/banner.mp4" type="video/mp4" />
      </video>

      <section className="hero">
        {/* Hero Text */}
        <div className="hero-text-area">
          <div className="hero-badge">
            <img className="hero-badge-icon" src="/landing-assets/arrow-black.png" alt="" />
            <span>随时随地提升工作效率</span>
          </div>
          <div className="hero-title">ClawPro 你的 AI 私人助理</div>
          <div className="hero-title-sub">
            <span>对话即可完成</span>
            <span className="hero-title-cursor">_</span>
            <div className="hero-rolling-text">
              <div className="hero-rolling-inner">
                {ROLLING_TEXTS.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-cta" onClick={handleCta} role="button" tabIndex={0}>
            <span>立即创建</span>
            <img src="/landing-assets/59.svg" alt="" width={24} height={24} />
          </div>

          {/* [sandbox/explore-1] 试验入口：和 Agent 聊聊 → /chat-welcome */}
          <div
            onClick={() => navigate("/chat-welcome")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/chat-welcome");
              }
            }}
            role="button"
            tabIndex={0}
            style={{
              width: 280,
              height: 44,
              margin: "12px auto 0",
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(20,71,230,0.25)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              color: "#1447E6",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "transform 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.95)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.7)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span>和 Agent 聊聊</span>
            <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
          </div>
        </div>

        {/* Hero Visual：卡片背景 + 6 张卡片 + 吉祥物 */}
        <div className="hero-visual">
          <img className="hero-visual-bg" src="/landing-assets/banner/卡片背景.png" alt="" />
          <div className="hero-visual-cards">
            {HERO_VISUAL_CARDS.map((c, i) => (
              <img key={i} src={c.src} alt={c.alt} />
            ))}
          </div>
          <img className="hero-visual-mascot" src="/landing-assets/banner/装饰2.png" alt="" />
        </div>

        {/* Sarry 浮卡 */}
        <div className="hero-visual-card-left">
          <div className="hvc-title">提升工作效率</div>
          <div className="hvc-bar hvc-bar-1">
            <div className="hvc-bar-fill" />
          </div>
          <div className="hvc-bar hvc-bar-2">
            <div className="hvc-bar-fill" />
          </div>
        </div>

        {/* 左侧装饰_1 */}
        <img className="hero-deco-1" src="/landing-assets/banner/装饰_1.png" alt="" />

        {/* 卡片1 浮图（滚动联动） */}
        <div className="hero-deco-card1" />

        {/* 安装技能 浮卡 */}
        <div className="hero-skill-card">
          <div className="hero-skill-card-head">
            <div className="hero-skill-card-title">安装技能</div>
            <div className="hero-skill-spinner" />
          </div>
          <div className="hero-skill-list">
            <span>obsidian 1.0.0</span>
            <span>video-transcribe 0.7.0</span>
            <span className="more">...</span>
          </div>
        </div>

        <div className="hero-gradient-bottom" />
      </section>

      {/* 大标题下方投影 */}
      <img className="hero-deco-shadow" src="/landing-assets/banner/投影.png" alt="" />
    </div>
  );
}
