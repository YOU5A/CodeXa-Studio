import { motion } from "framer-motion";
import { springSnappy, GlassSurface, GlassButton } from "@/design-system";
import {
  LayoutDashboard, Cpu, Gauge, Music, Database, Settings, FileAudio,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import type { Page, Language } from "@/types";
import { APP_VERSION } from "@/version";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onPreload?: (page: Page) => void;
}

const navLabels: Record<Language, Record<Page, string>> = {
  zh: {
    dashboard: "仪表盘",
    win32priority: "Win32 优先级",
    appcpupriority: "应用 CPU 优先级",
    musicmanager: "音乐管理器",
    backupcenter: "备份中心",
    ncmstudio: "NCM 解码",
    settings: "设置",
  },
  en: {
    dashboard: "Dashboard",
    win32priority: "Win32 Priority",
    appcpupriority: "App CPU Priority",
    musicmanager: "Music Manager",
    backupcenter: "Backup Center",
    ncmstudio: "NCM Studio",
    settings: "Settings",
  },
};

const navItems: { id: Page; icon: React.ReactNode }[] = [
  { id: "dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "win32priority", icon: <Cpu size={18} /> },
  { id: "appcpupriority", icon: <Gauge size={18} /> },
  { id: "musicmanager", icon: <Music size={18} /> },
  { id: "ncmstudio", icon: <FileAudio size={18} /> },
  { id: "backupcenter", icon: <Database size={18} /> },
  { id: "settings", icon: <Settings size={18} /> },
];

export default function Sidebar({ currentPage, onNavigate, onPreload }: SidebarProps) {
  const { lang } = useLanguage();
  const { settings } = useTheme();

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
      {navItems.map((item) => {
        const isActive = currentPage === item.id;
        return (
          <GlassButton
            key={item.id}
            variant="ghost"
            size="sm"
            inline={false}
            onClick={() => onNavigate(item.id)}
            onMouseEnter={() => onPreload?.(item.id)}
            whileHover={isActive ? { background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" } : undefined}
            style={{
              justifyContent: "flex-start",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: isActive ? 500 : 400,
              background: isActive ? "var(--accent-bg)" : "transparent",
              borderRadius: 10,
              padding: settings.compactMode ? "8px 10px" : "10px 14px",
              fontSize: settings.compactMode ? 12 : 13,
              width: "100%",
            }}
          >
            {item.icon}
            <span>{navLabels[lang][item.id]}</span>
          </GlassButton>
        );
      })}

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: settings.compactMode ? "8px 10px" : "12px 14px",
          fontSize: 11,
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        {"CodeXa Studio V" + APP_VERSION}
      </div>
    </GlassSurface>
  );
}
