import { motion } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, StopCircle,
  Volume2, Music, Settings,
} from "lucide-react";
import {
  GlassSurface, GlassButton, GlassTooltip,
  radii, space, fontSizes,
} from "@/design-system";
import { EASE_OUT } from "@/utils/animations";
import type { PlayMode } from "@/contexts/MusicPlayerContext";
import type { PlayerBarProps } from "./types";

export default function PlayerBar(props: PlayerBarProps) {
  const {
    playback, pct, volume, playMode,
    playingFile, metadata, coverB64,
    progressHover, isDragging, playBtnGlow, volumeHover, volGlow, isDraggingVolume,
    lyricsVisible, lyricsBtnHover,
    toggle, playPrev, playNext, setPlayMode,
    handleProgressMouseDown, handleVolumeMouseDown,
    setProgressHover, setPlayBtnGlow, setVolumeHover, setVolGlow,
    setLyricsVisible, setLyricsSettingsOpen, setLyricsBtnHover,
    progressRef, volumeRef, lyricsGearTimer,
    fmtTime, tx, lang,
  } = props;

  const modeTooltip =
    playMode === "sequential" ? tx.modeSequential :
    playMode === "loop-all" ? tx.modeLoopAll :
    playMode === "shuffle" ? tx.modeShuffle : tx.modeStopAfter;

  return (
    <GlassSurface
      tier="thick"
      style={{
        flexShrink: 0,
        padding: `${space[3]}px ${space[5]}px ${space[4]}px`,
        display: "flex",
        flexDirection: "column",
        gap: space[2],
      }}
    >
      {/* Progress Bar */}
      <div
        ref={progressRef}
        onMouseDown={handleProgressMouseDown}
        onMouseEnter={() => setProgressHover(true)}
        onMouseLeave={() => setProgressHover(false)}
        style={{
          width: "100%", height: progressHover || isDragging ? 6 : 4, borderRadius: radii.sm,
          background: "rgba(128,128,128,0.18)",
          cursor: "pointer", position: "relative",
          transition: "height 0.2s ease",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%", borderRadius: radii.sm,
          width: `${pct}%`,
          background: "var(--accent)",
          transition: isDragging ? "none" : "width 0.15s linear",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `${pct}%`,
          width: progressHover || isDragging ? 12 : 0, height: progressHover || isDragging ? 12 : 0,
          borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          transform: "translate(-50%, -50%)",
          transition: isDragging ? "none" : "width 0.15s ease, height 0.15s ease, left 0.15s linear",
          pointerEvents: "none",
        }} />
      </div>

      {/* Main Row */}
      <div style={{ display: "flex", alignItems: "center", gap: space[4] }}>
        {/* Left: Cover + Track Info */}
        <div style={{ display: "flex", alignItems: "center", gap: space[3], flex: 1, minWidth: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: radii.md,
            overflow: "hidden", flexShrink: 0,
            background: "rgba(128,128,128,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {coverB64 ? (
              <img src={`data:image/jpeg;base64,${coverB64}`} alt="cover"
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Music size={20} style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
            )}
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {(playback.is_playing || !playback.is_playing && !!playingFile)
                ? (metadata?.title || (playingFile ? playingFile.split("\\").pop() : tx.nowPlaying))
                : tx.noMusic}
            </span>
            <span style={{
              fontSize: fontSizes.xs, color: "var(--text-tertiary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {metadata?.artist || (lang === "zh" ? "\u672a\u77e5\u827a\u672f\u5bb6" : "Unknown Artist")}
            </span>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: space[4],
          flex: "0 0 auto",
        }}>
          {/* Lyrics Toggle + Settings Gear */}
          <span
            onMouseEnter={() => { if (lyricsGearTimer.current) { clearTimeout(lyricsGearTimer.current); lyricsGearTimer.current = null; } setLyricsBtnHover(true); }}
            onMouseLeave={() => { lyricsGearTimer.current = setTimeout(() => setLyricsBtnHover(false), 600); }}
            style={{ position: "relative", display: "inline-flex", alignItems: "center", height: 34, flexShrink: 0 }}
          >
            {/* Gear */}
            <span style={{
              position: "absolute",
              right: "calc(100% + 6px)",
              top: 0,
              display: "flex", alignItems: "center",
              height: 34,
              transform: lyricsBtnHover ? "translateX(0) scale(1)" : "translateX(8px) scale(0.5)",
              opacity: lyricsBtnHover ? 1 : 0,
              transition: "transform 0.2s ease, opacity 0.15s ease",
              pointerEvents: lyricsBtnHover ? "auto" : "none",
            }}>
              <GlassTooltip text={lang === "zh" ? "\u6b4c\u8bcd\u8bbe\u7f6e" : "Lyrics Settings"}>
              <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GlassButton
                variant="ghost"
                size="sm"
                noAnimation
                onClick={() => setLyricsSettingsOpen(true)}
                style={{
                  width: 34, height: 34, minWidth: 34, padding: 0,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-secondary)",
                  transition: "color 0.2s ease",
                }}
              >
                <Settings size={14} />
              </GlassButton>
              </span>
              </GlassTooltip>
            </span>

            {/* Lyrics Toggle */}
            <GlassTooltip text={tx.lyrics}>
            <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GlassButton
                variant="ghost"
                size="sm"
                noAnimation
                onClick={() => setLyricsVisible(v => !v)}
                style={{
                  width: 34, height: 34, minWidth: 34, padding: 0,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600,
                  color: lyricsVisible ? "var(--accent)" : "var(--text-secondary)",
                  transition: "color 0.2s ease",
                }}
              >
                {tx.lyrics}
              </GlassButton>
            </span>
            </GlassTooltip>
          </span>

          {/* Prev */}
          <GlassTooltip text={tx.prevTrack}>
          <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <button
              onClick={playPrev}
              className="ctrl-btn"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "50%",
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-tertiary)",
                transition: "color 0.2s ease, opacity 0.15s ease",
              }}
            >
              <SkipBack size={16} fill="currentColor" />
            </button>
          </span>
          </GlassTooltip>

          {/* Play/Pause */}
          <GlassTooltip text={playback.is_playing ? tx.pauseText : tx.playText}>
          <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              onClick={toggle}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setPlayBtnGlow({
                  x: (e.clientX - r.left) / r.width,
                  y: (e.clientY - r.top) / r.height,
                  visible: true,
                });
              }}
              onMouseLeave={() => setPlayBtnGlow({ x: 0.5, y: 0.5, visible: false })}
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "50%",
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-primary)",
                position: "relative", overflow: "hidden",
              }}
            >
              <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
                  background: `radial-gradient(circle at ${playBtnGlow.x * 100}% ${playBtnGlow.y * 100}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
                  opacity: playBtnGlow.visible ? 1 : 0,
                  transition: "opacity 0.25s ease",
                }} />
              {playback.is_playing
                ? <Pause size={14} fill="currentColor" style={{ position: "relative", zIndex: 1 }} />
                : <Play size={14} fill="currentColor" style={{ position: "relative", zIndex: 1, marginLeft: 2 }} />
              }
            </motion.button>
          </span>
          </GlassTooltip>

          {/* Next */}
          <GlassTooltip text={tx.nextTrack}>
          <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <button
              onClick={playNext}
              className="ctrl-btn"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "50%",
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-tertiary)",
                transition: "color 0.2s ease, opacity 0.15s ease",
              }}
            >
              <SkipForward size={16} fill="currentColor" />
            </button>
          </span>
          </GlassTooltip>

          {/* Mode toggle */}
          <GlassTooltip text={modeTooltip}>
          <span style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GlassButton
              variant="ghost"
              size="sm"
              noAnimation
              onClick={() => {
                const modes: PlayMode[] = ["loop-all", "shuffle", "stop-after"];
                const idx = modes.indexOf(playMode);
                setPlayMode(modes[(idx + 1) % modes.length]);
              }}
              style={{
                width: 34, height: 34, minWidth: 34, padding: 0,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)",
                transition: "color 0.2s ease",
              }}
            >
              {playMode === "shuffle" ? <Shuffle size={14} /> : playMode === "stop-after" ? <StopCircle size={14} /> : <Repeat size={14} />}
            </GlassButton>
          </span>
          </GlassTooltip>
        </div>

        {/* Right: Volume + Time */}
        <div style={{
          display: "flex", alignItems: "center", gap: space[3],
          flex: 1, justifyContent: "flex-end",
        }}>
          {/* Volume slider */}
          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            <Volume2 size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <div
              ref={volumeRef}
              onMouseDown={handleVolumeMouseDown}
              onMouseEnter={() => setVolumeHover(true)}
              onMouseLeave={() => setVolumeHover(false)}
              style={{
                width: 80, height: volumeHover || isDraggingVolume ? 6 : 4, borderRadius: radii.sm,
                background: "rgba(128,128,128,0.18)",
                cursor: "pointer", position: "relative",
                transition: "height 0.2s ease",
              }}
            >
              <div style={{
                position: "absolute", top: 0, left: 0, height: "100%", borderRadius: radii.sm,
                width: `${volume}%`,
                background: "var(--accent)",
                transition: isDraggingVolume ? "none" : "width 0.15s linear",
              }} />
              <div style={{
                position: "absolute", top: "50%", left: `${volume}%`,
                width: volumeHover || isDraggingVolume ? 12 : 0, height: volumeHover || isDraggingVolume ? 12 : 0,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                transform: "translate(-50%, -50%)",
                transition: isDraggingVolume ? "none" : "width 0.15s ease, height 0.15s ease, left 0.15s linear",
                pointerEvents: "none",
              }} />
            </div>
            <span style={{
              fontSize: 10, color: "var(--text-tertiary)",
              fontVariantNumeric: "tabular-nums", minWidth: 26, textAlign: "right",
            }}>
              {volume}%
            </span>
          </div>
          {/* Time */}
          <span style={{
            fontSize: fontSizes.xs, color: "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            minWidth: 80, textAlign: "right",
          }}>
            {fmtTime(playback.position_ms)} / {fmtTime(playback.length_ms)}
          </span>
        </div>
      </div>
    </GlassSurface>
  );
}
