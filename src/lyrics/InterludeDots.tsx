/**
 * InterludeDots — Three breathing dots with staggered animation
 *
 * Each dot cycles independently through opacity and scale.
 * When current line: dots breathe with staggered animation (GPU-accelerated).
 * When not current: dots are dimmed and static with smooth transition.
 * animation-fill-mode: backwards prevents flash during staggered delay.
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

  // Time-based fill progress (0..1) for each dot
  const dotProgress = (dot: { time: number; duration: number }) => {
    if (!isCurrent) return 0;
    return clamp((effectiveCurrentTime - dot.time) / Math.max(dot.duration, 1));
  };

  // Sync on seek or state change
  useEffect(() => {
    setRenderTime(getDisplayedCurrentTime());
  }, [getDisplayedCurrentTime, isCurrent, id, seekCounter, playState]);

  // RAF-driven time update when current and playing
  useEffect(() => {
    if (!pageOpen || !isCurrent || !playState) return;
    let rafId = 0;
    const tick = () => {
      setRenderTime(getDisplayedCurrentTime());
      rafId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(rafId); };
  }, [isCurrent, playState, pageOpen, seekCounter, getDisplayedCurrentTime]);

  const pauseClass = !isCurrent || !playState ? " pause-breath" : "";

  return (
    <div
      className={"interlude-inner" + pauseClass}
      ref={dotContainerRef}
    >
      {dots.map((dot, i) => {
        const progress = dotProgress(dot);
        const dotColor = isCurrent ? "var(--text-primary)" : "var(--text-tertiary)";
        return (
          <span
            key={i}
            className="interlude-dot"
            style={{
              animation: isCurrent
                ? ("interlude-dot-breathe 6s ease-in-out " + (i * 1.0) + "s infinite backwards")
                : "none",
              // Base styles always set; animation overrides when current,
              // backwards fill uses 0% keyframe values during delay.
              opacity: 0.25,
              transform: "scale(0.9)",
              // Transition only for dimming when NOT current.
              // Disabled when current to avoid fighting the CSS animation.
              transition: isCurrent ? "none" : "opacity 0.5s ease, transform 0.5s ease",
              backgroundColor: dotColor,
              boxShadow: isCurrent
                ? ("0 0 3px 1px " + dotColor)
                : "none",
              willChange: isCurrent ? "transform, opacity" : "auto",
            }}
          />
        );
      })}
    </div>
  );
}

export const INTERLUDE_ROW_HEIGHT = 0;