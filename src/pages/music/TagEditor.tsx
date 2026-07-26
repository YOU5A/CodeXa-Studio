import { Save, X, Edit3 } from "lucide-react";
import { GlassButton, GlassInput, space, fontSizes } from "@/design-system";
import type { TagEditorProps } from "./types";

export default function TagEditor(props: TagEditorProps) {
  const {
    tagTitle, tagArtist, tagAlbum, tagYear, tagGenre,
    saving, selectedFile,
    setTagTitle, setTagArtist, setTagAlbum, setTagYear, setTagGenre,
    saveTags, clearTagFields, applyAll, tx,
  } = props;

  const inputStyle = { fontSize: fontSizes.sm, padding: `${space[1]}px ${space[2]}px` };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
        <Edit3 size={14} style={{ color: "var(--text-secondary)" }} />
        <span style={{ fontSize: fontSizes.md, fontWeight: 500, color: "var(--text-secondary)" }}>
          {tx.tagEditor}
        </span>
        {selectedFile && (
          <span style={{
            fontSize: fontSizes.xs, color: "var(--text-tertiary)",
            marginLeft: "auto", maxWidth: "45%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {selectedFile.split("\\").pop()}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: space[2] }}>
        <GlassInput value={tagTitle} onChange={e => setTagTitle(e.target.value)} placeholder={tx.title_}
          style={inputStyle} />
        <GlassInput value={tagArtist} onChange={e => setTagArtist(e.target.value)} placeholder={tx.artist}
          style={inputStyle} />
        <GlassInput value={tagAlbum} onChange={e => setTagAlbum(e.target.value)} placeholder={tx.album}
          style={inputStyle} />
        <GlassInput value={tagYear} onChange={e => setTagYear(e.target.value)} placeholder={tx.year}
          style={inputStyle} />
        <GlassInput value={tagGenre} onChange={e => setTagGenre(e.target.value)} placeholder={tx.genre}
          style={inputStyle} />
      </div>

      <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
        <GlassButton variant="primary" onClick={saveTags} disabled={saving} size="md">
          <Save size={12} /> {tx.saveTags}
        </GlassButton>
        <GlassButton variant="secondary" onClick={clearTagFields} size="md">
          <X size={12} /> {tx.clearTags}
        </GlassButton>
        <GlassButton variant="secondary" onClick={applyAll} disabled={saving} size="md">
          {tx.applyAll}
        </GlassButton>
      </div>
    </>
  );
}
