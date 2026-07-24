/**
 * LyricDisplay — 歌词显示组件（重构版）
 *
 * 使用 position:absolute 布局替代 flex+spacer 方案。
 * 当前行居中，上下行按缩放公式层叠排布。
 * 动画由 CSS transition 驱动。
 *
 * @module lyrics/LyricDisplay
 */

import { useRef, useMemo, useLayoutEffect, useState, useCallback } from "react";
import type { LyricData, LyricLine } from "./types";
import type { LyricsSettingsValues } from "./LyricsSettingsPanel";
import { DEFAULT_LYRICS_SETTINGS } from "./LyricsSettingsPanel";
import LyricsLine from "./LyricsLine";

const ROW_HEIGHT_BASE = 28;
const CURRENT_ROW_HEIGHT = 36;

interface LyricDisplayProps {
  lyricData: LyricData | null;
  currentTime: number;
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
  lyricData, currentTime, loading, error,
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
  }, []);

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

  const focusLine = isManual ? manualLine.current : currentIndex;

  // ── 计算每行 top ──
  const linePositions = useMemo(() => {
    if (allLines.length === 0 || containerHeight === 0) return [];
    const positions: number[] = new Array(allLines.length).fill(0);
    const focus = Math.max(0, Math.min(focusLine, allLines.length - 1));

    // 当前行位置（受 alignment 设置影响）
    const alignMap = { center: 0.5, top: 0.3, bottom: 0.7 };
    const alignPct = alignMap[settings.alignment] ?? 0.5;
    const lineSpacing = settings.lineSpacing ?? 24;
    const gap = Math.max(12, Math.min(48, lineSpacing));
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
      positions[i] = nextTop + gap;
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

  // ── CSS 变量：根据设置注入 easing ──
  const rootStyle = {
    "--lyric-easing": "ease",
  } as React.CSSProperties;

  // ── 空 / 加载状态 ──
  const cs = {
    height: "100%", display: "flex", alignItems: "center",
    justifyContent: "center", textAlign: "center", padding: "0 16px",
  } as React.CSSProperties;

  if (loading) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{loadingText || "\u52A0\u8F7D\u4E2D..."}</span></div>;
  }
  if (error) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{error}</span></div>;
  }
  if (!lyricData || !allLines.length) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{noLyricsText || "\u6682\u65E0\u6B4C\u8BCD"}</span></div>;
  }
  if (!allLines.some(l => l.text.trim())) {
    return <div style={cs}><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{instrumentalText || "\u7EAF\u97F3\u4E50\uFF0C\u8BF7\u6B23\u8D4F"}</span></div>;
  }

  // ── 渲染 ──
  return (
    <div
      ref={containerRef}
      onWheel={(e) => {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        let next = focusLine + dir;
        while (next >= 0 && next < allLines.length && allLines[next]?.isInterlude) {
          next += dir;
        }
        if (next >= 0 && next < allLines.length) {
          enterManual(next);
        }
      }}
      style={{
        ...rootStyle,
        height: "100%",
        overflow: "hidden",
        position: "relative",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      {allLines.map((line, i) => {
        const offset = i - focusLine;
        const isCurrent = i === focusLine;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: linePositions[i] ?? 0,
              transition: "top 0.5s var(--lyric-easing, ease)",
              willChange: "top",
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
