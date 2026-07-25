/**
 * LyricsLine — Single lyric line with original + romaji + translation layers
 *
 * Ported from refined-now-playing-netease-next.
 * Each line renders up to 3 stacked div layers.
 * Romaji uses CSS var --lyric-romaji-size-em, translation uses --lyric-translation-size-em.
 * Interlude lines render InterludeDots.
 * Offset-based opacity: current line (offset=0) is full opacity, others dim.
 *
 * @module lyrics/LyricsLine
 */

import { memo, useRef } from "react";
import type { LyricLine } from "./types";
import type { LyricsSettingsValues } from "./types";
import { DEFAULT_LYRICS_SETTINGS } from "./types";
import InterludeDots from "./InterludeDots";

export interface LyricsLineProps {
  line: LyricLine;
  offset: number;
  isCurrent: boolean;
  currentTime: number;
  id?: number;
  getCurrentTime?: () => number;
  seekCounter?: number;
  playState?: boolean;
  pageOpen?: boolean;
  onClick?: (time: number) => void;
  settings?: LyricsSettingsValues;
}

/** scale = (max(1 - |offset|*0.2, 0))^3 * 0.3 + 0.7 */
export function scaleByOffset(offset: number): number {
  const a = Math.abs(offset);
  const s = 1 - a * 0.2;
  if (s <= 0) return 0.7;
  return s * s * s * 0.3 + 0.7;
}

/** blur = min(0.5 + |offset|*1.0, 4.5) px */
export function blurByOffset(offset: number): number {
  return Math.min(0.5 + Math.abs(offset) * 1.0, 4.5);
}

/** opacity: |offset|<=1->1, else max(1-0.4*(|offset|-1), 0) */
export function opacityByOffset(offset: number): number {
  const a = Math.abs(offset);
  if (a <= 1) return 1;
  return Math.max(1 - 0.4 * (a - 1), 0);
}

/** Estimate character width units (CJK=1, ASCII 0.55, other 0.65) */
export function estimateCharUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7F) units += 0.55;
    else if (
      (cp >= 0x4E00 && cp <= 0x9FFF) ||
      (cp >= 0x3000 && cp <= 0x303F) ||
      (cp >= 0xFF00 && cp <= 0xFFEF) ||
      (cp >= 0xAC00 && cp <= 0xD7AF)
    )
      units += 1;
    else units += 0.65;
  }
  return units;
}

const LyricsLine = memo(function LyricsLine({
  line,
  offset,
  isCurrent,
  currentTime,
  id,
  getCurrentTime,
  seekCounter = 0,
  playState = true,
  pageOpen = true,
  onClick,
  settings = DEFAULT_LYRICS_SETTINGS,
}: LyricsLineProps) {
  const pressStartTime = useRef(0);

  const { fontBold, fontSize, romajiFontSize, translationFontSize, showTranslation, showRomaji } = settings;

  // Interlude line
  if (line.isInterlude) {
    return (
      <div
        className="lyric-line lyric-interlude-line"
        data-offset={offset}
        style={{
          height: 0,
          overflow: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <InterludeDots
          line={line}
          currentTime={currentTime}
          isCurrent={isCurrent}
          id={id ?? 0}
          getCurrentTime={getCurrentTime}
          seekCounter={seekCounter}
          playState={playState}
          pageOpen={pageOpen}
        />
      </div>
    );
  }

  const displayText = line.originalLyric || line.text;
  const isZeroOffset = offset === 0;

  // Opacity classes: current line (offset=0) items full, others dim
  const originalOpacity = isZeroOffset ? 1 : 0.4;
  const subOpacity = isZeroOffset ? 0.8 : 0.32;

  return (
    <div
      className="lyric-line"
      data-offset={offset}
      onMouseDown={
        onClick
          ? () => {
              pressStartTime.current = Date.now();
            }
          : undefined
      }
      onMouseUp={
        onClick
          ? () => {
              if (Date.now() - pressStartTime.current < 200) onClick(line.time);
            }
          : undefined
      }
      style={{
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      {/* Original lyric */}
      <div
        className="lyric-line-original"
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: fontBold ? 700 : (isZeroOffset ? 600 : 400),
          lineHeight: 1.2,
          color: isZeroOffset ? "var(--text-primary)" : "var(--text-tertiary)",
          opacity: originalOpacity,
          transition: "opacity 0.5s ease",
        }}
      >
        {displayText}
      </div>

      {/* Romaji */}
      {showRomaji && line.romanLyric && (
        <div
          className="lyric-line-romaji"
          style={{
            fontSize: `calc(${fontSize}px * ${romajiFontSize})`,
            fontWeight: isZeroOffset ? 400 : 300,
            lineHeight: 1.2,
            color: isZeroOffset ? "var(--text-secondary)" : "var(--text-tertiary)",
            opacity: subOpacity * 0.8,
            marginBottom: "0.4em",
            transition: "opacity 0.5s ease",
          }}
        >
          {line.romanLyric}
        </div>
      )}

      {/* Translation */}
      {showTranslation && line.translatedLyric && (
        <div
          className="lyric-line-translated"
          style={{
            fontSize: `calc(${fontSize}px * ${translationFontSize})`,
            fontWeight: isZeroOffset ? 400 : 300,
            lineHeight: 1.2,
            color: isZeroOffset ? "var(--text-secondary)" : "var(--text-tertiary)",
            opacity: subOpacity,
            marginBottom: "0.3em",
            transition: "opacity 0.5s ease",
          }}
        >
          {line.translatedLyric}
        </div>
      )}
    </div>
  );
});

export default LyricsLine;