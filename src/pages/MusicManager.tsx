import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Search, Save, Image, X, Play, Pause, Settings,
  SkipBack, SkipForward, Repeat, Shuffle, StopCircle,
  Volume2, Trash2, Music, Edit3, ChevronUp, Globe
} from "lucide-react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSurface,
  GlassEmptyState,
  GlassBadge,
  GlassTooltip,
  space,
  fontSizes,
  radii,
} from "@/design-system";
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
    scanResult: "找到 {n} 个音频文件",
    tagsSaved: "标签已保存",
    coverApplied: "封面已应用",
    coverRemoved: "封面已删除",
    renameSuccess: "重命名成功",
    settings: "设置",
    renameFailed: "重命名失败",
    nowPlaying: "正在播放",
    noMusic: "未选择曲目",
    lyrics: "词",
    lyricsTitle: "歌词",
    lyricsLoading: "加载中...",
    lyricsNoLyrics: "暂无歌词",
    lyricsInstrumental: "纯音乐，请欣赏",
    saveTagsConfirm: "确定要保存标签到所选文件吗？",
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
    scanResult: "Found {n} audio files",
    tagsSaved: "Tags saved",
    coverApplied: "Cover applied",
    coverRemoved: "Cover removed",
    renameSuccess: "Renamed successfully",
    settings: "Settings",
    renameFailed: "Rename failed",
    nowPlaying: "Now Playing",
    noMusic: "No track selected",
    lyrics: "Lyrics",
    lyricsTitle: "Lyrics",
    lyricsLoading: "Loading...",
    lyricsNoLyrics: "No lyrics",
    lyricsInstrumental: "Instrumental",
    saveTagsConfirm: "Save tags to the selected file?",
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

export default function MusicManager({ onNavigate, fluidSettings: externalSettings, onFluidSettingsChange }: { onNavigate?: (page: Page) => void; fluidSettings?: FluidSettingsValues; onFluidSettingsChange?: (s: FluidSettingsValues) => void }) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [metadata, setMetadata] = useState<MusicMetadata | null>(null);
  const [coverB64, setCoverB64] = useState<string | null>(null);
  const [newCoverPath, setNewCoverPath] = useState("");
  const [coverPreviewB64, setCoverPreviewB64] = useState<string | null>(null);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [coverMenuHover, setCoverMenuHover] = useState(false);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);

  const [tagTitle, setTagTitle] = useState("");
  const [tagArtist, setTagArtist] = useState("");
  const [tagAlbum, setTagAlbum] = useState("");
  const [tagYear, setTagYear] = useState("");
  const [tagGenre, setTagGenre] = useState("");
  const [renameName, setRenameName] = useState("");
  const { audioState, playingFile, volume, playMode, playlist, playFile: contextPlayFile, toggle: contextToggle, seek: contextSeek, seekTo, setVolume, setPlaylist, setPlayMode, playNext: contextPlayNext, playPrev: contextPlayPrev, stop: contextStop, releaseHandle, fmtTime } = useMusicPlayer();
  const [saving, setSaving] = useState(false);
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
  const hasScanned = useRef(false);
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
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
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
        const saved = localStorage.getItem("music_folder");
        if (saved && !hasScanned.current) { hasScanned.current = true; setFolder(saved); doScan(saved); }
      } catch {}
      if (playingFile) {
        setSelectedFile(playingFile);
        try {
          const m = await window.electronAPI?.python.call("music.get_metadata", { filepath: playingFile });
          if (m && !m.error) {
            setMetadata(m);
            setTagTitle(m.title ?? ""); setTagArtist(m.artist ?? "");
            setTagAlbum(m.album ?? ""); setTagYear(m.year ?? ""); setTagGenre(m.genre ?? "");
          }
          const c = await window.electronAPI?.python.call("music.extract_cover", { filepath: playingFile });
          setCoverB64(c?.cover ?? null);
        } catch {}
        setNewCoverPath(""); setCoverPreviewB64(null);
        const fname = playingFile.split("\\").pop() || playingFile;
        setRenameName(fname.replace(/\.[^.]+$/, ""));
      }
    };
    init();
  }, []);

  // Scroll selected file into center of list
  const scrollToFile = (fp: string) => {
    if (!fp || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-filepath="${CSS.escape(fp)}"]`) as HTMLElement | null;
    if (el && listRef.current) {
      const container = listRef.current;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const containerHeight = container.clientHeight;
      container.scrollTo({
        top: elTop - containerHeight / 2 + elHeight / 2,
        behavior: "smooth",
      });
    }
  };
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ?? File ??
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
    const r = await window.electronAPI?.python.call("music.scan", { folder: d });
    if (r && !r.error) {
      setFiles(r.files ?? []);
      setPlaylist(r.files ?? []);
      showToast(tx.scanResult.replace("{n}", String(r.count ?? 0)), "info");
    }
  };
  const selectFile = async (fp: string) => {
    setSelectedFile(fp);
    const m = await window.electronAPI?.python.call("music.get_metadata", { filepath: fp });
    if (m && !m.error) {
      setMetadata(m);
      setTagTitle(m.title ?? ""); setTagArtist(m.artist ?? "");
      setTagAlbum(m.album ?? ""); setTagYear(m.year ?? ""); setTagGenre(m.genre ?? "");
    }
    const c = await window.electronAPI?.python.call("music.extract_cover", { filepath: fp });
    setCoverB64(c?.cover ?? null);
    setNewCoverPath(""); setCoverPreviewB64(null);
    const fname = fp.split("\\").pop() || fp;
    setRenameName(fname.replace(/\.[^.]+$/, ""));
    scrollToFile(fp);
  };

  // File list click handler (with auto-revert timer)
  const handleFileClick = (fp: string) => {
    setSelectedFile(fp);
    if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
    if (fp !== playingFile && playingFile) {
      revertTimerRef.current = setTimeout(() => {
        setSelectedFile(playingFile);
        revertTimerRef.current = null;
      }, 1500);
    }
  };

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

  // Sync selectedFile and metadata when playingFile changes
  useEffect(() => {
    if (playingFile && playingFile !== selectedFile) {
      if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
      selectFile(playingFile);
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

  // Cleanup revert timer on unmount
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const playFile = (fp: string) => {
    if (!fp) return;
    setSelectedFile(fp);
    (async () => {
      const m = await window.electronAPI?.python.call("music.get_metadata", { filepath: fp });
      if (m && !m.error) {
        setMetadata(m);
        setTagTitle(m.title ?? ""); setTagArtist(m.artist ?? "");
        setTagAlbum(m.album ?? ""); setTagYear(m.year ?? ""); setTagGenre(m.genre ?? "");
      }
      const c = await window.electronAPI?.python.call("music.extract_cover", { filepath: fp });
      setCoverB64(c?.cover ?? null);
      setNewCoverPath(""); setCoverPreviewB64(null);
      const fname = fp.split("\\").pop() || fp;
      setRenameName(fname.replace(/\.[^.]+$/, ""));
    })();
    contextPlayFile(fp);
    if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
    scrollToFile(fp);
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

  const playPrev = () => { contextPlayPrev(); };
  const playNext = () => { contextPlayNext(); };

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
    const r = await window.electronAPI?.python.call("music.save_tags", {
      filepath: selectedFile, title: tagTitle, artist: tagArtist, album: tagAlbum, year: tagYear, genre: tagGenre,
    });
    setSaving(false);
    showToast(r?.success ? tx.tagsSaved : (r?.error ?? "Failed"), r?.success ? "success" : "error");
    if (r?.success) selectFile(selectedFile);
  };
  const applyAll = async () => {
    if (files.length === 0) return;
    ensureFileWritable(files[0] || selectedFile);
    const ok = await confirm({ title: tx.applyAllConfirm, danger: true });
    if (!ok) return;
    setSaving(true);
    for (const fp of files)
      await window.electronAPI?.python.call("music.save_tags", { filepath: fp, title: tagTitle, artist: tagArtist, album: tagAlbum, year: tagYear, genre: tagGenre });
    setSaving(false);
    showToast(tx.tagsSaved, "success");
  };

  // ?? Cover ??
  const pickCover = async () => {
    const p = await window.electronAPI?.dialog.openFile({ name: "Images", extensions: ["jpg","jpeg","png","bmp","webp"] });
    if (p) {
      setNewCoverPath(p);
      const r = await window.electronAPI?.python.call("music.read_cover_file", { filepath: p });
      setCoverPreviewB64(r?.cover ?? null);
    }
  };
  const applyCover = async () => {
    if (!selectedFile || !newCoverPath) return;
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.applyCoverConfirm });
    if (!ok) return;
    const r = await window.electronAPI?.python.call("music.apply_cover", { filepath: selectedFile, cover_path: newCoverPath });
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
    const r = await window.electronAPI?.python.call("music.remove_cover", { filepath: selectedFile });
    showToast(r?.success ? tx.coverRemoved : (r?.error ?? ""), r?.success ? "success" : "error");
    if (r?.success) selectFile(selectedFile);
  };

  // Cover from URL (for CoverSearchPanel)
  const handleApplyCoverFromUrl = async (urlOrDataUrl: string) => {
    if (!selectedFile) throw new Error(lang === "zh" ? "请先选择文件" : "No file selected");
    ensureFileWritable(selectedFile);
    let coverPath = urlOrDataUrl;
    if (urlOrDataUrl.startsWith("data:")) {
      const base64 = urlOrDataUrl.split(",")[1];
      const ext = urlOrDataUrl.includes("image/png") ? ".png" : ".jpg";
      const tmpDir = await window.electronAPI?.app.getPath("temp");
      coverPath = tmpDir + "\\codexa_cover_dl_" + Date.now() + ext;
      const r = await window.electronAPI?.python.call("music.save_cover_file", {
        filepath: coverPath, base64, ext,
      });
      if (r?.error) throw new Error(r.error);
    }
    const r = await window.electronAPI?.python.call("music.apply_cover", {
      filepath: selectedFile, cover_path: coverPath,
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
      await window.electronAPI?.python.call("music.save_cover_file", {
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
          await window.electronAPI?.python.call("music.save_cover_file", {
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
    const r = await window.electronAPI?.python.call("music.rename", { filepath: selectedFile, new_name: renameName.trim() });
    if (r?.success) { showToast(tx.renameSuccess, "success"); setSelectedFile(r.new_path); doScan(); }
    else showToast(r?.error ?? tx.renameFailed, "error");
  };
  const renameAll = async () => {
    ensureFileWritable(selectedFile);
    const ok = await confirm({ title: tx.renameAllConfirm });
    if (!ok) return;
    let c = 0;
    for (const fp of files) {
      try {
        const m = await window.electronAPI?.python.call("music.get_metadata", { filepath: fp });
        if (!m?.error && m.title) {
          const nn = (m.artist ?? "") ? `${m.title} - ${m.artist}` : m.title;
          if ((await window.electronAPI?.python.call("music.rename", { filepath: fp, new_name: nn }))?.success) c++;
        }
      } catch {}
    }
    showToast(lang === "zh" ? `???? ${c} ???` : `Renamed ${c} files`, c > 0 ? "success" : "warning");
    doScan();
  };

  // ?? Toolbar actions ??
  const clearTagFields = () => {
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
      {/* Title + Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexShrink: 0 }}>
        <h1 style={{ fontSize: fontSizes["2xl"], fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {tx.title}
        </h1>
        <GlassBadge variant="accent" size="sm">{files.length} {lang === "zh" ? "??" : "files"}</GlassBadge>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: space[2], marginRight: space[4] }}>
          <GlassButton variant="primary" onClick={browse} size="md">
            <FolderOpen size={14} /> {tx.browse}
          </GlassButton>
          <GlassButton variant="secondary" onClick={() => doScan()} size="md">
            <Search size={14} /> {tx.scan}
          </GlassButton>
          <GlassButton variant="secondary" onClick={() => setFluidSettingsOpen(true)} size="md">
            <Settings size={14} /> {tx.settings}
          </GlassButton>
        </div>
      </div>

      {/* Empty State */}
      {files.length === 0 && (
        <GlassEmptyState
          icon={<Music size={48} style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />}
          title={tx.noFiles}
          description={tx.formats}
          action={<GlassButton variant="primary" onClick={browse}><FolderOpen size={14} /> {tx.browse}</GlassButton>}
        />
      )}

      {/* Main Content */}
      {files.length > 0 && (
        <>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: space[4] }}>
            {/* Left: Cover */}
            <CoverManager
              coverB64={coverB64}
              coverPreviewB64={coverPreviewB64}
              coverMenuOpen={coverMenuOpen}
              coverMenuHover={coverMenuHover}
              setCoverMenuOpen={setCoverMenuOpen}
              setCoverMenuHover={setCoverMenuHover}
              setCoverSearchOpen={setCoverSearchOpen}
              pickCover={pickCover}
              applyCover={applyCover}
              saveCover={saveCover}
              removeCover={removeCover}
              tx={tx}
            />

            {/* Right: Tag Editor + File List */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: space[3] }}>
              <GlassCard style={{ flexShrink: 0 }}>
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
                <RenamePanel
                  renameName={renameName}
                  setRenameName={setRenameName}
                  renameOne={renameOne}
                  renameAll={renameAll}
                  tx={tx}
                  lang={lang}
                />
              </GlassCard>
              <FileList
                files={files}
                selectedFile={selectedFile}
                playingFile={playingFile}
                onSelect={handleFileClick}
                onPlay={playFile}
                tx={tx}
                listRef={listRef}
              />
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
        </>
      )}
    </motion.div>
  );
}
