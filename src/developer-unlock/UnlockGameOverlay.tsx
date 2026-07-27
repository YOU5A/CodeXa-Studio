import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import LetterParticle from "./LetterParticle";
import type { GamePhase } from "./types";

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
      exitTimerRef.current = setTimeout(() => setExitPhase("exiting"), 1500);
      return () => { if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; } };
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
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={"c-" + i}
              initial={{ x: w / 2, y: h / 2, scale: 0, opacity: 1 }}
              animate={{ x: w / 2 + (Math.random() - 0.5) * 600, y: h / 2 + (Math.random() - 0.5) * 600, scale: [0, 1.5, 0], opacity: [1, 1, 0], rotate: Math.random() * 720 }}
              transition={{ duration: 1.2, delay: i * 0.02, ease: "easeOut" }}
              style={{ position: "absolute", width: 10, height: 10, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], borderRadius: 2 }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 15 }}
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#FFD700",
                textShadow: "0 0 40px rgba(255,215,0,0.6)",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {lang === "zh" ? "开发者功能已开启" : "Developer Mode Enabled"}
            </motion.div>
          </div>
        </>
      )}


    </div>,
    document.body
  );
}
