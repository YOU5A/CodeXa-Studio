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
import LyricBlock, { scaleByOffset, blurByOffset, opacityByOffset } from "./LyricBlock";

import { GlassGlow } from "@/design-system/components";
import { softenColorForGlow } from "@/utils/colorExtractor";

const VIRTUALIZED_LYRIC_MIN_LINES = 90;
const VIRTUALIZED_LYRIC_WINDOW_BEFORE = 24;
const VIRTUALIZED_LYRIC_WINDOW_AFTER = 30;
const VIRTUALIZED_LYRIC_SCROLLING_EXTRA = 12;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// ── Helpers ──

function estimateBlockHeight(line: LyricLine, options: LyricsSettingsValues): number {
  const fontSize = Math.max(1, Number(options.fontSize) || 20);
  if (!line || line.isInterlude || (!line.originalLyric && !line.dynamicLyric)) {
    return Math.ceil(fontSize * 1.2);
  }

  // Original lyric: fontSize * lineHeight + marginBottom (0.3em)
  let height = fontSize * 1.2 + fontSize * 0.3;

  const romajiSize = fontSize * (options.romajiFontSize || 0.6);
  const transSize = fontSize * (options.translationFontSize || 1.0);

  if (options.showRomaji && line.romanLyric) {
    height += romajiSize * 1.2 + romajiSize * 0.4;
  }
  if (options.showTranslation && line.translatedLyric) {
    height += transSize * 1.2 + transSize * 0.3;
  }

  return Math.ceil(height);
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

  // Opacity gate: keep lyrics hidden until both containerHeight & line heights are measured.
  // Prevents visible flash of wrong centering / collapsed heights on song switch.
  const [isVisible, setIsVisible] = useState(false);

  const heightOfItems = useRef<number[]>([]);
  const shouldTransit = useRef(true);
  const previousFocusedLineRef = useRef(0);
  const [lyricGen, setLyricGen] = useState(0);
  const [heightVersion, setHeightVersion] = useState(0);
  const [coverGlowColor, setCoverGlowColor] = useState<string | null>(null);
  const [coverGlowRgb, setCoverGlowRgb] = useState<string | null>(null);
  const [dynamicGlowRgb, setDynamicGlowRgb] = useState<string[] | null>(null);
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
      // Measure actual lyric block heights synchronously (before first paint).
      // This prevents the "collapsed" look caused by inaccurate height estimates.
      const items = containerRef.current.querySelectorAll("[data-lyric-index]");
      if (items.length > 0) {
        const n = allLines.length;
        const fresh = new Array(n) as number[];
        for (let i = 0; i < n; i++) {
          fresh[i] = heightOfItems.current[i] || estimateBlockHeight(allLines[i], settings);
        }
        items.forEach((el) => {
          const idx = Number((el as HTMLElement).dataset.lyricIndex);
          if (!isNaN(idx) && idx >= 0 && idx < n) {
            fresh[idx] = (el as HTMLElement).offsetHeight || fresh[idx];
          }
        });
        heightOfItems.current = fresh;
        setHeightVersion((v) => v + 1);
      }
      // Reveal once container height is known
      if (h > 0) setIsVisible(true);
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
  // useLayoutEffect ensures remount happens before paint (no flash of wrong positions)
  useLayoutEffect(() => { setLyricGen(g => g + 1); }, [lyricData]);

  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as CustomEvent).detail as [number, number, number] | null;
      if (color) {
        const softened = softenColorForGlow(color);
        setCoverGlowColor("rgb(" + softened[0] + "," + softened[1] + "," + softened[2] + ")");
        setCoverGlowRgb(softened[0] + "," + softened[1] + "," + softened[2]);
      } else {
        setCoverGlowColor(null);
        setCoverGlowRgb(null);
      }
      // 封面切换时清空旧动态色，确保 effectiveGlowRgb 立即回退到当前封面色
      setDynamicGlowRgb(null);
    };
    const cached = localStorage.getItem("fluidCoverColor");
    if (cached) {
      try {
        const c = JSON.parse(cached) as [number, number, number];
        const softened = softenColorForGlow(c);
        setCoverGlowColor("rgb(" + softened[0] + "," + softened[1] + "," + softened[2] + ")");
        setCoverGlowRgb(softened[0] + "," + softened[1] + "," + softened[2]);
      } catch {}
    }
    window.addEventListener("fluidCoverColorChanged", handler);
    return () => window.removeEventListener("fluidCoverColorChanged", handler);
  }, []);

  // Dynamic fluid color -> glow (top 3 blob colors)
  useEffect(() => {
    const handler = (e: Event) => {
      const colors = (e as CustomEvent).detail as [number, number, number][] | null;
      if (colors && colors.length > 0) {
        setDynamicGlowRgb(colors.map(c => {
          const s = softenColorForGlow(c);
          return s[0] + "," + s[1] + "," + s[2];
        }));
      } else {
        setDynamicGlowRgb(null);
      }
    };
    const cached = localStorage.getItem("fluidDynamicColor");
    if (cached) {
      try {
        const arr = JSON.parse(cached) as [number, number, number][];
        if (Array.isArray(arr) && arr.length > 0) {
          setDynamicGlowRgb(arr.map(c => {
            const s = softenColorForGlow(c);
            return s[0] + "," + s[1] + "," + s[2];
          }));
        }
      } catch {}
    }
    window.addEventListener("fluidDynamicColorChanged", handler);
    return () => window.removeEventListener("fluidDynamicColorChanged", handler);
  }, []);


  const focusLine = scrollingMode ? scrollingFocusLine : currentLineIndex;

  // ── Effective glow RGB based on fluid color mode ──
  const effectiveGlowRgb = useMemo(() => {
    let cm = null;
    try {
      const raw = localStorage.getItem("fluidSettings");
      if (raw) cm = JSON.parse(raw).colorMode;
    } catch {}
    if (cm === "cover" && coverGlowRgb) return coverGlowRgb;
    if ((cm === "dynamic" || cm === "auto") && dynamicGlowRgb && dynamicGlowRgb.length > 0) return dynamicGlowRgb[0];
    if (coverGlowRgb) return coverGlowRgb;
    return null;
  }, [coverGlowRgb, dynamicGlowRgb]);

  const effectiveGlowColor = effectiveGlowRgb ? "rgb(" + effectiveGlowRgb + ")" : null;

  // Adaptive GlassGlow color based on effective glow RGB (softened = whitened pastel)
  const glassGlowColor = effectiveGlowRgb
    ? "rgba(" + effectiveGlowRgb + ", 0.18)"
    : "rgba(255,255,255,0.15)";

  // Secondary / tertiary glow RGB (from dynamic multi-color sampling)
  const effectiveGlowRgb2 = dynamicGlowRgb && dynamicGlowRgb.length > 1 ? dynamicGlowRgb[1] : effectiveGlowRgb;
  const effectiveGlowRgb3 = dynamicGlowRgb && dynamicGlowRgb.length > 2 ? dynamicGlowRgb[2] : effectiveGlowRgb;

  // ── Recalculate item heights ──

  const recalcHeightOfItems = useCallback(() => {
    if (!allLines.length) return;
    for (let i = 0; i < allLines.length; i++) {
      heightOfItems.current[i] = estimateBlockHeight(allLines[i], settings);
    }
  }, [allLines, settings]);

  // Track previous height-affecting settings to detect changes
  const prevHeightSettingsRef = useRef({
    fontSize: settings.fontSize,
    showTranslation: settings.showTranslation,
    showRomaji: settings.showRomaji,
    romajiFontSize: settings.romajiFontSize,
    translationFontSize: settings.translationFontSize,
  });

  // Measure actual heights after render
  useEffect(() => {
    if (!allLines.length) return;
    const container = containerRef.current;
    if (!container) return;
    // Use requestAnimationFrame to measure after browser layout
    const raf = requestAnimationFrame(() => {
      const items = container.querySelectorAll('.lyric-block');
      const heights: number[] = [];
      items.forEach((item) => {
        const h = (item as HTMLElement).offsetHeight || 0;
        heights.push(h);
      });
      if (heights.length > 0 && heights.length === allLines.length) {
        heightOfItems.current = heights;
        setHeightVersion(v => v + 1);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [allLines, containerWidth, settings.fontSize, settings.showTranslation, settings.showRomaji, settings.romajiFontSize, settings.translationFontSize, currentLineIndex, scrollingMode]);

  // Reset height cache when lyric data changes (before key-based re-mount)
  // This ensures the interim render (before lyicGen kicks in) has correct estimates
  useLayoutEffect(() => {
    heightOfItems.current = [];
    setHeightVersion(0);
  }, [lyricData]);

  // ── Manual scroll state ──

  const [isManual, setIsManual] = useState(false);
  const [manualLine, setManualLine] = useState(0);
const manualBaseRef = useRef(0);
  const isManualRef = useRef(false);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Line transforms ──

  const lineTransforms = useMemo(() => {
    // Detect height-affecting settings changes and reset heights
    const heightSettingsChanged =
      settings.fontSize !== prevHeightSettingsRef.current.fontSize ||
      settings.showTranslation !== prevHeightSettingsRef.current.showTranslation ||
      settings.showRomaji !== prevHeightSettingsRef.current.showRomaji ||
      settings.romajiFontSize !== prevHeightSettingsRef.current.romajiFontSize ||
      settings.translationFontSize !== prevHeightSettingsRef.current.translationFontSize;

    if (heightSettingsChanged) {
      prevHeightSettingsRef.current = {
        fontSize: settings.fontSize,
        showTranslation: settings.showTranslation,
        showRomaji: settings.showRomaji,
        romajiFontSize: settings.romajiFontSize,
        translationFontSize: settings.translationFontSize,
      };
    }

    // Use ref value as fallback when state hasn't caught up yet (fixes initial overlap)
    const effectiveContainerHeight = containerHeight || containerHeightRef.current || 400;
    if (!allLines.length) {
      return [] as Array<{ top: number; scale: number; delay: number; blur: number; opacity: number }>;
    }

    // Re-estimate on first render, settings change, or line count change
    if (heightOfItems.current.length !== allLines.length || heightVersion === 0 || heightSettingsChanged) {
      recalcHeightOfItems();
    }

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
    } else if (isManual) {
      current = Math.min(Math.max(manualLine ?? 0, 0), allLines.length - 1);
    }

    // Position current line at alignment percentage (auto) or free-range (manual)
    const currentH = heightOfItems.current[current] || (settings.fontSize * 1.5);
    if (isManual) {
      // In manual mode, center on the scrolled-to line with full viewport range
      const rawCenter = effectiveContainerHeight * (settings.alignmentPercentage * 0.01);
      t[current].top = rawCenter - currentH / 2;
    } else {
      t[current].top =
        effectiveContainerHeight * (settings.alignmentPercentage * 0.01) -
        currentH / 2;
    }
    t[current].scale = 1;
    t[current].blur = bByOffset(0);
    t[current].opacity = oByOffset(0);
    t[current].delay = 0;

    const currentLineH = heightOfItems.current[current];

    // Temporary heighten interlude line
    if (allLines[current]?.isInterlude && !scrollingMode) {
      heightOfItems.current[current] = currentLineH + 8;
    }

    // Lines above current
    for (let i = current - 1; i >= 0; i--) {
      const offset = i - current;
      t[i].scale = sByOffset(offset);
      t[i].blur = bByOffset(offset);
      t[i].opacity = oByOffset(offset);
      const itemH = heightOfItems.current[i] || (settings.fontSize * 1.5);
      const scaledH = itemH * t[i].scale;
      t[i].top = t[i + 1].top - scaledH - space;
      t[i].delay = delayByOffset(offset);
    }

    // Lines below current
    for (let i = current + 1; i < allLines.length; i++) {
      const offset = i - current;
      t[i].scale = sByOffset(offset);
      t[i].blur = bByOffset(offset);
      t[i].opacity = oByOffset(offset);
      const prevItemH = heightOfItems.current[i - 1] || (settings.fontSize * 1.5);
      const prevScaledH = prevItemH * t[i - 1].scale;
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
    currentLineIndex, heightVersion, isManual, manualLine,
  ]);

  // ── Scrolling mode via wheel ──

  const enterManual = useCallback((lineIdx: number, baseIdx?: number) => {
    setManualLine(lineIdx);
    if (baseIdx !== undefined) manualBaseRef.current = baseIdx;
    isManualRef.current = true;
    setIsManual(true);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => {
      isManualRef.current = false;
      setIsManual(false);
      manualBaseRef.current = 0;
    }, 3000);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hw = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const base = isManualRef.current ? manualBaseRef.current : focusLine;
      let next = base + dir;
      while (next >= 0 && next < allLines.length && allLines[next]?.isInterlude) next += dir;
      if (next >= 0 && next < allLines.length) enterManual(next, next);
    };
    el.addEventListener("wheel", hw, { passive: false });
    return () => el.removeEventListener("wheel", hw);
  }, [focusLine, allLines, enterManual, isManual]);

  useLayoutEffect(() => {
    return () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, []);

  // ── Virtualization ──

  const displayFocusLine = scrollingMode ? scrollingFocusLine : (isManual ? manualLine : focusLine);
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
        @keyframes interlude-dot-breathe {
          0%   { transform: scale(0.9); opacity: 0.25; }
          50%  { transform: scale(1.08); opacity: 0.5; }
          100% { transform: scale(0.9); opacity: 0.25; }
        }
        .interlude-inner {
          opacity: 1;
        }
        .interlude-dot {
          display: inline-block;
          width: 0.7em;
          height: 0.7em;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
        }
        .interlude-dot:not(:last-child) {
          margin-right: 0.5em;
        }
        .lyric-block-romaji {
          margin-bottom: 0.4em;
        }
      `}</style>

      <div
        key={lyricGen}
        ref={containerRef}
        className={containerClass}
        style={{
          height: "100%",
          position: "relative",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s ease",
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          overflow: "hidden",
          contain: "layout style",
          ["--lyric-timing-function" as string]: timingMap[settings.animationTiming] || "ease",
          ["--lyric-glow" as string]: effectiveGlowColor || "var(--accent)",
          ["--lyric-glow-rgb" as string]: effectiveGlowRgb || "var(--accent-rgb)",
          ["--lyric-glow-rgb-2" as string]: effectiveGlowRgb2 || "var(--accent-rgb)",
          ["--lyric-glow-rgb-3" as string]: effectiveGlowRgb3 || "var(--accent-rgb)",
        }}
      >
        {allLines.map((line, i) => {
          if (!shouldRenderLine(i)) {
            // Placeholder for virtualized lines
            const estH = heightOfItems.current[i] || estimateBlockHeight(line, settings);
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

          const activeLine = isManual ? manualLine : focusLine;
          const isCurrent = i === activeLine;
          const ds = tf.delay ? ` ${tf.delay}ms` : "";

          return (
            <GlassGlow
              key={i}
              glowColor={glassGlowColor}
              glowRadius={350}
              borderRadius={4}
              style={{
                position: "absolute",
                top: tf.top,
                maxWidth: "calc(100% - 40px)",
                padding: "2px 8px 1px 8px",
                transform: `scale(${tf.scale})`,
                filter: tf.blur > 0.5 ? `blur(${tf.blur}px)` : "none",
                opacity: tf.opacity,
                transition: [
                  `top ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                  `transform ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                  `filter ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                  `opacity ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                ].join(", "),
                willChange: Math.abs(i - displayFocusLine) <= 3 ? "top, transform" : "auto",
                transformOrigin: "center",
              }}
            >
              <div
                data-lyric-index={i}
                style={{ margin: "-2px -8px -1px -8px" }}
              >
                <LyricBlock
                  line={line}
                  offset={i - (isManual ? manualLine : focusLine)}
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
            </GlassGlow>
          );
        })}
      </div>
    </>
  );
}
