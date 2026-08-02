/**
 * LyricsSettingsPanel — 歌词显示设置弹窗
 *
 * 弹窗外壳（GlassModal + GlassScrollArea），内容复用 LyricsSettingsContent。
 *
 * @module lyrics/LyricsSettingsPanel
 */

import { GlassModal, GlassScrollArea } from "@/design-system";
import LyricsSettingsContent from "./LyricsSettingsContent";
import type { LyricsSettingsValues } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  values: LyricsSettingsValues;
  onChange: (v: LyricsSettingsValues) => void;
}

export default function LyricsSettingsPanel({ open, onClose, values, onChange }: Props) {
  return (
    <GlassModal open={open} onClose={onClose} maxWidth={360}>
      <div style={{ marginRight: -28, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <GlassScrollArea maxHeight="70vh" fadeEdges>
          <div style={{ paddingRight: 28 }}>
            <LyricsSettingsContent values={values} onChange={onChange} />
          </div>
        </GlassScrollArea>
      </div>
    </GlassModal>
  );
}
