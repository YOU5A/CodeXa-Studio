/**
 * LyricOverview — 歌词概览列表
 *
 * 当前行高亮、已过行变暗、间奏行标记；无同步歌词时提示。
 * 支持点击行跳转（onJump(line.time + 0.05)）、按住拖拽选择行、滚轮浏览。
 *
 * @module lyrics/LyricOverview
 */

import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "./types";

interface LyricOverviewProps {
  lines: LyricLine[];
  currentLineIndex: number;
  onJump?: (time: number) => void;
  noLyricsText?: string;
}

const ROW_HEIGHT = 24;

export default function LyricOverview({ lines, currentLineIndex, onJump, noLyricsText }: LyricOverviewProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const previewRef = useRef<number | null>(null);
  const [previewLine, setPreviewLine] = useState<number | null>(null);

  const setPreview = (idx: number | null) => {
    previewRef.current = idx;
    setPreviewLine(idx);
  };

  // 当前行自动滚动到可视区（拖拽浏览时不打扰）
  useEffect(() => {
    if (dragRef.current || !listRef.current) return;
    const el = listRef.current.children[currentLineIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [currentLineIndex]);

  // 松手提交跳转
  useEffect(() => {
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      const idx = previewRef.current;
      setPreview(null);
      if (idx != null && idx >= 0 && idx < lines.length) {
        onJump?.(lines[idx].time + 0.05);
      }
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [lines, onJump]);

  if (!lines.length) {
    return (
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: 190,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--text-tertiary)",
        }}
      >
        {noLyricsText || "暂无歌词"}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onWheelCapture={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        height: "100%",
        width: 190,
        overflowY: "auto",
        padding: "8px 4px 8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        background: "rgba(128,128,128,0.06)",
        borderLeft: "1px solid var(--border-color)",
        borderRadius: 10,
        zIndex: 2,
      }}
    >
      {lines.map((line, i) => {
        const isCurrent = i === currentLineIndex;
        const isPast = i < currentLineIndex;
        const isPreview = i === previewLine;
        const active = isCurrent || isPreview;

        return (
          <div
            key={i}
            onPointerDown={(e) => {
              e.preventDefault();
              dragRef.current = true;
              setPreview(i);
            }}
            onPointerEnter={() => { if (dragRef.current) setPreview(i); }}
            style={{
              height: ROW_HEIGHT,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
              borderRadius: 6,
              padding: "0 6px",
              color: line.isInterlude
                ? "var(--text-tertiary)"
                : isPast
                  ? "var(--text-tertiary)"
                  : "var(--text-secondary)",
              fontWeight: isCurrent ? 600 : 400,
              background: active ? "rgba(var(--accent-rgb), 0.14)" : "transparent",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {line.isInterlude ? "· · ·" : (line.text || "…")}
          </div>
        );
      })}
    </div>
  );
}
