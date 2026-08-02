/**
 * Scrollbar — 歌词右侧可拖拽滚动条
 *
 * 建立「所有行 ↔ 非间奏行」映射（参照 RNP preProcessMapping），
 * 缩略块高度 max(containerHeight / 总步数, 30)，拖动回调 onFocusLine(行索引)。
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

export default function Scrollbar({ lines, currentLineIndex, containerHeight, onFocusLine }: ScrollbarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

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
        cursor: "pointer",
        touchAction: "none",
        zIndex: 2,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        setDragging(true);
        trackRef.current?.setPointerCapture(e.pointerId);
        apply(e.clientY);
      }}
      onPointerMove={(e) => { if (draggingRef.current) apply(e.clientY); }}
      onPointerUp={() => { draggingRef.current = false; setDragging(false); }}
      onPointerCancel={() => { draggingRef.current = false; setDragging(false); }}
    >
      <div
        style={{
          position: "absolute",
          top: thumbTop,
          height: thumbHeight,
          width: dragging ? 6 : 4,
          borderRadius: 999,
          background: dragging ? "rgba(var(--accent-rgb), 0.9)" : "rgba(128,128,128,0.45)",
          transition: "width 0.15s ease, background 0.15s ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
