/**
 * LandingPage V2 - 由设计同学高保真静态页（1920px）迁移而来的 React 版本
 *
 * 此组件承接四段原 inline JS 逻辑：
 * 1. Navbar 滚动效果（≥10px 加 .is-scrolled）
 * 2. Hero 卡片1 滚动联动滑入凹槽（0~360px 渐变）
 * 3. 4 个视频卡 hover 时播放 / 离开归零
 * 4. 窗口宽度 < 1920 时整体 zoom 缩放
 *
 * 退出页面时全部清理，避免内存泄漏。
 */
import { useEffect, useRef } from "react";

import "./landing.css";

import Advanced from "./Advanced";
import Enterprise from "./Enterprise";
import Features from "./Features";
import Footer from "./Footer";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import Intro from "./Intro";
import Navbar from "./Navbar";

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ---------- 1. Navbar 滚动效果 ----------
  useEffect(() => {
    const navbar = rootRef.current?.querySelector(".navbar");
    if (!navbar) return;
    const onScroll = () => {
      if (window.scrollY > 10) navbar.classList.add("is-scrolled");
      else navbar.classList.remove("is-scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---------- 2. Hero 卡片1 滚动联动 ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const card1 = rootRef.current?.querySelector<HTMLElement>(".hero-deco-card1");
    const dashFrame = rootRef.current?.querySelector<HTMLElement>(".hero-visual-cards img:first-child");
    if (!card1) return;

    const SCROLL_RANGE = 360;
    let ticking = false;

    const ease = (t: number) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.pow(1 - t, 3);
    };

    const update = () => {
      ticking = false;
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      const raw = Math.min(1, Math.max(0, y / SCROLL_RANGE));
      const p = ease(raw);
      const tx = 123 * p;
      const ty = 12 * p;
      const rot = -4.78 * (1 - p);
      card1.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg)`;
      const alpha = (0.2 * (1 - p)).toFixed(3);
      const blur = (32 * (1 - p)).toFixed(1);
      card1.style.boxShadow = `0 1px ${blur}px 0 rgba(134, 146, 183, ${alpha})`;
      if (dashFrame) dashFrame.style.opacity = String(1 - p);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // ---------- 3. Hover 视频播放 ----------
  useEffect(() => {
    if (!rootRef.current) return;
    const pairs: Array<{ cardSel: string; videoSel: string }> = [
      { cardSel: ".channels-card", videoSel: ".channels-illust-video" },
      { cardSel: ".collab-card", videoSel: ".collab-illust-video" },
      { cardSel: ".feature-card-large-left", videoSel: ".cloud-illust-video" },
    ];
    const cleaners: Array<() => void> = [];
    pairs.forEach((p) => {
      const card = rootRef.current!.querySelector<HTMLElement>(p.cardSel);
      if (!card) return;
      const video = card.querySelector<HTMLVideoElement>(p.videoSel);
      if (!video) return;
      const onEnter = () => {
        if (video.readyState < 2) {
          try {
            video.load();
          } catch {
            /* noop */
          }
        }
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
        const pr = video.play();
        if (pr && typeof pr.catch === "function") pr.catch(() => {});
      };
      const onLeave = () => {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* noop */
        }
      };
      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mouseleave", onLeave);
      cleaners.push(() => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mouseleave", onLeave);
      });
    });
    return () => cleaners.forEach((fn) => fn());
  }, []);

  // ---------- 4. 1920 等比缩放 ----------
  useEffect(() => {
    const wrapper = rootRef.current?.querySelector<HTMLElement>(".page-wrapper");
    if (!wrapper) return;
    const DESIGN_WIDTH = 1920;
    const applyScale = () => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (w >= DESIGN_WIDTH) {
        // CSS zoom 是非标准属性，用 any 绕过类型检查
        (wrapper.style as unknown as { zoom: string }).zoom = "";
        wrapper.style.transform = "";
        wrapper.style.width = "";
        return;
      }
      const scale = w / DESIGN_WIDTH;
      const styleAny = wrapper.style as unknown as { zoom: string };
      styleAny.zoom = String(scale);
      // 不支持 zoom 时 fallback 到 transform scale
      if (typeof styleAny.zoom === "undefined" || styleAny.zoom === "") {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = "top left";
        wrapper.style.width = `${DESIGN_WIDTH}px`;
      }
    };
    window.addEventListener("resize", applyScale);
    window.addEventListener("load", applyScale);
    applyScale();
    return () => {
      window.removeEventListener("resize", applyScale);
      window.removeEventListener("load", applyScale);
    };
  }, []);

  return (
    <div className="landing-root" ref={rootRef}>
      {/* Navbar 提到 page-wrapper 之外，使其不参与 1920 基准 zoom 缩放，
          始终保持 64px 高度，与用户端 TenantLayout 的 h-16 顶部导航完全一致，
          避免 1200px 窗口下 navbar 被 zoom 压到 ~40px 与用户端落差明显 */}
      <Navbar />
      <div className="page-wrapper">
        <Hero />

        <div
          className="main-content"
          style={{
            position: "absolute",
            width: "100%",
            minWidth: "1920px",
            height: "3237.40px",
            left: 0,
            top: "905px",
            borderBottom: "1px #E2E8F0 solid",
            zIndex: 30,
          }}
        >
          <Intro />
          <HowItWorks />
          <Features />
          <Enterprise />
          <Advanced />
          <Footer />
        </div>
      </div>
    </div>
  );
}
