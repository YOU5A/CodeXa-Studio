import { motion, AnimatePresence } from "framer-motion";
import { Music, ChevronUp, Globe, Image, Save, Trash2 } from "lucide-react";
import { GlassCard, GlassButton, radii, space } from "@/design-system";
import type { CoverManagerProps } from "./types";

export default function CoverManager(props: CoverManagerProps) {
  const {
    coverB64, coverPreviewB64, coverMenuOpen, coverMenuHover,
    setCoverMenuOpen, setCoverMenuHover, setCoverSearchOpen,
    pickCover, applyCover, saveCover, removeCover, tx,
  } = props;

  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: space[3] }}>
      <GlassCard style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: "100%", aspectRatio: "1",
          background: "var(--bg-tertiary)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {coverB64 ? (
            <img src={`data:image/jpeg;base64,${coverB64}`} alt="Cover"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Music size={48} style={{ color: "var(--text-tertiary)", opacity: 0.25 }} />
          )}
        </div>
        <button
          onClick={() => setCoverMenuOpen(v => !v)}
          onMouseEnter={() => setCoverMenuHover(true)}
          onMouseLeave={() => setCoverMenuHover(false)}
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 34,
            height: 22,
            borderRadius: 11,
            border: "1px solid rgba(255,255,255,0.10)",
            background: coverMenuHover ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)",
            backdropFilter: "blur(14px) saturate(1.6)",
            WebkitBackdropFilter: "blur(14px) saturate(1.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: coverMenuHover
              ? "0 0 22px rgba(255,255,255,0.22), 0 0 44px rgba(255,255,255,0.08)"
              : coverMenuOpen
                ? "0 0 18px rgba(255,255,255,0.14), 0 0 36px rgba(255,255,255,0.05)"
                : "0 0 12px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.02)",
            transition: "background 0.2s ease, box-shadow 0.3s ease",
            padding: 0,
            outline: "none",
            zIndex: 1,
          }}
        >
          <motion.div
            animate={{ rotate: coverMenuOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.75)" }} />
          </motion.div>
        </button>
      </GlassCard>

      <AnimatePresence>
        {coverMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}
          >
            <GlassButton variant="secondary" size="sm" inline={false} onClick={() => setCoverSearchOpen(true)}
              style={{ justifyContent: "center" }}>
              <Globe size={12} /> {tx.searchCover}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" inline={false} onClick={pickCover}
              style={{ justifyContent: "center" }}>
              <Image size={12} /> {tx.selectCover}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" inline={false} onClick={applyCover}
              style={{ justifyContent: "center" }}>
              {tx.applyCover}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" inline={false} onClick={saveCover}
              style={{ justifyContent: "center" }}>
              <Save size={12} /> {tx.saveCover}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" inline={false} onClick={removeCover}
              style={{ justifyContent: "center" }}>
              <Trash2 size={12} /> {tx.removeCover}
            </GlassButton>
          </motion.div>
        )}
      </AnimatePresence>

      {coverPreviewB64 && (
        <GlassCard style={{ padding: 0, overflow: "hidden" }}>
          <img src={`data:image/jpeg;base64,${coverPreviewB64}`} alt="Cover Preview"
            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: radii.lg }} />
        </GlassCard>
      )}
    </div>
  );
}
