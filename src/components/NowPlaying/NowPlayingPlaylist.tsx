/**
 * NowPlayingPlaylist — 播放列表面板（从窗口右侧向左弹出）
 *
 * 固定尺寸毛玻璃渐变浮窗，从窗口右边缘整体向左滑入（transform/opacity 专属动画）；
 * 点击面板外空白处（document pointerdown）或右上角 X / ESC 关闭；
 * 展示当前播放列表，点击行切换播放。
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ListMusic } from "lucide-react";
import { GlassButton, GlassTooltip, GlassGlow } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";

interface NowPlayingPlaylistProps {
  open: boolean;
  onClose: () => void;
  playlist: string[];
  playingFile: string;
  onPlay: (file: string) => void;
}

const baseName = (file: string) => file.split(/[\\/]/).pop() || file;

const panelS: React.CSSProperties = {
  position: "absolute",
  top: 64,
  right: 24,
  width: "min(340px, 85vw)",
  height: "min(520px, 70vh)",
  maxHeight: "calc(100% - 96px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 18,
  border: "0.5px solid var(--border-strong)",
  background: "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  backdropFilter: "blur(24px) saturate(1.5)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  boxShadow: "0 12px 48px rgba(0,0,0,0.45)",
  overflow: "hidden",
  zIndex: 5,
  transformOrigin: "right center",
  isolation: "isolate",
  willChange: "transform, opacity",
};

export default function NowPlayingPlaylist({ open, onClose, playlist, playingFile, onPlay }: NowPlayingPlaylistProps) {
  const { lang } = useLanguage();
  const zh = lang === "zh";
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // 点击面板外空白处关闭（事件透传，不拦截背后控件；列表按钮除外，避免关后立刻重开）
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest("[data-np-playlist-toggle]")) return;
      if (panelRef.current && !panelRef.current.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open, onClose]);

  // 打开或切换曲目时，将当前播放行滚入可视区
  // 直接操作列表 scrollTop，避免 scrollIntoView 滚动祖先容器带动整窗左右跳动
  // 行外层 GlassGlow 是 position: relative，offsetTop 相对它（≈0）而非滚动列表，
  // 因此改用 getBoundingClientRect 差值计算行在列表内的实际位置。
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const row = currentRef.current;
    if (list && row) {
      const listRect = list.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const rowTopInList = rowRect.top - listRect.top + list.scrollTop;
      list.scrollTop = Math.max(0, rowTopInList - list.clientHeight / 2 + rowRect.height / 2);
    }
  }, [open, playingFile, playlist.length]);

  // 焦点还原：面板关闭后恢复焦点到打开前的元素
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus?.();
      prevFocusRef.current = null;
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="np-playlist"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={zh ? "播放列表" : "Playlist"}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          style={panelS}
        >
          {/* 头部 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 10px 18px", flexShrink: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              <ListMusic size={17} />
              {zh ? "播放列表" : "Playlist"}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>{playlist.length}</span>
            </span>
            <GlassButton
              variant="ghost"
              size="sm"
              noAnimation
              aria-label={zh ? "关闭播放列表" : "Close playlist"}
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                minWidth: 28,
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              <X size={15} />
            </GlassButton>
          </div>

          {/* 列表 */}
          <div ref={listRef} style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 8px 16px 10px" }}>
            {playlist.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 13, color: "var(--text-tertiary)" }}>
                {zh ? "当前播放列表为空" : "Playlist is empty"}
              </div>
            ) : (
              playlist.map((file, i) => {
                const isCurrent = file === playingFile;
                return (
                  <GlassTooltip
                    key={`${file}\u0000${i}`}
                    text={baseName(file)}
                    placement="left"
                    style={{ display: "flex" }}
                  >
                  <GlassGlow
                    glowColor="var(--np-row-glow)"
                    glowRadius={220}
                    borderRadius={8}
                    style={{ flex: 1, width: "100%", borderRadius: 8 }}
                  >
                  <button
                    ref={isCurrent ? currentRef : undefined}
                    className={`np-playlist-row${isCurrent ? " current" : ""}`}
                    onClick={() => onPlay(file)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 10px",
                      marginBottom: 2,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        flexShrink: 0,
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                      }}
                      className={isCurrent ? "np-playlist-index-current" : "np-playlist-index"}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                      {baseName(file)}
                    </span>
                    {isCurrent && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                    )}
                  </button>
                  </GlassGlow>
                  </GlassTooltip>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
