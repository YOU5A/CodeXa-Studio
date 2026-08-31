import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { springSnappy, GlassSurface, GlassButton, GlassTooltip } from "@/design-system";
import {
  LayoutDashboard, Cpu, Gauge, Music, MonitorCog, Settings, FileAudio,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useDevUnlock } from "@/developer-unlock";
import { useConfirm } from "@/contexts/ConfirmContext";
import type { Page, Language } from "@/types";
import { APP_VERSION } from "@/version";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onPreload?: (page: Page) => void;
  onVersionTrigger?: () => void;
}

interface ClickTip {
  x: number;
  y: number;
  text: string;
}

const navLabels: Record<Language, Record<Page, string>> = {
  zh: {
    dashboard: "仪表盘",
    win32priority: "Win32 优先级",
    appcpupriority: "应用 CPU 优先级",
    musicmanager: "音乐管理器",
    backupcenter: "显卡名称",
    ncmstudio: "NCM 解码",
    settings: "设置",
  },
  en: {
    dashboard: "Dashboard",
    win32priority: "Win32 Priority",
    appcpupriority: "App CPU Priority",
    musicmanager: "Music Manager",
    backupcenter: "GPU Name",
    ncmstudio: "NCM Studio",
    settings: "Settings",
  },
};

const navItems: { id: Page; icon: React.ReactNode }[] = [
  { id: "dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "backupcenter", icon: <MonitorCog size={18} /> },
  { id: "win32priority", icon: <Cpu size={18} /> },
  { id: "appcpupriority", icon: <Gauge size={18} /> },
  { id: "musicmanager", icon: <Music size={18} /> },
  { id: "ncmstudio", icon: <FileAudio size={18} /> },
  { id: "settings", icon: <Settings size={18} /> },
];

export default function Sidebar({ currentPage, onNavigate, onPreload, onVersionTrigger }: SidebarProps) {
  const { lang } = useLanguage();
  const { settings } = useTheme();
  const { isDeveloperMode, registerVersionClick, lock } = useDevUnlock();
  const { confirm } = useConfirm();
  const [clickTip, setClickTip] = useState<ClickTip | null>(null);
  const tipKeyRef = useRef(0);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, []);

  const handleVersionClick = useCallback(async (e: React.MouseEvent) => {
    if (isDeveloperMode) {
      const ok = await confirm({
        title: lang === "zh" ? "退出开发者模式？" : "Exit Developer Mode?",
        confirmLabel: lang === "zh" ? "退出" : "Exit",
        cancelLabel: lang === "zh" ? "取消" : "Cancel",
        danger: true,
      });
      if (ok) await lock();
      return;
    }

    const { remaining, triggered } = registerVersionClick();
    if (triggered) {
      if (tipTimerRef.current) { clearTimeout(tipTimerRef.current); tipTimerRef.current = null; }
      setClickTip(null);
      onVersionTrigger?.();
      return;
    }

    // Clear any pending hide timer from a previous tip
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }

    const msg = lang === "zh"
      ? `还需点击 ${remaining} 次`
      : `${remaining} more clicks`;
    const offsetX = (Math.random() - 0.5) * 48;
    const offsetY = (Math.random() - 0.5) * 20;
    tipKeyRef.current++;
    setClickTip({
      x: e.clientX + 16 + offsetX,
      y: e.clientY - 40 + offsetY,
      text: msg,
    });

    tipTimerRef.current = setTimeout(() => {
      tipTimerRef.current = null;
      setClickTip(null);
    }, 1500);
  }, [isDeveloperMode, registerVersionClick, onVersionTrigger, lang, confirm, lock]);

  return (
    <GlassSurface
      tier="regular"
      styleOverrides={{ radius: 0, shadow: "none" }}
      style={{
        width: "var(--sidebar-width)",
        minWidth: 180,
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        padding: settings.compactMode ? "8px 6px" : "12px 8px",
        borderRight: "1px solid var(--border-color)",
        borderTop: "none",
        borderBottom: "none",
        borderLeft: "none",
        gap: 2,
        flexShrink: 0,
        borderRadius: 0,
      }}
    >
      {navItems
        .map((item) => {
          if (item.id === "ncmstudio" && !isDeveloperMode) return null;
          const isActive = currentPage === item.id;
          const isNewNcm = item.id === "ncmstudio";
          return (
            <GlassButton
              key={item.id}
              variant="ghost"
              size="sm"
              inline={false}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => onPreload?.(item.id)}
              whileHover={isActive ? { background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" } : undefined}
              initial={isNewNcm ? { opacity: 0, y: -10 } : undefined}
              animate={isNewNcm ? { opacity: 1, y: 0 } : undefined}
              style={{
                justifyContent: "flex-start",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 500 : 400,
                background: isActive ? "var(--accent-bg-fade)" : "transparent",
                borderRadius: 10,
                padding: settings.compactMode ? "8px 10px" : "10px 14px",
                fontSize: settings.compactMode ? 12 : 13,
                width: "100%",
              }}
              {...{ "data-nav-id": item.id }}
            >
              {item.icon}
              <span>{navLabels[lang][item.id]}</span>
            </GlassButton>
          );
        })}

      <div style={{ flex: 1 }} />

      <GlassTooltip text={isDeveloperMode ? (lang === "zh" ? "点击退出开发者模式" : "Click to exit Developer Mode") : ""}>
        <div
          onClick={handleVersionClick}
          style={{
            padding: settings.compactMode ? "8px 10px" : "12px 14px",
            fontSize: 11,
            color: isDeveloperMode ? "var(--accent)" : "var(--text-tertiary)",
            textAlign: "center",
            cursor: "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            width: "100%",
          }}
        >
          {"CodeXa Studio V" + APP_VERSION}
          {isDeveloperMode && (
            <span style={{ fontSize: 9, display: "block", marginTop: 2, opacity: 0.6 }}>
              {lang === "zh" ? "开发者模式" : "Dev Mode"}
            </span>
          )}
        </div>
      </GlassTooltip>

      {createPortal(
        <AnimatePresence>
          {clickTip && (
            <motion.div
              key={tipKeyRef.current}
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.88 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: clickTip.x,
                top: clickTip.y,
                zIndex: 99999,
                pointerEvents: "none",
                backdropFilter: "blur(32px) saturate(2.2)",
                WebkitBackdropFilter: "blur(32px) saturate(2.2)",
                background: "rgba(18,18,28,0.40)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "nowrap",
                boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              }}
            >
              {clickTip.text}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GlassSurface>
  );
}
