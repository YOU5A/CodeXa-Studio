/**
 * LyricsLine — 单行歌词组件
 *
 * 三态渲染：active（当前行）/ before（之前）/ after（之后）
 * 动画公式来自 Refined Now Playing 研究，受 LyricsSettings 控制。
 *
 * 当前行动态字号：根据文本长度自动缩放——短文本（单排）放大，长文本（多排）缩小。
 *
 * @module lyrics/LyricsLine
 */

import { memo, useRef, useMemo } from "react";
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

/** 估算文本字符宽度单位（CJK=1, ASCII≈0.55, 其他≈0.65） */
function estimateCharUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7F) units += 0.55;
    else if (cp >= 0x4E00 && cp <= 0x9FFF) units += 1;
    else if (cp >= 0x3000 && cp <= 0x303F) units += 1;
    else if (cp >= 0xFF00 && cp <= 0xFFEF) units += 1;
    else if (cp >= 0xAC00 && cp <= 0xD7AF) units += 1;
    else units += 0.65;
  }
  return units;
}

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
  const currentFontBase = CURRENT_FONT_MAP[fontSize];

  // 当前行动态字号：短文本放大，长文本缩小（基于 LyricWindow 280px 宽度）
  const currentFont = useMemo(() => {
    if (!isCurrent) return currentFontBase;
    const charUnits = estimateCharUnits(line.text);
    const maxUnits = 248 / currentFontBase; // 可用像素宽度 ÷ 单字宽
    const scale = maxUnits / Math.max(charUnits, 1);
    return Math.min(18, Math.round(currentFontBase * Math.max(0.8, Math.min(1.4, scale))));
  }, [isCurrent, currentFontBase, line.text]);

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
export { scaleByOffset, blurByOffset, opacityByOffset, estimateCharUnits };