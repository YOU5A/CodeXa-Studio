/**
 * LyricsLine — 单行歌词组件
 *
 * 三态渲染：active（当前行）/ before（之前）/ after（之后）
 * 动画公式来自 Refined Now Playing 研究，受 LyricsSettings 控制。
 *
 * @module lyrics/LyricsLine
 */

import { memo, useRef } from "react";
import type { LyricLine } from "./types";
import type { LyricsSettingsValues } from "./LyricsSettingsPanel";
import { DEFAULT_LYRICS_SETTINGS } from "./LyricsSettingsPanel";
import InterludeDots from "./InterludeDots";

export interface LyricsLineProps {
  line: LyricLine;
  /** 距离当前行的偏移量（0=当前行） */
  offset: number;
  isCurrent: boolean;
  currentTime: number;
  onClick?: (time: number) => void;
  settings?: LyricsSettingsValues;
}

/** scale = clamp((1 - |offset| × 0.2)³ × 0.3 + 0.7, 0, 1) */
function scaleByOffset(offset: number): number {
  const a = Math.abs(offset);
  const s = 1 - a * 0.2;
  if (s <= 0) return 0.7;
  return s * s * s * 0.3 + 0.7;
}

/** blur = min(0.5 + |offset| × 1.0, 4.5) px */
function blurByOffset(offset: number): number {
  return Math.min(0.5 + Math.abs(offset) * 1.0, 4.5);
}

/** opacity: |offset| ≤ 1 → 1, else → max(1 - 0.4 × (|offset|-1), 0) */
function opacityByOffset(offset: number): number {
  const a = Math.abs(offset);
  if (a <= 1) return 1;
  return Math.max(1 - 0.4 * (a - 1), 0);
}

const FONT_MAP = { small: 10, medium: 12, large: 14 };
const CURRENT_FONT_MAP = { small: 13, medium: 15, large: 17 };

const LyricsLine = memo(function LyricsLine({
  line,
  offset,
  isCurrent,
  currentTime,
  onClick,
  settings = DEFAULT_LYRICS_SETTINGS,
}: LyricsLineProps) {
  const absOffset = Math.abs(offset);
  const pressStartTime = useRef(0);
  const { enableScale, enableBlur, enableGlow, enableStagger, fontSize } = settings;

  // ── 间奏行 ──
  if (line.isInterlude) {
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isCurrent ? 1 : 0.25,
          transform: enableScale ? `scale(${scaleByOffset(offset)})` : "scale(1)",
          transition: "opacity 0.5s ease, transform 0.5s var(--lyric-easing, ease)",
          pointerEvents: "none",
        }}
      >
        <InterludeDots line={line} currentTime={currentTime} isCurrent={isCurrent} />
      </div>
    );
  }

  // ── 普通歌词行 ──
  const scale = enableScale ? scaleByOffset(offset) : 1;
  const blur = enableBlur ? blurByOffset(offset) : 0;
  const opacity = opacityByOffset(offset);
  const staggerDelay = enableStagger ? absOffset * 50 : 0;

  const baseFont = FONT_MAP[fontSize];
  const currentFont = CURRENT_FONT_MAP[fontSize];

  return (
    <div
      onMouseDown={onClick ? () => { pressStartTime.current = Date.now(); } : undefined}
      onMouseUp={onClick ? () => {
        if (Date.now() - pressStartTime.current < 200) {
          onClick(line.time);
        }
      } : undefined}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "4px 16px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        transform: `scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        opacity,
        transition: [
          "transform 0.5s var(--lyric-easing, ease)",
          "filter 0.5s ease",
          "opacity 0.5s ease",
        ].join(", "),
        transitionDelay: `${staggerDelay}ms`,
        textShadow: enableGlow && isCurrent
          ? "0 0 14px rgba(var(--accent-rgb), 0.40), 0 0 28px rgba(var(--accent-rgb), 0.15)"
          : "none",
      }}
    >
      <span
        style={{
          fontSize: isCurrent ? currentFont : baseFont,
          fontWeight: isCurrent ? 700 : 400,
          lineHeight: 1.5,
          color: isCurrent ? "var(--text-primary)" : "var(--text-tertiary)",
          position: "relative",
          zIndex: 1,
          filter: isCurrent ? "brightness(1.15)" : "none",
          transition: "font-size 0.5s ease, font-weight 0.5s ease, color 0.5s ease, filter 0.5s ease",
        }}
      >
        {line.text}
      </span>
    </div>
  );
});

export default LyricsLine;
export { scaleByOffset, blurByOffset, opacityByOffset };
