import { FileAudio, CheckSquare, Square } from "lucide-react";
import { GlassCard, GlassButton, GlassScrollArea, GlassGlow } from "@/design-system/components";
import { fontSizes } from "@/design-system/tokens";
import type { NcmFileListProps } from "./types";

export default function FileList({
  files, selectedFile, selectedIndices,
  onSelect, onToggleSelect, onSelectAll, onDeselectAll,
  ncmFilesLabel, allLabel, noneLabel, filesCountLabel, noFilesLabel,
  bottomInset = 0,
}: NcmFileListProps & { bottomInset?: number }) {
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
        <span>{ncmFilesLabel}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <GlassButton variant="ghost" size="sm" onClick={onSelectAll}>{allLabel}</GlassButton>
          <GlassButton variant="ghost" size="sm" onClick={onDeselectAll}>{noneLabel}</GlassButton>
        </div>
      </div>

      {/* List with top/bottom fade mask */}
      <GlassScrollArea fadeEdges={true} scrollbarGutter={8} style={{ padding: "4px 10px", margin: 0 }}>
          <div style={{ paddingBottom: bottomInset }}>
        {files.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 120, color: "var(--text-tertiary)",
            fontSize: fontSizes.sm, userSelect: "none",
          }}>
            {noFilesLabel}
          </div>
        ) : files.map((file, i) => {
          const isSelected = selectedFile?.filepath === file.filepath;
          const isChecked = selectedIndices.has(i);
          return (
            <GlassGlow
              key={file.filepath}
              glowColor="rgba(255,255,255,0.15)"
              glowRadius={280}
              borderRadius={6}
              style={{ marginBottom: 1 }}
            >
            <div
              onClick={() => onSelect(file, i)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                fontSize: fontSizes.xs,
                background: isSelected ? "var(--accent-bg)" : "transparent",
                color: isSelected ? "var(--accent)" : "var(--text-primary)",
                transition: "background 0.15s ease",
              }}
            >
              <span
                onClick={(e) => { e.stopPropagation(); onToggleSelect(i); }}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                {isChecked
                  ? <CheckSquare size={14} style={{ color: "var(--accent)" }} />
                  : <Square size={14} style={{ color: "var(--text-tertiary)" }} />}
              </span>
              <FileAudio size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1,
              }}>
                {file.filename}
              </span>
            </div>
            </GlassGlow>
          );
        })}
          </div>
      </GlassScrollArea>

      {/* Footer */}
      <div style={{
        padding: "6px 12px", borderTop: "1px solid var(--border-color)",
        fontSize: fontSizes.xs, color: "var(--text-tertiary)", flexShrink: 0,
      }}>
        {files.length} {filesCountLabel}
        {selectedIndices.size > 0 && ` \u00b7 ${selectedIndices.size} selected`}
      </div>
    </GlassCard>
  );
}
