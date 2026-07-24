/**
 * LyricManager — 歌词状态管理 Hook
 *
 * 负责: 当前歌曲信息 / 获取歌词 / 缓存 / 时间同步
 * 歌词来源优先级: 本地 .lrc > 嵌入式标签 > 网易云在线搜索
 *
 * @module lyrics/LyricManager
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { parseLyrics } from "./LyricParser";
import type { LyricData, LyricLine } from "./types";

/** 歌词缓存: key = 文件路径 */
const lyricCache = new Map<string, LyricData>();

export interface LyricManagerState {
  /** 当前歌词数据，null 表示未加载 */
  lyricData: LyricData | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前高亮行索引 */
  currentLineIndex: number;
  /** 当前播放秒数 */
  currentTime: number;
}

/** 从文件路径提取歌曲名（fallback） */
function extractTitleFromPath(filePath: string): string {
  const name = filePath.replace(/\\/g, "/").split("/").pop() || "";
  return name.replace(/\.[^.]+$/, "");
}

export function useLyricManager() {
  const { audioState, playingFile } = useMusicPlayer();
  const [lyricData, setLyricData] = useState<LyricData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);

  const lastFileRef = useRef<string>("");

  /** 根据当前时间计算歌词行 */
  const computeLineIndex = useCallback((time: number, lines: LyricLine[]): number => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= time) idx = i;
      else break;
    }
    return idx;
  }, []);

  /** 获取歌词（本地优先，在线 fallback） */
  const fetchLyrics = useCallback(async (filePath: string) => {
    if (!filePath) return;

    // 检查缓存
    if (lyricCache.has(filePath)) {
      setLyricData(lyricCache.get(filePath)!);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ---- 第 1 步: 尝试本地歌词（Python Bridge） ----
      const localResult = await window.electronAPI?.python.call("music.get_lyrics", {
        filepath: filePath,
      });

      if (localResult?.lyrics_text) {
        const data = parseLyrics(localResult.lyrics_text);
        lyricCache.set(filePath, data);
        setLyricData(data);
        setLoading(false);
        return;
      }

      // ---- 第 2 步: 在线搜索（网易云音乐） ----
      let title = extractTitleFromPath(filePath);
      let artist = "";

      // 尝试从音频元数据中获取更准确的 title/artist
      try {
        const metaResult = await window.electronAPI?.python.call("music.get_metadata", {
          filepath: filePath,
        });
        if (metaResult?.title) title = metaResult.title;
        if (metaResult?.artist) artist = metaResult.artist;
      } catch {
        // 元数据获取失败，使用文件名 fallback
      }

      if (window.electronAPI?.music?.searchLyrics) {
        const onlineResult = await window.electronAPI.music.searchLyrics(title, artist || undefined);

        if (onlineResult?.lyrics_text) {
          const data = parseLyrics(onlineResult.lyrics_text);
          lyricCache.set(filePath, data);
          setLyricData(data);
          setLoading(false);
          return;
        }
      }

      // ---- 第 3 步: 无歌词可用 ----
      setLyricData(null);
      setError("暂无歌词");
    } catch (e: any) {
      setError(e?.message || "获取歌词失败");
      setLyricData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 歌曲切换时重新获取 */
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

  /** rAF ???? ? ????????? React ?? */
  const currentTimeRef = useRef(0);
  const rafRef = useRef(0);
  const lastIndexRef = useRef(-1);

  useEffect(() => {
    const tick = () => {
      const t = audioState.pos ?? 0;
      currentTimeRef.current = t;
      if (lyricData?.lines?.length) {
        const idx = computeLineIndex(t, lyricData.lines);
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
  }, [audioState.pos, lyricData, computeLineIndex]);

  /** ?? currentTime ref?? InterludeDots ????? */
  const getCurrentTime = useCallback(() => currentTimeRef.current, []);
  /** 清除缓存（用于手动刷新） */
  const clearCache = useCallback(() => {
    lyricCache.clear();
  }, []);

  return {
    lyricData,
    loading,
    error,
    currentLineIndex,
    currentTime,
    currentTimeRef,
    getCurrentTime,
    fetchLyrics,
    clearCache,
  } as LyricManagerState & {
    fetchLyrics: (fp: string) => Promise<void>;
    clearCache: () => void;
    currentTimeRef: React.RefObject<number>;
    getCurrentTime: () => number;
  };
}