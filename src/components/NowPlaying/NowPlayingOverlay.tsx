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
import { GlassButton, GlassTooltip } from "@/design-system";
import BottomNotice from "@/components/BottomNotice";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { useLyricManager, loadLyricsSettings, saveLyricsSettings } from "@/lyrics";
import { useLanguage } from "@/contexts/LanguageContext";
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
import NowPlayingLyricsCopyMode from "./NowPlayingLyricsCopyMode";
import { loadNowPlayingSettings, saveNowPlayingSettings } from "./NowPlayingSettings";
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

/** 全屏时歌词字号在用户设置基础上追加的增量 */
const FULLSCREEN_FONT_BOOST = 20;

export default function NowPlayingOverlay({ open, onClose }: NowPlayingOverlayProps) {
  const {
    audioState, playingFile, volume, playMode, playlist,
    toggle, seekTo, seek, setVolume, setPlayMode, playNext, playPrev, fmtTime,
    playFile,
  } = useMusicPlayer();
  const { lang } = useLanguage();
  const T = (zh: string, en: string) => (lang === "zh" ? zh : en);
  // 覆盖层内部独立实例；模块级 lyricCache 与 MusicManager 共享，不产生重复网络请求
  const { lyricData, loading: lyricsLoading, error: lyricsError, currentLineIndex, currentTime, getCurrentTime, seekCounter } = useLyricManager(open);
  const [trackMeta, setTrackMeta] = useState<TrackMeta | null>(null);
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
  const [lyricsSettings, setLyricsSettings] = useState<LyricsSettingsValues>(() => loadLyricsSettings());
  const [npSettings, setNpSettings] = useState<NowPlayingSettingsValues>(() => loadNowPlayingSettings());
  // 背景设置（类型/动态/暗化）与音乐页流体设置共享同一份存储
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => loadFluidSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const copyListRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsHover, setFsHover] = useState(false);
  const [fsBusy, setFsBusy] = useState(false); // 全屏窗口补间动画中：禁止连点
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
    // 有封面色/流体色时按实际颜色判断；无数据时仅 fluid 类型视为可能亮底，
    // blur/solid/gradient 无封面一律是深色底，保持白字
    if (source) return isLightColor(source);
    return fluidSettings.backgroundType === "fluid";
  }, [coverColor, fluidColor, resolvedTheme, fluidSettings.backgroundType]);

  // 亮色主题的流体背景需要更强暗化以维持歌词和控件对比度；设置值本身不变。
  const fluidDimMultiplier = resolvedTheme === "light" && fluidSettings.backgroundType === "fluid" ? 2 : 1;

  const closePlaylist = useCallback(() => setPlaylistOpen(false), []);
  const handleTogglePlaylist = useCallback(() => {
    setSettingsOpen(false);
    setPlaylistOpen(v => !v);
  }, []);

  // 右下角按钮可用性：按歌词数据（hasTranslation/hasRomaji/hasKaraoke）判断
  const hasTranslation = !!lyricData?.hasTranslation || !!lyricData?.lines.some((l) => !!l.translatedLyric);
  const hasRomaji = !!lyricData?.hasRomaji || !!lyricData?.lines.some((l) => !!l.romanLyric);
  const hasKaraoke = !!lyricData?.hasKaraoke || !!lyricData?.lines.some((l) => !!l.dynamicLyric && l.dynamicLyric.length > 0);

  // 更新 NowPlaying 专属歌词样式（与共享 lyricsSettings 隔离，不广播到悬浮歌词窗）
  const updateLyricStyles = (patch: Partial<NowPlayingSettingsValues["lyricStyles"]>) => {
    const next = { ...npSettings, lyricStyles: { ...npSettings.lyricStyles, ...patch } };
    setNpSettings(next);
    saveNowPlayingSettings(next);
  };
  const toggleTranslation = () => {
    updateLyricStyles({ showTranslation: !npSettings.lyricStyles.showTranslation });
  };
  const toggleRomaji = () => {
    updateLyricStyles({ showRomaji: !npSettings.lyricStyles.showRomaji });
  };
  const toggleKaraoke = () => {
    const next = { ...npSettings, useKaraokeLyrics: !npSettings.useKaraokeLyrics };
    setNpSettings(next);
    saveNowPlayingSettings(next);
  };
  const toggleCopyMode = () => setCopyMode((v) => !v);
  const selectAllLyrics = () => {
    const container = copyListRef.current;
    if (!container) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // 右下角快捷按钮状态样式：统一封面+白色柔和色（开启不透明、关闭半透明 1/2）；不可用为灰色且透明度与关闭一致
  const switchBtnStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 600,
    color: disabled ? "rgb(140, 144, 150)" : "var(--np-cover-text)",
    opacity: active ? 1 : 0.5,
    transition: "color 0.25s ease, opacity 0.25s ease",
  });

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

  // 焦点还原：打开时记录来源元素，关闭后恢复焦点，避免焦点遗留在卸载的覆盖层内
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus?.();
      prevFocusRef.current = null;
    }
  }, [open]);

  // 复制模式：关闭覆盖层时退出平铺模式并清空提示
  useEffect(() => {
    if (!open) {
      setCopyMode(false);
      setCopyNotice(false);
    }
  }, [open]);

  // 元数据 + 封面取色：仅在覆盖层打开且 playingFile 变化时刷新（含自动下一首）；
  // 关闭时不请求，避免常驻挂载重复调用桥
  useEffect(() => {
    let cancelled = false;
    if (!open || !playingFile) {
      setTrackMeta(null);
      setCoverColor(null);
      return;
    }
    const load = async () => {
      try {
        const m = await window.electronAPI?.bridge.call("music.get_metadata", { filepath: playingFile });
        if (cancelled) return;
        if (!m || typeof m !== "object") {
          // 桥返回异常数据：按文件名回退，不留旧曲目信息
          setTrackMeta({ title: "", artist: "", album: "", cover: null });
          setCoverColor(null);
          return;
        }
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
      } catch {
        // 桥调用失败（文件被删/桥重启等）：回退文件名显示，避免旧元数据错配
        if (cancelled) return;
        setTrackMeta({ title: "", artist: "", album: "", cover: null });
        setCoverColor(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, playingFile]);

  // 跟随歌词设置变化（来源/字号/翻译等）
  useEffect(() => {
    const handler = () => setLyricsSettings(loadLyricsSettings());
    window.addEventListener("lyricsSettingsChanged", handler);
    return () => window.removeEventListener("lyricsSettingsChanged", handler);
  }, []);

  // 复制模式：仅当复制内容来自歌词平铺列表时弹底部成功提示，
  // 避免复制设置等其他文本时误报
  useEffect(() => {
    if (!open || !copyMode) return;
    const handler = () => {
      const container = copyListRef.current;
      const sel = window.getSelection();
      if (!container || !sel || sel.rangeCount === 0) return;
      if (container.contains(sel.getRangeAt(0).commonAncestorContainer)) setCopyNotice(true);
    };
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [open, copyMode]);

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
    // 播放列表面板打开时同样暂停闲置隐藏，避免控制条淡出后面板无参照
    if (!open || !npSettings.idleHide || settingsOpen || playlistOpen) {
      setIdle(false);
      return;
    }
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      setIdle(false);
    };
  }, [open, npSettings.idleHide, settingsOpen, playlistOpen, resetIdleTimer]);

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
    // 圆角随窗口补间平滑过渡（约 260ms，与主进程全屏动画同步）
    transition: "border-radius 0.26s cubic-bezier(0.22, 0.61, 0.36, 1)",
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
          role="dialog"
          aria-modal="true"
          aria-label={T("正在播放", "Now Playing")}
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
        style={{ position: "absolute", inset: 0, zIndex: 0, background: bgLight ? "#ececf0" : "#12161f" }}
      >
        <NowPlayingBackground
          coverColor={coverColor}
          coverImageUrl={trackMeta?.cover ? `data:image/jpeg;base64,${trackMeta.cover}` : null}
          playing={audioState.playing}
          dim={fluidSettings.backgroundDim}
          dimMultiplier={fluidDimMultiplier}
          type={fluidSettings.backgroundType}
          dynamicFluid={fluidSettings.dynamicFluid}
          blurAmount={fluidSettings.blurAmount}
          targetFps={fluidSettings.fps}
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
          aria-label={T("设置", "Settings")}
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
            aria-label={T("关闭", "Close")}
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
            aria-label={fullscreen ? T("退出全屏", "Exit fullscreen") : T("全屏", "Fullscreen")}
            onClick={async () => {
              if (fsBusy) return;
              setFsBusy(true);
              try {
                // 主进程在补间开始即广播全屏状态事件（字号/圆角同步过渡），
                // 返回值在动画结束后到达，这里再同步一次保证与窗口实际状态一致
                const next = await window.electronAPI?.window.toggleFullscreen(!fullscreen);
                if (typeof next === "boolean") setFullscreen(next);
              } finally {
                setFsBusy(false);
              }
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
              pointerEvents: fsBusy ? "none" : (fsHover ? "auto" : "none"),
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
          <AnimatePresence mode="wait" initial={false}>
            {copyMode ? (
              <motion.div
                key="np-copy-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "tween", duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ height: "100%" }}
              >
                <NowPlayingLyricsCopyMode
                  ref={copyListRef}
                  lines={lyricData?.lines ?? []}
                  showRomaji={npSettings.lyricStyles.showRomaji}
                  showTranslation={npSettings.lyricStyles.showTranslation}
                />
              </motion.div>
            ) : (
              <motion.div
                key="np-normal-lyrics"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "tween", duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ height: "100%" }}
              >
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
                  npSettings={npSettings}
                  align={npSettings.lyricsAlign}
                  // 全屏时在当前字号基础上 +20px，退出全屏回到用户设置
                  fontSize={fullscreen ? npSettings.lyricsFontSize + FULLSCREEN_FONT_BOOST : npSettings.lyricsFontSize}
                  alignmentPercentage={fullscreen ? 50 : undefined}
                  glowBorderRadius={fullscreen ? 0 : "var(--radius)"}
                  useKaraokeLyrics={npSettings.useKaraokeLyrics}
                  karaokeAnimation={npSettings.karaokeAnimation}
                  lyricGlow={npSettings.lyricGlow}
                  scrollbar
                  onSeek={seekTo}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
        <GlassTooltip text={T("翻译", "Translation")} placement="left">
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-lyrics-switch-btn"
            aria-label={T("翻译", "Translation")}
            aria-pressed={npSettings.lyricStyles.showTranslation}
            disabled={!hasTranslation}
            onClick={toggleTranslation}
            style={switchBtnStyle(npSettings.lyricStyles.showTranslation, !hasTranslation)}
          >
            译
          </GlassButton>
        </GlassTooltip>
        <GlassTooltip text={T("音译", "Romaji")} placement="left">
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-lyrics-switch-btn"
            aria-label={T("音译", "Romaji")}
            aria-pressed={npSettings.lyricStyles.showRomaji}
            disabled={!hasRomaji}
            onClick={toggleRomaji}
            style={switchBtnStyle(npSettings.lyricStyles.showRomaji, !hasRomaji)}
          >
            音
          </GlassButton>
        </GlassTooltip>
        <GlassTooltip text={T("逐字", "Karaoke")} placement="left">
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-lyrics-switch-btn"
            aria-label={T("逐字", "Karaoke")}
            aria-pressed={npSettings.useKaraokeLyrics}
            disabled={!hasKaraoke}
            onClick={toggleKaraoke}
            style={switchBtnStyle(npSettings.useKaraokeLyrics, !hasKaraoke)}
          >
            逐字
          </GlassButton>
        </GlassTooltip>
        <AnimatePresence>
          {copyMode && (
            <motion.span
              key="np-select-all"
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.55 }}
              transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
              style={{ display: "inline-flex" }}
            >
              <GlassTooltip text={T("全选", "Select all")} placement="left">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  noAnimation
                  className="np-lyrics-switch-btn np-select-all-btn"
                  aria-label={T("全选", "Select all")}
                  onClick={selectAllLyrics}
                  style={switchBtnStyle(false)}
                >
                  全选
                </GlassButton>
              </GlassTooltip>
            </motion.span>
          )}
        </AnimatePresence>
        <GlassTooltip text={T("复制歌词", "Copy lyrics")} placement="left">
          <GlassButton
            variant="ghost"
            size="sm"
            noAnimation
            className="np-lyrics-switch-btn"
            aria-label={T("复制", "Copy")}
            aria-pressed={copyMode}
            disabled={!lyricData?.lines?.length}
            onClick={toggleCopyMode}
            style={switchBtnStyle(copyMode, !lyricData?.lines?.length)}
          >
            <Copy size={14} />
          </GlassButton>
        </GlassTooltip>
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

      {/* 复制成功底部提示（复制模式内 Ctrl+C 后弹出，自动消失） */}
      <BottomNotice
        show={copyNotice}
        tone="default"
        duration={2000}
        onDone={() => setCopyNotice(false)}
      >
        {T("已复制歌词", "Lyrics copied")}
      </BottomNotice>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
