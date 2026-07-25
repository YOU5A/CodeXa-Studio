/**
 * LyricDisplay — Core lyrics display with transform-based layout
 *
 * Ported from refined-now-playing-netease-next.
 * Each line is absolutely positioned with transform-based animation.
 * Line heights are estimated dynamically based on fontSize and visible sub-layers.
 * Uses ResizeObserver for container size tracking.
 *
 * @module lyrics/LyricDisplay
 */

import { useRef, useMemo, useLayoutEffect, useState, useCallback, useEffect } from "react";
import type { LyricData, LyricLine, LyricsSettingsValues } from "./types";
import { DEFAULT_LYRICS_SETTINGS } from "./types";
import LyricsLine, { scaleByOffset, blurByOffset, opacityByOffset } from "./LyricsLine";

const VIRTUALIZED_LYRIC_MIN_LINES = 90;
const VIRTUALIZED_LYRIC_WINDOW_BEFORE = 24;
const VIRTUALIZED_LYRIC_WINDOW_AFTER = 30;
const VIRTUALIZED_LYRIC_SCROLLING_EXTRA = 12;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// ── Helpers ──

function estimateLyricLineHeight(line: LyricLine, options: LyricsSettingsValues): number {
  const fontSize = Math.max(1, Number(options.fontSize) || 20);
  const baseLineHeight = fontSize * 1.2;
  if (!line || line.isInterlude || (!line.originalLyric && !line.dynamicLyric)) {
    return Math.ceil(baseLineHeight);
  }

  let height = baseLineHeight;
  const gap = fontSize * 0.3;

  if (options.showRomaji && line.romanLyric) {
    height += gap + fontSize * (options.romajiFontSize || 0.6);
  }
  if (options.showTranslation && line.translatedLyric) {
    height += gap + fontSize * (options.translationFontSize || 1.0);
  }

  return Math.ceil(Math.max(baseLineHeight, height));
}

// ── Props ──

interface LyricDisplayProps {
  lyricData: LyricData | null;
  currentTime: number;
  currentLineIndex: number;
  getCurrentTime?: () => number;
  seekCounter?: number;
  playState?: boolean;
  pageOpen?: boolean;
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  noLyricsText?: string;
  instrumentalText?: string;
  onLineClick?: (time: number) => void;
  settings?: LyricsSettingsValues;
  scrollingMode?: boolean;
  scrollingFocusLine?: number;
}

// ── Component ──

export default function LyricDisplay({
  lyricData, currentTime, currentLineIndex, getCurrentTime,
  seekCounter = 0, playState = true, pageOpen = true,
  loading, error, loadingText, noLyricsText, instrumentalText,
  onLineClick, settings = DEFAULT_LYRICS_SETTINGS,
  scrollingMode = false, scrollingFocusLine = 0,
}: LyricDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerHeightRef = useRef(0);

  const heightOfItems = useRef<number[]>([]);
  const shouldTransit = useRef(true);
  const previousFocusedLineRef = useRef(0);
  const [lyricGen, setLyricGen] = useState(0);
  // ── Resize tracking ──

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      containerHeightRef.current = h;
      setContainerHeight(h);
      setContainerWidth(containerRef.current.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(() => {
      shouldTransit.current = false;
      measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [lyricData]);

  // ── Data ──

  const allLines = useMemo(() => {
    return lyricData?.lines ?? [];
  }, [lyricData]);

  // Force remount on lyric data change to prevent position transition artifacts
  useEffect(() => { setLyricGen(g => g + 1); }, [lyricData]);

  const focusLine = scrollingMode ? scrollingFocusLine : currentLineIndex;

  // ── Recalculate item heights ──

  const recalcHeightOfItems = useCallback(() => {
    if (!allLines.length) return;
    for (let i = 0; i < allLines.length; i++) {
      heightOfItems.current[i] = estimateLyricLineHeight(allLines[i], settings);
    }
  }, [allLines, settings]);

  // Measure actual heights after render
  useEffect(() => {
    if (!allLines.length) return;
    const container = containerRef.current;
    if (!container) return;
    // Use requestAnimationFrame to measure after browser layout
    const raf = requestAnimationFrame(() => {
      const items = container.querySelectorAll('.lyric-line');
      const heights: number[] = [];
      items.forEach((item) => {
        const h = (item as HTMLElement).offsetHeight || 0;
        if (h > 0) heights.push(h);
      });
      if (heights.length > 0 && heights.length === allLines.length) {
        heightOfItems.current = heights;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [allLines, containerWidth, settings.fontSize, settings.showTranslation, settings.showRomaji, settings.romajiFontSize, settings.translationFontSize, currentLineIndex, scrollingMode]);

  // ── Line transforms ──

  const lineTransforms = useMemo(() => {
    // Use ref value as fallback when state hasn't caught up yet (fixes initial overlap)
    const effectiveContainerHeight = containerHeight || containerHeightRef.current || 400;
    if (!allLines.length) {
      return [] as Array<{ top: number; scale: number; delay: number; blur: number; opacity: number }>;
    }

    recalcHeightOfItems();

    const space = settings.fontSize * 1.2;

    const delayByOffset = (offset: number) => {
      if (scrollingMode) return 0;
      if (!settings.enableStagger) return 0;
      // Only stagger on manual jumps (>1 line), not during normal auto-advance
      const jump = Math.abs(focusLine - previousFocusedLineRef.current);
      if (jump <= 1) return 0;
      return Math.min(Math.abs(offset) * 80, 400);
    };

    const sByOffset = (offset: number) => {
      if (!settings.enableScale) return 1;
      return scaleByOffset(offset);
    };

    const bByOffset = (offset: number) => {
      if (!settings.enableBlur || scrollingMode) return 0;
      return blurByOffset(offset);
    };

    const oByOffset = (offset: number) => {
      return opacityByOffset(offset);
    };

    const t: Array<{ top: number; scale: number; delay: number; blur: number; opacity: number }> = [];
    for (let i = 0; i < allLines.length; i++) {
      t.push({ top: 0, scale: 1, delay: 0, blur: 0, opacity: 1 });
    }

    let current = Math.min(Math.max(focusLine ?? 0, 0), allLines.length - 1);
    if (current === -1) current = 0;

    if (scrollingMode) {
      current = Math.min(Math.max(scrollingFocusLine ?? 0, 0), allLines.length - 1);
    }

    // Position current line at alignment percentage
    t[current].top =
      effectiveContainerHeight * (settings.alignmentPercentage * 0.01) -
      heightOfItems.current[current] / 2;
    t[current].scale = 1;
    t[current].blur = bByOffset(0);
    t[current].opacity = oByOffset(0);
    t[current].delay = 0;

    const currentLineH = heightOfItems.current[current];

    // Temporary heighten interlude line
    if (allLines[current]?.isInterlude && !scrollingMode) {
      heightOfItems.current[current] = currentLineH + 50;
    }

    // Lines above current
    for (let i = current - 1; i >= 0; i--) {
      const offset = i - current;
      t[i].scale = sByOffset(offset);
      t[i].blur = bByOffset(offset);
      t[i].opacity = oByOffset(offset);
      const scaledH = heightOfItems.current[i] * t[i].scale;
      t[i].top = t[i + 1].top - scaledH - space;
      t[i].delay = delayByOffset(offset);
    }

    // Lines below current
    for (let i = current + 1; i < allLines.length; i++) {
      const offset = i - current;
      t[i].scale = sByOffset(offset);
      t[i].blur = bByOffset(offset);
      t[i].opacity = oByOffset(offset);
      const prevScaledH = heightOfItems.current[i - 1] * t[i - 1].scale;
      t[i].top = t[i - 1].top + prevScaledH + space;
      t[i].delay = delayByOffset(offset);
    }

    // Restore interlude height
    heightOfItems.current[current] = currentLineH;

    // Reset delay/duration if should not transit
    if (!shouldTransit.current && !scrollingMode) {
      for (let i = 0; i < allLines.length; i++) {
        t[i].delay = 0;
      }
    }

    shouldTransit.current = true;
    previousFocusedLineRef.current = focusLine;
    return t;
  }, [
    focusLine, containerHeight, containerWidth,
    settings.fontSize, settings.enableScale, settings.enableBlur,
    settings.showTranslation, settings.showRomaji,
    settings.romajiFontSize, settings.translationFontSize,
    settings.alignmentPercentage, settings.enableStagger,
    scrollingMode, scrollingFocusLine, allLines, recalcHeightOfItems,
    currentLineIndex,
  ]);

  // ── Scrolling mode via wheel ──

  const [isManual, setIsManual] = useState(false);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualLineRef = useRef(0);

  const enterManual = useCallback((lineIdx: number) => {
    setIsManual(true);
    manualLineRef.current = lineIdx;
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => setIsManual(false), 3000);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hw = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      let next = focusLine + dir;
      while (next >= 0 && next < allLines.length && allLines[next]?.isInterlude) next += dir;
      if (next >= 0 && next < allLines.length) enterManual(next);
    };
    el.addEventListener("wheel", hw, { passive: false });
    return () => el.removeEventListener("wheel", hw);
  }, [focusLine, allLines, enterManual]);

  useLayoutEffect(() => {
    return () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, []);

  // ── Virtualization ──

  const displayFocusLine = scrollingMode ? scrollingFocusLine : (isManual ? manualLineRef.current : focusLine);
  const shouldVirtualize = allLines.length > VIRTUALIZED_LYRIC_MIN_LINES;
  const virtualWindowExtra = scrollingMode ? VIRTUALIZED_LYRIC_SCROLLING_EXTRA : 0;
  const virtualStart = Math.max(0, displayFocusLine - VIRTUALIZED_LYRIC_WINDOW_BEFORE - virtualWindowExtra);
  const virtualEnd = Math.min(allLines.length - 1, displayFocusLine + VIRTUALIZED_LYRIC_WINDOW_AFTER + virtualWindowExtra);

  const shouldRenderLine = (index: number) => {
    if (!shouldVirtualize) return true;
    return index >= virtualStart && index <= virtualEnd;
  };

  // Animation timing CSS variable
  const timingMap: Record<string, string> = {
    smooth: "ease",
    sharp: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    easeout: "cubic-bezier(0, 0, 0.58, 1)",
    lazy: "cubic-bezier(0.45, 0, 0.75, 0.35)",
  };

  // Container class for centering/bold
  const containerClass =
    "lyric-display-container" +
    (scrollingMode ? " scrolling" : "") +
    (settings.fontBold ? " font-bold" : "");

  // ── Render: loading / error / empty states ──

  const cs: React.CSSProperties = {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 16px",
  };

  if (loading)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{loadingText || "加载中..."}</span>
      </div>
    );
  if (error)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{error}</span>
      </div>
    );
  if (!lyricData || !allLines.length)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{noLyricsText || "暂无歌词"}</span>
      </div>
    );
  if (!allLines.some((l) => (l.originalLyric || l.text || "").trim()))
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{instrumentalText || "纯音乐，请欣赏"}</span>
      </div>
    );

  // ── Main render ──

  return (
    <>
      {/* Global keyframe styles */}
      <style>{`
        @keyframes interlude-breath {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .lyric-display-container.scrolling .interlude-inner {
          opacity: 0 !important;
          transition: opacity .5s ease !important;
          transition-delay: 0s !important;
        }
        .interlude-inner {
          animation-name: interlude-breath;
          animation-duration: 2s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          transform-origin: left;
          opacity: 0;
          transition: opacity .5s ease;
        }
        .interlude-inner.pause-breath {
          animation-play-state: paused;
        }
        .lyric-interlude-line[data-offset="0"] .interlude-inner {
          transition-delay: .5s;
          opacity: 1;
        }
        .interlude-dot {
          display: inline-block;
          width: 0.7em;
          height: 0.7em;
          aspect-ratio: 1/1;
          border-radius: 50%;
          background-color: var(--text-primary);
        }
        .interlude-dot:not(:last-child) {
          margin-right: 0.5em;
        }
        .lyric-display-container.font-bold .lyric-line-original {
          font-weight: bold !important;
        }
        .lyric-line-original {
          margin-bottom: 0.3em;
        }
        .lyric-line-romaji {
          margin-bottom: 0.4em;
        }
      `}</style>

      <div
        key={lyricGen}
        ref={containerRef}
        className={containerClass}
        style={{
          height: "100%",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          contain: "layout style",
          ["--lyric-timing-function" as string]: timingMap[settings.animationTiming] || "ease",
        }}
      >
        {allLines.map((line, i) => {
          if (!shouldRenderLine(i)) {
            // Placeholder for virtualized lines
            const estH = heightOfItems.current[i] || estimateLyricLineHeight(line, settings);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  visibility: "hidden",
                  pointerEvents: "none",
                  height: estH,
                  top: 0,
                }}
              />
            );
          }

          const tf = lineTransforms[i];
          if (!tf) return null;

          const isCurrent = i === focusLine;
          const ds = tf.delay ? ` ${tf.delay}ms` : "";

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: tf.top,
                transform: `scale(${tf.scale})`,
                filter: tf.blur > 0.5 ? `blur(${tf.blur}px)` : "none",
                opacity: tf.opacity,
                transition: [
                  `top 0.5s var(--lyric-timing-function, ease)${ds}`,
                  `transform 0.5s var(--lyric-timing-function, ease)${ds}`,
                  `filter 0.5s var(--lyric-timing-function, ease)${ds}`,
                  `opacity 0.5s var(--lyric-timing-function, ease)${ds}`,
                ].join(", "),
                willChange: Math.abs(i - displayFocusLine) <= 3 ? "top, transform" : "auto",
                transformOrigin: "center",
                maxWidth: "calc(100% - 40px)",
              }}
            >
              <LyricsLine
                line={line}
                offset={i - focusLine}
                isCurrent={isCurrent}
                currentTime={currentTime}
                id={i}
                getCurrentTime={getCurrentTime}
                seekCounter={seekCounter}
                playState={playState}
                pageOpen={pageOpen}
                onClick={onLineClick}
                settings={settings}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}