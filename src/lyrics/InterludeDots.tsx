/**
 * InterludeDots — Interlude waiting dots with per-dot time-based animation
 *
 * Ported from refined-now-playing-netease-next.
 * 3 dots fill up progressively over the interlude duration using RAF-driven animation.
 * Container uses breathing animation. Paused when not current line or not playing.
 *
 * @module lyrics/InterludeDots
 */

import { useRef, useState, useEffect, useCallback } from "react";
import type { LyricLine } from "./types";

interface InterludeDotsProps {
  line: LyricLine;
  currentTime: number;
  isCurrent: boolean;
  id: number;
  getCurrentTime?: () => number;
  seekCounter?: number;
  playState?: boolean;
  pageOpen?: boolean;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export default function InterludeDots({
  line, currentTime, isCurrent, id,
  getCurrentTime, seekCounter = 0, playState = true, pageOpen = true,
}: InterludeDotsProps) {
  const dotContainerRef = useRef<HTMLDivElement>(null);

  const getDisplayedCurrentTime = useCallback(() => {
    return getCurrentTime ? getCurrentTime() : currentTime;
  }, [getCurrentTime, currentTime]);

  const [renderTime, setRenderTime] = useState(getDisplayedCurrentTime());
  const effectiveCurrentTime = isCurrent ? renderTime : currentTime;

  const dotCount = 3;
  const perDotTime = Math.floor((line.duration || 3000) / dotCount);
  const dots = Array.from({ length: dotCount }).map((_, i) => ({
    time: line.time + perDotTime * i,
    duration: perDotTime,
  }));

  const dotAnimation = (dot: { time: number; duration: number }) => {
    if (!isCurrent) {
      return {
        transition: "opacity 200ms ease, transform 200ms ease",
        opacity: 0.2,
        transform: "scale(0.9)",
      };
    }
    const progress = clamp((effectiveCurrentTime - dot.time) / Math.max(dot.duration, 1));
    return {
      transition: "none",
      opacity: 0.2 + 0.7 * progress,
      transform: `scale(${0.9 + 0.1 * progress})`,
    };
  };

  // Sync on seek or state change
  useEffect(() => {
    setRenderTime(getDisplayedCurrentTime());
  }, [getDisplayedCurrentTime, isCurrent, id, seekCounter, playState]);

  // RAF-driven time update when this is the current line and playing
  useEffect(() => {
    if (!pageOpen || !isCurrent || !playState) {
      return;
    }
    let rafId = 0;
    const tick = () => {
      setRenderTime(getDisplayedCurrentTime());
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isCurrent, playState, pageOpen, seekCounter, getDisplayedCurrentTime]);

  const pauseClass = !isCurrent || !playState ? " pause-breath" : "";

  return (
    <div
      className={"interlude-inner" + pauseClass}
      ref={dotContainerRef}
    >
      {dots.map((dot, i) => (
        <span
          key={i}
          className="interlude-dot"
          style={dotAnimation(dot)}
        />
      ))}
    </div>
  );
}

/** Row height used for interlude lines in scroll calculations */
export const INTERLUDE_ROW_HEIGHT = 0;