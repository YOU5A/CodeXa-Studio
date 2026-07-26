import { Music } from "lucide-react";
import { GlassCard } from "@/design-system/components";
import { space, fontSizes } from "@/design-system/tokens";
import type { FileListProps } from "./types";

export default function FileList(props: FileListProps) {
  const { files, selectedFile, playingFile, onSelect, onPlay, listRef } = props;

  return (
    <GlassCard style={{ flex: 1, minHeight: 0, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        ref={listRef}
        className="music-file-list-scroll scroll-fade-edge"
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          padding: `${space[2]}px 0`,
        }}
      >
        {files.map((fp: string) => {
          const name = fp.split("\\").pop() || fp;
          const isSelected = fp === selectedFile;
          const isPlaying = fp === playingFile;
          return (
            <div
              key={fp}
              data-filepath={fp}
              onClick={() => onSelect(fp)}
              onDoubleClick={() => onPlay(fp)}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
                el.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`);
                el.style.setProperty("--go", "1");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.setProperty("--go", "0");
              }}
              style={{
                padding: `${space[2]}px ${space[4]}px`,
                cursor: "pointer",
                fontSize: fontSizes.sm,
                color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                background: isSelected
                  ? "rgba(var(--accent-rgb, 99,102,241), 0.12)"
                  : "rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px) saturate(1.2)",
                WebkitBackdropFilter: "blur(8px) saturate(1.2)",
                borderLeft: isPlaying ? "3px solid var(--accent)" : "3px solid transparent",
                display: "flex", alignItems: "center", gap: space[2],
                position: "relative", overflow: "hidden",
                transition: "background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
              }}
            >
              <span style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(var(--accent-rgb, 99,102,241), 0.15) 0%, transparent 60%)",
                opacity: "var(--go, 0)",
                transition: "opacity 0.25s ease",
              }} />
              <Music size={12} style={{ position: "relative", zIndex: 1 }} />
              <span style={{
                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                position: "relative", zIndex: 1,
              }}>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
