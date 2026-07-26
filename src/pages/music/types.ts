import type { MusicMetadata } from "@/types";
import type { PlayMode } from "@/contexts/MusicPlayerContext";
import type { RGB } from "@/utils/colorExtractor";
import type { FluidSettingsValues } from "@/components/FluidSettingsPanel";
import type { LyricsSettingsValues } from "@/lyrics";

export interface CoverManagerProps {
  coverB64: string | null;
  coverPreviewB64: string | null;
  coverMenuOpen: boolean;
  coverMenuHover: boolean;
  setCoverMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setCoverMenuHover: (v: boolean) => void;
  setCoverSearchOpen: (v: boolean) => void;
  pickCover: () => void;
  applyCover: () => void;
  saveCover: () => void;
  removeCover: () => void;
  tx: Record<string, string>;
}

export interface TagEditorProps {
  tagTitle: string;
  tagArtist: string;
  tagAlbum: string;
  tagYear: string;
  tagGenre: string;
  saving: boolean;
  selectedFile: string;
  setTagTitle: (v: string) => void;
  setTagArtist: (v: string) => void;
  setTagAlbum: (v: string) => void;
  setTagYear: (v: string) => void;
  setTagGenre: (v: string) => void;
  saveTags: () => void;
  clearTagFields: () => void;
  applyAll: () => void;
  tx: Record<string, string>;
}

export interface RenamePanelProps {
  renameName: string;
  setRenameName: (v: string) => void;
  renameOne: () => void;
  renameAll: () => void;
  tx: Record<string, string>;
  lang: "zh" | "en";
}

export interface FileListProps {
  files: string[];
  selectedFile: string;
  playingFile: string | null;
  onSelect: (fp: string) => void;
  onPlay: (fp: string) => void;
  tx: Record<string, string>;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export interface PlaybackInfo {
  position_ms: number;
  length_ms: number;
  is_playing: boolean;
}

export interface PlayerBarProps {
  playback: PlaybackInfo;
  pct: number;
  volume: number;
  playMode: PlayMode;
  playingFile: string | null;
  metadata: MusicMetadata | null;
  coverB64: string | null;
  progressHover: boolean;
  isDragging: boolean;
  playBtnGlow: { x: number; y: number; visible: boolean };
  volumeHover: boolean;
  volGlow: { x: number; y: number; visible: boolean };
  isDraggingVolume: boolean;
  lyricsVisible: boolean;
  lyricsBtnHover: boolean;
  toggle: () => void;
  playPrev: () => void;
  playNext: () => void;
  setPlayMode: (mode: PlayMode) => void;
  handleProgressMouseDown: (e: React.MouseEvent) => void;
  handleVolumeMouseDown: (e: React.MouseEvent) => void;
  setProgressHover: (v: boolean) => void;
  setPlayBtnGlow: (v: { x: number; y: number; visible: boolean }) => void;
  setVolumeHover: (v: boolean) => void;
  setVolGlow: (v: { x: number; y: number; visible: boolean }) => void;
  setLyricsVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLyricsSettingsOpen: (v: boolean) => void;
  setLyricsBtnHover: (v: boolean) => void;
  progressRef: React.RefObject<HTMLDivElement | null>;
  volumeRef: React.RefObject<HTMLDivElement | null>;
  lyricsGearTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  fmtTime: (s: number) => string;
  tx: Record<string, string>;
  lang: "zh" | "en";
}
