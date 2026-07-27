import { Music } from "lucide-react";
import { GlassCard, GlassScrollArea, GlassGlow } from "@/design-system/components";
import { fontSizes } from "@/design-system/tokens";
import type { FileListProps } from "./types";

export default function FileList({
  files, selectedFile, playingFile,
  onSelect, onPlay,
  audioFilesLabel, noFilesLabel, filesCountLabel,
  listRef,
}: FileListProps) {
  return (
    <GlassCard style={{
      minHeight: "200px", maxHeight: "100%", display: "flex", flexDirection: "column",
      overflow: "hidden", padding: 0,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderBottom: "1px solid var(--border-color)",
        fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-secondary)",
        flexShrink: 0,
      }}>
        <span>{audioFilesLabel}</span>
      </div>

      {/* List with top/bottom fade mask */}
      <GlassScrollArea ref={listRef} fadeEdges={true} scrollbarGutter={8} style={{ padding: "4px 10px", margin: 0 }}>
        {files.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 120, color: "var(--text-tertiary)",
            fontSize: fontSizes.sm, userSelect: "none",
          }}>
            {noFilesLabel}
          </div>
        ) : files.map((fp: string) => {
          const name = fp.split("\\").pop() || fp;
          const isSelected = fp === selectedFile;
          const isPlaying = fp === playingFile;
          return (
            <GlassGlow
              key={fp}
              glowColor="rgba(255,255,255,0.15)"
              glowRadius={280}
              borderRadius={6}
              style={{ marginBottom: 1 }}
            >
              <div
                data-filepath={fp}
                onClick={() => onSelect(fp)}
                onDoubleClick={() => onPlay(fp)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                  fontSize: fontSizes.xs,
                  background: isSelected ? "var(--accent-bg-fade)" : "transparent",
                  color: isSelected ? "var(--accent)" : "var(--text-primary)",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {isPlaying ? (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 7, height: 7, flexShrink: 0 }} />
                )}
                <Music size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flex: 1,
                }}>
                  {name}
                </span>
              </div>
            </GlassGlow>
          );
        })}
      </GlassScrollArea>

      {/* Footer */}
      <div style={{
        padding: "6px 12px", borderTop: "1px solid var(--border-color)",
        fontSize: fontSizes.xs, color: "var(--text-tertiary)", flexShrink: 0,
      }}>
        {files.length} {filesCountLabel}
      </div>
    </GlassCard>
  );
}
