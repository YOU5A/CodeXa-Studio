/**
 * NowPlayingProgressPreview — 进度条悬停歌词预览（移植自 RNP progressbar-preview）
 *
 * 鼠标悬停在进度条上时，按悬停位置换算时间并定位对应歌词行，
 * 在进度条上方显示：行号、逐词词遮罩、原文、翻译、行内子进度条、起止时间。
 * 通过 portal 渲染到 document.body，pointer-events: none，不影响拖动 seek。
 *
 * 时间单位：本项目歌词行时间为秒，逐词时间为毫秒。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadLyricsSettings } from "@/lyrics";
import type { LyricData } from "@/lyrics";

interface NowPlayingProgressPreviewProps {
  /** 是否启用（设置面板“进度条悬停预览”开关） */
  enabled: boolean;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  lyricData: LyricData | null;
  /** 歌曲总时长（秒） */
  duration: number;
}

function formatTime(time: number) {
  const total = Math.max(0, Math.floor(time));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function NowPlayingProgressPreview({ enabled, progressBarRef, lyricData, duration }: NowPlayingProgressPreviewProps) {
  const [visible, setVisible] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [nonInterludeIndex, setNonInterludeIndex] = useState(0);
  const [hoveredTime, setHoveredTime] = useState(0);
  const [subProgress, setSubProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const xRef = useRef(0);
  const lyricDataRef = useRef(lyricData);
  const durationRef = useRef(duration);
  // 歌词全局偏移（与 LyricManager 同源，事件同步）：预览与播放行保持一致
  const globalOffsetRef = useRef(0);
  // 进度条拖拽中：指针移出进度条时预览保持跟随，松手后再按指针位置显隐
  const draggingRef = useRef(false);
  lyricDataRef.current = lyricData;
  durationRef.current = duration;

  // 歌词全局偏移变化同步（避免 pointermove 高频读 localStorage）
  useEffect(() => {
    const handler = () => { globalOffsetRef.current = loadLyricsSettings().globalOffset; };
    handler();
    window.addEventListener("lyricsSettingsChanged", handler);
    return () => window.removeEventListener("lyricsSettingsChanged", handler);
  }, []);

  const updateHover = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const totalLength = Math.max(0, durationRef.current || 0);
    // 与播放同步应用全局偏移（秒），保证悬停行与当前行一致
    const hovered = totalLength * percent + globalOffsetRef.current / 1000;
    setHoveredTime(hovered);

    const lines = lyricDataRef.current?.lines ?? [];
    if (!lines.length) return;

    let idx = 0;
    let currentNonInterlude = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= hovered) {
        idx = i;
        if (lines[i].originalLyric) currentNonInterlude += 1;
      } else {
        break;
      }
    }
    // 末行结束后（超出 500ms）视为无行
    if (idx === lines.length - 1 && lines[idx].duration && hovered > lines[idx].time + lines[idx].duration + 0.5) {
      idx = lines.length;
    }
    setLineIndex(idx);
    setNonInterludeIndex(currentNonInterlude);

    const line = lines[idx];
    if (!line) {
      setSubProgress(0);
      return;
    }
    let lineDuration = line.duration;
    if (!lineDuration) lineDuration = Math.max(0, totalLength - line.time);
    lineDuration = Math.max(lineDuration || 0, 1);
    setSubProgress(Math.max(0, Math.min(100, ((hovered - line.time) / lineDuration) * 100)));
  }, [progressBarRef]);

  // 更新预览位置：固定显示在进度条上方 6px，水平方向 clamp 在窗口内
  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    const bar = progressBarRef.current;
    if (!container || !bar) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const rect = bar.getBoundingClientRect();
    let left = xRef.current - width / 2;
    left = Math.max(0, Math.min(left, window.innerWidth - width));
    container.style.left = `${left}px`;
    container.style.top = `${rect.top - height - 6}px`;
  }, [visible, lineIndex, hoveredTime, nonInterludeIndex, subProgress, progressBarRef]);

  // 进度条事件挂接：拖拽 seek 期间（mousedown → mouseup）预览跟随 window 级鼠标移动
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar || !enabled) return;
    const onEnter = (e: PointerEvent) => {
      xRef.current = e.clientX;
      setVisible(true);
      updateHover(e.clientX);
    };
    const onMove = (e: PointerEvent) => {
      xRef.current = e.clientX;
      // 非拖拽时直接更新；拖拽中由 window mousemove 统一驱动
      if (!draggingRef.current) updateHover(e.clientX);
    };
    const onLeave = () => {
      // 拖拽 seek 期间保持预览跟随，松手后再按指针位置决定显隐
      if (!draggingRef.current) setVisible(false);
    };
    const onDown = () => { draggingRef.current = true; };
    const onWindowMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      xRef.current = e.clientX;
      updateHover(e.clientX);
    };
    const onUp = (e: MouseEvent) => {
      draggingRef.current = false;
      const el = progressBarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setVisible(false);
      } else {
        updateHover(e.clientX);
      }
    };
    bar.addEventListener("pointerenter", onEnter);
    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerleave", onLeave);
    bar.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      bar.removeEventListener("pointerenter", onEnter);
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerleave", onLeave);
      bar.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onWindowMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [progressBarRef, enabled, updateHover]);

  const lines = lyricData?.lines ?? [];
  const line = lines[lineIndex];
  const nonInterludeCount = lines.filter((l) => !!l.originalLyric).length;
  const isPureMusic = !!lyricData && (
    lines.length === 1 ||
    (lines.length <= 10 && lines.some((l) => /纯音乐|instrumental/i.test(l.originalLyric ?? ""))) ||
    !!lines[0]?.unsynced
  );
  const show = enabled && visible && !isPureMusic && lines.length > 0 && lineIndex < lines.length;

  return createPortal(
    <div
      ref={containerRef}
      className={`np-progressbar-preview${show ? "" : " invisible"}`}
      style={{ position: "fixed", zIndex: 1000, pointerEvents: "none" }}
    >
      {line && (line.originalLyric || line.text) && nonInterludeIndex > 0 ? (
        <div className="np-progressbar-preview-number">{nonInterludeIndex} / {nonInterludeCount}</div>
      ) : null}
      {line?.dynamicLyric?.length ? (
        <div className="np-progressbar-preview-karaoke">
          {line.dynamicLyric.map((w, i) => {
            const base = line.dynamicLyricTime ?? line.time * 1000;
            const wordTime = w.time ?? 0;
            // 与 LyricBlock 一致：YRC 通常存绝对时间，仅对小偏移补行基准
            const abs = wordTime >= base - 1000 ? wordTime : base + wordTime;
            const dur = Math.max(w.duration || 0, 1);
            const progress = (hoveredTime * 1000 - abs) / dur;
            const cls = progress >= 0 && progress <= 1 ? " current" : progress < 0 ? " upcoming" : "";
            return (
              <span
                key={i}
                className={`np-progressbar-preview-word${cls}`}
                style={{ WebkitMaskPosition: `${100 * (1 - Math.max(0, Math.min(1, progress)))}%` }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      ) : null}
      {line && !line.dynamicLyric?.length && (line.originalLyric || line.text) ? (
        <div className="np-progressbar-preview-original">{line.originalLyric || line.text}</div>
      ) : null}
      {line && line.originalLyric === "" ? <div className="np-progressbar-preview-original">-</div> : null}
      {line?.translatedLyric ? <div className="np-progressbar-preview-translated">{line.translatedLyric}</div> : null}
      {line ? (
        <>
          <div className="np-progressbar-preview-subbar">
            <div className="np-progressbar-preview-subbar-inner" style={{ width: `${subProgress}%` }} />
          </div>
          <div className="np-progressbar-preview-time">
            <span>{formatTime(line.time)}</span>
            <span>{line.duration > 0 ? formatTime(line.time + line.duration) : formatTime(duration)}</span>
          </div>
        </>
      ) : null}
    </div>,
    document.body
  );
}
