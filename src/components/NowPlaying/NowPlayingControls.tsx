/**
 * NowPlayingControls — 播放控制条（RNP v3 / Apple Music 风格堆叠）
 *
 * 进度条 + 时间行（当前 / 剩余）→ 传输按钮行 → 音量行。
 * mousedown 拖拽逻辑与 PlayerBar 一致；播放模式循环 loop-all → shuffle → stop-after（仅三种）。
 * 播放键无白色底，仅保留 GlassGlow 鼠标跟随光晕。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, StopCircle, Volume1, Volume2, ListMusic } from "lucide-react";
import { GlassSeekBar, GlassGlow } from "@/design-system/components";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PlayMode } from "@/contexts/MusicPlayerContext";
import NowPlayingProgressPreview from "./NowPlayingProgressPreview";
import type { LyricData } from "@/lyrics";

interface NowPlayingControlsProps {
  position: number;
  duration: number;
  playing: boolean;
  volume: number;
  playMode: PlayMode;
  toggle: () => void;
  playPrev: () => void;
  playNext: () => void;
  onTogglePlaylist: () => void;
  setPlayMode: (mode: PlayMode) => void;
  seek: (clientX: number, progressRef: React.RefObject<HTMLDivElement | null>) => void;
  setVolume: (v: number) => void;
  fmtTime: (ms: number) => string;
  /** 进度条悬停预览数据（可为 null） */
  lyricData?: LyricData | null;
  /** 进度条悬停预览开关（设置面板控制） */
  previewEnabled?: boolean;
}

const MODE_ORDER: PlayMode[] = ["loop-all", "shuffle", "stop-after"];

export default function NowPlayingControls({
  position, duration, playing, volume, playMode,
  toggle, playPrev, playNext, setPlayMode, seek, setVolume, fmtTime,
  onTogglePlaylist,
  lyricData, previewEnabled,
}: NowPlayingControlsProps) {
  const { lang } = useLanguage();
  const T = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const posMs = Math.floor(position * 1000);
  const lengthMs = Math.floor((duration || 0) * 1000);
  const pct = lengthMs > 0 && isFinite(lengthMs) ? (posMs / lengthMs) * 100 : 0;
  // 显示用秒级整数：± 时间共用 floor(position) 边界，保证同步跳动且相加 = 总秒数
  const elapsedMs = Math.floor(position) * 1000;
  const remainingMs = Math.max(0, (Math.max(0, Math.floor(duration || 0)) - Math.floor(position)) * 1000);

  const doSeek = useCallback((clientX: number) => seek(clientX, progressRef), [seek]);
  const doSetVolume = useCallback((clientX: number) => {
    const el = volumeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = Math.round(((clientX - rect.left) / rect.width) * 100);
    setVolume(Math.max(0, Math.min(100, v)));
  }, [setVolume]);

  // 拖拽期间 window 级监听，与 PlayerBar 完全一致
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => doSeek(e.clientX);
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, doSeek]);

  useEffect(() => {
    if (!isDraggingVolume) return;
    const onMove = (e: MouseEvent) => doSetVolume(e.clientX);
    const onUp = () => setIsDraggingVolume(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingVolume, doSetVolume]);

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    doSeek(e.clientX);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    doSetVolume(e.clientX);
  };

  const modeIcon =
    playMode === "shuffle" ? <Shuffle size={18} /> :
    playMode === "stop-after" ? <StopCircle size={18} /> :
    <Repeat size={18} />;

  const cycleMode = () => {
    const idx = MODE_ORDER.indexOf(playMode);
    setPlayMode(MODE_ORDER[(idx + 1) % MODE_ORDER.length]);
  };

  const btnBase: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    minWidth: 40,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "color 0.2s ease, transform 0.15s ease",
  };

  return (
    <div className="np-controls" style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      {/* 进度条 */}
      <GlassSeekBar ref={progressRef} value={pct} size="lg" onMouseDown={handleProgressMouseDown} fillColor="rgb(var(--np-glow-rgb))" thumbColor="rgb(var(--np-glow-rgb))" />

      {/* 进度条悬停歌词预览 */}
      <NowPlayingProgressPreview
        enabled={!!previewEnabled}
        progressBarRef={progressRef}
        lyricData={lyricData ?? null}
        duration={duration}
      />

      {/* 时间行：当前 / 剩余 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -6 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {fmtTime(elapsedMs)}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          -{fmtTime(remainingMs)}
        </span>
      </div>

      {/* 传输按钮行 */}
      <div className="np-ctrl-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <button className="ctrl-btn np-ctrl-fade np-ctrl-cover" style={btnBase} onClick={cycleMode} aria-label={T("播放模式", "Playback mode")}>
          {modeIcon}
        </button>
        <button className="ctrl-btn np-ctrl-dim np-ctrl-cover" style={btnBase} onClick={playPrev} aria-label={T("上一首", "Previous")}>
          <SkipBack size={18} fill="currentColor" />
        </button>
        <GlassGlow
          glowColor="var(--np-play-glow)"
          glowRadius={140}
          borderRadius="50%"
          style={{ borderRadius: "50%" }}
        >
          <button
            className="ctrl-btn np-ctrl-dim np-play-core np-ctrl-cover"
            onClick={() => toggle()}
            aria-label={playing ? T("暂停", "Pause") : T("播放", "Play")}
            style={{
              ...btnBase,
              width: 54,
              height: 54,
              minWidth: 54,
            }}
          >
            {playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </button>
        </GlassGlow>
        <button className="ctrl-btn np-ctrl-dim np-ctrl-cover" style={btnBase} onClick={playNext} aria-label={T("下一首", "Next")}>
          <SkipForward size={18} fill="currentColor" />
        </button>
        <button className="ctrl-btn np-ctrl-fade np-ctrl-cover" style={btnBase} data-np-playlist-toggle onClick={onTogglePlaylist} aria-label={T("播放列表", "Playlist")}>
          <ListMusic size={18} />
        </button>
      </div>

      {/* 音量行：整体比进度条略短（水平收窄），高度与进度条一致（滑块 lg） */}
      <div className="np-ctrl-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "96%", alignSelf: "center" }}>
        <Volume1 size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
        <GlassSeekBar ref={volumeRef} value={volume} size="lg" onMouseDown={handleVolumeMouseDown} style={{ flex: 1 }} fillColor="rgb(var(--np-glow-rgb))" thumbColor="rgb(var(--np-glow-rgb))" />
        <Volume2 size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      </div>
    </div>
  );
}
