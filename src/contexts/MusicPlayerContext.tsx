import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

export type PlayMode = "sequential" | "loop-all" | "shuffle" | "stop-after";

interface AudioState {
  duration: number;
  playing: boolean;
  pos: number;
}

interface MusicPlayerContextValue {
  audioState: AudioState;
  playingFile: string;
  volume: number;
  playMode: PlayMode;
  playlist: string[];
  playFile: (fp: string) => void;
  toggle: (currentSelectedFile?: string) => void;
  stop: () => void;
  releaseHandle: () => void;
  seek: (clientX: number, progressRef: React.RefObject<HTMLDivElement | null>) => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  setPlaylist: (files: string[]) => void;
  setPlayMode: (mode: PlayMode) => void;
  playNext: () => void;
  playPrev: () => void;
  fmtTime: (ms: number) => string;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue>({
  audioState: { duration: 0, playing: false, pos: 0 },
  playingFile: "",
  volume: 40,
  playMode: "sequential",
  playlist: [],
  playFile: () => {},
  toggle: () => {},
  stop: () => {},
  releaseHandle: () => {},
  seek: () => {},
  seekTo: () => {},
  setVolume: () => {},
  setPlaylist: () => {},
  setPlayMode: () => {},
  playNext: () => {},
  playPrev: () => {},
  fmtTime: () => "0:00",
});

export function useMusicPlayer() {
  return useContext(MusicPlayerContext);
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<AudioState>({
    duration: 0,
    playing: false,
    pos: 0,
  });
  const [playingFile, setPlayingFile] = useState("");
  const isStoppingRef = useRef(false);

  // Play mode & playlist
  const [playMode, setPlayModeState] = useState<PlayMode>(() => {
    try {
      const saved = localStorage.getItem("music_playmode");
      return (saved as PlayMode) || "sequential";
    } catch {
      return "sequential";
    }
  });
  const [playlist, setPlaylistState] = useState<string[]>([]);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);

  // Refs for onEnd handler to always read latest values
  const playModeRef = useRef(playMode);
  const playlistRef = useRef(playlist);
  const shuffleOrderRef = useRef(shuffleOrder);
  const playingFileRef = useRef(playingFile);

  useEffect(() => { playModeRef.current = playMode; }, [playMode]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { shuffleOrderRef.current = shuffleOrder; }, [shuffleOrder]);
  useEffect(() => { playingFileRef.current = playingFile; }, [playingFile]);

  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem("music_volume");
      return saved ? parseInt(saved) : 40;
    } catch {
      return 40;
    }
  });

  // Create persistent Audio element - never destroyed during page navigation
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = volume / 100;
    audioRef.current = audio;

    const onDur = () => {
      const d = audio.duration;
      if (isFinite(d) && d > 0) setAudioState(prev => ({ ...prev, duration: d }));
    };
    const onTime = () => setAudioState(prev => ({ ...prev, pos: audio.currentTime }));
    const onPlay = () => setAudioState(prev => ({ ...prev, playing: true }));
    const onPause = () => setAudioState(prev => ({ ...prev, playing: false }));
    const onEnd = () => {
      setAudioState(prev => ({ ...prev, playing: false, pos: 0 }));
      // Auto-advance based on play mode
      const mode = playModeRef.current;
      const list = playlistRef.current;
      const shuff = shuffleOrderRef.current;
      const current = playingFileRef.current;

      if (mode === "stop-after") return;
      if (list.length === 0) return;

      const idx = list.indexOf(current);
      let nextIdx: number;

      if (mode === "shuffle" && shuff.length > 0) {
        const shuffIdx = shuff.indexOf(idx);
        const nextShuffIdx = (shuffIdx + 1) % shuff.length;
        nextIdx = shuff[nextShuffIdx];
      } else {
        // sequential or loop-all: play next, wrap to start
        nextIdx = idx >= 0 && idx < list.length - 1 ? idx + 1 : 0;
      }

      const nextFile = list[nextIdx];
      if (nextFile) {
        setPlayingFile(nextFile);
        playingFileRef.current = nextFile;
        audio.src = window.electronAPI?.python.getFileUrl(nextFile) ?? "";
        audio.play().catch(e => console.error("[Audio] Auto-next failed:", e));
        setAudioState(prev => ({ ...prev, pos: 0 }));
      }
    };
    const onErr = () => {
      if (isStoppingRef.current) {
        isStoppingRef.current = false;
        setAudioState({ duration: 0, playing: false, pos: 0 });
        return;
      }
      console.error("[Audio]", audio.error?.message);
      setAudioState({ duration: 0, playing: false, pos: 0 });
    };

    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onErr);

    return () => {
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onErr);
      audio.pause();
      audio.src = "";
    };
  }, []); // Only on App mount/unmount

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const setPlaylist = useCallback((files: string[]) => {
    setPlaylistState(files);
    playlistRef.current = files;
    if (files.length > 0) {
      const newOrder = shuffleArray(files.map((_, i) => i));
      setShuffleOrder(newOrder);
      shuffleOrderRef.current = newOrder;
    } else {
      setShuffleOrder([]);
      shuffleOrderRef.current = [];
    }
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayModeState(mode);
    playModeRef.current = mode;
    localStorage.setItem("music_playmode", mode);
  }, []);

  const playFile = useCallback((fp: string) => {
    const audio = audioRef.current;
    if (!fp || !audio) return;
    setPlayingFile(fp);
    playingFileRef.current = fp;
    audio.src = window.electronAPI?.python.getFileUrl(fp) ?? "";
    audio.play().catch(e => console.error("[Audio] Play failed:", e));
    setAudioState(prev => ({ ...prev, pos: 0 }));
  }, []);

  const toggle = useCallback((currentSelectedFile?: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    const noSrc = !audio.src || audio.src === window.location.href;
    if (noSrc) {
      if (currentSelectedFile) playFile(currentSelectedFile);
      return;
    }
    if (playingFile && currentSelectedFile && currentSelectedFile !== playingFile) {
      playFile(currentSelectedFile);
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [playingFile, playFile]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    isStoppingRef.current = true;
    audio.pause();
    audio.currentTime = 0;
    audio.src = "";
    setAudioState({ duration: 0, playing: false, pos: 0 });
    setPlayingFile("");
    playingFileRef.current = "";
  }, []);

  // Release file handle without clearing playback state (for file write operations)
  const releaseHandle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
  }, []);


  const playNext = useCallback(() => {
    const list = playlistRef.current;
    const mode = playModeRef.current;
    const shuff = shuffleOrderRef.current;
    const current = playingFileRef.current;

    if (list.length === 0) return;
    const idx = list.indexOf(current);
    let nextIdx: number;

    if (mode === "shuffle" && shuff.length > 0) {
      const shuffIdx = idx >= 0 ? shuff.indexOf(idx) : -1;
      const nextShuffIdx = shuffIdx >= 0 ? (shuffIdx + 1) % shuff.length : 0;
      nextIdx = shuff[nextShuffIdx];
    } else {
      nextIdx = idx >= 0 && idx < list.length - 1 ? idx + 1 : 0;
    }

    const nextFile = list[nextIdx];
    if (nextFile) playFile(nextFile);
  }, [playFile]);

  const playPrev = useCallback(() => {
    const list = playlistRef.current;
    const mode = playModeRef.current;
    const shuff = shuffleOrderRef.current;
    const current = playingFileRef.current;

    if (list.length === 0) return;
    const idx = list.indexOf(current);
    let prevIdx: number;

    if (mode === "shuffle" && shuff.length > 0) {
      const shuffIdx = idx >= 0 ? shuff.indexOf(idx) : -1;
      const prevShuffIdx = shuffIdx > 0 ? shuffIdx - 1 : shuff.length - 1;
      prevIdx = shuff[prevShuffIdx];
    } else {
      prevIdx = idx > 0 ? idx - 1 : list.length - 1;
    }

    const prevFile = list[prevIdx];
    if (prevFile) playFile(prevFile);
  }, [playFile]);

  const seek = useCallback((clientX: number, progressRef: React.RefObject<HTMLDivElement | null>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = audioState.duration || audio.duration || 1;
    const sec = frac * dur;
    audio.currentTime = sec;
    setAudioState(prev => ({ ...prev, pos: sec }));
  }, [audioState.duration]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || audioState.duration || 0));
    audio.currentTime = clamped;
    setAudioState(prev => ({ ...prev, pos: clamped }));
  }, [audioState.duration]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem("music_volume", String(v));
  }, []);

  const fmtTime = useCallback((ms: number) => {
    if (!ms || ms <= 0 || !isFinite(ms)) return "0:00";
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        audioState, playingFile, volume, playMode, playlist,
          playFile, toggle, stop, releaseHandle, seek, seekTo, setVolume,
        setPlaylist, setPlayMode, playNext, playPrev, fmtTime,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}