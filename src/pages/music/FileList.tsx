import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Music, Search, X, Volume2, Disc } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, GlassScrollArea, GlassInput, GlassTooltip } from "@/design-system/components";
import { springSmooth } from "@/design-system/animations";
import { fontSizes, space, radii } from "@/design-system/tokens";
import type { FileListProps } from "./types";

function updateItemGlow(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = ((cx - r.left) / r.width) * 100;
  const py = ((cy - r.top) / r.height) * 100;
  el.style.setProperty("--btn-gx", px + "%");
  el.style.setProperty("--btn-gy", py + "%");
  el.style.setProperty("--btn-go", "1");
}

function clearItemGlow(el: HTMLElement) {
  el.style.setProperty("--btn-go", "0");
}

function ItemGlow() {
  return (
    <>
      {/* 顶部菲涅尔高光弧 (跟随鼠标 X 轴顶部透镜反光) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.42)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.01) 70%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 1,
          opacity: "calc(var(--btn-go, 0) * 0.70)",
          transition: "opacity 0.25s ease",
        }}
      />
      {/* 边缘微色散菲涅尔描边 (跟随鼠标光标移动的 1px 反光边框) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          padding: 1,
          zIndex: 1,
          background: "var(--glass-dispersion-rim)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
          opacity: "calc(var(--btn-go, 0) * 0.85)",
          transition: "opacity 0.25s ease",
        }}
      />
      {/* 鼠标跟随聚焦高光斑 (Spotlight Specular) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background: `radial-gradient(130px circle at var(--btn-gx, 50%) var(--btn-gy, 50%), rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.15) 35%, transparent 70%)`,
          opacity: "var(--btn-go, 0)",
          transition: "opacity 0.25s ease-out",
          borderRadius: "inherit",
        }}
      />
      {/* 鼠标跟随漫射光晕 (Diffuse Flare) */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background: `radial-gradient(320px circle at var(--btn-gx, 50%) var(--btn-gy, 50%), var(--glass-fresnel-soft, rgba(255,255,255,0.25)) 0%, transparent 60%)`,
          opacity: "var(--btn-go, 0)",
          transition: "opacity 0.35s ease-out",
          borderRadius: "inherit",
        }}
      />
    </>
  );
}

export default function FileList({
  files, selectedFile, playingFile,
  onSelect, onPlay,
  audioFilesLabel, noFilesLabel, filesCountLabel,
  listRef,
  searchPlaceholder,
  locateTrackLabel,
}: FileListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isTargetVisible, setIsTargetVisible] = useState(true);
  const scrollAnimRef = useRef<number | null>(null);

  const targetFile = selectedFile || playingFile;

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase().trim();
    return files.filter(fp => {
      const name = fp.split("\\").pop() || fp;
      return name.toLowerCase().includes(q);
    });
  }, [files, searchQuery]);

  // Check whether the active target file is currently in view
  const checkTargetVisibility = useCallback(() => {
    const container = listRef.current;
    if (!container || !targetFile) {
      setIsTargetVisible(true);
      return;
    }

    let el: HTMLElement | null = null;
    try {
      el = container.querySelector(`[data-filepath="${CSS.escape(targetFile)}"]`);
    } catch {
      const items = container.querySelectorAll<HTMLElement>("[data-filepath]");
      for (let i = 0; i < items.length; i++) {
        if (items[i].getAttribute("data-filepath") === targetFile) {
          el = items[i];
          break;
        }
      }
    }

    if (!el) {
      // If the target file is filtered out by search or not in DOM
      setIsTargetVisible(true);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Check if element is mostly within visible vertical range of the container
    const elHeight = elRect.height || 30;
    const inView = (
      elRect.bottom >= containerRect.top + elHeight * 0.5 &&
      elRect.top <= containerRect.bottom - elHeight * 0.5
    );

    setIsTargetVisible(inView);
  }, [targetFile, listRef]);

  // Listen to list scroll and resize to update visibility
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkTargetVisibility();
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    checkTargetVisibility();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        checkTargetVisibility();
      });
      ro.observe(container);
    }

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
    };
  }, [checkTargetVisibility, listRef, filteredFiles]);

  // Smooth scroll target file into vertical center
  const scrollToTarget = useCallback(() => {
    const target = targetFile;
    const container = listRef.current;
    if (!target || !container) return;

    let el: HTMLElement | null = null;
    try {
      el = container.querySelector(`[data-filepath="${CSS.escape(target)}"]`);
    } catch {
      const items = container.querySelectorAll<HTMLElement>("[data-filepath]");
      for (let i = 0; i < items.length; i++) {
        if (items[i].getAttribute("data-filepath") === target) {
          el = items[i];
          break;
        }
      }
    }
    if (!el) return;

    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    const cs = getComputedStyle(container);
    const padTop = parseFloat(cs.paddingTop) || 0;

    const visualTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const contentOffset = visualTop + container.scrollTop - padTop;
    const targetScroll = contentOffset - container.clientHeight / 2 + el.getBoundingClientRect().height / 2;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const clamped = Math.max(0, Math.min(Math.round(targetScroll), maxScroll));

    const startScroll = container.scrollTop;
    const distance = clamped - startScroll;

    if (Math.abs(distance) < 2) {
      checkTargetVisibility();
      return;
    }

    const duration = Math.min(320, Math.max(120, Math.abs(distance) * 0.35));
    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const cancelOnWheel = () => {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
      container.removeEventListener("wheel", cancelOnWheel);
    };
    container.addEventListener("wheel", cancelOnWheel, { passive: true });

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollTop = Math.round(startScroll + distance * easeOutCubic(progress));

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(animate);
      } else {
        container.scrollTop = clamped;
        scrollAnimRef.current = null;
        container.removeEventListener("wheel", cancelOnWheel);
        checkTargetVisibility();
      }
    };

    scrollAnimRef.current = requestAnimationFrame(animate);
  }, [targetFile, listRef, checkTargetVisibility]);

  return (
    <GlassCard style={{
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      padding: 0,
      minHeight: 0,
    }}>
      {/* Header with Title, Count Badge, and Search Filter */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-color)",
        flexShrink: 0,
        gap: space[2],
      }}>
        {/* Left: Title + Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          <span style={{ fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-primary)" }}>
            {audioFilesLabel}
          </span>
          {files.length > 0 && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "1px 7px",
              borderRadius: radii.full,
              background: "rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-color)",
            }}>
              {searchQuery.trim() ? `${filteredFiles.length} / ${files.length}` : files.length}
            </span>
          )}
        </div>

        {/* Right: Search Filter Input */}
        {files.length > 0 && (
          <div style={{ position: "relative", width: 170, maxWidth: "50%" }}>
            <GlassInput
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder || "搜索..."}
              style={{
                fontSize: fontSizes.xs,
                padding: "3px 22px 3px 24px",
                height: 26,
                borderRadius: radii.full,
              }}
            />
            <Search
              size={12}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* List with top/bottom fade mask */}
      <GlassScrollArea
        ref={listRef}
        fadeEdges={true}
        scrollbarGutter={8}
        style={{
          flex: 1,
          padding: "4px 10px",
          margin: 0,
          minHeight: 0,
        }}
      >
        <div style={{ paddingBottom: 28 }}>
        {files.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flex: 1, minHeight: 200, color: "var(--text-tertiary)",
            fontSize: fontSizes.sm, userSelect: "none",
          }}>
            {noFilesLabel}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flex: 1, minHeight: 180, color: "var(--text-tertiary)",
            fontSize: fontSizes.xs, userSelect: "none",
          }}>
            无匹配歌曲
          </div>
        ) : filteredFiles.map((fp: string) => {
          const fullName = fp.split("\\").pop() || fp;
          const dotIndex = fullName.lastIndexOf(".");
          const name = dotIndex > 0 ? fullName.substring(0, dotIndex) : fullName;
          const ext = dotIndex > 0 ? fullName.substring(dotIndex + 1).toUpperCase() : "";
          const isSelected = fp === selectedFile;
          const isPlaying = fp === playingFile;

          const isLossless = ["FLAC", "WAV", "APE", "ALAC", "DSF", "DFF"].includes(ext);

          return (
            <div
              key={fp}
              className={`music-file-item${isSelected ? " selected" : ""}`}
              data-filepath={fp}
              onClick={() => onSelect(fp)}
              onDoubleClick={() => onPlay(fp)}
              onMouseMove={(e) => updateItemGlow(e.currentTarget, e.clientX, e.clientY)}
              onMouseEnter={(e) => updateItemGlow(e.currentTarget, e.clientX, e.clientY)}
              onMouseLeave={(e) => clearItemGlow(e.currentTarget)}
              style={{
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: space[2],
                padding: "7px 14px",
                borderRadius: 9999,
                cursor: "pointer",
                fontSize: fontSizes.xs,
                background: isSelected ? "var(--glass-vision-active)" : "transparent",
                color: isPlaying ? "var(--accent)" : "var(--text-primary)",
                boxShadow: isSelected ? "var(--glass-vision-shadow)" : "none",
                transition: "background 0.15s ease, box-shadow 0.15s ease",
                marginBottom: 2,
                "--btn-go": "0",
                "--btn-gx": "50%",
                "--btn-gy": "50%",
              } as React.CSSProperties}
            >
              {/* Left: Icon + Title (zIndex: 2) */}
              <div style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
                flex: 1,
              }}>
                {isPlaying ? (
                  <Volume2
                    size={14}
                    style={{
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Music
                    size={13}
                    style={{
                      color: "var(--text-tertiary)",
                      opacity: isSelected ? 0.75 : 0.45,
                      flexShrink: 0,
                      transition: "opacity 0.15s ease",
                    }}
                  />
                )}
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: isPlaying ? 600 : (isSelected ? 500 : 400),
                  color: isPlaying ? "var(--accent)" : "var(--text-primary)",
                  transition: "color 0.15s ease",
                }}>
                  {name}
                </span>
              </div>

              {/* Right: Audio Format Badge (zIndex: 2) */}
              {ext && (
                <span style={{
                  position: "relative",
                  zIndex: 2,
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  padding: "1.5px 7px",
                  borderRadius: radii.full,
                  background: isLossless
                    ? "rgba(var(--accent-rgb, 59, 130, 246), 0.16)"
                    : "rgba(255,255,255,0.06)",
                  color: isLossless
                    ? "var(--accent)"
                    : "var(--text-tertiary)",
                  border: `1px solid ${isLossless ? "rgba(var(--accent-rgb, 59, 130, 246), 0.3)" : "rgba(255,255,255,0.08)"}`,
                }}>
                  {ext}
                </span>
              )}

              {/* GlassButton 同款鼠标跟随光晕与描边 (zIndex: 1) */}
              <ItemGlow />
            </div>
          );
        })}
        </div>
      </GlassScrollArea>

      {/* Footer */}
      <div style={{
        padding: "6px 14px",
        borderTop: "1px solid var(--border-color)",
        fontSize: fontSizes.xs,
        color: "var(--text-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span>{files.length} {filesCountLabel}</span>
        {playingFile && (
          <span style={{
            fontSize: 11,
            color: "var(--accent)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "60%",
          }}>
            正在播放: {playingFile.split("\\").pop()}
          </span>
        )}
      </div>

      {/* Floating Center / Locate Track Button */}
      <AnimatePresence>
        {!isTargetVisible && Boolean(targetFile) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              right: 14,
              bottom: 40,
              zIndex: 30,
            }}
          >
            <GlassTooltip text={locateTrackLabel || "定位到当前曲目"}>
              <motion.button
                type="button"
                onClick={() => {
                  if (targetFile && targetFile !== selectedFile) {
                    onSelect(targetFile);
                  }
                  scrollToTarget();
                }}
                whileHover={{
                  scale: 1.08,
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.22), 0 0 16px rgba(var(--accent-rgb, 59, 130, 246), 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                  borderColor: "rgba(255, 255, 255, 0.38)",
                }}
                whileTap={{
                  scale: 0.94,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.16), 0 0 6px rgba(var(--accent-rgb, 59, 130, 246), 0.2)",
                }}
                transition={springSmooth}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radii.full,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.10) 100%), rgba(var(--accent-rgb, 59, 130, 246), 0.12)",
                  backdropFilter: "blur(24px) saturate(2)",
                  WebkitBackdropFilter: "blur(24px) saturate(2)",
                  border: "1px solid rgba(255, 255, 255, 0.24)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18), 0 0 10px rgba(var(--accent-rgb, 59, 130, 246), 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
                  color: "var(--accent)",
                  cursor: "pointer",
                  outline: "none",
                  padding: 0,
                }}
              >
                <Disc size={15} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
              </motion.button>
            </GlassTooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
