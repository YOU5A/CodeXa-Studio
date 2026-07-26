import { GlassButton, GlassInput } from "@/design-system/components";
import { space, fontSizes } from "@/design-system/tokens";
import type { RenamePanelProps } from "./types";

export default function RenamePanel(props: RenamePanelProps) {
  const { renameName, setRenameName, renameOne, renameAll, tx, lang } = props;

  return (
    <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
      <GlassInput
        value={renameName}
        onChange={e => setRenameName(e.target.value)}
        placeholder={renameName || (lang === "zh" ? "文件名" : "File name")}
        style={{ flex: 1, fontSize: fontSizes.sm, padding: `${space[1]}px ${space[2]}px` }}
      />
      <GlassButton variant="secondary" onClick={renameOne} size="sm">
        {tx.renameSelected}
      </GlassButton>
      <GlassButton variant="secondary" onClick={renameAll} size="sm">
        {tx.renameAll}
      </GlassButton>
    </div>
  );
}
