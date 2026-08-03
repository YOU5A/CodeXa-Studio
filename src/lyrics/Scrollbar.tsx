/**
 * Scrollbar — 歌词右侧可拖拽滚动条
 *
 * 建立「所有行 ↔ 非间奏行」映射（参照 RNP preProcessMapping），
 * 缩略块高度 max(containerHeight / 总步数, 30)，拖动回调 onFocusLine(行索引)。
 * 仅滑块可拖拽：轨道空白处点击/拖拽不响应，避免误操作当前歌词位置。
 *
 * @module lyrics/Scrollbar
 */

import { useMemo, useRef, useState } from "react";
import type { LyricLine } from "./types";

interface ScrollbarProps {
  lines: LyricLine[];
  currentLineIndex: number;
  containerHeight: number;
  onFocusLine: (lineIndex: number) => void;
}

/** 判定为“拖动”的最小位移（px）：小于该位移视为点击，不跳转 */
const DRAG_THRESHOLD = 4;

export default function Scrollbar({ lines, currentLineIndex, containerHeight, onFocusLine }: ScrollbarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // 非间奏行序列：拖拽目标只落在真实歌词行上
  const nonInterlude = useMemo(
    () => lines.map((line, i) => ({ line, i })).filter(({ line }) => !line.isInterlude).map(({ i }) => i),
    [lines]
  );
  const steps = nonInterlude.length;

  const thumbHeight = Math.min(containerHeight, Math.max(containerHeight / Math.max(steps, 1), 30));
  const maxTop = Math.max(0, containerHeight - thumbHeight);

  // 当前行在非间奏行序列中的步数（间奏行取最近的上一个非间奏行）
  const currentStep = useMemo(() => {
    let s = 0;
    for (let i = 0; i < nonInterlude.length; i++) {
      if (nonInterlude[i] <= currentLineIndex) s = i;
      else break;
    }
    return s;
  }, [nonInterlude, currentLineIndex]);

  const thumbTop = steps <= 1 ? 0 : (currentStep / (steps - 1)) * maxTop;

  const lineFromY = (clientY: number) => {
    const track = trackRef.current;
    if (!track || steps === 0) return 0;
    const rect = track.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const step = Math.round(frac * (steps - 1));
    return nonInterlude[Math.min(step, steps - 1)] ?? 0;
  };

  const apply = (clientY: number) => onFocusLine(lineFromY(clientY));

  // 高亮颜色复用 LyricDisplay 容器上的封面发光色（--lyric-glow-rgb）
  const coverRgb = "var(--lyric-glow-rgb, var(--accent-rgb))";

  return (
    <div
      ref={trackRef}
      className={`lyric-scrollbar${dragging ? " dragging" : ""}`}
      style={{
        position: "absolute",
        right: 6,
        top: 0,
        height: containerHeight || "100%",
        width: 14,
        display: "flex",
        justifyContent: "center",
        zIndex: 2,
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        ref={thumbRef}
        style={{
          position: "absolute",
          top: 0,
          transform: `translateY(${thumbTop}px)`,
          height: thumbHeight,
          width: dragging ? 10 : hovered ? 9 : 8,
          borderRadius: 999,
          background: dragging
            ? `rgba(${coverRgb}, 0.95)`
            : hovered
              ? `rgba(${coverRgb}, 0.7)`
              : "rgba(128,128,128,0.45)",
          boxShadow: dragging
            ? `0 0 14px rgba(${coverRgb}, 0.45), inset 0 0 0 1px rgba(255,255,255,0.22)`
            : hovered
              ? `0 0 10px rgba(${coverRgb}, 0.28)`
              : "0 1px 4px rgba(0,0,0,0.18)",
          transition: dragging
            ? "transform 0.08s linear, width 0.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.25s ease, box-shadow 0.25s ease"
            : "transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), width 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)",
          willChange: "transform",
          pointerEvents: "auto",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          draggingRef.current = true;
          dragStartYRef.current = e.clientY;
          dragMovedRef.current = false;
          setDragging(true);
          thumbRef.current?.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          if (!dragMovedRef.current && Math.abs(e.clientY - dragStartYRef.current) < DRAG_THRESHOLD) return;
          dragMovedRef.current = true;
          apply(e.clientY);
        }}
        onPointerUp={() => { draggingRef.current = false; setDragging(false); }}
        onPointerCancel={() => { draggingRef.current = false; setDragging(false); }}
      />
    </div>
  );
}
