/**
 * LyricManager — Lyrics state management hook
 *
 * Fetches lyrics via local .NET bridge or online search.
 * Integrates global offset from lyrics settings.
 *
 * 网络获取链路为模块级共享：已完成结果进 lyricCache，
 * 在途请求进 pendingLyric（Promise 去重），多实例（悬浮窗 + NowPlaying）
 * 切歌时同一首歌只会发起一次网络请求。
 *
 * @module lyrics/LyricManager
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { parseLyric, parseLyricData } from "./LyricParser";
import type { LyricData, LyricLine, OnlineLyricResult } from "./types";
import { loadLyricsSettings } from "./types";

const lyricCache = new Map<string, LyricData>();
/** 在途请求去重表：同一文件同时只保留一个获取任务 */
const pendingLyric = new Map<string, Promise<LyricResult>>();

export type LyricSourceOption = "auto" | "netease" | "lrc";

function getLyricSource(): LyricSourceOption {
  return loadLyricsSettings().lyricSource;
}

function getGlobalOffset(): number {
  return loadLyricsSettings().globalOffset;
}

export interface LyricManagerState {
  lyricData: LyricData | null;
  loading: boolean;
  error: string | null;
  currentLineIndex: number;
  currentTime: number;
}

interface LyricResult {
  data: LyricData | null;
  error: string | null;
}

function extractTitleFromPath(filePath: string): string {
  const name = filePath.replace(/\\/g, "/").split("/").pop() || "";
  return name.replace(/\.[^.]+$/, "");
}

function extractArtistFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = (parts.pop() || "").replace(/\.[^.]+$/, "");
  const separator = fileName.includes(" - ") ? " - " : fileName.includes("-") ? "-" : null;
  if (separator) {
    const [artist] = fileName.split(separator);
    if (artist.trim()) return artist.trim();
  }
  return "";
}

/**
 * 模块级歌词获取：已完成缓存 → 在途 Promise → 新建请求。
 * 多实例并发调用同一文件时共享同一个请求，避免重复网络调用。
 */
async function requestLyricData(filePath: string): Promise<LyricResult> {
  if (lyricCache.has(filePath)) {
    return { data: lyricCache.get(filePath)!, error: null };
  }

  const pending = pendingLyric.get(filePath);
  if (pending) return pending;

  const promise = (async (): Promise<LyricResult> => {
    try {
      const source = getLyricSource();

      // Resolve title/artist from metadata
      let title = extractTitleFromPath(filePath);
      let artist = extractArtistFromPath(filePath);
      let album = "";
      try {
        const metaResult = await window.electronAPI?.bridge.call("music.get_metadata", { filepath: filePath });
        if (metaResult?.title) title = metaResult.title;
        if (metaResult?.artist) artist = metaResult.artist;
        if (metaResult?.album) album = metaResult.album;
      } catch {
        /* use filename fallback */
      }

      // Helper: fetch from Netease online
      const fetchNetease = async (): Promise<LyricData | null> => {
        if (!window.electronAPI?.music?.searchLyrics) { console.log("[LyricManager] searchLyrics API not available"); return null; }
        console.log("[LyricManager] Calling searchLyrics:", { title, artist, album });
        const result: OnlineLyricResult | null = await window.electronAPI.music.searchLyrics(
          title, artist || undefined, album || undefined, "netease"
        );
        console.log("[LyricManager] searchLyrics result:", result?.lyrics_text ? "got lyrics" : "null");
        if (result?.lyrics_text) {
          return parseLyricData(
            result.lyrics_text,
            result.translated_text || undefined,
            result.roman_text || undefined,
            result.dynamic_text || undefined
          );
        }
        return null;
      };

      // Helper: fetch from local LRC file
      const fetchLocalLrc = async (): Promise<LyricData | null> => {
        const localResult = await window.electronAPI?.bridge.call("music.get_lyrics", { filepath: filePath });
        if (localResult?.lyrics_text) {
          return parseLyricData(localResult.lyrics_text);
        }
        return null;
      };

      if (source === "lrc") {
        // Only local LRC
        const data = await fetchLocalLrc();
        if (data) {
          lyricCache.set(filePath, data);
          return { data, error: null };
        }
        return { data: null, error: "暂无本地歌词" };
      }

      if (source === "netease") {
        // Only Netease online
        const data = await fetchNetease();
        if (data) {
          lyricCache.set(filePath, data);
          return { data, error: null };
        }
        return { data: null, error: "暂无歌词" };
      }

      // "auto": Netease first, fallback to local LRC
      const neteaseData = await fetchNetease();
      if (neteaseData) {
        lyricCache.set(filePath, neteaseData);
        return { data: neteaseData, error: null };
      }
      const localData = await fetchLocalLrc();
      if (localData) {
        lyricCache.set(filePath, localData);
        return { data: localData, error: null };
      }
      return { data: null, error: "暂无歌词" };
    } catch (e: any) {
      return { data: null, error: e?.message || "获取歌词失败" };
    }
  })();

  pendingLyric.set(filePath, promise);
  // 无论成功失败都从在途表移除，允许下次重试；额外 catch 防止 finally 链产生未处理 rejection
  promise.finally(() => { pendingLyric.delete(filePath); }).catch(() => {});
  return promise;
}

/**
 * 歌词状态 Hook。
 *
 * @param active 是否激活：false 时暂停 rAF 定位循环（数据获取仍走共享缓存去重）。
 *               MusicManager 始终启用；NowPlaying 覆盖层仅在打开时启用，避免常驻空转。
 */
export function useLyricManager(active = true) {
  const { audioState, playingFile } = useMusicPlayer();
  const [lyricData, setLyricData] = useState<LyricData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [globalOffset, setGlobalOffset] = useState(getGlobalOffset());
  const [seekCounter, setSeekCounter] = useState(0);

  const lastFileRef = useRef<string>("");
  const prevSourceRef = useRef<LyricSourceOption>(getLyricSource());
  // 歌词请求序号：切歌/换源后旧请求即使后返回也直接丢弃，防止覆盖当前曲目数据
  const fetchSeqRef = useRef(0);

  const computeLineIndex = useCallback(
    (time: number, lines: LyricLine[]): number => {
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= time) idx = i;
        else break;
      }
      return idx;
    },
    []
  );

  const fetchLyrics = useCallback(async (filePath: string) => {
    if (!filePath) return;
    const seq = ++fetchSeqRef.current;

    // 已完成缓存：同步命中，直接使用
    if (lyricCache.has(filePath)) {
      const data = lyricCache.get(filePath)!;
      setLyricData(data);
      // Sync current line index immediately so first visible frame centers correctly
      const rawTime = audioState.pos ?? 0;
      const idx = computeLineIndex(rawTime, data.lines);
      lastIndexRef.current = idx;
      setCurrentLineIndex(idx);
      setCurrentTime(rawTime);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // 共享请求链路：在途去重由 requestLyricData 内部处理
    const { data, error: fetchError } = await requestLyricData(filePath);

    // 过期请求（期间切歌/换源）直接丢弃，避免旧结果覆盖当前曲目
    if (seq !== fetchSeqRef.current) return;

    if (data) {
      setLyricData(data);
      const rawTime = audioState.pos ?? 0;
      const idx = computeLineIndex(rawTime, data.lines);
      lastIndexRef.current = idx;
      setCurrentLineIndex(idx);
      setCurrentTime(rawTime);
      setError(null);
    } else {
      setLyricData(null);
      setError(fetchError ?? "暂无歌词");
    }
    setLoading(false);
  }, []);

  // Song change detection
  useEffect(() => {
    if (playingFile && playingFile !== lastFileRef.current) {
      lastFileRef.current = playingFile;
      setLyricData(null);
      setCurrentLineIndex(0);
      setCurrentTime(0);
      lastIndexRef.current = -1;
      fetchLyrics(playingFile);
    }
    if (!playingFile) {
      lastFileRef.current = "";
      setLyricData(null);
      setError(null);
      setCurrentLineIndex(-1);
    }
  }, [playingFile, fetchLyrics]);

  // Listen for settings changes (lyric source or global offset)
  useEffect(() => {
    const handler = () => {
      const settings = loadLyricsSettings();
      const newOffset = settings.globalOffset;
      if (newOffset !== globalOffset) {
        setGlobalOffset(newOffset);
        setSeekCounter(+new Date());
      }
      // Only re-fetch when lyrics source changes
      const newSource = settings.lyricSource;
      if (newSource !== prevSourceRef.current) {
        prevSourceRef.current = newSource;
        lyricCache.clear();
        pendingLyric.clear();
        if (lastFileRef.current) {
          fetchLyrics(lastFileRef.current);
        }
      }
    };
    window.addEventListener("lyricsSettingsChanged", handler);
    return () => window.removeEventListener("lyricsSettingsChanged", handler);
  }, [globalOffset, fetchLyrics]);

  // RAF-driven time sync with global offset
  const currentTimeRef = useRef(0);
  const rafRef = useRef(0);
  const lastIndexRef = useRef(-1);
  const lyricDataRef = useRef(lyricData);
  const globalOffsetRef = useRef(globalOffset);
  lyricDataRef.current = lyricData;
  globalOffsetRef.current = globalOffset;

  useEffect(() => {
    // 未激活（如 NowPlaying 覆盖层关闭）时不跑 rAF，避免常驻空转
    if (!active) return;
    const tick = () => {
      const rawTime = audioState.pos ?? 0;
      const t = rawTime + globalOffsetRef.current / 1000;
      currentTimeRef.current = t;
      const data = lyricDataRef.current;
      if (data?.lines?.length) {
        const idx = computeLineIndex(t, data.lines);
        if (idx !== lastIndexRef.current) {
          lastIndexRef.current = idx;
          setCurrentTime(t);
          setCurrentLineIndex(idx);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioState.pos, computeLineIndex, active]);

  const getLiveCurrentTime = useCallback(() => currentTimeRef.current, []);
  const clearCache = useCallback(() => {
    lyricCache.clear();
    pendingLyric.clear();
  }, []);

  return {
    lyricData,
    loading,
    error,
    currentLineIndex,
    currentTime,
    currentTimeRef,
    getCurrentTime: getLiveCurrentTime,
    fetchLyrics,
    clearCache,
    seekCounter,
    globalOffset,
  } as LyricManagerState & {
    fetchLyrics: (fp: string) => Promise<void>;
    clearCache: () => void;
    currentTimeRef: React.RefObject<number>;
    getCurrentTime: () => number;
    seekCounter: number;
    globalOffset: number;
  };
}
