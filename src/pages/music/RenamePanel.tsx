import { FileText } from "lucide-react";
import { GlassButton, GlassInput } from "@/design-system/components";
import { space, fontSizes } from "@/design-system/tokens";
import type { RenamePanelProps } from "./types";

export default function RenamePanel(props: RenamePanelProps) {
  const { renameName, setRenameName, renameOne, renameAll, tx, lang } = props;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: space[2],
      paddingTop: space[3],
      borderTop: "1px solid var(--border-color)",
      width: "100%",
    }}>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <FileText size={13} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ fontSize: fontSizes.xs, fontWeight: 500, color: "var(--text-secondary)" }}>
          {lang === "zh" ? "文件重命名" : "File Rename"}
        </span>
      </div>

      {/* Input + Action Buttons */}
      <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
        <GlassInput
          value={renameName}
          onChange={e => setRenameName(e.target.value)}
          placeholder={renameName || (lang === "zh" ? "文件名" : "File name")}
          style={{ flex: 1, fontSize: fontSizes.xs }}
        />
        <GlassButton
          variant="secondary"
          onClick={renameOne}
          size="sm"
          disabled={!renameName}
          style={{ fontSize: fontSizes.xs }}
        >
          {tx.renameSelected}
        </GlassButton>
        <GlassButton
          variant="ghost"
          onClick={renameAll}
          size="sm"
          style={{ fontSize: fontSizes.xs }}
        >
          {tx.renameAll}
        </GlassButton>
      </div>
    </div>
  );
}
