import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import LetterParticle from "./LetterParticle";
import type { GamePhase } from "./types";
import { devUnlockService } from "./DeveloperUnlockService";

type SuccessPhase = "confetti" | "dissolve" | "sphere_form" | "sphere_travel" | "sphere_arrive" | "done";

const TARGETS = ["Y", "O", "U", "S", "A"];
const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MIN_COUNT = 15;
const MAX_COUNT = 25;
const GAME_TIMEOUT_MS = 30_000;
const INACTIVITY_TIMEOUT_MS = 15_000;
const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa"];

interface UnlockGameOverlayProps {
  onSuccess: () => void;
  onClose: () => void;
  onStartArrival?: (startPos: { x: number; y: number }) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ParticleInit {
  id: number;
  letter: string;
  isTarget: boolean;
  x: number;
  scale: number;
}

interface NcmTarget {
  left: number;
  top: number;
  width: number;
  height: number;
}

function generateLetters(viewportWidth: number): ParticleInit[] {
  const count = MIN_COUNT + Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1));
  const letters: ParticleInit[] = [];
  const used = new Set<string>(TARGETS);
  const margin = 40;
  const usableWidth = viewportWidth - margin * 2;
  const slotWidth = usableWidth / count;

  // Generate all letters with stratified X positions (one per equal-width slot)
  const allItems: { letter: string; isTarget: boolean }[] = [];

  // Add YOUSA targets
  TARGETS.forEach((letter) => {
    allItems.push({ letter, isTarget: true });
  });

  // Build pool of remaining unique letters (excluding YOUSA)
  const pool = ALL_LETTERS.split("").filter((l) => !used.has(l));

  // Pick remaining letters without duplicates
  const remainingCount = count - TARGETS.length;
  for (let i = 0; i < remainingCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const letter = pool.splice(idx, 1)[0];
    allItems.push({ letter, isTarget: false });
  }

  // Shuffle items first
  const shuffled = shuffle(allItems);

  // Assign stratified X positions: one per slot with jitter
  shuffled.forEach((item, i) => {
    const slotCenter = margin + slotWidth * (i + 0.5);
    const jitter = (Math.random() - 0.5) * slotWidth * 0.7;
    letters.push({
      id: i,
      letter: item.letter,
      isTarget: item.isTarget,
      x: Math.max(margin, Math.min(viewportWidth - margin, slotCenter + jitter)),
      scale: 0.9 + Math.random() * 0.2,
    });
  });

  return letters;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  cp1: Point;
  cp2: Point;
  end: Point;
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function buildSvgPath(start: Point, segs: Segment[]): string {
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  for (const s of segs) {
    d += ` C ${fmt(s.cp1.x)} ${fmt(s.cp1.y)} ${fmt(s.cp2.x)} ${fmt(s.cp2.y)} ${fmt(s.end.x)} ${fmt(s.end.y)}`;
  }
  return d + " Z";
}

function generateArrivalKeyframes(targetW: number, targetH: number): string[] {
  const W = Math.max(targetW, 40);
  const H = Math.max(targetH, 20);
  const cx = W / 2;
  const cy = H / 2;
  const R = H / 2;
  const k90 = 0.55228475;
  const k45 = 0.2652165;
  const sqrt2_2 = Math.SQRT1_2;

  // Stage 1: Circle Stable (30px sphere at target center)
  const r0 = 15;
  const L0 = k45 * r0;
  const p0_0 = { x: cx, y: cy - r0 };
  const p0_1 = { x: cx + r0 * sqrt2_2, y: cy - r0 * sqrt2_2 };
  const p0_2 = { x: cx + r0, y: cy };
  const p0_3 = { x: cx + r0 * sqrt2_2, y: cy + r0 * sqrt2_2 };
  const p0_4 = { x: cx, y: cy + r0 };
  const p0_5 = { x: cx - r0 * sqrt2_2, y: cy + r0 * sqrt2_2 };
  const p0_6 = { x: cx - r0, y: cy };
  const p0_7 = { x: cx - r0 * sqrt2_2, y: cy - r0 * sqrt2_2 };
  const segs0: Segment[] = [
    { cp1: { x: cx + L0, y: cy - r0 }, cp2: { x: p0_1.x - L0 * sqrt2_2, y: p0_1.y - L0 * sqrt2_2 }, end: p0_1 },
    { cp1: { x: p0_1.x + L0 * sqrt2_2, y: p0_1.y + L0 * sqrt2_2 }, cp2: { x: p0_2.x, y: p0_2.y - L0 }, end: p0_2 },
    { cp1: { x: p0_2.x, y: p0_2.y + L0 }, cp2: { x: p0_3.x + L0 * sqrt2_2, y: p0_3.y - L0 * sqrt2_2 }, end: p0_3 },
    { cp1: { x: p0_3.x - L0 * sqrt2_2, y: p0_3.y + L0 * sqrt2_2 }, cp2: { x: p0_4.x + L0, y: p0_4.y }, end: p0_4 },
    { cp1: { x: p0_4.x - L0, y: p0_4.y }, cp2: { x: p0_5.x + L0 * sqrt2_2, y: p0_5.y + L0 * sqrt2_2 }, end: p0_5 },
    { cp1: { x: p0_5.x - L0 * sqrt2_2, y: p0_5.y - L0 * sqrt2_2 }, cp2: { x: p0_6.x, y: p0_6.y + L0 }, end: p0_6 },
    { cp1: { x: p0_6.x, y: p0_6.y - L0 }, cp2: { x: p0_7.x - L0 * sqrt2_2, y: p0_7.y + L0 * sqrt2_2 }, end: p0_7 },
    { cp1: { x: p0_7.x + L0 * sqrt2_2, y: p0_7.y - L0 * sqrt2_2 }, cp2: { x: p0_0.x - L0, y: p0_0.y }, end: p0_0 },
  ];

  // Stage 2: Pre-deformation (slight horizontal bulge, vertical contraction, organic edge wobble)
  const rx1 = 21.5;
  const ry1 = 13.5;
  const p1_0 = { x: cx, y: cy - ry1 };
  const p1_1 = { x: cx + rx1 * 0.78 + 1.2, y: cy - ry1 * 0.78 - 0.5 };
  const p1_2 = { x: cx + rx1, y: cy };
  const p1_3 = { x: cx + rx1 * 0.76, y: cy + ry1 * 0.82 + 0.6 };
  const p1_4 = { x: cx, y: cy + ry1 + 0.3 };
  const p1_5 = { x: cx - rx1 * 0.77 - 0.6, y: cy + ry1 * 0.80 + 0.4 };
  const p1_6 = { x: cx - rx1, y: cy };
  const p1_7 = { x: cx - rx1 * 0.79, y: cy - ry1 * 0.77 - 0.6 };
  const L1x = rx1 * k45;
  const L1y = ry1 * k45;
  const segs1: Segment[] = [
    { cp1: { x: cx + L1x * 1.2, y: cy - ry1 }, cp2: { x: p1_1.x - L1x * sqrt2_2, y: p1_1.y - L1y * sqrt2_2 }, end: p1_1 },
    { cp1: { x: p1_1.x + L1x * sqrt2_2, y: p1_1.y + L1y * sqrt2_2 }, cp2: { x: p1_2.x, y: p1_2.y - L1y * 1.1 }, end: p1_2 },
    { cp1: { x: p1_2.x, y: p1_2.y + L1y * 1.1 }, cp2: { x: p1_3.x + L1x * sqrt2_2, y: p1_3.y - L1y * sqrt2_2 }, end: p1_3 },
    { cp1: { x: p1_3.x - L1x * sqrt2_2, y: p1_3.y + L1y * sqrt2_2 }, cp2: { x: p1_4.x + L1x * 1.1, y: p1_4.y }, end: p1_4 },
    { cp1: { x: p1_4.x - L1x * 1.1, y: p1_4.y }, cp2: { x: p1_5.x + L1x * sqrt2_2, y: p1_5.y + L1y * sqrt2_2 }, end: p1_5 },
    { cp1: { x: p1_5.x - L1x * sqrt2_2, y: p1_5.y - L1y * sqrt2_2 }, cp2: { x: p1_6.x, y: p1_6.y + L1y * 1.1 }, end: p1_6 },
    { cp1: { x: p1_6.x, y: p1_6.y - L1y * 1.1 }, cp2: { x: p1_7.x - L1x * sqrt2_2, y: p1_7.y + L1y * sqrt2_2 }, end: p1_7 },
    { cp1: { x: p1_7.x + L1x * sqrt2_2, y: p1_7.y - L1y * sqrt2_2 }, cp2: { x: p1_0.x - L1x * 1.2, y: p1_0.y }, end: p1_0 },
  ];

  // Stage 3: Spreading Flow (liquid tongues on both sides, thick center, width reaching ~82%)
  const wHalf2 = (W / 2) * 0.82;
  const neckX2 = wHalf2 * 0.58;
  const neckY2 = H * 0.36;
  const centerThick2 = H * 0.46;
  const tipH2 = H * 0.28;
  const p2_0 = { x: cx, y: cy - centerThick2 };
  const p2_1 = { x: cx + neckX2, y: cy - neckY2 };
  const p2_2 = { x: cx + wHalf2, y: cy };
  const p2_3 = { x: cx + neckX2, y: cy + neckY2 };
  const p2_4 = { x: cx, y: cy + centerThick2 };
  const p2_5 = { x: cx - neckX2, y: cy + neckY2 };
  const p2_6 = { x: cx - wHalf2, y: cy };
  const p2_7 = { x: cx - neckX2, y: cy - neckY2 };
  const segs2: Segment[] = [
    { cp1: { x: cx + neckX2 * 0.45, y: cy - centerThick2 }, cp2: { x: p2_1.x - neckX2 * 0.25, y: p2_1.y }, end: p2_1 },
    { cp1: { x: p2_1.x + (wHalf2 - neckX2) * 0.5, y: p2_1.y }, cp2: { x: p2_2.x, y: cy - tipH2 * k90 }, end: p2_2 },
    { cp1: { x: p2_2.x, y: cy + tipH2 * k90 }, cp2: { x: p2_3.x + (wHalf2 - neckX2) * 0.5, y: p2_3.y }, end: p2_3 },
    { cp1: { x: p2_3.x - neckX2 * 0.25, y: p2_3.y }, cp2: { x: cx + neckX2 * 0.45, y: cy + centerThick2 }, end: p2_4 },
    { cp1: { x: cx - neckX2 * 0.45, y: cy + centerThick2 }, cp2: { x: p2_5.x + neckX2 * 0.25, y: p2_5.y }, end: p2_5 },
    { cp1: { x: p2_5.x - (wHalf2 - neckX2) * 0.5, y: p2_5.y }, cp2: { x: p2_6.x, y: cy + tipH2 * k90 }, end: p2_6 },
    { cp1: { x: p2_6.x, y: cy - tipH2 * k90 }, cp2: { x: p2_7.x - (wHalf2 - neckX2) * 0.5, y: p2_7.y }, end: p2_7 },
    { cp1: { x: p2_7.x + neckX2 * 0.25, y: p2_7.y }, cp2: { x: cx - neckX2 * 0.45, y: cy - centerThick2 }, end: p2_0 },
  ];

  // Helper for capsule forms
  function createCapsule(wHalf: number, radius: number, vCompression = 0): string {
    const rEff = radius - vCompression;
    const topY = cy - rEff;
    const botY = cy + rEff;
    const shoulderX = Math.max(0, wHalf - radius);
    const p_0 = { x: cx, y: topY };
    const p_1 = { x: cx + shoulderX, y: topY };
    const p_2 = { x: cx + wHalf, y: cy };
    const p_3 = { x: cx + shoulderX, y: botY };
    const p_4 = { x: cx, y: botY };
    const p_5 = { x: cx - shoulderX, y: botY };
    const p_6 = { x: cx - wHalf, y: cy };
    const p_7 = { x: cx - shoulderX, y: topY };
    const segs: Segment[] = [
      { cp1: { x: cx + shoulderX / 3, y: topY }, cp2: { x: cx + (2 * shoulderX) / 3, y: topY }, end: p_1 },
      { cp1: { x: p_1.x + k90 * radius, y: topY }, cp2: { x: p_2.x, y: cy - k90 * rEff }, end: p_2 },
      { cp1: { x: p_2.x, y: cy + k90 * rEff }, cp2: { x: p_3.x + k90 * radius, y: botY }, end: p_3 },
      { cp1: { x: cx + (2 * shoulderX) / 3, y: botY }, cp2: { x: cx + shoulderX / 3, y: botY }, end: p_4 },
      { cp1: { x: cx - shoulderX / 3, y: botY }, cp2: { x: cx - (2 * shoulderX) / 3, y: botY }, end: p_5 },
      { cp1: { x: p_5.x - k90 * radius, y: botY }, cp2: { x: p_6.x, y: cy + k90 * rEff }, end: p_6 },
      { cp1: { x: p_6.x, y: cy - k90 * rEff }, cp2: { x: p_7.x - k90 * radius, y: topY }, end: p_7 },
      { cp1: { x: cx - (2 * shoulderX) / 3, y: topY }, cp2: { x: cx - shoulderX / 3, y: topY }, end: p_0 },
    ];
    return buildSvgPath(p_0, segs);
  }

  // Stage 4: Capsule Formed (sides merged into smooth rounded capsule, width ~98.5%)
  const path3 = createCapsule((W / 2) * 0.985, R);

  // Stage 5a: Rebound Overshoot (capsule width slightly exceeds target by ~2.5px with subtle fluid volume contraction)
  const path4 = createCapsule(W / 2 + 2.5, R, 0.25);

  // Stage 5b: Settle to exact NCM button capsule dimensions
  const path5 = createCapsule(W / 2, R, 0);

  return [
    buildSvgPath(p0_0, segs0),
    buildSvgPath(p1_0, segs1),
    buildSvgPath(p2_0, segs2),
    path3,
    path4,
    path5,
  ];
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [glowPos, setGlowPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setGlowPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => { setHovered(false); setGlowPos(null); }}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 9999,
        width: 48,
        height: 48,
        borderRadius: 9999,
        background: hovered && glowPos
          ? "radial-gradient(circle 60px at " + glowPos.x + "px " + glowPos.y + "px, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)"
          : "rgba(255,255,255,0.06)",
        border: hovered ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.12)",
        color: hovered ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.7)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        transition: "background 0.3s, border 0.3s, color 0.3s, box-shadow 0.3s",
        boxShadow: hovered
          ? "0 0 16px rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <svg width="20" height="20" style={{ pointerEvents: "none" }} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="3" x2="15" y2="15" />
        <line x1="15" y1="3" x2="3" y2="15" />
      </svg>
    </button>
  );
}

export function UnlockGameOverlay({ onSuccess, onClose, onStartArrival }: UnlockGameOverlayProps) {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [collectedLetters, setCollectedLetters] = useState<string[]>([]);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [letters] = useState<ParticleInit[]>(() => generateLetters(window.innerWidth));
  const [exitPhase, setExitPhase] = useState<"idle" | "exiting">("idle");
  const [successPhase, setSuccessPhase] = useState<SuccessPhase>("confetti");
  const [ncmTarget, setNcmTarget] = useState<NcmTarget | null>(null);
  const confettiPieces = useMemo(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      dx: (Math.random() - 0.5) * 600,
      dy: (Math.random() - 0.5) * 600,
      rotate: Math.random() * 720,
    }))
  , []);
  const lastInteractionRef = useRef(Date.now());
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const occupiedRef = useRef<{ x: number; y: number }[]>([]);

  const measureRef = useRef<HTMLDivElement>(null);
  const [textDim, setTextDim] = useState<{ w: number; h: number }>({
    w: lang === "zh" ? 208 : 252,
    h: 32,
  });

  useLayoutEffect(() => {
    if (measureRef.current) {
      const w = measureRef.current.offsetWidth || Math.round(measureRef.current.getBoundingClientRect().width);
      const h = measureRef.current.offsetHeight || Math.round(measureRef.current.getBoundingClientRect().height);
      if (w > 0 && h > 0) {
        setTextDim({ w, h });
      }
    }
  }, [lang]);

  // 根据文字尺寸精准框住文字：左右留 24px，上下留 8px，既不贴字也不过大
  const padX = 24;
  const padY = 8;
  const capWidth = textDim.w + padX * 2;
  const capHeight = textDim.h + padY * 2;
  const capRadius = Math.round(capHeight / 2);
  const containerW = Math.max(320, capWidth + 40);
  const containerH = Math.max(80, capHeight + 30);

  useEffect(() => {
    const handler = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const markInteraction = useCallback(() => { lastInteractionRef.current = Date.now(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (phaseRef.current === "playing") setPhase("failed"); }, GAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (phaseRef.current === "playing" && Date.now() - lastInteractionRef.current > INACTIVITY_TIMEOUT_MS) {
        setPhase("failed");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPhase("failed"); return; }
      if (phaseRef.current !== "playing") return;
      markInteraction();
      const key = e.key.toUpperCase();
      if (key === TARGETS[currentTargetIndex]) {
        handleCollect(key);
      } else {
        setPhase("failed");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentTargetIndex, markInteraction]);

  // Auto-exit after celebration or failure
  useEffect(() => {
    if (phase === "success") {
      // Auto-exit is now handled by the successPhase animation chain (see below)
      return;
    }
    if (phase === "failed") {
      exitTimerRef.current = setTimeout(() => setExitPhase("exiting"), 1000);
      return () => { if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; } };
    }
  }, [phase]);

  // When exit animation completes, call the appropriate handler
  useEffect(() => {
    if (exitPhase === "exiting") {
      closeTimerRef.current = setTimeout(() => {
        if (phaseRef.current === "success") onSuccess();
        else onClose();
      }, 400);
      return () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } };
    }
  }, [exitPhase, onSuccess, onClose]);

      // Success animation phase chain
  useEffect(() => {
    if (phase !== "success") return;
    // Reset
    setSuccessPhase("confetti");
    setNcmTarget(null);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Confetti runs ~2.0s, then dissolve: text melting + liquid blob contracting to droplet
    timers.push(setTimeout(() => {
      setSuccessPhase("dissolve");
      // Trigger SVG liquid filter animations
      (document.getElementById("cs-liq-freq") as any)?.beginElement?.();
      (document.getElementById("cs-liq-scale") as any)?.beginElement?.();
    }, 2000));
    // Dissolve done (0.55s) -> droplet wobbles at center briefly
    timers.push(setTimeout(() => setSuccessPhase("sphere_form"), 2550));

    // Droplet fully formed at center -> hand off to standalone UnlockArrivalAnimation
    timers.push(setTimeout(() => {
      // 1. 同步激活开发者模式，让侧边栏立即将 NCM 按钮放入 DOM 树
      devUnlockService.enableDevModeOnly();

      if (onStartArrival) {
        // 2. 将水滴起始位置（屏幕正中心）交接给独立全屏展开动画
        onStartArrival({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        // 3. 自身水滴稍作重叠后平滑隐藏，确保视觉上零空隙、绝不变透明
        setTimeout(() => {
          setSuccessPhase("done");
        }, 60);
        // 4. 小游戏蒙层在水滴起飞滑行期间平缓淡出，避免背景模糊突然消失的闪烁感
        setTimeout(() => {
          setExitPhase("exiting");
        }, 120);
      } else {
        // 兜底：如果外部未挂载独立组件，在小游戏内完成飞行
        requestAnimationFrame(() => {
          const ncmBtn = document.querySelector<HTMLElement>('[data-nav-id="ncmstudio"]');
          const rect = ncmBtn?.getBoundingClientRect();
          if (rect) {
            setNcmTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
          }
          setSuccessPhase("sphere_travel");
        });
      }
    }, 2800));

    // 兜底分支计时器（仅在无 onStartArrival 时使用）
    if (!onStartArrival) {
      timers.push(setTimeout(() => {
        const ncmBtn = document.querySelector<HTMLElement>('[data-nav-id="ncmstudio"]');
        const rect = ncmBtn?.getBoundingClientRect();
        if (rect) {
          setNcmTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
        }
        window.dispatchEvent(new CustomEvent("codexa-unlock-arrival"));
        setSuccessPhase("sphere_arrive");
      }, 3500));

      timers.push(setTimeout(() => {
        window.dispatchEvent(new CustomEvent("codexa-unlock-handoff"));
        setExitPhase("exiting");
      }, 4500));

      timers.push(setTimeout(() => {
        setSuccessPhase("done");
      }, 4800));
    }

    return () => timers.forEach(clearTimeout);
  }, [phase, onStartArrival]);

  const handleCollect = useCallback((letter: string) => {
    markInteraction();
    setCollectedLetters((prev) => [...prev, letter]);
    const nextIndex = currentTargetIndex + 1;
    setCurrentTargetIndex(nextIndex);
    if (nextIndex >= TARGETS.length) setPhase("success");
  }, [currentTargetIndex, markInteraction]);

  const handleWrongClick = useCallback(() => setPhase("failed"), []);
  const handleClose = useCallback(() => setPhase("failed"), []);

  const overlayBase = {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: "transparent",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    overflow: "hidden",
    borderRadius: "var(--radius)",
    WebkitAppRegion: "no-drag",
    transition: "backdrop-filter 0.5s ease-out, opacity 0.5s ease-out",
  } as React.CSSProperties;

  const exitStyle = exitPhase === "exiting" ? {
    backdropFilter: "blur(0px)",
    WebkitBackdropFilter: "blur(0px)",
    opacity: 0,
    pointerEvents: "none",
  } as React.CSSProperties : {};

  const overlayStyle = { ...overlayBase, ...exitStyle } as React.CSSProperties;

  const { w, h } = viewportSize;

  return createPortal(
    <div style={overlayStyle} onMouseMove={phase === "playing" ? markInteraction : undefined}>
      {/* Invisible text measurer for 100% accurate layout dimensions without transform/scale distortion */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          visibility: "hidden",
          pointerEvents: "none",
          fontSize: 26,
          fontWeight: 700,
          whiteSpace: "nowrap",
          left: -9999,
          top: -9999,
          zIndex: -1,
        }}
      >
        {lang === "zh" ? "开发者功能已开启" : "Developer Mode Enabled"}
      </div>

      {/* Playing (visible during playing and failed, fades with overlay) */}
      {(phase === "playing" || phase === "failed") && (
        <>
          {letters.map((p, i) => (
            <LetterParticle
              key={p.id}
              letter={p.letter}
              isTarget={p.isTarget}
              isNext={p.isTarget && TARGETS.indexOf(p.letter) === currentTargetIndex}
              isCollected={p.isTarget && collectedLetters.includes(p.letter)}
              isFailing={false}
              viewportWidth={viewportSize.w}
              viewportHeight={viewportSize.h}
              index={i}
              total={letters.length}
              initialX={p.x}
              initialScale={p.scale}
              particleId={p.id}
              occupiedRef={occupiedRef}
              onCollect={handleCollect}
              onWrongClick={handleWrongClick}
            />
          ))}

          <CloseButton onClick={handleClose} />

          <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", width: 300, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 9999, overflow: "hidden", zIndex: 10 }}>
            <motion.div initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 30, ease: "linear" }} style={{ height: "100%", background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.02) 100%), color-mix(in srgb, var(--accent) 35%, transparent)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 0 10px color-mix(in srgb, var(--accent) 20%, transparent)", borderRadius: 9999 }} />
          </div>
        </>
      )}

      {/* Success */}
      {phase === "success" && (
        <>
          {/* Wobble keyframes for the glass sphere */}
          <style>{`
            @keyframes cs-wobble {
              0%, 100% { transform: scale(1, 1); }
              25% { transform: scale(1.025, 0.975); }
              50% { transform: scale(0.98, 1.02); }
              75% { transform: scale(1.015, 0.985); }
            }
          `}</style>

          {/* SVG liquid filter for the dissolve blob */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <radialGradient id="cs-arrival-fill" cx="38%" cy="28%" r="76%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.46)" />
                <stop offset="34%" stopColor="rgba(255,255,255,0.16)" />
                <stop offset="74%" stopColor="rgba(255,255,255,0.045)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
              </radialGradient>
              <filter id="cs-liquid" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise">
                  <animate id="cs-liq-freq" attributeName="baseFrequency" values="0.04;0.01" dur="0.55s" begin="indefinite" fill="freeze" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G">
                  <animate id="cs-liq-scale" attributeName="scale" values="12;0" dur="0.55s" begin="indefinite" fill="freeze" />
                </feDisplacementMap>
              </filter>
              <filter id="cs-liquid-arrival" x="-20%" y="-40%" width="140%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035 0.08" numOctaves="2" seed="17" result="arrivalNoise" />
                <feDisplacementMap in="SourceGraphic" in2="arrivalNoise" scale="3" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>

          {/* Confetti */}
          {confettiPieces.map((p) => (
            <motion.div
              key={"c-" + p.id}
              initial={{ x: w / 2, y: h / 2, scale: 0, opacity: 1 }}
              animate={{ x: w / 2 + p.dx, y: h / 2 + p.dy, scale: [0, 1.5, 0], opacity: [1, 1, 0], rotate: p.rotate }}
              transition={{ duration: 1.2, delay: p.id * 0.02, ease: "easeOut" }}
              style={{ position: "absolute", width: 10, height: 10, background: CONFETTI_COLORS[p.id % CONFETTI_COLORS.length], borderRadius: 2 }}
            />
          ))}

          {/* Dissolve: text melts + liquid blob contracts into droplet */}
          {successPhase !== "done" && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: containerW,
                height: containerH,
                pointerEvents: "none",
                zIndex: 100,
              }}
            >
              {/* 
                液体胶囊：根据文字尺寸精准框住文字（左右留 24px，上下留 8px），
                在 dissolve 时对称凝聚收缩为 30px 水滴，与文字 100% 同心对齐！
                使用 inset: 0 + margin: auto 进行纯 CSS 盒模型自动居中，完全不受 transform 与关键帧动画影响。
              */}
              <motion.div
                initial={{ opacity: 0, width: capWidth, height: capHeight, borderRadius: `${capRadius}px` }}
                animate={
                  successPhase === "dissolve" || successPhase === "sphere_form"
                    ? {
                        opacity: 1,
                        width: 30,
                        height: 30,
                        borderRadius: "15px",
                      }
                    : {
                        opacity: 1,
                        width: capWidth,
                        height: capHeight,
                        borderRadius: `${capRadius}px`,
                      }
                }
                transition={
                  successPhase === "dissolve" || successPhase === "sphere_form"
                    ? { duration: 0.55, ease: "easeInOut" }
                    : { delay: 0.25, duration: 0.45, ease: "easeOut" }
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  background:
                    "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.01) 100%)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  boxShadow:
                    "0 8px 28px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.12), 0 0 24px rgba(255,255,255,0.20), inset 0 0 20px rgba(255,255,255,0.10)",
                  transformOrigin: "center center",
                  animation: "cs-wobble 0.9s ease-in-out infinite",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />

              {/* Text: appears inside the capsule, then dissolves */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  successPhase === "dissolve" || successPhase === "sphere_form"
                    ? { scaleX: 0, opacity: 0, filter: "blur(12px)" }
                    : { scale: 1, opacity: 1 }
                }
                transition={
                  successPhase === "dissolve" || successPhase === "sphere_form"
                    ? { duration: 0.55, ease: "easeInOut" }
                    : { delay: 0.4, type: "spring", stiffness: 200, damping: 15 }
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: "auto",
                  width: "max-content",
                  height: "max-content",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  textShadow: "0 3px 12px rgba(var(--fluid-glow-rgb, 120, 170, 255), 0.4), 0 1px 4px rgba(var(--fluid-glow-rgb, 120, 170, 255), 0.25)",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                {lang === "zh" ? "开发者功能已开启" : "Developer Mode Enabled"}
              </motion.div>
            </div>
          )}
        </>
      )}


    </div>,
    document.body
  );
}
