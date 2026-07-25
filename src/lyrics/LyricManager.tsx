/**
 * LyricManager — Lyrics state management hook
 *
 * Fetches lyrics via local Python bridge or online search.
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
      setLyricData(lyricCache.get(filePath)!);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const source = getLyricSource();

    // Resolve title/artist from metadata
    let title = extractTitleFromPath(filePath);
    let artist = extractArtistFromPath(filePath);
    try {
      const metaResult = await window.electronAPI?.python.call("music.get_metadata", { filepath: filePath });
      if (metaResult?.title) title = metaResult.title;
      if (metaResult?.artist) artist = metaResult.artist;
    } catch {
      /* use filename fallback */
    }

    // Helper: fetch from Netease online
    const fetchNetease = async (): Promise<LyricData | null> => {
      if (!window.electronAPI?.music?.searchLyrics) return null;
      const result: OnlineLyricResult | null = await window.electronAPI.music.searchLyrics(
        title, artist || undefined, "netease"
      );
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
      const localResult = await window.electronAPI?.python.call("music.get_lyrics", { filepath: filePath });
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
          setLoading(false);
          return;
        }
        const localData = await fetchLocalLrc();
        if (localData) {
          lyricCache.set(filePath, localData);
          setLyricData(localData);
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
      setCurrentLineIndex(-1);
      setCurrentTime(0);
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
      const newOffset = getGlobalOffset();
      if (newOffset !== globalOffset) {
        setGlobalOffset(newOffset);
        setSeekCounter(+new Date());
      }
      lyricCache.clear();
      if (lastFileRef.current) {
        fetchLyrics(lastFileRef.current);
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
      const t = rawTime + globalOffsetRef.current;
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