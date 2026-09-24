import { FileAudio, CheckSquare, Square } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassCard, GlassButton, GlassScrollArea } from "@/design-system/components";
import { fontSizes } from "@/design-system/tokens";
import type { NcmFileListProps } from "./types";

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
          background: `radial-gradient(220px 32px at var(--btn-gx, 50%) 0%, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.08) 55%, transparent 100%)`,
          pointerEvents: "none",
          zIndex: 1,
          opacity: "var(--btn-go, 0)",
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
          background: `radial-gradient(180px circle at var(--btn-gx, 50%) var(--btn-gy, 50%), var(--glass-fresnel-rim, rgba(255, 255, 255, 0.65)) 0%, var(--glass-fresnel-soft, rgba(255, 255, 255, 0.25)) 35%, rgba(255, 255, 255, 0.06) 65%, transparent 80%)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
          opacity: "var(--btn-go, 0)",
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
        ) : (
          <AnimatePresence mode="popLayout">
            {files.map((file, i) => {
          const isSelected = selectedFile?.filepath === file.filepath;
          const isChecked = selectedIndices.has(i);
          return (
            <motion.div
              key={file.filepath}
              initial={{ opacity: 0, filter: "blur(6px)", y: -4 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(6px)", y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
            <div
              className={`music-file-item${isSelected ? " selected" : ""}`}
              onClick={() => onSelect(file, i)}
              onMouseMove={(e) => updateItemGlow(e.currentTarget, e.clientX, e.clientY)}
              onMouseEnter={(e) => updateItemGlow(e.currentTarget, e.clientX, e.clientY)}
              onMouseLeave={(e) => clearItemGlow(e.currentTarget)}
              style={{
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9999,
                cursor: "pointer",
                fontSize: fontSizes.xs,
                background: isSelected ? "var(--glass-vision-active)" : "transparent",
                color: "var(--text-primary)",
                boxShadow: isSelected ? "var(--glass-vision-shadow)" : "none",
                transition: "background 0.15s ease, box-shadow 0.15s ease",
                marginBottom: 2,
                "--btn-go": "0",
                "--btn-gx": "50%",
                "--btn-gy": "50%",
              } as React.CSSProperties}
            >
              <span
                onClick={(e) => { e.stopPropagation(); onToggleSelect(i); }}
                style={{ position: "relative", zIndex: 2, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                {isChecked
                  ? <CheckSquare size={14} style={{ color: "var(--accent)" }} />
                  : <Square size={14} style={{ color: "var(--text-tertiary)" }} />}
              </span>
              <FileAudio size={12} style={{ position: "relative", zIndex: 2, color: "var(--text-tertiary)", flexShrink: 0 }} />
              <span style={{
                position: "relative",
                zIndex: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}>
                {file.filename}
              </span>

              {/* GlassButton 同款鼠标跟随光晕与描边 (zIndex: 1) */}
              <ItemGlow />
            </div>
            </motion.div>
          );
        })}
          </AnimatePresence>
        )}
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
