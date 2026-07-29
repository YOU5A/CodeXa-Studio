import { Music, Image } from "lucide-react";
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
}: NcmMetadataPanelProps) {
  const coverBase64 = info?.coverBase64 as string | undefined;

  return (
    <GlassCard style={{ padding: 0, alignSelf: "flex-start", maxWidth: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--border-color)",
        fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
      }}>
        <Music size={14} />
        <span>{metadataLabel}</span>
      </div>

      <AnimatePresence mode="wait">
        {info && !info.error ? (
        <motion.div
          key="meta"
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ padding: 12 }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {/* Cover preview */}
            {coverBase64 ? (
              <img
                src={"data:image/jpeg;base64," + coverBase64}
                alt="Cover"
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
              gap: "4px 12px", fontSize: fontSizes.xs, flex: 1,
            }}>
              <span style={{ color: "var(--text-tertiary)" }}>{titleLabel}:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                {info?.title || "-"}
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>{artistLabel}:</span>
              <span style={{ color: "var(--text-primary)" }}>
                {info?.artist || "-"}
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>{albumLabel}:</span>
              <span style={{ color: "var(--text-primary)" }}>
                {info?.album || "-"}
              </span>

              {info?.duration > 0 && (
                <>
                  <span style={{ color: "var(--text-tertiary)" }}>{durationLabel}:</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {fmtDuration(info.duration)}
                  </span>
                </>
              )}

              <span style={{ color: "var(--text-tertiary)" }}>{formatLabel}:</span>
              <span style={{
                color: "var(--accent)", fontSize: fontSizes.xs,
                background: "var(--accent-bg-fade)", padding: "1px 6px",
                borderRadius: 4, display: "inline-block", width: "fit-content",
              }}>
                {info?.format || "?"}
              </span>
            </div>
          </div>

          {/* Write tags toggle */}
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px solid var(--border-color)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <GlassToggle active={writeTags} onChange={onWriteTagsChange} size="sm" />
            <span style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)" }}>
              {writeTagsLabel}
            </span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
          padding: 24, textAlign: "center",
          color: "var(--text-tertiary)", fontSize: fontSizes.sm,
        }}>
          {info?.error ? info.error : noMetadataText}
        </motion.div>
      )}
      </AnimatePresence>
    </GlassCard>
  );
}