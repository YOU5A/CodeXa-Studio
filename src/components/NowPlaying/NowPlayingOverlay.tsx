/**
 * NowPlayingOverlay — 全窗口播放覆盖层
 *
 * createPortal(document.body) + fixed inset: 0，铺满整个应用窗口（含标题栏）。
 * 布局：左列（CD + 歌曲信息 + 控制条，与封面同宽、垂直居中）+ 右列歌词（满高居中），
 * 右上角设置面板（外观/歌词/关于），时钟左上角。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize, Minimize, Settings, X } from "lucide-react";
import { Copy } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassButton } from "@/design-system";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { useLyricManager, loadLyricsSettings, saveLyricsSettings } from "@/lyrics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import type { LyricsSettingsValues } from "@/lyrics";
import { extractDominantColorAsync, isLightColor, softenColorForGlow, type RGB } from "@/utils/colorExtractor";
import { useTheme } from "@/hooks/useTheme";
import NowPlayingBackground from "./NowPlayingBackground";
import NowPlayingDisc from "./NowPlayingDisc";
import NowPlayingInfo from "./NowPlayingInfo";
import NowPlayingControls from "./NowPlayingControls";
import NowPlayingSettingsWindow from "./NowPlayingSettingsWindow";
import NowPlayingPlaylist from "./NowPlayingPlaylist";
import NowPlayingLyrics from "./NowPlayingLyrics";
import { loadNowPlayingSettings, saveNowPlayingSettings } from "./NowPlayingSettings";
import { NOW_PLAYING_FULLSCREEN_FONT_SIZE } from "./NowPlayingSettings";
import { loadFluidSettings, type FluidSettingsValues } from "@/components/FluidSettingsPanel";
import type { NowPlayingSettingsValues } from "./NowPlayingSettings";
import "./NowPlaying.css";

interface NowPlayingOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface TrackMeta {
  title: string;
  artist: string;
  album: string;
  cover: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export default function NowPlayingOverlay({ open, onClose }: NowPlayingOverlayProps) {
  const {
    audioState, playingFile, volume, playMode, playlist,
    toggle, stop, seekTo, seek, setVolume, setPlayMode, playNext, playPrev, fmtTime,
    playFile,
  } = useMusicPlayer();
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const T = (zh: string, en: string) => (lang === "zh" ? zh : en);
  // 覆盖层内部独立实例；模块级 lyricCache 与 MusicManager 共享，不产生重复网络请求
  const { lyricData, loading: lyricsLoading, error: lyricsError, currentLineIndex, currentTime, getCurrentTime, seekCounter } = useLyricManager();
  const [trackMeta, setTrackMeta] = useState<TrackMeta | null>(null);
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
  const [lyricsSettings, setLyricsSettings] = useState<LyricsSettingsValues>(() => loadLyricsSettings());
  const [npSettings, setNpSettings] = useState<NowPlayingSettingsValues>(() => loadNowPlayingSettings());
  // 背景设置（类型/动态/暗化）与音乐页流体设置共享同一份存储
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => loadFluidSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsHover, setFsHover] = useState(false);
  const fullscreenBtnRef = useRef<HTMLButtonElement | null>(null);

  // 无封面时跟随流体动态主色（与 LyricDisplay 的 glow 同源），用于背景亮度判断
  const [fluidColor, setFluidColor] = useState<RGB | null>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("fluidDynamicColor") || "null") as RGB[] | null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch {
      return null;
    }
  });

  // 背景亮度：优先封面主色，其次流体动态色，最后按应用主题回退（light → 亮背景）
  const { resolvedTheme } = useTheme();
  const bgLight = useMemo(() => {
    // 仅亮色主题启用亮度自适应；暗色主题始终使用白色系文本
    if (resolvedTheme !== "light") return false;
    const source = coverColor ?? fluidColor;
    return source ? isLightColor(source) : true;
  }, [coverColor, fluidColor, resolvedTheme]);

  const closePlaylist = useCallback(() => setPlaylistOpen(false), []);
  const handleTogglePlaylist = useCallback(() => {
    setSettingsOpen(false);
    setPlaylistOpen(v => !v);
  }, []);

  // 右下角按钮可用性：按歌词数据（hasTranslation/hasRomaji/hasKaraoke）判断
  const hasTranslation = !!lyricData?.hasTranslation || !!lyricData?.lines.some((l) => !!l.translatedLyric);
  const hasRomaji = !!lyricData?.hasRomaji || !!lyricData?.lines.some((l) => !!l.romanLyric);
  const hasKaraoke = !!lyricData?.hasKaraoke || !!lyricData?.lines.some((l) => !!l.dynamicLyric && l.dynamicLyric.length > 0);

  const toggleTranslation = () => {
    const next = { ...lyricsSettings, showTranslation: !lyricsSettings.showTranslation };
    saveLyricsSettings(next);
    setLyricsSettings(next);
  };
  const toggleRomaji = () => {
    const next = { ...lyricsSettings, showRomaji: !lyricsSettings.showRomaji };
    saveLyricsSettings(next);
    setLyricsSettings(next);
  };
  const toggleKaraoke = () => {
    const next = { ...npSettings, useKaraokeLyrics: !npSettings.useKaraokeLyrics };
    setNpSettings(next);
    saveNowPlayingSettings(next);
  };
  const copyCurrentLine = async () => {
    const line = lyricData?.lines?.[currentLineIndex];
    if (!line || !(line.originalLyric || line.text)) return;
    const parts = [line.originalLyric || line.text];
    if (lyricsSettings.showRomaji && line.romanLyric) parts.push(line.romanLyric);
    if (lyricsSettings.showTranslation && line.translatedLyric) parts.push(line.translatedLyric);
    const text = parts.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast(T("已复制歌词", "Lyrics copied"), "success");
  };

  // ESC：设置面板打开时先关面板，再关覆盖层
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 全屏时 ESC 先退出全屏，不关闭覆盖层
      if (fullscreen) {
        window.electronAPI?.window.toggleFullscreen(false).then((v) => {
          if (typeof v === "boolean") setFullscreen(v);
        });
        return;
      }
      if (playlistOpen) setPlaylistOpen(false);
      else if (settingsOpen) setSettingsOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, settingsOpen, playlistOpen, fullscreen, onClose]);

  // 全屏状态跟随主窗口（全屏时去掉圆角，避免露出透明四角）
  useEffect(() => {
    const api = window.electronAPI?.window;
    if (!api?.onFullscreenChange) return;
    const handler = (v: boolean) => setFullscreen(v);
    const off = api.onFullscreenChange(handler);
    return () => off?.();
  }, []);

  // 进入/退出全屏时窗口在静止光标下缩放，不会触发 mouseleave，
  // 主动收起按钮显隐并清除 GlassButton 残留悬停光晕，避免样式卡住
  useEffect(() => {
    setFsHover(false);
    fullscreenBtnRef.current?.style.setProperty("--btn-go", "0");
  }, [fullscreen]);

  // 覆盖层关闭时若处于全屏，自动退出全屏，避免留下全屏空窗口
  useEffect(() => {
    if (!open && fullscreen) {
      window.electronAPI?.window.toggleFullscreen(false);
    }
  }, [open, fullscreen]);

  // 停止播放（playingFile 清空）自动关闭
  useEffect(() => {
    if (open && !playingFile) onClose();
  }, [open, playingFile, onClose]);

  // 覆盖层关闭时重置设置/列表面板状态
  useEffect(() => {
    if (!open) {
      setSettingsOpen(false);
      setPlaylistOpen(false);
    }
  }, [open]);

  // 元数据 + 封面取色：playingFile 变化时刷新（含自动下一首）
  useEffect(() => {
    let cancelled = false;
    if (!playingFile) {
      setTrackMeta(null);
      setCoverColor(null);
      return;
    }
    const load = async () => {
      const m = await window.electronAPI?.bridge.call("music.get_metadata", { filepath: playingFile });
      if (cancelled) return;
      const cover = m?.cover ?? null;
      setTrackMeta({
        title: m?.title ?? "",
        artist: m?.artist ?? "",
        album: m?.album ?? "",
        cover,
      });
      if (cover) {
        const color = await extractDominantColorAsync(`data:image/jpeg;base64,${cover}`);
        if (!cancelled) setCoverColor(color);
      } else {
        setCoverColor(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [playingFile]);

  // 跟随歌词设置变化（来源/字号/翻译等）
  useEffect(() => {
    const handler = () => setLyricsSettings(loadLyricsSettings());
    window.addEventListener("lyricsSettingsChanged", handler);
    return () => window.removeEventListener("lyricsSettingsChanged", handler);
  }, []);

  // 流体动态颜色变化时刷新亮度判断来源
  useEffect(() => {
    const handler = (e: Event) => {
      const colors = (e as CustomEvent).detail as RGB[] | null;
      setFluidColor(colors && colors.length > 0 ? colors[0] : null);
    };
    window.addEventListener("fluidDynamicColorChanged", handler);
    return () => window.removeEventListener("fluidDynamicColorChanged", handler);
  }, []);

  // 背景设置变化时同步（音乐页/NowPlaying 设置面板修改都会广播）
  useEffect(() => {
    const handler = () => setFluidSettings(loadFluidSettings());
    window.addEventListener("fluidSettingsChanged", handler);
    return () => window.removeEventListener("fluidSettingsChanged", handler);
  }, []);

  // ── 时钟（始终显示） ──
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(tick);
  }, [open]);

  // ── 闲置自动隐藏（由外观页开关控制；设置面板打开时暂停） ──
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(idle);
  idleRef.current = idle;

  const resetIdleTimer = useCallback(() => {
    if (idleRef.current) setIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), 1500);
  }, []);

  useEffect(() => {
    // 任何分支先清掉未决计时器，保证关闭开关/切页立即生效
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!open || !npSettings.idleHide || settingsOpen) {
      setIdle(false);
      return;
    }
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      setIdle(false);
    };
  }, [open, npSettings.idleHide, settingsOpen, resetIdleTimer]);

  // 覆盖层根节点声明 no-drag：避免标题栏 -webkit-app-region: drag 截获覆盖层内点击
  // borderRadius 对齐 #root 的窗口圆角（var(--radius)），避免四角露出黑色直角
  // 文字发光色（封面色柔化；无封面时回退主题强调色）：提升到根节点，
  // 供标题发光与进度条/音量条填充共用同一色源
  const glowRgb = coverColor ? softenColorForGlow(coverColor).join(", ") : null;
  // 原始封面色（文字混色用，避免柔化色二次漂白后看不出色相）
  const coverRgb = coverColor ? coverColor.join(", ") : null;

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    // zLayers.modal（50）之上，覆盖含标题栏（100）的整个窗口
    zIndex: 200,
    overflow: "hidden",
    borderRadius: fullscreen ? 0 : "var(--radius)",
    WebkitAppRegion: "no-drag",
    ["--np-glow-rgb" as string]: glowRgb || "var(--accent-rgb)",
    ["--np-cover-rgb" as string]: coverRgb || "var(--accent-rgb)",
  } as React.CSSProperties;

  // 防御：playingFile 应为字符串（历史崩溃：非字符串进入 getFileUrl）
  const safeFile = typeof playingFile === "string" ? playingFile : "";
  const displayMode = npSettings.displayMode;
  const fallbackTitle = safeFile ? (safeFile.split("\\").pop() || safeFile) : "";
  const title = trackMeta?.title || fallbackTitle || "未选择曲目";
  const artist = trackMeta?.artist || "未知艺术家";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`np-overlay${idle ? " np-idle" : ""}${bgLight ? " np-bg-light" : ""}`}
          onMouseMove={npSettings.idleHide ? resetIdleTimer : undefined}
          // 打开/关闭：纯位移从底部向上展开/向下收起（无透明度/缩放渐变）
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.38, ease: "easeOut" }}
          style={overlayStyle}
        >
      {/* 背景组：不透明底色 + NowPlaying 流体；展开时淡入，与主界面流体平滑过渡 */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: "tween", duration: 0.45, ease: "easeOut" }}
        style={{ position: "absolute", inset: 0, zIndex: 0, background: "#12161f" }}
      >
        <NowPlayingBackground
          coverColor={coverColor}
          coverImageUrl={trackMeta?.cover ? `data:image/jpeg;base64,${trackMeta.cover}` : null}
          playing={audioState.playing}
          dim={fluidSettings.backgroundDim}
          type={fluidSettings.backgroundType}
          dynamicFluid={fluidSettings.dynamicFluid}
        />
      </motion.div>

      {/* 窗口标题区域可拖动：位于按钮层之下，按钮显式 no-drag，点击不会被遮挡 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "var(--titlebar-height)",
          WebkitAppRegion: "drag",
          zIndex: 2,
        }}
      />

      {/* 面板打开时的全屏透明阻挡层：拦截点击，防止穿透到歌词/控制条等下层元素；
          层级在主内容（z1）之上、面板（z3/z5）之下；渲染在顶栏之前，右上角按钮仍可点击 */}
      <AnimatePresence>
        {(settingsOpen || playlistOpen) && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            onPointerDown={() => {
              if (settingsOpen) setSettingsOpen(false);
              if (playlistOpen) setPlaylistOpen(false);
            }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              // 轻微压暗窗口其他元素，突出面板（面板 zIndex 高于本层，不受影响）
              background: "rgba(0,0,0,0.12)",
            }}
          />
        )}
      </AnimatePresence>

      {/* 顶栏：左上角时钟 + 右上角设置/关闭（闲置时按钮淡出，时钟保留） */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, pointerEvents: "none" }}>
        <span
          style={{
            position: "absolute",
            left: 24,
            top: 18,
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.04em",
          }}
        >
          {clock}
        </span>
        <GlassButton
          variant="ghost"
          size="sm"
          noAnimation
          className="np-settings-btn"
          data-np-settings-toggle
          aria-label="设置"
          onClick={() => { setPlaylistOpen(false); setSettingsOpen(v => !v); }}
          style={{
            position: "absolute",
            right: 64,
            top: 16,
            width: 36,
            height: 36,
            minWidth: 36,
            padding: 0,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            pointerEvents: "auto",
            WebkitAppRegion: "no-drag",
          }}
        >
          <Settings size={18} />
        </GlassButton>
        {/* 右上角按钮列：关闭 + 全屏（全屏默认隐藏，鼠标靠近关闭按钮时显示） */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            width: 36,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            pointerEvents: "auto",
            WebkitAppRegion: "no-drag",
          }}
          onMouseEnter={() => setFsHover(true)}
          onMouseLeave={() => setFsHover(false)}
        >
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-close"
            aria-label="关闭"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              WebkitAppRegion: "no-drag",
            }}
          >
            <X size={18} />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-fullscreen-btn"
            ref={fullscreenBtnRef}
            aria-label={fullscreen ? "退出全屏" : "全屏"}
            onClick={async () => {
              // 直接按主进程返回值同步状态，避免 enter/leave-full-screen 事件在
              // Windows 无边框窗口上不触发导致按钮图标卡住
              const next = await window.electronAPI?.window.toggleFullscreen(!fullscreen);
              if (typeof next === "boolean") setFullscreen(next);
            }}
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              opacity: fsHover ? 1 : 0,
              pointerEvents: fsHover ? "auto" : "none",
              WebkitAppRegion: "no-drag",
              transition: "opacity 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </GlassButton>
        </div>
      </div>

      {/* 主布局：左列封面/信息/控制条（与封面同宽、垂直居中）+ 右列歌词（满高居中） */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "grid",
          display: "flex",
          justifyContent: "center",
          gap: displayMode === "all" ? "clamp(24px, 3vw, 48px)" : 0,
          transition: "gap 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)",
          padding: "clamp(48px, 6vh, 72px) clamp(24px, 4vw, 48px) clamp(32px, 5vh, 56px) clamp(48px, 6vw, 80px)",
          boxSizing: "border-box",
          alignItems: "stretch",
        }}
      >
        {/* 左列：CD + 歌曲信息 + 控制条（垂直居中） */}
        <div
          style={{
            display: "flex",
            width: displayMode === "lyric-only" ? 0 : displayMode === "song-info-only" ? "min(360px, 100%)" : "clamp(260px, 25vw, 600px)",
            opacity: displayMode === "lyric-only" ? 0 : 1,
            pointerEvents: displayMode === "lyric-only" ? "none" : "auto",
            // 仅歌词折叠态才裁剪；其余模式保持可见，避免裁剪封面弥散阴影
            overflow: displayMode === "lyric-only" ? "hidden" : "visible",
            transition: "width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            height: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            // 进度条贴近专辑信息后，整体下移填补底部留白
            paddingTop: "clamp(72px, 9vh, 108px)",
          }}
        >
          <NowPlayingDisc
            coverB64={trackMeta?.cover ?? null}
            coverColor={coverColor}
            playing={audioState.playing}
            rectangle={npSettings.rectangleCover}
            blurShadow={npSettings.coverBlurryShadow}
          />
          <div style={{ marginTop: "clamp(24px, 3.5vh, 44px)", width: "100%" }}>
            <NowPlayingInfo title={title} artist={artist} album={trackMeta?.album || ""} />
          </div>
          <AnimatePresence initial={false}>
            {!npSettings.hidePlayerControls && (
              <motion.div
                key="np-controls-area"
                style={{ marginTop: 14, width: "100%" }}
                initial={{ opacity: 0, height: 0, y: 8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: 8 }}
                transition={{ duration: 0.32, ease: "easeInOut" }}
              >
                <NowPlayingControls
                  position={audioState.pos}
                  duration={audioState.duration}
                  playing={audioState.playing}
                  volume={volume}
                  playMode={playMode}
                  toggle={toggle}
                  playPrev={playPrev}
                  playNext={playNext}
                  setPlayMode={setPlayMode}
                  seek={seek}
                  setVolume={setVolume}
                  fmtTime={fmtTime}
                  onTogglePlaylist={handleTogglePlaylist}
                  lyricData={lyricData}
                  previewEnabled={npSettings.enableProgressbarPreview}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右列：歌词（满高居中；内部水平内边距收窄歌词宽度，不改变整体布局） */}
        {/* 顶部/底部渐隐用 mask 只作用于歌词内容，不影响背景与其他元素 */}
        <div style={{ flex: displayMode === "song-info-only" ? "0 1 0%" : "1 1 0%", minWidth: 0, opacity: displayMode === "song-info-only" ? 0 : 1, pointerEvents: displayMode === "song-info-only" ? "none" : "auto", overflow: "hidden", position: "relative", height: "100%", padding: "0 clamp(20px, 2.5vw, 44px)", boxSizing: "border-box", maskImage: "linear-gradient(to bottom, transparent 0%, black 40px, black calc(100% - 40px), transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40px, black calc(100% - 40px), transparent 100%)", transition: "flex-grow 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)" }}>
          <NowPlayingLyrics
            lyricData={lyricData}
            currentTime={currentTime}
            currentLineIndex={currentLineIndex}
            getCurrentTime={getCurrentTime}
            seekCounter={seekCounter}
            playState={audioState.playing}
            pageOpen={open}
            loading={lyricsLoading}
            error={lyricsError}
            loadingText="加载歌词…"
            noLyricsText="暂无歌词"
            instrumentalText="纯音乐，请欣赏"
            onLineClick={seekTo}
            settings={lyricsSettings}
            align={npSettings.lyricsAlign}
            // 全屏字号固定 48px，普通状态使用用户设置字号
            fontSize={fullscreen ? NOW_PLAYING_FULLSCREEN_FONT_SIZE : npSettings.lyricsFontSize}
            alignmentPercentage={fullscreen ? 50 : undefined}
            glowBorderRadius={fullscreen ? 0 : "var(--radius)"}
            useKaraokeLyrics={npSettings.useKaraokeLyrics}
            karaokeAnimation={npSettings.karaokeAnimation}
            lyricGlow={npSettings.lyricGlow}
            scrollbar
            onSeek={seekTo}
          />
        </div>
      </div>

      {/* 右下角小按钮：翻译 / 音译 / 逐字 / 复制（闲置时淡出） */}
      <div
        className="np-lyrics-switch"
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          zIndex: 3,
          display: "flex",
          gap: 8,
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        <GlassButton
          variant="ghost"
          size="sm"
          noAnimation
          className={`np-lyrics-switch-btn${lyricsSettings.showTranslation ? " active" : ""}`}
          aria-label={T("翻译", "Translation")}
          title={T("翻译", "Translation")}
          disabled={!hasTranslation}
          onClick={toggleTranslation}
          style={{
            width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
          }}
        >
          译
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          noAnimation
          className={`np-lyrics-switch-btn${lyricsSettings.showRomaji ? " active" : ""}`}
          aria-label={T("音译", "Romaji")}
          title={T("音译", "Romaji")}
          disabled={!hasRomaji}
          onClick={toggleRomaji}
          style={{
            width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
          }}
        >
          音
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          noAnimation
          className={`np-lyrics-switch-btn${npSettings.useKaraokeLyrics ? " active" : ""}`}
          aria-label={T("逐字", "Karaoke")}
          title={T("逐字", "Karaoke")}
          disabled={!hasKaraoke}
          onClick={toggleKaraoke}
          style={{
            width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
          }}
        >
          逐字
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="sm"
          noAnimation
          className="np-lyrics-switch-btn"
          aria-label={T("复制", "Copy")}
          title={T("复制歌词", "Copy lyrics")}
          disabled={!lyricData?.lines?.length}
          onClick={copyCurrentLine}
          style={{
            width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)",
          }}
        >
          <Copy size={14} />
        </GlassButton>
      </div>
      {/* 设置面板 */}
      <NowPlayingSettingsWindow
        open={settingsOpen}
        fullscreen={fullscreen}
        onClose={() => setSettingsOpen(false)}
        settings={npSettings}
        onChange={(v) => {
          setNpSettings(v);
          saveNowPlayingSettings(v);
        }}
        lyricsSettings={lyricsSettings}
        onLyricsSettingsChange={(v) => {
          saveLyricsSettings(v);
          setLyricsSettings(v);
        }}
      />

      {/* 播放列表面板（右侧滑入抽屉） */}
      <NowPlayingPlaylist
        open={playlistOpen}
        onClose={closePlaylist}
        playlist={playlist}
        playingFile={safeFile}
        onPlay={playFile}
      />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
