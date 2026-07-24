/**
 * LyricDisplay — 歌词显示组件（重构版）
 *
 * 使用 position:absolute 布局替代 flex+spacer 方案。
 * 当前行居中，上下行按缩放公式层叠排布。
 * 动画由 CSS transition 驱动。
 *
 * Performance:
 * - Only sets willChange on ±3 surrounding lines (not all lines).
 * - Uses contain:layout style on container for independent compositing.
 * - Visibility window skips rendering lines far outside viewport.
 *
 * @module lyrics/LyricDisplay
 */

import { useRef, useMemo, useLayoutEffect, useState, useCallback, useEffect } from "react";
import type { LyricData, LyricLine } from "./types";
import type { LyricsSettingsValues } from "./LyricsSettingsPanel";
import { DEFAULT_LYRICS_SETTINGS } from "./LyricsSettingsPanel";
import LyricsLine, { estimateCharUnits } from "./LyricsLine";

const ROW_HEIGHT_BASE = 28;
const CURRENT_ROW_HEIGHT = 36;
/** Only render lines within this many positions of focus (rest are too far offscreen) */
const VISIBILITY_WINDOW = 12;

interface LyricDisplayProps {
  lyricData: LyricData | null;
  currentTime: number;
  currentLineIndex: number;
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  noLyricsText?: string;
  instrumentalText?: string;
  onLineClick?: (time: number) => void;
  /** 歌词设置 */
  settings?: LyricsSettingsValues;
}

export default function LyricDisplay({
  lyricData, currentTime, currentLineIndex, loading, error,
  loadingText, noLyricsText, instrumentalText,
  onLineClick,
  settings = DEFAULT_LYRICS_SETTINGS,
}: LyricDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isManual, setIsManual] = useState(false);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualLine = useRef(0);

  // ── 容器尺寸 ──
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lyricData]);

  // ── 当前行索引 ──
  const { currentIndex, allLines } = useMemo(() => {
    if (!lyricData?.lines?.length) {
      return { currentIndex: -1, allLines: [] as LyricLine[] };
    }
    const lines = lyricData.lines;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) idx = i;
      else break;
    }
    return { currentIndex: idx, allLines: lines };
  }, [lyricData, currentTime]);

  // ── 手动浏览 ──
  const enterManual = useCallback((lineIdx: number) => {
    setIsManual(true);
    manualLine.current = lineIdx;
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => {
      setIsManual(false);
    }, 3000);
  }, []);

  const focusLine = isManual ? manualLine.current : currentLineIndex;

  // ── 计算每行 top ──
  const linePositions = useMemo(() => {
    if (allLines.length === 0 || containerHeight === 0) return [] as number[];
    const positions: number[] = new Array(allLines.length).fill(0);
    const focus = Math.max(0, Math.min(focusLine, allLines.length - 1));

    // 当前行位置（受 alignment 设置影响）
    const alignMap = { center: 0.5, top: 0.3, bottom: 0.7 };
    const alignPct = alignMap[settings.alignment] ?? 0.5;
    const lineSpacing = settings.lineSpacing ?? 24;
    const gap = Math.max(12, Math.min(48, lineSpacing));

    // 当前行折行时，下方额外加 5px 间距
    const FONT_PX = { small: 13, medium: 15, large: 17 } as Record<string, number>;
    const currentFontPx = FONT_PX[settings.fontSize] ?? 15;
    const currentLineWraps =
      focus >= 0 && focus < allLines.length &&
      estimateCharUnits(allLines[focus].text) > 140 / currentFontPx;
    const centerY = containerHeight * alignPct;
    positions[focus] = centerY - CURRENT_ROW_HEIGHT / 2;

    // 向上层叠
    let prevTop = positions[focus];
    for (let i = focus - 1; i >= 0; i--) {
      const rowH = allLines[i].isInterlude ? ROW_HEIGHT_BASE * 0.6 : ROW_HEIGHT_BASE;
      const scale = 1 - (focus - i) * 0.18;
      const scaledH = rowH * Math.max(scale, 0.7);
      positions[i] = prevTop - scaledH - gap;
      prevTop = positions[i];
    }

    // 向下层叠
    let nextTop = positions[focus] + CURRENT_ROW_HEIGHT;
    for (let i = focus + 1; i < allLines.length; i++) {
      const rowH = allLines[i].isInterlude ? ROW_HEIGHT_BASE * 0.6 : ROW_HEIGHT_BASE;
      const scale = 1 - (i - focus) * 0.18;
      const scaledH = rowH * Math.max(scale, 0.7);
      positions[i] = nextTop + gap + (i === focus + 1 && currentLineWraps ? 15 : 0);
      nextTop = positions[i] + scaledH;
    }

    return positions;
  }, [allLines, focusLine, containerHeight, settings.alignment, settings.lineSpacing]);



  // ── cleanup ──
  useLayoutEffect(() => {
    return () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, []);

  // ── 滚轮事件（需 passive:false 才能 preventDefault）──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      let next = focusLine + dir;
      while (next >= 0 && next < allLines.length && allLines[next]?.isInterlude) {
        next += dir;
      }
      if (next >= 0 && next < allLines.length) {
        enterManual(next);
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [focusLine, allLines, enterManual]);

  // ── 空 / 加载状态 ──
  const cs = {
    height: "100%", display: "flex", alignItems: "center",
    justifyContent: "center", textAlign: "center", padding: "0 16px",
  } as React.CSSProperties;

  if (loading) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{loadingText || "加载中..."}</span></div>;
  }
  if (error) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{error}</span></div>;
  }
  if (!lyricData || !allLines.length) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{noLyricsText || "暂无歌词"}</span></div>;
  }
  if (!allLines.some(l => l.text.trim())) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{instrumentalText || "纯音乐，请欣赏"}</span></div>;
  }

  // ── 渲染 ──
  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        overflow: "hidden",
        position: "relative",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        // Independent compositing — prevents repaints from bubbling up
        contain: "layout style",
      }}
    >
      {allLines.map((line, i) => {
        // Visibility window: skip lines too far from focus (entirely offscreen)
        const dist = Math.abs(i - focusLine);
        if (dist > VISIBILITY_WINDOW) return null;

        const offset = i - focusLine;
        const isCurrent = i === focusLine;
        // Only hint GPU layer for lines that will actually animate (near focus)
        const nearFocus = dist <= 3;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: linePositions[i] ?? 0,
              transition: "top 0.5s var(--lyric-easing, ease)",
              willChange: nearFocus ? "top" : "auto",
            }}
          >
            <LyricsLine
              line={line}
              offset={offset}
              isCurrent={isCurrent}
              currentTime={currentTime}
              onClick={onLineClick}
              settings={settings}
            />
          </div>
        );
      })}
    </div>
  );
}
