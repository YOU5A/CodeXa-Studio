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

export type Theme = "light" | "dark" | "auto" | "graphite" | "midnight" | "ocean" | "emerald" | "crimson";
export type Language = "zh" | "en";
export type Page =
  | "dashboard"
  | "win32priority"
  | "appcpupriority"
  | "musicmanager"
  | "backupcenter"
  | "settings";

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
    onMaximizeChange: (callback: (maximized: boolean) => void) => void;
    setOpacity: (opacity: number) => Promise<void>;
    setMinimizable: (v: boolean) => Promise<void>;
    setPosition: (x: number, y: number) => Promise<void>;
    getPosition: () => Promise<[number, number]>;
    getSize: () => Promise<[number, number]>;
  };
  python: {
    call: (method: string, params?: any) => Promise<any>;
    status: () => Promise<boolean>;
    getFileUrl: (filepath: string) => string;
  };
  dialog: {
    openFolder: () => Promise<string | null>;
    openFile: (filters?: any) => Promise<string | null>;
    saveFile: (options?: any) => Promise<string | null>;
  };
  shell: {
    openPath: (filePath: string) => Promise<string>;
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getPath: (name: string) => Promise<string>;
  };

  music: {
    searchLyrics: (title: string, artist?: string) => Promise<{ lyrics_text: string | null; source: string; error?: string }>;
    searchCoverNetease: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    searchCoverQQ: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    searchCoverITunes: (title: string, artist?: string, album?: string) => Promise<{ results: CoverSearchResult[]; error?: string }>;
    downloadCoverImage: (url: string) => Promise<{ data: string | null; error: string | null }>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<boolean>;
    getAll: () => Promise<Record<string, any>>;
    resetBounds: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
