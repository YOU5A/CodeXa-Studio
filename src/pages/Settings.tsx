import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sun, Moon, Monitor, Globe, Palette,
  Layout, Zap, RotateCcw
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useToast } from "@/contexts/ToastContext";
import { APP_VERSION } from "@/version";
import { GlassButton, GlassModal, GlassPanel, GlassToggle, GlassPillButton, GlassSlider } from "@/design-system";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";
import type { Theme, Language } from "@/types";

const t: Record<Language, Record<string, string>> = {
  zh: {
    title: "个性化设置",
    appearance: "外观",
    themeLabel: "主题",
    light: "浅色",
    dark: "深色",
    auto: "自动",
    graphite: "石墨",
    midnight: "午夜",
    ocean: "海洋",
    emerald: "翡翠",
    crimson: "深红",
    opacity: "窗口透明度",
    radius: "圆角大小",
    animSpeed: "动画速度",
    animNormal: "缓慢",
    animFast: "标准",
    animOff: "关闭",
    windowBehavior: "窗口行为",
    autoStart: "开机启动",
    closeToTray: "关闭到托盘",
    rememberSize: "记住窗口大小",
    rememberPos: "记住窗口位置",
    interface: "界面设置",
    sidebarWidth: "侧边栏宽度",
    fontScale: "界面缩放",
    compact: "紧凑模式",
    resetSettings: "重置所有设置",
    resetConfirm: "确定要恢复默认设置吗？",
    resetSuccess: "已恢复默认设置",
    themeTitle: "选择配色方案",
    themeSub: "Choose a color scheme",
    themeReset: "恢复默认",
    about: "关于",
    aboutTitle: "CodeXa Studio",
    aboutVersion: `版本 ${APP_VERSION}`,
    aboutDesc: "统一 Windows 系统管理工具",
    aboutAuthor: "作者: Y0USA",
    aboutTech: "Electron + React + Python",
    github: "GitHub",
    bilibli: "B站",
    usertool: "UserTool",
    language: "语言",
  },
  en: {
    title: "Personalization",
    appearance: "Appearance",
    themeLabel: "Theme",
    light: "Light",
    dark: "Dark",
    auto: "Auto",
    graphite: "Graphite",
    midnight: "Midnight",
    ocean: "Ocean",
    emerald: "Emerald",
    crimson: "Crimson",
    opacity: "Window Opacity",
    radius: "Corner Radius",
    animSpeed: "Animation Speed",
    animNormal: "Slow",
    animFast: "Standard",
    animOff: "Off",
    windowBehavior: "Window Behavior",
    autoStart: "Auto Start",
    closeToTray: "Close to Tray",
    rememberSize: "Remember Window Size",
    rememberPos: "Remember Window Position",
    interface: "Interface",
    sidebarWidth: "Sidebar Width",
    fontScale: "UI Scale",
    compact: "Compact Mode",
    resetSettings: "Reset All Settings",
    resetConfirm: "Restore default settings?",
    resetSuccess: "Settings restored successfully",
    themeTitle: "Choose Theme",
    themeSub: "Choose a color scheme",
    themeReset: "Reset to Default",
    about: "About",
    aboutTitle: "CodeXa Studio",
    aboutVersion: `Version ${APP_VERSION}`,
    aboutDesc: "Unified Windows System Management Tool",
    aboutAuthor: "Author: Y0USA",
    aboutTech: "Electron + React + Python",
    github: "GitHub",
    bilibli: "Bilibili",
    usertool: "UserTool",
    language: "Language",
  },
};

const themeDropdownOptions: { value: Theme; icon: React.ReactNode; key: string }[] = [
  { value: "light", icon: <Sun size={16} />, key: "light" },
  { value: "dark", icon: <Moon size={16} />, key: "dark" },
  { value: "auto", icon: <Monitor size={16} />, key: "auto" },
  { value: "graphite", icon: <Palette size={16} />, key: "graphite" },
  { value: "midnight", icon: <Moon size={16} />, key: "midnight" },
  { value: "ocean", icon: <Palette size={16} />, key: "ocean" },
  { value: "emerald", icon: <Palette size={16} />, key: "emerald" },
  { value: "crimson", icon: <Moon size={16} />, key: "crimson" },
];

const themeColorMap: Record<Theme, string> = {
  light: "#0071e3",
  dark: "#1a2a4a",
  auto: "transparent",
  graphite: "#5856d6",
  midnight: "#6366f1",
  ocean: "#0066cc",
  emerald: "#059669",
  crimson: "#f43f5e",
};

const sidebarWidthOptions = [
  { value: "200", label: "200px" },
  { value: "220", label: "220px" },
  { value: "240", label: "240px" },
  { value: "260", label: "260px" },
  { value: "280", label: "280px" },
];

const fontScaleOptions = [
  { value: "80", label: "80%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
  { value: "110", label: "110%" },
  { value: "120", label: "120%" },
  { value: "140", label: "140%" },
];

const animSpeedOptions = [
  { value: "normal", key: "animNormal" },
  { value: "fast", key: "animFast" },
  { value: "off", key: "animOff" },
] as const;

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  minWidth: 56,
  flexShrink: 0,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: -4,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 0",
  gap: 12,
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--border-color)",
  opacity: 0.5,
  margin: "4px 0",
};

export default function Settings() {
  const { lang, setLang } = useLanguage();
  const tx = t[lang];
  const { theme, settings, setTheme, updateSettings, resetSettings } = useTheme();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const animationDuration = getAnimDuration(settings.animationSpeed);

  const [themePickerOpen, setThemePickerOpen] = useState(false);

  useEffect(() => {
    window.electronAPI?.python.call("config.get").then((_cfg: any) => {
    }).catch(() => {});
    window.electronAPI?.settings.getAll().then((s: any) => {
      if (s?.autoStart !== undefined) updateSettings({ autoStart: s.autoStart } as any);
      if (s?.closeToTray !== undefined) updateSettings({ closeToTray: s.closeToTray } as any);
      if (s?.rememberSize !== undefined) updateSettings({ rememberSize: s.rememberSize });
      if (s?.rememberPosition !== undefined) updateSettings({ rememberPosition: s.rememberPosition });
    }).catch(() => {});
  }, []);

  const handleReset = async () => {
    const ok = await confirm({ title: tx.resetConfirm, danger: true });
    if (!ok) return;
    resetSettings();
    window.electronAPI?.settings.set("rememberSize", true);
    window.electronAPI?.settings.set("rememberPosition", true);
    window.electronAPI?.settings.resetBounds();
    showToast(tx.resetSuccess, "success");
  };

  const setPillGlow = useCallback((el: HTMLElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    el.style.setProperty("--pill-gx", ((cx - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--pill-gy", ((cy - r.top) / r.height) * 100 + "%");
    el.style.setProperty("--pill-go", "1");
  }, []);

  const clearPillGlow = useCallback((el: HTMLElement) => {
    el.style.setProperty("--pill-go", "0");
  }, []);

  const handlePillMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPillGlow(e.currentTarget, e.clientX, e.clientY);
  }, [setPillGlow]);

  const handlePillLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    clearPillGlow(e.currentTarget);
  }, [clearPillGlow]);

  const currentThemeOption = themeDropdownOptions.find(o => o.value === theme) ?? themeDropdownOptions[0];

  return (
    <motion.div
      animate={{ opacity: 1 }}
      transition={{ duration: animationDuration, ease: EASE_OUT }}
      style={{ maxWidth: 880, margin: "0 auto", width: "100%" }}
    >
      {/* Page Title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
          {tx.title}
        </h1>
        <GlassPillButton
          onClick={handleReset}
          
          style={{
            padding: "4px 14px",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all var(--transition-fast)",
            fontFamily: "inherit",
            outline: "none",
          }}
          title={tx.resetConfirm}
        >
                    <RotateCcw size={12} style={{ marginRight: 4, display: "inline", verticalAlign: "middle" }} />
          {tx.resetSettings}
        </GlassPillButton>
      </div>

      {/* ── Settings Panel ── */}
      <GlassPanel tier="thick" padding={20} style={{ gap: 12 }}>

        {/* ── Appearance ── */}
        <div style={sectionLabelStyle}>{tx.appearance}</div>

        {/* Theme */}
        <div style={rowStyle}>
          <div style={labelStyle}>{tx.themeLabel}</div>
          <GlassPillButton
            onClick={() => setThemePickerOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 20,
              border: "1.5px solid var(--border-color)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              fontFamily: "inherit",
              outline: "none",
            }}
          >
            {currentThemeOption.icon}
            {tx[currentThemeOption.key]}
            <Palette size={12} />
          </GlassPillButton>
        </div>

        {/* Opacity */}
        <div style={sectionStyle}>
          <GlassSlider
            label={tx.opacity}
            display={settings.windowOpacity + "%"}
            value={settings.windowOpacity}
            defaultVal={100}
            min={70}
            max={100}
            step={1}
            onChange={(v) => updateSettings({ windowOpacity: v })}
          />
        </div>

        {/* Radius */}
        <div style={sectionStyle}>
          <GlassSlider
            label={tx.radius}
            display={settings.borderRadius + "px"}
            value={settings.borderRadius}
            defaultVal={20}
            min={0}
            max={30}
            step={1}
            onChange={(v) => updateSettings({ borderRadius: v })}
          />
        </div>

        {/* Animation Speed */}
        <div style={sectionStyle}>
          <div style={labelStyle}>{tx.animSpeed}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {animSpeedOptions.map((opt) => {
              const active = settings.animationSpeed === opt.value;
              return (
                <GlassPillButton
                  key={opt.value}
                  
                  onClick={() => updateSettings({ animationSpeed: opt.value as typeof settings.animationSpeed })}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                    background: active ? "var(--accent-bg)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                    boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  {tx[opt.key]}
                </GlassPillButton>
              );
            })}
          </div>
        </div>

        <div style={separatorStyle} />

        {/* ── Window Behavior ── */}
        <div style={sectionLabelStyle}>{tx.windowBehavior}</div>

        <div style={rowStyle}>
          <div style={labelStyle}>{tx.autoStart}</div>
          <GlassToggle active={(settings as any).autoStart ?? false} onChange={(v) => { updateSettings({ autoStart: v } as any); window.electronAPI?.settings.set('autoStart', v); }} />
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>{tx.closeToTray}</div>
          <GlassToggle active={(settings as any).closeToTray ?? false} onChange={(v) => { updateSettings({ closeToTray: v } as any); window.electronAPI?.settings.set('closeToTray', v); }} />
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>{tx.rememberSize}</div>
          <GlassToggle active={settings.rememberSize} onChange={(v) => { updateSettings({ rememberSize: v }); window.electronAPI?.settings.set('rememberSize', v); }} />
        </div>

        <div style={rowStyle}>
          <div style={labelStyle}>{tx.rememberPos}</div>
          <GlassToggle active={settings.rememberPosition} onChange={(v) => { updateSettings({ rememberPosition: v }); window.electronAPI?.settings.set('rememberPosition', v); }} />
        </div>

        <div style={separatorStyle} />

        {/* ── Interface ── */}
        <div style={sectionLabelStyle}>{tx.interface}</div>

        {/* Sidebar Width */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={labelStyle}>{tx.sidebarWidth}</div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {settings.sidebarWidth}px
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sidebarWidthOptions.map((opt) => {
              const active = String(settings.sidebarWidth) === opt.value;
              return (
                <GlassPillButton
                  key={opt.value}
                  
                  onClick={() => updateSettings({ sidebarWidth: Number(opt.value) })}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                    background: active ? "var(--accent-bg)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                    boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  {opt.label}
                </GlassPillButton>
              );
            })}
          </div>
        </div>

        {/* Font Scale */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={labelStyle}>{tx.fontScale}</div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
              {settings.fontScale}%
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {fontScaleOptions.map((opt) => {
              const active = String(settings.fontScale) === opt.value;
              return (
                <GlassPillButton
                  key={opt.value}
                  
                  onClick={() => updateSettings({ fontScale: Number(opt.value) })}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                    background: active ? "var(--accent-bg)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                    boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  {opt.label}
                </GlassPillButton>
              );
            })}
          </div>
        </div>

        {/* Compact Mode */}
        <div style={rowStyle}>
          <div style={labelStyle}>{tx.compact}</div>
          <GlassToggle active={settings.compactMode} onChange={(v) => updateSettings({ compactMode: v, fontScale: v ? 90 : 120 })} />
        </div>

        <div style={separatorStyle} />

        {/* ── Language ── */}
        <div style={sectionLabelStyle}>{tx.language}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(["zh", "en"] as const).map((lng) => {
            const active = lang === lng;
            return (
              <GlassPillButton
                key={lng}
                
                onClick={() => setLang(lng)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                                <Globe size={13} />
                {lng === "zh" ? "中文" : "English"}
              </GlassPillButton>
            );
          })}
        </div>

        <div style={separatorStyle} />

        {/* ── About ── */}
        <div style={sectionLabelStyle}>{tx.about}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="./icon.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{tx.aboutTitle}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{tx.aboutVersion}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7 }}>
          <div>{tx.aboutDesc}</div>
          <div>{tx.aboutAuthor}</div>
          <div>{tx.aboutTech}</div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <GlassButton variant="secondary" size="sm"
            onClick={() => window.electronAPI?.shell.openExternal("https://github.com/YOU5A")}>
            {tx.github}
          </GlassButton>
          <GlassButton variant="secondary" size="sm"
            onClick={() => window.electronAPI?.shell.openExternal("https://space.bilibili.com/353017137")}>
            {tx.bilibli}
          </GlassButton>
          <GlassButton variant="secondary" size="sm"
            onClick={() => window.electronAPI?.shell.openExternal("https://you5a.github.io/UserTool")}>
            {tx.usertool}
          </GlassButton>
        </div>

      </GlassPanel>

      {/* ── Theme Picker Modal ── */}
      <GlassModal open={themePickerOpen} onClose={() => setThemePickerOpen(false)} maxWidth={400}>
        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <h3 style={{
            fontSize: 17, fontWeight: 600, color: "var(--text-primary)",
            margin: "0 0 2px 0", letterSpacing: "-0.01em",
          }}>
            {tx.themeLabel}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
            {tx.themeSub}
          </p>
        </div>

        <div style={{ height: 1, background: "var(--border-color)", opacity: 0.5, marginBottom: 16 }} />

        {/* Theme pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {themeDropdownOptions.map((opt) => {
            const active = theme === opt.value;
            const colorDot = themeColorMap[opt.value];
            return (
              <GlassPillButton
                key={opt.value}
                onClick={() => { setTheme(opt.value); setThemePickerOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  lineHeight: 1,
                }}
              >
                <span style={{ display: "flex", alignItems: "center" }}>
                  {opt.icon}
                </span>
                {tx[opt.key]}
                {opt.value !== "auto" ? (
                  <span style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: colorDot,
                    border: "1px solid rgba(128,128,128,0.3)",
                    flexShrink: 0,
                  }} />
                ) : (
                  <span style={{
                    display: "flex",
                    gap: 0,
                    width: 14, height: 12,
                    flexShrink: 0,
                  }}>
                    <span style={{
                      width: 7, height: 12,
                      borderRadius: "6px 0 0 6px",
                      background: "#1C1C1E",
                      border: "1px solid rgba(128,128,128,0.3)",
                      borderRight: "none",
                    }} />
                    <span style={{
                      width: 7, height: 12,
                      borderRadius: "0 6px 6px 0",
                      background: "#0a84ff",
                      border: "1px solid rgba(128,128,128,0.3)",
                      borderLeft: "none",
                    }} />
                  </span>
                )}
              </GlassPillButton>
            );
          })}
        </div>

        <div style={{ height: 1, background: "var(--border-color)", opacity: 0.5, margin: "16px 0" }} />

        {/* Reset */}
        <GlassPillButton
          onClick={() => { setTheme("auto"); setThemePickerOpen(false); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "7px 0",
            borderRadius: 16,
            border: "1.5px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
                    <RotateCcw size={12} />
          {tx.themeReset}
        </GlassPillButton>
      </GlassModal>
    </motion.div>
  );
}
