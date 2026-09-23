import { useState, useLayoutEffect, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, ChevronUp, Globe, Image, Save, Trash2, Check, X } from "lucide-react";
import { GlassCard, GlassButton, GlassTooltip } from "@/design-system/components";
import { radii, space, fontSizes } from "@/design-system/tokens";
import type { CoverManagerProps } from "./types";

export default function CoverManager(props: CoverManagerProps) {
  const {
    coverB64,
    coverPreviewB64,
    coverRef,
    setCoverSearchOpen,
    pickCover,
    applyCover,
    cancelCover,
    saveCover,
    removeCover,
    newCoverPath,
    hasSelectedFile = true,
    tx,
    lang = "zh",
  } = props;

  const displayCover = coverPreviewB64 || coverB64;
  const isPreviewing = Boolean(coverPreviewB64 && coverPreviewB64 !== coverB64);

  const [menuOpen, setMenuOpen] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  // 当选择本地新封面时，自动展开菜单让用户能点击“应用新封面”
  const prevNewCoverPath = useRef(newCoverPath);
  useEffect(() => {
    if (newCoverPath && newCoverPath !== prevNewCoverPath.current) {
      setMenuOpen(true);
    }
    prevNewCoverPath.current = newCoverPath;
  }, [newCoverPath]);

  // Blur transition on expand/collapse — instant blur then smooth clear
  const buttonsRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(menuOpen);
  useLayoutEffect(() => {
    if (prevOpen.current === menuOpen) return;
    prevOpen.current = menuOpen;
    const el = buttonsRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.filter = "blur(6px)";
    void el.offsetHeight;
    el.style.transition = "filter 0.35s ease";
    el.style.filter = "blur(0px)";
  }, [menuOpen]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: space[2], alignItems: "center" }}>
      {/* Cover Image Container */}
      <GlassCard
        ref={coverRef}
        style={{
          width: "100%",
          maxWidth: 240,
          aspectRatio: "1",
          padding: 0,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.xl,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {coverB64 ? (
          <img
            src={`data:image/jpeg;base64,${coverB64}`}
            alt="Cover"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: space[2], color: "var(--text-tertiary)",
          }}>
            <Music size={52} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: fontSizes.xs, opacity: 0.6 }}>
              {tx.coverOps || "封面"}
            </span>
          </div>
        )}

        {/* 展开/收起胶囊按钮 */}
        <div style={{
          position: "absolute",
          bottom: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
        }}>
          <GlassTooltip text={menuOpen ? (tx.collapse || "收起封面操作") : (tx.coverOps || "封面操作")}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              aria-label="Toggle cover operations"
              style={{
                width: 34,
                height: 22,
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.10)",
                background: btnHover ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)",
                backdropFilter: "blur(14px) saturate(1.6)",
                WebkitBackdropFilter: "blur(14px) saturate(1.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: btnHover
                  ? "0 0 22px rgba(255,255,255,0.22), 0 0 44px rgba(255,255,255,0.08)"
                  : menuOpen
                    ? "0 0 18px rgba(255,255,255,0.14), 0 0 36px rgba(255,255,255,0.05)"
                    : "0 0 12px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.02)",
                transition: "background 0.2s ease, box-shadow 0.3s ease",
                padding: 0,
                outline: "none",
              }}
            >
              <motion.div
                animate={{ rotate: menuOpen ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.75)" }} />
              </motion.div>
            </button>
          </GlassTooltip>
        </div>
      </GlassCard>

      {/* Expandable Action Buttons Toolbar with Smooth Exit/Enter Animation */}
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            key="cover-actions-panel"
            ref={buttonsRef}
            initial={{ opacity: 0, height: 0, scale: 0.96 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.96 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: "100%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "2px 2px",
            }}
          >
            {/* Row 1: Search & Pick */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2], width: "100%" }}>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => setCoverSearchOpen(true)}
                disabled={!hasSelectedFile}
                style={{ justifyContent: "center", fontSize: fontSizes.xs }}
              >
                <Globe size={13} style={{ marginRight: 4 }} />
                {tx.searchCover}
              </GlassButton>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={pickCover}
                disabled={!hasSelectedFile}
                style={{ justifyContent: "center", fontSize: fontSizes.xs }}
              >
                <Image size={13} style={{ marginRight: 4 }} />
                {tx.selectCover}
              </GlassButton>
            </div>

            {/* Row 2: Secondary / Conditional Actions */}
            {newCoverPath ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2], width: "100%" }}>
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={applyCover}
                  style={{ justifyContent: "center", fontSize: fontSizes.xs }}
                >
                  <Check size={13} style={{ marginRight: 4 }} />
                  {tx.applyCover}
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={cancelCover}
                  style={{ justifyContent: "center", fontSize: fontSizes.xs }}
                >
                  <X size={13} style={{ marginRight: 4 }} />
                  {lang === "zh" ? "取消" : "Cancel"}
                </GlassButton>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[2], width: "100%" }}>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={saveCover}
                  disabled={!coverB64}
                  style={{ justifyContent: "center", fontSize: fontSizes.xs }}
                >
                  <Save size={13} style={{ marginRight: 4 }} />
                  {tx.saveCover}
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={removeCover}
                  disabled={!coverB64 || !hasSelectedFile}
                  style={{
                    justifyContent: "center",
                    fontSize: fontSizes.xs,
                    color: coverB64 ? "var(--accent-red, #ff5555)" : undefined,
                  }}
                >
                  <Trash2 size={13} style={{ marginRight: 4 }} />
                  {tx.removeCover}
                </GlassButton>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
