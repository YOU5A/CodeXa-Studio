/**
 * LyricWindow — 可拖拽歌词悬浮窗口
 *
 * Uses GlassFloat (reusable floating glass window primitive).
 */

import type { ReactNode } from "react";
import { GlassFloat } from "@/design-system";

interface LyricWindowProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  defaultPosition?: { x: number; y: number };
}

const WIN_WIDTH = 280;
const WIN_HEIGHT = 340;

export default function LyricWindow({ open, onClose, children, defaultPosition }: LyricWindowProps) {
  return (
    <GlassFloat
      open={open}
      onClose={onClose}
      title="歌词"
      width={WIN_WIDTH}
      height={WIN_HEIGHT}
      positionKey="lyrics-window-position"
      defaultPosition={defaultPosition}
    >
      {children}
    </GlassFloat>
  );
}
