import { Save, X, Edit3, Layers } from "lucide-react";
import { GlassButton, GlassInput, GlassTooltip } from "@/design-system/components";
import { space, fontSizes, radii } from "@/design-system/tokens";
import type { TagEditorProps } from "./types";

export default function TagEditor(props: TagEditorProps) {
  const {
    tagTitle, tagArtist, tagAlbum, tagYear, tagGenre,
    saving, selectedFile,
    setTagTitle, setTagArtist, setTagAlbum, setTagYear, setTagGenre,
    saveTags, clearTagFields, applyAll, tx,
  } = props;

  const fileName = selectedFile ? selectedFile.split("\\").pop() : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[3], width: "100%" }}>
      {/* Header with Title and File badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space[2],
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Edit3 size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: fontSizes.sm, fontWeight: 600, color: "var(--text-primary)" }}>
            {tx.tagEditor}
          </span>
        </div>
        {fileName && (
          <GlassTooltip text={fileName} placement="left">
            <span style={{
              fontSize: fontSizes.xs,
              color: "var(--text-tertiary)",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "2px 10px",
              borderRadius: radii.full,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              {fileName}
            </span>
          </GlassTooltip>
        )}
      </div>

      {/* Grid Inputs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: space[2],
        width: "100%",
      }}>
        {/* Row 1: Title (Full width) */}
        <div style={{ gridColumn: "1 / -1" }}>
          <GlassInput
            value={tagTitle}
            onChange={e => setTagTitle(e.target.value)}
            placeholder={tx.title_}
            disabled={!selectedFile}
            style={{ width: "100%", fontSize: fontSizes.xs }}
          />
        </div>

        {/* Row 2: Artist & Album */}
        <div>
          <GlassInput
            value={tagArtist}
            onChange={e => setTagArtist(e.target.value)}
            placeholder={tx.artist}
            disabled={!selectedFile}
            style={{ width: "100%", fontSize: fontSizes.xs }}
          />
        </div>
        <div>
          <GlassInput
            value={tagAlbum}
            onChange={e => setTagAlbum(e.target.value)}
            placeholder={tx.album}
            disabled={!selectedFile}
            style={{ width: "100%", fontSize: fontSizes.xs }}
          />
        </div>

        {/* Row 3: Year & Genre */}
        <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", gap: space[2], gridColumn: "1 / -1" }}>
          <GlassInput
            value={tagYear}
            onChange={e => setTagYear(e.target.value)}
            placeholder={tx.year}
            disabled={!selectedFile}
            style={{ width: "100%", fontSize: fontSizes.xs }}
          />
          <GlassInput
            value={tagGenre}
            onChange={e => setTagGenre(e.target.value)}
            placeholder={tx.genre}
            disabled={!selectedFile}
            style={{ width: "100%", fontSize: fontSizes.xs }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: space[2],
        flexWrap: "wrap",
        marginTop: 2,
      }}>
        <GlassButton
          variant="primary"
          onClick={saveTags}
          disabled={saving || !selectedFile}
          size="sm"
          style={{ flex: 1, justifyContent: "center" }}
        >
          <Save size={13} style={{ marginRight: 4 }} />
          {tx.saveTags}
        </GlassButton>

        <GlassButton
          variant="secondary"
          onClick={clearTagFields}
          disabled={!selectedFile}
          size="sm"
          style={{ justifyContent: "center" }}
        >
          <X size={13} style={{ marginRight: 4 }} />
          {tx.clearTags}
        </GlassButton>

        <GlassButton
          variant="ghost"
          onClick={applyAll}
          disabled={saving}
          size="sm"
          style={{ justifyContent: "center" }}
        >
          <Layers size={13} style={{ marginRight: 4 }} />
          {tx.applyAll}
        </GlassButton>
      </div>
    </div>
  );
}
