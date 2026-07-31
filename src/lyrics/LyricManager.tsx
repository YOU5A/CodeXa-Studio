/**
 * LyricManager — Lyrics state management hook
 *
 * Fetches lyrics via local .NET bridge or online search.
 * Integrates global offset from lyrics settings.
 *
 * @module lyrics/LyricManager
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { parseLyric, parseLyricData } from "./LyricParser";
import type { LyricData, LyricLine, OnlineLyricResult } from "./types";
import { loadLyricsSettings } from "./types";

const lyricCache = new Map<string, LyricData>();

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

export function useLyricManager() {
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

    try {
      if (source === "lrc") {
        // Only local LRC
        const data = await fetchLocalLrc();
        if (data) {
          lyricCache.set(filePath, data);
          setLyricData(data);
          const rt = audioState.pos ?? 0;
          const idx = computeLineIndex(rt, data.lines);
          lastIndexRef.current = idx;
          setCurrentLineIndex(idx);
          setCurrentTime(rt);
          setLoading(false);
          return;
        }
        setLyricData(null);
        setError("暂无本地歌词");
      } else if (source === "netease") {
        // Only Netease online
        const data = await fetchNetease();
        if (data) {
          lyricCache.set(filePath, data);
          setLyricData(data);
          const rt = audioState.pos ?? 0;
          const idx = computeLineIndex(rt, data.lines);
          lastIndexRef.current = idx;
          setCurrentLineIndex(idx);
          setCurrentTime(rt);
          setLoading(false);
          return;
        }
        setLyricData(null);
        setError("暂无歌词");
      } else {
        // "auto": Netease first, fallback to local LRC
        const neteaseData = await fetchNetease();
        if (neteaseData) {
          lyricCache.set(filePath, neteaseData);
          setLyricData(neteaseData);
          const rawTime3 = audioState.pos ?? 0;
          const idx3 = computeLineIndex(rawTime3, neteaseData.lines);
          lastIndexRef.current = idx3;
          setCurrentLineIndex(idx3);
          setCurrentTime(rawTime3);
          setLoading(false);
          return;
        }
        const localData = await fetchLocalLrc();
        if (localData) {
          lyricCache.set(filePath, localData);
          setLyricData(localData);
          const rawTime4 = audioState.pos ?? 0;
          const idx4 = computeLineIndex(rawTime4, localData.lines);
          lastIndexRef.current = idx4;
          setCurrentLineIndex(idx4);
          setCurrentTime(rawTime4);
          setLoading(false);
          return;
        }
        setLyricData(null);
        setError("暂无歌词");
      }
    } catch (e: any) {
      setError(e?.message || "获取歌词失败");
      setLyricData(null);
    } finally {
      setLoading(false);
    }
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
  }, [audioState.pos, computeLineIndex]);

  const getLiveCurrentTime = useCallback(() => currentTimeRef.current, []);
  const clearCache = useCallback(() => lyricCache.clear(), []);

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
