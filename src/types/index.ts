export interface SystemInfo {
  cpu_percent: number;
  cpu_count: number;
  cpu_count_physical: number;
  memory_total: number;
  memory_used: number;
  memory_available: number;
  memory_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  windows_version: string;
  windows_release: string;
  windows_build: string;
  windows_edition: string;
  hostname: string;
  is_admin: boolean;
}

export interface RegistryValue {
  value: number | null;
  decimal: number;
  hex: string;
  binary: string;
  error?: string;
}

export interface PriorityRule {
  name: string;
  cpu_priority: string;
  io_priority: string;
}

export interface CoverSearchResult {
  source: "netease" | "qq" | "itunes";
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  songId?: number;
  albumMid?: string;
}

export interface MusicMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  track: string;
  has_cover: boolean;
}

export interface BackupEntry {
  filename: string;
  filepath: string;
  date: string;
  time: string;
  decimal: number;
  hex: string;
  date_obj: Date;
  module?: string;
  size?: number;
}

export interface PlaybackState {
  position_ms: number;
  length_ms: number;
  is_playing: boolean;
  is_paused: boolean;
  is_open: boolean;
}

// ── NCM types ──

export interface NcmFileInfo {
  filepath: string;
  filename: string;
  size: number;
  musicId?: number;
  title?: string;
  artist?: string;
  album?: string;
  format?: string;
  bitrate?: number;
  duration?: number;
  hasCover?: boolean;
  coverBase64?: string | null;
}

export interface NcmMetadata {
  musicId: number;
  title: string;
  artist: string;
  album: string;
  albumPicUrl?: string;
  format: string;
  bitrate: number;
  duration: number;
  hasCover: boolean;
  coverData?: number[] | null;
}

export interface DecodeProgress {
  current: number;
  total: number;
  currentFile: string;
  percent: number;
  status: "scanning" | "decoding" | "writing_tags" | "verifying" | "done" | "error";
}

export interface DecodeResult {
  success: boolean;
  outputPath?: string | null;
  errorMessage?: string | null;
  audioFormat: string;
  md5?: string | null;
  sha256?: string | null;
  originalSize: number;
  decryptedSize: number;
  title?: string;
  artist?: string;
}

export interface BatchDecodeResult {
  results: DecodeResult[];
  successCount: number;
  failCount: number;
}

export type Theme = "light" | "dark" | "auto" | "graphite" | "midnight" | "ocean" | "emerald" | "crimson";
export type Language = "zh" | "en";
export type Page =
  | "dashboard"
  | "win32priority"
  | "appcpupriority"
  | "musicmanager"
  | "backupcenter"
  | "ncmstudio"
  | "settings";

/** All JSON-RPC methods routed through electron/rpc -> .NET Bridge (or JS fallback). */
export type RpcMethod =
  | "system.info"
  | "registry.read" | "registry.write" | "registry.backup"
  | "admin.check" | "admin.restart"
  | "priority.list" | "priority.add" | "priority.edit" | "priority.delete" | "priority.export" | "priority.import_config"
  | "music.scan" | "music.get_metadata" | "music.save_tags" | "music.extract_cover" | "music.apply_cover"
  | "music.remove_cover" | "music.read_cover_file" | "music.rename" | "music.get_lyrics" | "music.save_cover_file"
  | "ncm.list" | "ncm.get_info" | "ncm.decode" | "ncm.batch_decode"
  | "backup.list" | "backup.dir" | "backup.export" | "backup.restore" | "backup.delete" | "backup.clear_all"
  | "config.get" | "config.set";

/** Electron native dialog filter descriptor. */
export interface DialogFilter {
  name: string;
  extensions: string[];
}

/** Electron native save-dialog options. */
export interface SaveDialogOptions {
  defaultPath?: string;
  filters?: DialogFilter[];
}

export interface AppSettings {
  windowOpacity: number;
  borderRadius: number;
  animationSpeed: "normal" | "fast" | "off";
  rememberSize: boolean;
  rememberPosition: boolean;
  sidebarWidth: number;
  fontScale: number;
  compactMode: boolean;
  theme: Theme;
}

export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (callback: (maximized: boolean) => void) => () => void;
    setOpacity: (opacity: number) => Promise<void>;
    setMinimizable: (v: boolean) => Promise<void>;
    setPosition: (x: number, y: number) => Promise<void>;
    getPosition: () => Promise<[number, number]>;
    getSize: () => Promise<[number, number]>;
    toggleFullscreen: (force?: boolean) => Promise<boolean>;
    onFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void;
  };
  bridge: {
    call: <T = any>(method: RpcMethod, params?: Record<string, unknown>) => Promise<T>;
    status: () => Promise<boolean>;
    getFileUrl: (filepath: string) => string;
  };
  dialog: {
    openFolder: () => Promise<string | null>;
    openFile: (filters?: DialogFilter[]) => Promise<string | null>;
    saveFile: (options?: SaveDialogOptions) => Promise<string | null>;
  };
  shell: {
    openPath: (filePath: string) => Promise<string>;
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getPath: (name: string) => Promise<string>;
  };

  music: {
    searchLyrics: (title: string, artist?: string, album?: string, source?: string) => Promise<{ lyrics_text: string | null; translated_text?: string | null; roman_text?: string | null; dynamic_text?: string | null; source: string; error?: string }>;
    searchCoverNetease: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    searchCoverQQ: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    searchCoverITunes: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    downloadCoverImage: (url: string) => Promise<{ data: string | null; error: string | null }>;
  };
  settings: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
    getAll: () => Promise<Record<string, unknown>>;
    resetBounds: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
