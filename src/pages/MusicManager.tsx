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
import type { MusicMetadata, PlaybackState, Page } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";

import { extractDominantColorAsync, type RGB } from "@/utils/colorExtractor";
import FluidSettingsPanel, { DEFAULT_FLUID_SETTINGS, loadFluidSettings, saveFluidSettings, type FluidSettingsValues } from "@/components/FluidSettingsPanel";
import CoverSearchPanel from "@/components/CoverSearchPanel";

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
  // Stop playback if modifying the currently playing file (prevents file-lock errors)
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
  const { lyricData, loading: lyricsLoading, error: lyricsError, currentLineIndex, currentTime } = useLyricManager();
  const [volumeHover, setVolumeHover] = useState(false);
  const [volGlow, setVolGlow] = useState({ x: 0.5, y: 0.5, visible: false });
  const [fluidSettingsOpen, setFluidSettingsOpen] = useState(false);
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => externalSettings ?? loadFluidSettings());
  const [lyricsSettings, setLyricsSettings] = useState<LyricsSettingsValues>(() => loadLyricsSettings());
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
  // 重命名输入框参考
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

  // On mount, clear any stale cover color from previous session (since playback doesn't persist)
  useEffect(() => {
    if (!coverB64) {
      localStorage.removeItem("fluidCoverColor");
      window.dispatchEvent(new CustomEvent("fluidCoverColorChanged", { detail: null }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount: restore folder, volume, and playing file state
  useEffect(() => {
    const init = async () => {
      try {
        const saved = localStorage.getItem('music_folder');
        if (saved && !hasScanned.current) { hasScanned.current = true; setFolder(saved); doScan(saved); }
      } catch {}
      // If a file was playing before switching pages, restore its selection
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll selected file into center of list (called explicitly, not on every click)
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

  // ── File ──

  const { settings } = useTheme();
  const animationDuration = getAnimDuration(settings.animationSpeed);

  const browse = async () => {
    const p = await window.electronAPI?.dialog.openFolder();
    if (p) {
      setFolder(p);
      try { localStorage.setItem('music_folder', p); } catch {}
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

  // Sync selectedFile and metadata when playingFile changes (e.g., next/prev/auto-advance)
  useEffect(() => {
    if (playingFile && playingFile !== selectedFile) {
      if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
      selectFile(playingFile);
    }
  }, [playingFile]);

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
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

  const playPrev = () => {
    contextPlayPrev();
  };
  const playNext = () => {
    contextPlayNext();
  };

  const doSeek = (clientX: number) => {
    contextSeek(clientX, progressRef);
  };

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

  // ── Tags ──
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

  // ── Cover ──
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

  // ?? Cover from URL (for CoverSearchPanel) ??
  const handleApplyCoverFromUrl = async (urlOrDataUrl: string) => {
    if (!selectedFile) throw new Error(lang === "zh" ? "?????" : "No file selected");
    ensureFileWritable(selectedFile);
    let coverPath = urlOrDataUrl;
    if (urlOrDataUrl.startsWith("data:")) {
      const base64 = urlOrDataUrl.split(",")[1];
      const ext = urlOrDataUrl.includes("image/png") ? ".png" : ".jpg";
      const tmpDir = await window.electronAPI?.app.getPath("temp");
      coverPath = tmpDir + "\codexa_cover_dl_" + Date.now() + ext;
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

  // ── Rename ──
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
    showToast(lang === "zh" ? `已重命名 ${c} 个文件` : `Renamed ${c} files`, c > 0 ? "success" : "warning");
    doScan();
  };

  // ── Toolbar actions ──
  const clearTagFields = () => {
    setTagTitle(""); setTagArtist(""); setTagAlbum(""); setTagYear(""); setTagGenre("");
  };

  return (
    <>
    <motion.div
      animate={{ opacity: 1 }}
      transition={{ duration: animationDuration, ease: EASE_OUT }}
      style={{ height: "100%", display: "flex", flexDirection: "column", gap: space[3] }}
    >
      {/* Title + Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexShrink: 0 }}>
        <h1 style={{ fontSize: fontSizes["2xl"], fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {tx.title}
        </h1>
        {files.length > 0 && (
          <GlassBadge variant="accent" size="sm">{files.length} {lang === "zh" ? "\u6587\u4ef6" : "files"}</GlassBadge>
        )}
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
      {files.length === 0 ? (
        <GlassEmptyState
          icon={<Music size={48} />}
          title={tx.noFiles}
          description={tx.formats}
          style={{ flex: 1 }}
        />
      ) : (
        <>
          {/* Main Content */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: space[4] }}>
            {/* Left: Cover */}
            <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: space[3] }}>
              <GlassCard style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                <div style={{
                  width: "100%", aspectRatio: "1",
                  background: "var(--bg-tertiary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {coverB64 ? (
                    <img src={`data:image/jpeg;base64,${coverB64}`} alt="Cover"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Music size={48} style={{ color: "var(--text-tertiary)", opacity: 0.25 }} />
                  )}
                </div>
                {/* Cover menu toggle ? glass glow pill at bottom of cover */}
                <button
                  onClick={() => setCoverMenuOpen(v => !v)}
                  onMouseEnter={() => setCoverMenuHover(true)}
                  onMouseLeave={() => setCoverMenuHover(false)}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 34,
                    height: 22,
                    borderRadius: 11,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: coverMenuHover ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(14px) saturate(1.6)",
                    WebkitBackdropFilter: "blur(14px) saturate(1.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: coverMenuHover
                      ? "0 0 22px rgba(255,255,255,0.22), 0 0 44px rgba(255,255,255,0.08)"
                      : coverMenuOpen
                        ? "0 0 18px rgba(255,255,255,0.14), 0 0 36px rgba(255,255,255,0.05)"
                        : "0 0 12px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.02)",
                    transition: "background 0.2s ease, box-shadow 0.3s ease",
                    padding: 0,
                    outline: "none",
                    zIndex: 1,
                  }}
                >
                  <motion.div
                    animate={{ rotate: coverMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.75)" }} />
                  </motion.div>
                </button>
              </GlassCard>

              <AnimatePresence>
                {coverMenuOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: space[1] }}
                  >
                    <GlassButton variant="secondary" size="sm" inline={false} onClick={() => setCoverSearchOpen(true)}
                      style={{ justifyContent: "center" }}>
                      <Globe size={12} /> {tx.searchCover}
                    </GlassButton>
                    <GlassButton variant="secondary" size="sm" inline={false} onClick={pickCover}
                      style={{ justifyContent: "center" }}>
                      <Image size={12} /> {tx.selectCover}
                    </GlassButton>
                    <GlassButton variant="secondary" size="sm" inline={false} onClick={applyCover}
                      style={{ justifyContent: "center" }}>
                      {tx.applyCover}
                    </GlassButton>
                    <GlassButton variant="secondary" size="sm" inline={false} onClick={saveCover}
                      style={{ justifyContent: "center" }}>
                      <Save size={12} /> {tx.saveCover}
                    </GlassButton>
                    <GlassButton variant="secondary" size="sm" inline={false} onClick={removeCover}
                      style={{ justifyContent: "center" }}>
                      <Trash2 size={12} /> {tx.removeCover}
                    </GlassButton>
                  </motion.div>
                )}
              </AnimatePresence>

              {coverPreviewB64 && (
                <GlassCard style={{ padding: 0, overflow: "hidden" }}>
                  <img src={`data:image/jpeg;base64,${coverPreviewB64}`} alt="Cover Preview"
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: radii.lg }} />
                </GlassCard>
              )}
            </div>

            {/* Right: Tag Editor + File List */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: space[3] }}>
              {/* Tag Editor */}
              <GlassCard style={{ flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
                  <Edit3 size={14} style={{ color: "var(--text-secondary)" }} />
                  <span style={{ fontSize: fontSizes.md, fontWeight: 500, color: "var(--text-secondary)" }}>
                    {tx.tagEditor}
                  </span>
                  {selectedFile && (
                    <span style={{
                      fontSize: fontSizes.xs, color: "var(--text-tertiary)",
                      marginLeft: "auto", maxWidth: "45%",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {selectedFile.split("\\").pop()}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: space[2] }}>
                  <GlassInput value={tagTitle} onChange={e => setTagTitle(e.target.value)} placeholder={tx.title_}
                    style={{ fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }} />
                  <GlassInput value={tagArtist} onChange={e => setTagArtist(e.target.value)} placeholder={tx.artist}
                    style={{ fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }} />
                  <GlassInput value={tagAlbum} onChange={e => setTagAlbum(e.target.value)} placeholder={tx.album}
                    style={{ fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }} />
                  <GlassInput value={tagYear} onChange={e => setTagYear(e.target.value)} placeholder={tx.year}
                    style={{ fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }} />
                  <GlassInput value={tagGenre} onChange={e => setTagGenre(e.target.value)} placeholder={tx.genre}
                    style={{ fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }} />
                </div>

                <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
                  <GlassButton variant="primary" onClick={saveTags} disabled={saving} size="md">
                    <Save size={12} /> {tx.saveTags}
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={clearTagFields} size="md">
                    <X size={12} /> {tx.clearTags}
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={applyAll} disabled={saving} size="md">
                    {tx.applyAll}
                  </GlassButton>
                </div>

                {/* Rename Row */}
                <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
                  <GlassInput
                    value={renameName}
                    onChange={e => setRenameName(e.target.value)}
                    placeholder={renameName || (lang === "zh" ? "文件名" : "File name")}
                    style={{ flex: 1, fontSize: fontSizes.sm, padding: space[1] + "px " + space[2] + "px" }}
                  />
                  <GlassButton variant="secondary" onClick={renameOne} size="sm">
                    {tx.renameSelected}
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={renameAll} size="sm">
                    {tx.renameAll}
                  </GlassButton>
                </div>
              </GlassCard>

              {/* File List */}
              <GlassCard style={{ flex: 1, minHeight: 0, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div
                  ref={listRef}
                  className="music-file-list-scroll scroll-fade-edge"
                  style={{
                    flex: 1, overflowY: "auto", overflowX: "hidden",
                    padding: space[2] + "px 0",
                  }}
                >
                  {files.map((fp: string) => {
                    const name = fp.split("\\").pop() || fp;
                    const isSelected = fp === selectedFile;
                    const isPlaying = fp === playingFile;
                    return (
                      <div
                        key={fp}
                        data-filepath={fp}
                        onClick={() => {
                          setSelectedFile(fp);
                          if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
                          if (fp !== playingFile && playingFile) {
                            revertTimerRef.current = setTimeout(() => {
                              setSelectedFile(playingFile);
                              revertTimerRef.current = null;
                            }, 1500);
                          }
                        }}
                        onDoubleClick={() => {
                          if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null; }
                          playFile(fp);
                        }}
                        onMouseMove={(e) => {
                          const el = e.currentTarget;
                          const r = el.getBoundingClientRect();
                          el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
                          el.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`);
                          el.style.setProperty("--go", "1");
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.setProperty("--go", "0");
                        }}
                        style={{
                          padding: space[2] + "px " + space[4] + "px",
                          cursor: "pointer",
                          fontSize: fontSizes.sm,
                          color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                          background: isSelected
                            ? "rgba(var(--accent-rgb, 99,102,241), 0.12)"
                            : "rgba(255,255,255,0.03)",
                          backdropFilter: "blur(8px) saturate(1.2)",
                          WebkitBackdropFilter: "blur(8px) saturate(1.2)",
                          borderLeft: isPlaying ? "3px solid var(--accent)" : "3px solid transparent",
                          display: "flex", alignItems: "center", gap: space[2],
                          position: "relative", overflow: "hidden",
                          transition: "background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
                        }}
                      >
                        <span style={{
                          position: "absolute", inset: 0, pointerEvents: "none",
                          background: "radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(var(--accent-rgb, 99,102,241), 0.15) 0%, transparent 60%)",
                          opacity: "var(--go, 0)",
                          transition: "opacity 0.25s ease",
                        }} />
                        <Music size={12} style={{ position: "relative", zIndex: 1 }} />
                        <span style={{
                          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          position: "relative", zIndex: 1,
                        }}>
                          {name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}

      {/* Player Bar ? Apple Music style */}
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
        {/* Progress Bar ? slim, expands on hover */}
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

        {/* Main Row: Cover+Info | Controls | Volume+Time */}
        <div style={{
          display: "flex", alignItems: "center", gap: space[4],
        }}>
          {/* Left: Cover + Track Info */}
          <div style={{
            display: "flex", alignItems: "center", gap: space[3],
            flex: 1, minWidth: 0,
          }}>
            {/* Cover Thumbnail */}
            <div style={{
              width: 48, height: 48, borderRadius: radii.md,
              overflow: "hidden", flexShrink: 0,
              background: "rgba(128,128,128,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {coverB64 ? (
                <img
                  src={`data:image/jpeg;base64,${coverB64}`}
                  alt="cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Music size={20} style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
              )}
            </div>
            {/* Track Info */}
            <div style={{
              minWidth: 0, display: "flex", flexDirection: "column", gap: 2,
            }}>
              <span style={{
                fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {(playback.is_playing || playback.is_paused)
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
              {/* Gear ? slides out left */}
              <span
                style={{
                  position: "absolute",
                  right: "calc(100% + 6px)",
                  top: 0,
                  display: "flex", alignItems: "center",
                  height: 34,
                  transform: lyricsBtnHover ? "translateX(0) scale(1)" : "translateX(8px) scale(0.5)",
                  opacity: lyricsBtnHover ? 1 : 0,
                  transition: "transform 0.2s ease, opacity 0.15s ease",
                  pointerEvents: lyricsBtnHover ? "auto" : "none",
                }}
              >
                <GlassTooltip text={lang === "zh" ? "歌词设置" : "Lyrics Settings"}>
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
                onMouseLeave={() => setPlayBtnGlow(prev => ({ ...prev, visible: false }))}
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
            <GlassTooltip text={playMode === "sequential" ? tx.modeSequential : playMode === "loop-all" ? tx.modeLoopAll : playMode === "shuffle" ? tx.modeShuffle : tx.modeStopAfter}>
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
            {/* Volume ? custom slider like progress bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: space[2],
            }}>
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
    </motion.div>

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
  );
}