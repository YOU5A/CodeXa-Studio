import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

export function UnlockGameOverlay({ onSuccess, onClose }: UnlockGameOverlayProps) {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [collectedLetters, setCollectedLetters] = useState<string[]>([]);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [letters] = useState<ParticleInit[]>(() => generateLetters(window.innerWidth));
  const [exitPhase, setExitPhase] = useState<"idle" | "exiting">("idle");
  const [successPhase, setSuccessPhase] = useState<SuccessPhase>("confetti");
  const [ncmTarget, setNcmTarget] = useState<{ x: number; y: number } | null>(null);
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
    // Droplet formed -> calculate NCM button position from adjacent sidebar items
    timers.push(setTimeout(() => {
      const musicBtn = document.querySelector('[data-nav-id="musicmanager"]');
      if (musicBtn) {
        const mRect = musicBtn.getBoundingClientRect();
        const btnHeight = mRect.height;
        // NCM button sits right after musicmanager with 2px gap
        setNcmTarget({
          x: mRect.left + mRect.width / 2,
          y: mRect.bottom + 2 + btnHeight / 2,
        });
      }
      setSuccessPhase("sphere_travel");
    }, 2800));
    // Travel done -> arrive: unlock + droplet blurs out + overlay fades in parallel
    timers.push(setTimeout(() => {
      devUnlockService.enableDevModeOnly();
      setSuccessPhase("sphere_arrive");
      setExitPhase("exiting");
    }, 3500));
    // Arrive animation (0.5s) + exit transition (0.5s) finish together
    timers.push(setTimeout(() => {
      setSuccessPhase("done");
    }, 4000));

    return () => timers.forEach(clearTimeout);
  }, [phase]);

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
            <motion.div initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 30, ease: "linear" }} style={{ height: "100%", background: "var(--accent)", borderRadius: 9999 }} />
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
      25% { transform: scale(1.12, 0.88); }
      50% { transform: scale(0.92, 1.08); }
      75% { transform: scale(1.06, 0.94); }
    }
  `}</style>

  {/* SVG liquid filter for the dissolve blob */}
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <defs>
      <filter id="cs-liquid" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise">
          <animate id="cs-liq-freq" attributeName="baseFrequency" values="0.04;0.01" dur="0.55s" begin="indefinite" fill="freeze" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G">
          <animate id="cs-liq-scale" attributeName="scale" values="12;0" dur="0.55s" begin="indefinite" fill="freeze" />
        </feDisplacementMap>
      </filter>
    </defs>
  </svg>

  {/* Confetti — unchanged */}
  {confettiPieces.map((p) => (
    <motion.div
      key={"c-" + p.id}
      initial={{ x: w / 2, y: h / 2, scale: 0, opacity: 1 }}
      animate={{ x: w / 2 + p.dx, y: h / 2 + p.dy, scale: [0, 1.5, 0], opacity: [1, 1, 0], rotate: p.rotate }}
      transition={{ duration: 1.2, delay: p.id * 0.02, ease: "easeOut" }}
      style={{ position: "absolute", width: 10, height: 10, background: CONFETTI_COLORS[p.id % CONFETTI_COLORS.length], borderRadius: 2 }}
    />
  ))}

  {successPhase !== "done" && (
<>
  {/* Dissolve: text melts + liquid blob contracts into droplet */}
  {successPhase !== "sphere_form" && successPhase !== "sphere_travel" && successPhase !== "sphere_arrive" && (
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 100 }}>
      {/* Text: appears with spring, then dissolves */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={
          successPhase === "dissolve"
            ? { scaleX: 0, opacity: 0, filter: "blur(12px)" }
            : { scale: 1, opacity: 1 }
        }
        transition={
          successPhase === "dissolve"
            ? { duration: 0.55, ease: "easeInOut" }
            : { delay: 0.6, type: "spring", stiffness: 200, damping: 15 }
        }
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#FFFFFF",
          textShadow: "0 3px 12px rgba(var(--fluid-glow-rgb), 0.4), 0 1px 4px rgba(var(--fluid-glow-rgb), 0.25)",
          textAlign: "center",
          whiteSpace: "nowrap",
          transformOrigin: "center",
        }}
      >
        {lang === "zh" ? "\u5f00\u53d1\u8005\u529f\u80fd\u5df2\u5f00\u542f" : "Developer Mode Enabled"}
      </motion.div>

      {/* Liquid blob: starts large (covers text), contracts into droplet */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={
          successPhase === "dissolve"
            ? { opacity: 1, width: 30, height: 30, borderRadius: "50%", x: "-50%", y: "-50%" }
            : { opacity: 0, width: 240, height: 40, borderRadius: "12% / 28%", x: "-50%", y: "-50%" }
        }
        transition={
          successPhase === "dissolve"
            ? { duration: 0.55, delay: 0.05, ease: "easeOut" }
            : { duration: 0.15 }
        }
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.12), 0 0 30px rgba(var(--fluid-glow-rgb), 0.4), 0 0 8px rgba(var(--fluid-glow-rgb), 0.25), inset 0 0 20px rgba(255,255,255,0.08)",
          filter: "url(#cs-liquid)",
          pointerEvents: "none",
        }}
      />
    </div>
  )}

  {/* Traveling droplet: wobbles then flies to NCM button with liquid stretch */}
  {(successPhase === "sphere_form" || successPhase === "sphere_travel" || successPhase === "sphere_arrive") && (
    <motion.div
      initial={false}
      animate={{
        left: (successPhase === "sphere_travel" || successPhase === "sphere_arrive") && ncmTarget
          ? ncmTarget.x - 15
          : w / 2 - 15,
        top: (successPhase === "sphere_travel" || successPhase === "sphere_arrive") && ncmTarget
          ? ncmTarget.y - 15
          : h / 2 - 15,
      }}
      transition={
        successPhase === "sphere_travel"
          ? { type: "spring", stiffness: 55, damping: 12 }
          : { duration: 0.35, ease: "easeOut" }
      }
      style={{ position: "fixed", zIndex: 1000, pointerEvents: "none" }}
    >
      <motion.div
        animate={
          successPhase === "sphere_arrive"
            ? { scale: 2.5, opacity: 0, filter: "blur(12px)" }
            : { scale: 1, opacity: 1, filter: "blur(0px)" }
        }
        transition={
          successPhase === "sphere_arrive"
            ? { duration: 0.5, ease: "easeOut" }
            : { duration: 0.3, ease: "easeOut" }
        }
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.12), 0 0 30px rgba(var(--fluid-glow-rgb), 0.4), 0 0 8px rgba(var(--fluid-glow-rgb), 0.25), inset 0 0 20px rgba(255,255,255,0.08)",
          transformOrigin: successPhase === "sphere_travel" ? "25% 50%" : "center",
          animation:
            successPhase === "sphere_travel" ? "cs-liquid-pull 0.5s ease-in-out infinite" :
            successPhase === "sphere_arrive" ? "none" :
            "cs-wobble 0.9s ease-in-out infinite",
        }}
      />
    </motion.div>
  )}</>
  )}
</>
      )}


    </div>,
    document.body
  );
}
