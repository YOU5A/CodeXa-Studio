import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Search, Save, Image, X, Play, Pause, Settings,
  SkipBack, SkipForward, Repeat, Shuffle, StopCircle,
  Volume2, Trash2, Edit3, ChevronUp, Globe, Palette
} from "lucide-react";
import { GlassCard, GlassButton, GlassInput, GlassSurface, GlassBadge, GlassTooltip, GlassScrollArea } from "@/design-system/components";
import { space, fontSizes, radii } from "@/design-system/tokens";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import type { PlayMode } from "@/contexts/MusicPlayerContext";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { useLyricManager, LyricWindow, LyricDisplay, LyricsSettingsPanel, loadLyricsSettings, saveLyricsSettings, DEFAULT_LYRICS_SETTINGS } from "@/lyrics";
import type { LyricsSettingsValues } from "@/lyrics";
import type { MusicMetadata, Page } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";
import { extractDominantColorAsync, type RGB } from "@/utils/colorExtractor";
import FluidSettingsPanel, { DEFAULT_FLUID_SETTINGS, loadFluidSettings, saveFluidSettings, type FluidSettingsValues } from "@/components/FluidSettingsPanel";
import CoverSearchPanel from "@/components/CoverSearchPanel";
import CoverPreviewWindow from "@/components/CoverPreviewWindow";

import CoverManager from "./music/CoverManager";
import TagEditor from "./music/TagEditor";
import RenamePanel from "./music/RenamePanel";
import FileList from "./music/FileList";
import PlayerBar from "./music/PlayerBar";

const t = {
    zh: {
    title: "音乐管理器",
    browse: "浏览",
    scan: "扫描",
    formats: "支持: MP3, FLAC, OGG, M4A, WAV, OPUS",
    tagEditor: "标签编辑",
    title_: "标题",
    artist: "艺术家",
    album: "专辑",
    year: "年份",
    genre: "流派",
    saveTags: "保存标签",
    clearTags: "清除",
    applyAll: "应用到所有",
    coverOps: "封面操作",
    selectCover: "选择封面",
    applyCover: "应用到选中",
    saveCover: "保存封面",
    removeCover: "删除封面",
    searchCover: "搜索网络封面",
    renameSelected: "重命名选中",
    renameAll: "全部重命名",
    noFiles: "选择文件夹并扫描",
    noFileSelected: "请先选择文件",
    audioFiles: "音频文件",
    noAudioFiles: "选择文件夹并扫描",
    filesCount: "个文件",
    scanResult: "找到 {n} 个音频文件",
    tagsSaved: "标签已保存",
    coverApplied: "封面已应用",
    coverRemoved: "封面已删除",
    renameSuccess: "重命名成功",
    settings: "设置",
    visualFx: "背景特效",
    filterSongs: "搜索...",
    renameFailed: "重命名失败",
    nowPlaying: "正在播放",
    noMusic: "未选择曲目",
    lyrics: "词",
    lyricsTitle: "歌词",
    lyricsLoading: "加载中...",
    lyricsNoLyrics: "暂无歌词",
    lyricsInstrumental: "纯音乐，请欣赏",
    saveTagsConfirm: "确定要保存标签到所选文件吗？",
    clearTagsConfirm: "确认清除标签吗？",
    clearTagsConfirmDesc: "清除之后手动保存才能清除。",
    applyAllConfirm: "确定要将当前标签应用到所有文件吗？此操作不可撤销。",
    applyCoverConfirm: "确定要应用封面到所选文件吗？",
    removeCoverConfirm: "确定要删除所选文件的封面吗？",
    renameOneConfirm: "确定要重命名所选文件吗？",
    renameAllConfirm: "确定要按“标题 - 艺术家”格式重命名所有文件吗？",
    modeSequential: "顺序播放",
    modeLoopAll: "列表循环",
    modeShuffle: "随机播放",
    modeStopAfter: "播完停止",
    prevTrack: "上一首",
    nextTrack: "下一首",
    playText: "播放",
    pauseText: "暂停",
  },
en: {
    title: "Music Manager",
    browse: "Browse",
    scan: "Scan",
    formats: "Supports: MP3, FLAC, OGG, M4A, WAV, OPUS",
    tagEditor: "Tag Editor",
    title_: "Title",
    artist: "Artist",
    album: "Album",
    year: "Year",
    genre: "Genre",
    saveTags: "Save Tags",
    clearTags: "Clear",
    applyAll: "Apply to All",
    coverOps: "Cover",
    selectCover: "Select",
    applyCover: "Apply",
    saveCover: "Save",
    removeCover: "Remove",
    searchCover: "Search Cover",
    renameSelected: "Rename",
    renameAll: "Rename All",
    noFiles: "Select a folder and scan",
    noFileSelected: "Select a file first",
    audioFiles: "Audio Files",
    noAudioFiles: "Select a folder and scan",
    filesCount: "files",
    scanResult: "Found {n} audio files",
    tagsSaved: "Tags saved",
    coverApplied: "Cover applied",
    coverRemoved: "Cover removed",
    renameSuccess: "Renamed successfully",
    settings: "Settings",
    visualFx: "Visual FX",
    filterSongs: "Filter songs...",
    renameFailed: "Rename failed",
    nowPlaying: "Now Playing",
    noMusic: "No track selected",
    lyrics: "Lyrics",
    lyricsTitle: "Lyrics",
    lyricsLoading: "Loading...",
    lyricsNoLyrics: "No lyrics",
    lyricsInstrumental: "Instrumental",
    saveTagsConfirm: "Save tags to the selected file?",
    clearTagsConfirm: "Clear tag fields?",
    clearTagsConfirmDesc: "You need to save manually to clear tags from the file.",
    applyAllConfirm: "Apply current tags to all files? This cannot be undone.",
    applyCoverConfirm: "Apply cover artwork to the selected file?",
    removeCoverConfirm: "Remove cover artwork from the selected file?",
    renameOneConfirm: "Rename the selected file?",
    renameAllConfirm: "Rename all files using “Title - Artist” format?",
    modeSequential: "Sequential",
    modeLoopAll: "Loop All",
    modeShuffle: "Shuffle",
    modeStopAfter: "Stop After",
    prevTrack: "Previous",
    nextTrack: "Next",
    playText: "Play",
    pauseText: "Pause",
  },
};


// ?? Session-persistent state (survives page switching, resets on app restart) ??
let sessionState: {
  folder: string;
  files: string[];
  scanned: boolean;
  selectedFile: string;
  metadata: MusicMetadata | null;
  metadataFile: string;
  coverB64: string | null;
  tagTitle: string;
  tagArtist: string;
  tagAlbum: string;
  tagYear: string;
  tagGenre: string;
  renameName: string;
  coverColor: RGB | null;
} = {
  folder: "",
  files: [],
  scanned: false,
  selectedFile: "",
  metadata: null,
  metadataFile: "",
  coverB64: null,
  tagTitle: "",
  tagArtist: "",
  tagAlbum: "",
  tagYear: "",
  tagGenre: "",
  renameName: "",
  coverColor: null,
};

export default function MusicManager({ onNavigate, fluidSettings: externalSettings, onFluidSettingsChange, onOpenNowPlaying }: { onNavigate?: (page: Page) => void; fluidSettings?: FluidSettingsValues; onFluidSettingsChange?: (s: FluidSettingsValues) => void; onOpenNowPlaying: () => void }) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const { audioState, playingFile, volume, playMode, playlist, playFile: contextPlayFile, toggle: contextToggle, seek: contextSeek, seekTo, setVolume, setPlaylist, setPlayMode, playNext: contextPlayNext, playPrev: contextPlayPrev, stop: contextStop, releaseHandle, fmtTime, playingMeta, playingCover } = useMusicPlayer();

  // Whether the cached metadata/cover belongs to the cached selected file
  const restoredSelection = sessionState.metadataFile === sessionState.selectedFile;
  // 离开音乐页期间自动切歌：会话缓存可能属于旧曲目，初始化时直接以正在播放的曲目为准
  const playingDiffersFromCache = !!playingFile && playingFile !== sessionState.selectedFile;
  const [folder, setFolder] = useState(sessionState.folder);
  const [files, setFiles] = useState<string[]>(sessionState.files);
  const [selectedFile, setSelectedFile] = useState(playingDiffersFromCache ? playingFile : sessionState.selectedFile);
  const [metadata, setMetadata] = useState<MusicMetadata | null>(playingDiffersFromCache ? playingMeta : (restoredSelection ? sessionState.metadata : null));
  const [coverB64, setCoverB64] = useState<string | null>(playingDiffersFromCache ? playingCover : (restoredSelection ? sessionState.coverB64 : null));
  const [newCoverPath, setNewCoverPath] = useState("");
  const [coverPreviewB64, setCoverPreviewB64] = useState<string | null>(null);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const [coverRect, setCoverRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const [tagTitle, setTagTitle] = useState(playingDiffersFromCache ? (playingMeta?.title ?? "") : (restoredSelection ? sessionState.tagTitle : ""));
  const [tagArtist, setTagArtist] = useState(playingDiffersFromCache ? (playingMeta?.artist ?? "") : (restoredSelection ? sessionState.tagArtist : ""));
  const [tagAlbum, setTagAlbum] = useState(playingDiffersFromCache ? (playingMeta?.album ?? "") : (restoredSelection ? sessionState.tagAlbum : ""));
  const [tagYear, setTagYear] = useState(playingDiffersFromCache ? (playingMeta?.year ?? "") : (restoredSelection ? sessionState.tagYear : ""));
  const [tagGenre, setTagGenre] = useState(playingDiffersFromCache ? (playingMeta?.genre ?? "") : (restoredSelection ? sessionState.tagGenre : ""));
  const [renameName, setRenameName] = useState(playingDiffersFromCache ? ((playingFile.split("\\").pop() || playingFile).replace(/\.[^.]+$/, "")) : (restoredSelection ? sessionState.renameName : ""));
  const [saving, setSaving] = useState(false);
  const playingFileRef = useRef(playingFile);
  playingFileRef.current = playingFile; // sync every render, not async via useEffect
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensureFileWritable = (filepath: string) => {
    if (filepath && playingFile && filepath === playingFile) {
      releaseHandle();
      showToast(lang === "zh" ? "已停止播放以释放文件" : "Playback stopped to release file", "info");
    }
  };
  const progressRef = useRef<HTMLDivElement | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<() => void>(() => {});
  const hasScanned = useRef(sessionState.scanned);
  const scrollAnimRef = useRef<number | null>(null);
  const scrollGateRef = useRef({ time: 0, fp: "" });
  const loadSeqRef = useRef(0);
  const userScrolledRef = useRef(false);
  const scrollListenerRef = useRef<(() => void) | null>(null);

  // Sync state to session cache (survives page navigation)
  useEffect(() => { sessionState.folder = folder; }, [folder]);
  useEffect(() => { sessionState.files = files; }, [files]);
  useEffect(() => { sessionState.scanned = hasScanned.current; });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [progressHover, setProgressHover] = useState(false);
  const [playBtnGlow, setPlayBtnGlow] = useState({ x: 0.5, y: 0.5, visible: false });
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyricsSettingsOpen, setLyricsSettingsOpen] = useState(false);
  const [lyricsBtnHover, setLyricsBtnHover] = useState(false);
  const lyricsGearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { lyricData, loading: lyricsLoading, error: lyricsError, currentLineIndex, currentTime, getCurrentTime } = useLyricManager();
  const [volumeHover, setVolumeHover] = useState(false);
  const [volGlow, setVolGlow] = useState({ x: 0.5, y: 0.5, visible: false });
  const [fluidSettingsOpen, setFluidSettingsOpen] = useState(false);
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => externalSettings ?? loadFluidSettings());
  const [lyricsSettings, setLyricsSettings] = useState<LyricsSettingsValues>(() => loadLyricsSettings());

  // 与其他歌词设置实例（如 NowPlaying 覆盖层面板）同步：任何设置保存都会广播事件
  useEffect(() => {
    const handler = () => setLyricsSettings(loadLyricsSettings());
    window.addEventListener("lyricsSettingsChanged", handler);
    return () => window.removeEventListener("lyricsSettingsChanged", handler);
  }, []);

  // 与其他流体设置实例（如 NowPlaying 覆盖层面板）同步：任何设置保存都会广播事件
  useEffect(() => {
    const handler = () => setFluidSettings(loadFluidSettings());
    window.addEventListener("fluidSettingsChanged", handler);
    return () => window.removeEventListener("fluidSettingsChanged", handler);
  }, []);
  const [coverColor, setCoverColor] = useState<RGB | null>(sessionState.coverColor);

  // Sync UI state back to session cache (survives page navigation)
  useEffect(() => {
    sessionState.selectedFile = selectedFile;
    sessionState.metadata = metadata;
    sessionState.coverB64 = coverB64;
    sessionState.tagTitle = tagTitle;
    sessionState.tagArtist = tagArtist;
    sessionState.tagAlbum = tagAlbum;
    sessionState.tagYear = tagYear;
    sessionState.tagGenre = tagGenre;
    sessionState.renameName = renameName;
    sessionState.coverColor = coverColor;
  });
  useEffect(() => {
    saveFluidSettings(fluidSettings);
  }, [fluidSettings]);

  
  // Extract cover color and notify app
  useEffect(() => {
    let cancelled = false;
    if (coverB64) {
      const dataUrl = `data:image/jpeg;base64,${coverB64}`;
      extractDominantColorAsync(dataUrl).then((color) => {
        if (!cancelled) {
          setCoverColor(color);
          localStorage.setItem("fluidCoverColor", JSON.stringify(color));
          window.dispatchEvent(new CustomEvent("fluidCoverColorChanged", { detail: color }));
        }
      });
    } else {
      setCoverColor(null);
      localStorage.removeItem("fluidCoverColor");
      window.dispatchEvent(new CustomEvent("fluidCoverColorChanged", { detail: null }));
    }
    window.dispatchEvent(new CustomEvent("fluidCoverChanged", { detail: coverB64 }));
    return () => { cancelled = true; };
  }, [coverB64]);

  // On mount, clear any stale cover color from previous session
  useEffect(() => {
    if (!coverB64) {
      localStorage.removeItem("fluidCoverColor");
      window.dispatchEvent(new CustomEvent("fluidCoverColorChanged", { detail: null }));
    }
  }, []);

  // Mount: restore folder, volume, and playing file state
  useEffect(() => {
    const init = async () => {
      try {
        // If already scanned this session, restore from cache without re-scanning
        if (sessionState.scanned && sessionState.files.length > 0) {
          // Already have cached data, no need to re-scan
        } else {
          const saved = localStorage.getItem("music_folder");
          if (saved && !hasScanned.current) { hasScanned.current = true; setFolder(saved); doScan(saved); }
        }
      } catch {}
      // 离开音乐页期间自动切歌：会话缓存可能属于旧曲目，以正在播放的曲目为准刷新元数据并同步缓存
      if (playingFile && playingFile !== sessionState.selectedFile) {
        selectFile(playingFile);
      } else if (sessionState.selectedFile && sessionState.metadataFile !== sessionState.selectedFile) {
        selectFile(sessionState.selectedFile);
      }
      if (playingFile) {
        requestAnimationFrame(() => scrollToFile(playingFile));
      }
    };
    init();
  }, []);

  // Scroll selected file into center of list (logic refactored - see below)

  const scrollToFile = (fp: string) => {
    const now = performance.now();
    if (scrollGateRef.current.fp === fp && now - scrollGateRef.current.time < 80) return;
    scrollGateRef.current = { time: now, fp };

    if (!fp || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-filepath="${CSS.escape(fp)}"]`) as HTMLElement | null;
    if (!el || !listRef.current) return;
    const container = listRef.current;

    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    // Cleanup previous wheel listener
    if (scrollListenerRef.current) {
      scrollListenerRef.current();
      scrollListenerRef.current = null;
    }

    // Fix: account for container padding-top in offset calculation
    const cs = getComputedStyle(container);
    const padTop = parseFloat(cs.paddingTop) || 0;

    const visualTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const contentOffset = visualTop + container.scrollTop - padTop;
    const target = contentOffset - container.clientHeight / 2 + el.getBoundingClientRect().height / 2;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const clamped = Math.max(0, Math.min(Math.round(target), maxScroll));

    if (Math.abs(container.scrollTop - clamped) < 1) return;

    // Reset user scroll flag before animating
    userScrolledRef.current = false;

    // Listen for user scroll (wheel) during animation
    const onUserScroll = () => {
      userScrolledRef.current = true;
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
      if (scrollListenerRef.current) {
        scrollListenerRef.current();
        scrollListenerRef.current = null;
      }
    };
    container.addEventListener("wheel", onUserScroll, { passive: true });
    scrollListenerRef.current = () => container.removeEventListener("wheel", onUserScroll);

    // Smooth animation with easeOutCubic (faster initial response)
    const startScroll = container.scrollTop;
    const distance = clamped - startScroll;
    const duration = Math.min(350, Math.max(100, Math.abs(distance) * 0.35));
    const startTime = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now_: number) => {
      if (userScrolledRef.current) {
        scrollAnimRef.current = null;
        if (scrollListenerRef.current) { scrollListenerRef.current(); scrollListenerRef.current = null; }
        return;
      }
      const elapsed = now_ - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollTop = Math.round(startScroll + distance * easeOutCubic(progress));
      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(animate);
      } else {
        container.scrollTop = clamped;
        scrollAnimRef.current = null;
        if (scrollListenerRef.current) { scrollListenerRef.current(); scrollListenerRef.current = null; }
      }
    };

    scrollAnimRef.current = requestAnimationFrame(animate);
  };

  // ── File & UI Settings ──
  const { settings } = useTheme();
  const animationDuration = getAnimDuration(settings.animationSpeed);

  const browse = async () => {
    const p = await window.electronAPI?.dialog.openFolder();
    if (p) {
      setFolder(p);
      try { localStorage.setItem("music_folder", p); } catch {}
      doScan(p);
    }
  };
  const doScan = async (dir?: string) => {
    const d = dir || folder;
    if (!d) return;
    const r = await window.electronAPI?.bridge.call("music.scan", { folder: d });
    if (r && !r.error) {
      const newFiles = r.files ?? [];
      setFiles(newFiles);
      setPlaylist(newFiles);
      // Update session cache so re-entering doesn't re-scan
      sessionState.files = newFiles;
      sessionState.folder = d;
      sessionState.scanned = true;
      showToast(tx.scanResult.replace("{n}", String(r.count ?? 0)), "info");
    }
  };

  // -- Drag & Drop (document-level, capture phase for Electron compatibility) --
  const AUDIO_EXTENSIONS = [".mp3", ".flac", ".ogg", ".m4a", ".wav", ".opus", ".mp4a"];

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.files) return;
      const droppedFiles = Array.from(e.dataTransfer.files);
      const audioPaths: string[] = [];
      for (const f of droppedFiles) {
        const fp = (f as any).path;
        if (fp && AUDIO_EXTENSIONS.some(ext => fp.toLowerCase().endsWith(ext))) {
          audioPaths.push(fp);
        }
      }
      if (audioPaths.length === 0) return;
      const existing = new Set(files);
      const newPaths = audioPaths.filter(p => !existing.has(p));
      if (newPaths.length === 0) return;
      const updated = [...files, ...newPaths];
      setFiles(updated);
      setPlaylist(updated);
      if (!selectedFile && newPaths.length > 0) {
        selectFile(newPaths[0]);
      }
      showToast(tx.scanResult.replace("{n}", String(newPaths.length)), "info");
    };

    document.addEventListener("dragenter", onDragEnter, true);
    window.addEventListener("dragenter", onDragEnter, true);
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    return () => {
      document.removeEventListener("dragenter", onDragEnter, true);
      window.removeEventListener("dragenter", onDragEnter, true);
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", onDrop, true);
    };
  }, [files, selectedFile, tx]);



  const selectFile = async (fp: string, shouldScroll = false) => {
    const seq = ++loadSeqRef.current;
    setSelectedFile(fp);
    if (shouldScroll) scrollToFile(fp);
    const m = await window.electronAPI?.bridge.call("music.get_metadata", { filepath: fp });
    if (seq !== loadSeqRef.current) return;
    if (m && !m.error) {
      setMetadata(m);
      sessionState.metadataFile = fp;
      setTagTitle(m.title ?? ""); setTagArtist(m.artist ?? "");
      setTagAlbum(m.album ?? ""); setTagYear(m.year ?? ""); setTagGenre(m.genre ?? "");
    }
    setCoverB64(m?.cover ?? null);
    setNewCoverPath(""); setCoverPreviewB64(null);
    const fname = fp.split("\\").pop() || fp;
    setRenameName(fname.replace(/\.[^.]+$/, ""));
  };

  // File list click handler:
  // 正在播放音乐时单击：只把选择框移动过去，不读取音乐所有信息，3s后自动返回之前播放的音乐
  // 未播放音乐时单击：正常选中并加载信息
  const handleFileClick = (fp: string) => {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }

    if (playingFile) {
      setSelectedFile(fp);
      if (fp !== playingFile) {
        revertTimerRef.current = setTimeout(() => {
          const current = playingFileRef.current;
          if (current) {
            setSelectedFile(current);
          }
          revertTimerRef.current = null;
        }, 3000);
      }
    } else {
      selectFile(fp, false);
    }
  };

  // Cleanup revert timer on unmount
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

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
  }, [isDragging]);

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
  }, [isDraggingVolume]);

  // 上下切换音乐或自动切歌时：立即同步元数据和封面信息
  const prevPlayingFileRef = useRef(playingFile);
  useEffect(() => {
    const prev = prevPlayingFileRef.current;
    prevPlayingFileRef.current = playingFile;
    if (prev === playingFile) return;
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    if (playingFile) {
      selectFile(playingFile, false);
    }
  }, [playingFile]);

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 双击选择/播放：立即同步信息并播放
  const playFile = (fp: string) => {
    if (!fp) return;
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    selectFile(fp, false);
    contextPlayFile(fp);
  };

  const toggle = () => {
    if (!selectedFile && !playingFile) {
      showToast(tx.noFileSelected, "warning");
      return;
    }
    if (selectedFile && selectedFile !== playingFile) {
      playFile(selectedFile);
      return;
    }
    contextToggle(selectedFile);
  };

  toggleRef.current = toggle;

  // 上下切换音乐：清除定时器并切换
  const playPrev = () => {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    contextPlayPrev();
  };
  const playNext = () => {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    contextPlayNext();
  };

  const doSeek = (clientX: number) => { contextSeek(clientX, progressRef); };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    doSeek(e.clientX);
  };

  const doSetVolume = (clientX: number) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const v = Math.round(((clientX - rect.left) / rect.width) * 100);
    setVolume(Math.max(0, Math.min(100, v)));
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    doSetVolume(e.clientX);
  };

  const playback = {
    get position_ms() { return Math.floor(audioState.pos * 1000); },
    get length_ms() { return Math.floor((audioState.duration || 0) * 1000); },
    get is_playing() { return audioState.playing; },
    get is_paused() { return !audioState.playing && (audioState.pos > 0 || !!playingFile); },
    get is_open() { return !!playingFile; },
  };
  const pct = (playback.length_ms > 0 && isFinite(playback.length_ms)) ? (playback.position_ms / playback.length_ms) * 100 : 0;

  // ?? Tags ??
  const saveTags = async () => {
    if (!selectedFile) { showToast(tx.noFileSelected, "warning"); return; }
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.saveTagsConfirm });
    if (!ok) return;
    setSaving(true);
    const r = await window.electronAPI?.bridge.call("music.save_tags", {
      filepath: selectedFile, title: tagTitle, artist: tagArtist, album: tagAlbum, year: tagYear, genre: tagGenre,
    });
    setSaving(false);
    showToast(r?.success ? tx.tagsSaved : (r?.error ?? "Failed"), r?.success ? "success" : "error");
    if (r?.success) selectFile(selectedFile);
  };
  const applyAll = async () => {
    if (files.length === 0) return;
    const ok = await confirm({ title: tx.applyAllConfirm, danger: true });
    if (!ok) return;
    setSaving(true);
    let okCount = 0;
    let failCount = 0;
    let firstError = "";
    try {
      for (const fp of files) {
        ensureFileWritable(fp);
        try {
          const r = await window.electronAPI?.bridge.call("music.save_tags", {
            filepath: fp, title: tagTitle, artist: tagArtist, album: tagAlbum, year: tagYear, genre: tagGenre,
          });
          if (r?.success) okCount++;
          else {
            failCount++;
            if (!firstError) firstError = r?.error || "Failed";
          }
        } catch (e) {
          failCount++;
          if (!firstError) firstError = (e as Error)?.message || String(e);
        }
      }
    } finally {
      setSaving(false);
    }
    if (failCount === 0) showToast(tx.tagsSaved, "success");
    else showToast(lang === "zh" ? `成功 ${okCount} / 失败 ${failCount}：${firstError}` : `Succeeded ${okCount} / Failed ${failCount}: ${firstError}`, "error");
  };

  // Capture cover screen position when preview opens
  const updateCoverRect = useCallback(() => {
    if (coverRef.current) {
      const rect = coverRef.current.getBoundingClientRect();
      setCoverRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (coverPreviewB64) {
      updateCoverRect();
      const timer = setTimeout(updateCoverRect, 80);
      window.addEventListener("resize", updateCoverRect);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateCoverRect);
      };
    }
  }, [coverPreviewB64, updateCoverRect]);

  // ── Cover ──
  const pickCover = async () => {
    const p = await window.electronAPI?.dialog.openFile([{ name: "Images", extensions: ["jpg","jpeg","png","bmp","webp"] }]);
    if (p) {
      setNewCoverPath(p);
      const r = await window.electronAPI?.bridge.call("music.read_cover_file", { filepath: p });
      setCoverPreviewB64(r?.cover ?? null);
    }
  };
  const cancelCover = () => {
    setNewCoverPath("");
    setCoverPreviewB64(null);
  };
  const applyCover = async () => {
    if (!selectedFile || !newCoverPath) return;
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.applyCoverConfirm });
    if (!ok) return;
    const r = await window.electronAPI?.bridge.call("music.apply_cover", { filepath: selectedFile, cover_path: newCoverPath });
    showToast(r?.success ? tx.coverApplied : (r?.error ?? ""), r?.success ? "success" : "error");
    if (r?.success) selectFile(selectedFile);
  };
  const saveCover = () => {
    if (!coverB64) return;
    const byteCharacters = atob(coverB64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const removeCover = async () => {
    if (!selectedFile) return;
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.removeCoverConfirm, danger: true });
    if (!ok) return;
    const r = await window.electronAPI?.bridge.call("music.remove_cover", { filepath: selectedFile });
    showToast(r?.success ? tx.coverRemoved : (r?.error ?? ""), r?.success ? "success" : "error");
    if (r?.success) selectFile(selectedFile);
  };

  // Cover from URL (for CoverSearchPanel)
  const handleApplyCoverFromUrl = async (urlOrDataUrl: string) => {
    if (!selectedFile) throw new Error(lang === "zh" ? "请先选择文件" : "No file selected");
    ensureFileWritable(selectedFile);
    let coverPath = "";
    let coverBase64 = "";
    let mimeType = "image/jpeg";
    if (urlOrDataUrl.startsWith("data:")) {
      coverBase64 = urlOrDataUrl.split(",")[1];
      mimeType = urlOrDataUrl.includes("image/png") ? "image/png" : "image/jpeg";
    } else if (urlOrDataUrl.startsWith("http://") || urlOrDataUrl.startsWith("https://")) {
      throw new Error(lang === "zh" ? "无法应用封面：仅支持本地文件或 base64 数据" : "Cannot apply cover: local file or base64 data only");
    } else {
      coverPath = urlOrDataUrl;
      mimeType = urlOrDataUrl.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    }
    const r = await window.electronAPI?.bridge.call("music.apply_cover", {
      filepath: selectedFile, cover_path: coverPath, cover_base64: coverBase64, mime_type: mimeType,
    });
    if (!r?.success) throw new Error(r?.error || "Apply failed");
    selectFile(selectedFile);
  };

  const handleSaveCoverFromUrl = async (urlOrDataUrl: string) => {
    if (urlOrDataUrl.startsWith("data:")) {
      const base64 = urlOrDataUrl.split(",")[1];
      const ext = urlOrDataUrl.includes("image/png") ? "png" : "jpg";
      const savePath = await window.electronAPI?.dialog.saveFile({
        defaultPath: `cover.${ext}`,
        filters: [{ name: "Images", extensions: [ext] }],
      });
      if (!savePath) return;
      await window.electronAPI?.bridge.call("music.save_cover_file", {
        filepath: savePath, base64, ext,
      });
    } else {
      const savePath = await window.electronAPI?.dialog.saveFile({
        defaultPath: "cover.jpg",
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
      });
      if (!savePath) return;
      if (window.electronAPI?.music?.downloadCoverImage) {
        const dl = await window.electronAPI.music.downloadCoverImage(urlOrDataUrl);
        if (dl?.data) {
          const b64 = dl.data.split(",")[1];
          const ext = dl.data.includes("image/png") ? "png" : "jpg";
          await window.electronAPI?.bridge.call("music.save_cover_file", {
            filepath: savePath, base64: b64, ext,
          });
        }
      }
    }
  };

  // ?? Rename ??
  const renameOne = async () => {
    if (!selectedFile) { showToast(tx.noFileSelected, "warning"); return; }
    if (!renameName.trim()) { showToast(lang === "zh" ? "请输入文件名" : "Enter a file name", "warning"); return; }
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.renameOneConfirm });
    if (!ok) return;
    const r = await window.electronAPI?.bridge.call("music.rename", { filepath: selectedFile, new_name: renameName.trim() });
    if (!r?.success) { showToast(r?.error ?? tx.renameFailed, "error"); return; }
    const oldPath = selectedFile;
    const newPath = r.new_path || oldPath;
    setFiles(files.map(fp => fp === oldPath ? newPath : fp));
    setPlaylist(playlist.map(fp => fp === oldPath ? newPath : fp));
    if (oldPath === playingFile) contextStop();
    showToast(tx.renameSuccess, "success");
    selectFile(newPath);
    if (folder) doScan();
  };
  const renameAll = async () => {
    const ok = await confirm({ title: tx.renameAllConfirm });
    if (!ok) return;
    setSaving(true);
    let okCount = 0;
    let failCount = 0;
    let firstError = "";
    const pathMap: Record<string, string> = {};
    try {
      for (const fp of files) {
        ensureFileWritable(fp);
        try {
          const m = await window.electronAPI?.bridge.call("music.get_metadata", { filepath: fp });
          if (m?.error || !m.title) continue;
          const nn = (m.artist ?? "") ? `${m.title} - ${m.artist}` : m.title;
          const r = await window.electronAPI?.bridge.call("music.rename", { filepath: fp, new_name: nn });
          if (r?.success && r.new_path) {
            okCount++;
            pathMap[fp] = r.new_path;
          } else {
            failCount++;
            if (!firstError) firstError = r?.error || "Rename failed";
          }
        } catch (e) {
          failCount++;
          if (!firstError) firstError = (e as Error)?.message || String(e);
        }
      }
    } finally {
      setSaving(false);
    }
    if (okCount > 0) {
      setFiles(files.map(fp => pathMap[fp] ?? fp));
      setPlaylist(playlist.map(fp => pathMap[fp] ?? fp));
      if (playingFile && pathMap[playingFile]) contextStop();
    }
    if (failCount === 0) {
      showToast(lang === "zh" ? `已重命名 ${okCount} 个文件` : `Renamed ${okCount} files`, okCount > 0 ? "success" : "warning");
    } else {
      showToast(lang === "zh" ? `成功 ${okCount} / 失败 ${failCount}：${firstError}` : `Succeeded ${okCount} / Failed ${failCount}: ${firstError}`, "error");
    }
    if (folder) doScan();
  };

  // ?? Toolbar actions ??
  const clearTagFields = async () => {
    if (!tagTitle && !tagArtist && !tagAlbum && !tagYear && !tagGenre) return;
    const ok = await confirm({
      title: tx.clearTagsConfirm,
      description: tx.clearTagsConfirmDesc,
      danger: true,
    });
    if (!ok) return;
    setTagTitle(""); setTagArtist(""); setTagAlbum(""); setTagYear(""); setTagGenre("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: animationDuration, ease: EASE_OUT }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: space[4],
        height: "100%",
      }}
    >
      {/* Toolbar — NCM-style GlassSurface bar */}
      <GlassSurface
        tier="regular"
        style={{
          display: "flex",
          alignItems: "center",
          gap: space[2],
          padding: "10px 14px",
          borderRadius: radii.md,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: fontSizes.lg, fontWeight: 600, color: "var(--text-primary)", margin: 0, marginRight: space[1], whiteSpace: "nowrap" }}>
          {tx.title}
        </span>
        <GlassButton variant="ghost" size="sm" onClick={browse}>
          <FolderOpen size={14} />
          <span style={{ marginLeft: 4 }}>{tx.browse}</span>
        </GlassButton>
        <GlassInput
          value={folder}
          onChange={(e) => setFolder((e.target as HTMLInputElement).value)}
          placeholder={lang === "zh" ? "选择音乐文件夹..." : "Select music folder..."}
          style={{ flex: 1, minWidth: 120, fontSize: fontSizes.xs }}
        />
        <GlassButton variant="primary" size="sm" onClick={() => doScan()} disabled={!folder}>
          <Search size={14} />
          <span style={{ marginLeft: 4 }}>{tx.scan}</span>
        </GlassButton>
        <GlassTooltip text={lang === "zh" ? "流体与动态背景设置" : "Fluid & dynamic background settings"}>
          <span>
            <GlassButton variant="ghost" size="sm" onClick={() => setFluidSettingsOpen(true)}>
              <Palette size={14} />
              <span style={{ marginLeft: 4 }}>{tx.visualFx || tx.settings}</span>
            </GlassButton>
          </span>
        </GlassTooltip>
      </GlassSurface>

      {/* Main Content: Left Workbench (List) + Right Inspector (Cover, Tags, Rename) */}
      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(340px, 390px)",
        gap: space[4],
        alignItems: "stretch",
      }}>
        {/* Left Column: File List */}
        <div style={{ minWidth: 0, height: "100%", minHeight: 0 }}>
          <FileList
            files={files}
            selectedFile={selectedFile}
            playingFile={playingFile}
            onSelect={handleFileClick}
            onPlay={playFile}
            audioFilesLabel={tx.audioFiles}
            noFilesLabel={tx.noAudioFiles}
            filesCountLabel={tx.filesCount}
            listRef={listRef}
            searchPlaceholder={tx.filterSongs}
            locateTrackLabel={lang === "zh" ? "定位到当前曲目" : "Locate current track"}
          />
        </div>

        {/* Right Column: Inspector Panel */}
        <div style={{
          minWidth: 0,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}>
          <GlassCard style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: 0,
            minHeight: 0,
          }}>
            <GlassScrollArea
              scrollbarGutter={6}
              style={{
                flex: 1,
                minHeight: 0,
                padding: `${space[3]}px ${space[4]}px`,
                display: "flex",
                flexDirection: "column",
                gap: space[3],
              }}
            >
              <motion.div layout transition={{ duration: 0.25, ease: "easeOut" }} style={{ width: "100%" }}>
                <CoverManager
                  coverB64={coverB64}
                  coverPreviewB64={coverPreviewB64}
                  coverRef={coverRef}
                  setCoverSearchOpen={setCoverSearchOpen}
                  pickCover={pickCover}
                  applyCover={applyCover}
                  cancelCover={cancelCover}
                  saveCover={saveCover}
                  removeCover={removeCover}
                  newCoverPath={newCoverPath}
                  hasSelectedFile={!!selectedFile}
                  tx={tx}
                  lang={lang}
                />
              </motion.div>

              <motion.div layout transition={{ duration: 0.25, ease: "easeOut" }} style={{ width: "100%" }}>
                <TagEditor
                  tagTitle={tagTitle}
                  tagArtist={tagArtist}
                  tagAlbum={tagAlbum}
                  tagYear={tagYear}
                  tagGenre={tagGenre}
                  saving={saving}
                  selectedFile={selectedFile}
                  setTagTitle={setTagTitle}
                  setTagArtist={setTagArtist}
                  setTagAlbum={setTagAlbum}
                  setTagYear={setTagYear}
                  setTagGenre={setTagGenre}
                  saveTags={saveTags}
                  clearTagFields={clearTagFields}
                  applyAll={applyAll}
                  tx={tx}
                />
              </motion.div>

              <motion.div layout transition={{ duration: 0.25, ease: "easeOut" }} style={{ width: "100%" }}>
                <RenamePanel
                  renameName={renameName}
                  setRenameName={setRenameName}
                  renameOne={renameOne}
                  renameAll={renameAll}
                  tx={tx}
                  lang={lang}
                />
              </motion.div>
            </GlassScrollArea>
          </GlassCard>
        </div>
      </div>

      {/* Player Bar */}
          <PlayerBar
            playback={playback}
            pct={pct}
            volume={volume}
            playMode={playMode}
            playingFile={playingFile}
            metadata={metadata}
            coverB64={coverB64}
            onOpenNowPlaying={onOpenNowPlaying}
            progressHover={progressHover}
            isDragging={isDragging}
            playBtnGlow={playBtnGlow}
            volumeHover={volumeHover}
            volGlow={volGlow}
            isDraggingVolume={isDraggingVolume}
            lyricsVisible={lyricsVisible}
            lyricsBtnHover={lyricsBtnHover}
            toggle={toggle}
            playPrev={playPrev}
            playNext={playNext}
            setPlayMode={setPlayMode}
            handleProgressMouseDown={handleProgressMouseDown}
            handleVolumeMouseDown={handleVolumeMouseDown}
            setProgressHover={setProgressHover}
            setPlayBtnGlow={setPlayBtnGlow}
            setVolumeHover={setVolumeHover}
            setVolGlow={setVolGlow}
            setLyricsVisible={setLyricsVisible}
            setLyricsSettingsOpen={setLyricsSettingsOpen}
            setLyricsBtnHover={setLyricsBtnHover}
            progressRef={progressRef}
            volumeRef={volumeRef}
            lyricsGearTimer={lyricsGearTimer}
            fmtTime={fmtTime}
            tx={tx}
            lang={lang}
          />

          {/* Lyrics Window */}
          <LyricWindow open={lyricsVisible} onClose={() => setLyricsVisible(false)} defaultPosition={{ x: 84, y: 300 }}>
            <LyricDisplay
              lyricData={lyricData}
              currentTime={currentTime}
              currentLineIndex={currentLineIndex}
              loading={lyricsLoading}
              error={lyricsError}
              loadingText={tx.lyricsLoading}
              noLyricsText={tx.lyricsNoLyrics}
              instrumentalText={tx.lyricsInstrumental}
              onLineClick={seekTo}
              settings={lyricsSettings}
            />
          </LyricWindow>

          <CoverPreviewWindow
            open={coverPreviewB64 !== null}
            onClose={() => {
              setCoverPreviewB64(null);
              setNewCoverPath("");
            }}
            coverB64={coverPreviewB64 ?? ""}
            coverRect={coverRect}
          />

          <CoverSearchPanel
            open={coverSearchOpen}
            onClose={() => setCoverSearchOpen(false)}
            title={tagTitle || (selectedFile ? (selectedFile.split("\\").pop() || "").replace(/\.[^.]+$/, "") : "")}
            artist={tagArtist}
            album={tagAlbum}
            onApplyCover={handleApplyCoverFromUrl}
            onSaveCover={handleSaveCoverFromUrl}
          />

          <FluidSettingsPanel
            open={fluidSettingsOpen}
            onClose={() => setFluidSettingsOpen(false)}
            values={fluidSettings}
            onChange={setFluidSettings}
          />

          <LyricsSettingsPanel
            open={lyricsSettingsOpen}
            onClose={() => setLyricsSettingsOpen(false)}
            values={lyricsSettings}
            onChange={(v) => { setLyricsSettings(v); saveLyricsSettings(v); }}
          />
    </motion.div>
  );
}
