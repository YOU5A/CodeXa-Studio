import { GlassToggle } from "@/design-system/components";
import { sectionLabelStyle, rowStyle, labelStyle, separatorStyle } from "./shared";
import type { AppSettings } from "@/types";

interface BehaviorSectionProps {
  tx: Record<string, string>;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  autoStart: boolean;
  closeToTray: boolean;
  onAutoStartChange: (v: boolean) => void;
  onCloseToTrayChange: (v: boolean) => void;
}

export default function BehaviorSection({
  tx, settings, updateSettings, autoStart, closeToTray, onAutoStartChange, onCloseToTrayChange,
}: BehaviorSectionProps) {
  return (
    <>
      <div style={sectionLabelStyle}>{tx.windowBehavior}</div>

      <div style={rowStyle}>
        <div style={labelStyle}>{tx.autoStart}</div>
        <GlassToggle
          active={autoStart}
          onChange={onAutoStartChange}
        />
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>{tx.closeToTray}</div>
        <GlassToggle
          active={closeToTray}
          onChange={onCloseToTrayChange}
        />
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>{tx.rememberSize}</div>
        <GlassToggle
          active={settings.rememberSize}
          onChange={(v) => {
            updateSettings({ rememberSize: v });
            window.electronAPI?.settings.set("rememberSize", v);
          }}
        />
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>{tx.rememberPos}</div>
        <GlassToggle
          active={settings.rememberPosition}
          onChange={(v) => {
            updateSettings({ rememberPosition: v });
            window.electronAPI?.settings.set("rememberPosition", v);
          }}
        />
      </div>

      <div style={separatorStyle} />
    </>
  );
}
