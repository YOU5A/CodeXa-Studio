import { Music, Image, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassCard, GlassToggle } from "@/design-system/components";
import { fontSizes } from "@/design-system/tokens";
import type { NcmMetadataPanelProps } from "./types";

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + ":" + sec.toString().padStart(2, "0");
}

export default function MetadataPanel({
  info, writeTags, onWriteTagsChange,
  metadataLabel, noMetadataText, titleLabel, artistLabel, albumLabel,
  formatLabel, durationLabel, writeTagsLabel,
  selectedPath, loading,
}: NcmMetadataPanelProps) {
  const coverBase64 = info?.coverBase64 as string | undefined;
  const hasInfo = Boolean(info && !info.error);
  const activeKey = selectedPath || (hasInfo ? `${info?.title}-${info?.artist}` : (info?.error ? "error" : (loading ? "loading" : "empty")));

  return (
    <GlassCard style={{ padding: 0, alignSelf: "flex-start", maxWidth: "100%", width: "100%", overflow: "hidden" }}>
      {/* Header - Always static */}
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--border-color)",
        fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Music size={14} />
          <span>{metadataLabel}</span>
        </div>
        {loading && (
          <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)", opacity: 0.8 }} />
        )}
      </div>

      {/* Dynamic Content Area */}
      <div style={{ position: "relative", minHeight: 104 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {hasInfo ? (
            <motion.div
              key={activeKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{ padding: 12 }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                {/* Cover preview */}
                {coverBase64 ? (
                  <img
                    src={"data:image/jpeg;base64," + coverBase64}
                    alt="Cover"
                    decoding="async"
                    loading="eager"
                    style={{
                      width: 80, height: 80, borderRadius: 8,
                      objectFit: "cover", flexShrink: 0,
                      border: "1px solid var(--border-color)",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: 8, flexShrink: 0,
                    background: "var(--surface-bg)", border: "1px solid var(--border-color)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Image size={24} style={{ color: "var(--text-tertiary)" }} />
                  </div>
                )}

                {/* Metadata grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "auto 1fr",
                  gap: "6px 12px", fontSize: fontSizes.xs, flex: 1, minWidth: 0,
                  alignItems: "start",
                }}>
                  <span style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}>{titleLabel}:</span>
                  <span
                    title={info?.title || ""}
                    style={{ color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-word", lineHeight: 1.4 }}
                  >
                    {info?.title || "-"}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}>{artistLabel}:</span>
                  <span
                    title={info?.artist || ""}
                    style={{ color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.4 }}
                  >
                    {info?.artist || "-"}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}>{albumLabel}:</span>
                  <span
                    title={info?.album || ""}
                    style={{ color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.4 }}
                  >
                    {info?.album || "-"}
                  </span>

                  {info?.duration > 0 && (
                    <>
                      <span style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}>{durationLabel}:</span>
                      <span style={{ color: "var(--text-primary)", lineHeight: 1.4 }}>
                        {fmtDuration(info.duration)}
                      </span>
                    </>
                  )}

                  <span style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}>{formatLabel}:</span>
                  <span style={{
                    color: "var(--text-primary)", fontSize: fontSizes.xs,
                    background: "var(--glass-vision-active)", padding: "1px 6px",
                    borderRadius: 4, display: "inline-block", width: "fit-content",
                    boxShadow: "0 0 0 1px var(--glass-vision-border)",
                  }}>
                    {info?.format || "?"}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : selectedPath && loading ? (
            <motion.div
              key="loading-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                padding: 12, display: "flex", gap: 12, alignItems: "center",
              }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: 8, flexShrink: 0,
                background: "var(--surface-bg-hover)", border: "1px solid var(--border-color)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0.5,
              }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ height: 14, width: "60%", background: "var(--surface-bg-hover)", borderRadius: 4, opacity: 0.6 }} />
                <div style={{ height: 12, width: "40%", background: "var(--surface-bg-hover)", borderRadius: 4, opacity: 0.4 }} />
                <div style={{ height: 12, width: "50%", background: "var(--surface-bg-hover)", borderRadius: 4, opacity: 0.4 }} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={info?.error ? "error" : "empty"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{
                padding: 24, textAlign: "center",
                color: "var(--text-tertiary)", fontSize: fontSizes.sm,
              }}
            >
              {info?.error ? info.error : noMetadataText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Write tags toggle - Static Footer */}
      {(hasInfo || selectedPath) && (
        <div style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border-color)",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <GlassToggle active={writeTags} onChange={onWriteTagsChange} size="sm" />
          <span style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)" }}>
            {writeTagsLabel}
          </span>
        </div>
      )}
    </GlassCard>
  );
}