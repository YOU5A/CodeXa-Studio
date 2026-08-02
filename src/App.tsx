import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme, ThemeProvider } from "./hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "./utils/animations";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { MusicPlayerProvider, useMusicPlayer } from "./contexts/MusicPlayerContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { DevUnlockProvider, useDevUnlock, UnlockGameOverlay } from "@/developer-unlock";
import ToastContainer from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import type { Page } from "./types";
import { STORAGE_PAGE } from "./constants/storage-keys";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import { GlassLayout, GlassMain, GlassEmptyState, pageTransition } from "./design-system";
import ErrorBoundary from "./components/ErrorBoundary";
import NowPlayingBackground from "./components/NowPlaying/NowPlayingBackground";
import NowPlayingOverlay from "./components/NowPlaying/NowPlayingOverlay";
import { loadFluidSettings, type FluidSettingsValues } from "./components/FluidSettingsPanel";
import type { RGB } from "./utils/colorExtractor";

// Lazy-loaded pages with hover preload support
const pageLoaders: Record<Page, () => Promise<{ default: React.ComponentType<any> }>> = {
  dashboard: () => import("./pages/Dashboard"),
  win32priority: () => import("./pages/Win32Priority"),
  appcpupriority: () => import("./pages/AppCpuPriority"),
  musicmanager: () => import("./pages/MusicManager"),
  backupcenter: () => import("./pages/BackupCenter"),
  ncmstudio: () => import("./pages/NcmStudio"),
  settings: () => import("./pages/Settings"),
};
const preloadPage = (page: Page) => { pageLoaders[page](); };
const Dashboard = lazy(pageLoaders.dashboard);
const Win32Priority = lazy(pageLoaders.win32priority);
const AppCpuPriority = lazy(pageLoaders.appcpupriority);
const MusicManager = lazy(pageLoaders.musicmanager);
const BackupCenter = lazy(pageLoaders.backupcenter);
const NcmStudio = lazy(pageLoaders.ncmstudio);
const Settings = lazy(pageLoaders.settings);

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", minHeight: 300, padding: 24,
    }}>
      <GlassEmptyState
        style={{ minWidth: 320, borderRadius: "var(--radius)" }}
        icon={
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "3px solid var(--border-color)",
              borderTopColor: "var(--accent)",
            }}
          />
        }
        title={"\u52a0\u8f7d\u4e2d\u2026"}
      />
    </div>
  );
}

function AppContent() {
  const { theme, resolvedTheme, settings, setTheme, updateSettings } = useTheme();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return (localStorage.getItem(STORAGE_PAGE) as Page) || "dashboard";
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  // 主窗口流体启停：NowPlaying 展开（含背景淡入）完成后再隐藏，关闭时立即恢复，保证动画期间底层流体可见
  const [mainFluidEnabled, setMainFluidEnabled] = useState(true);
  const animDuration = getAnimDuration(settings.animationSpeed);
  const { audioState } = useMusicPlayer();
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => loadFluidSettings());
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const { lang } = useLanguage();
  const { isDeveloperMode, isGameOpen, openGame, closeGame, unlock } = useDevUnlock();
  const { showToast } = useToast();

  useEffect(() => {
    window.electronAPI?.window.onMaximizeChange(setIsMaximized);
    window.electronAPI?.window.isMaximized().then(setIsMaximized);
  }, []);

  // Apply window opacity on mount and when settings change
  useEffect(() => {
    window.electronAPI?.window.setOpacity(settings.windowOpacity / 100);
  }, [settings.windowOpacity]);

  // Listen for fluid settings changes from other components (same-tab sync)
  useEffect(() => {
    const handler = () => setFluidSettings(loadFluidSettings());
    window.addEventListener("fluidSettingsChanged", handler);
    return () => window.removeEventListener("fluidSettingsChanged", handler);
  }, []);


  // Listen for cover color changes from MusicManager
  // (MusicManager handles localStorage persistence; App only consumes the event)
  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as CustomEvent<RGB | null>).detail;
      setCoverColor(color);
    };
    window.addEventListener("fluidCoverColorChanged", handler as EventListener);
    return () => window.removeEventListener("fluidCoverColorChanged", handler as EventListener);
  }, []);

  // Sync cover color to --fluid-glow-rgb for lyrics/unlock glow effect
  useEffect(() => {
    // Initialize with accent color on first mount
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim();
    if (accent && !document.documentElement.style.getPropertyValue("--fluid-glow-rgb")) {
      document.documentElement.style.setProperty("--fluid-glow-rgb", accent);
    }
  }, []);

  useEffect(() => {
    if (coverColor) {
      const [r, g, b] = coverColor;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const rgb = luminance < 40 ? "255, 255, 255" : `${r}, ${g}, ${b}`;
      document.documentElement.style.setProperty("--fluid-glow-rgb", rgb);
    }
    // Keep previous value; don't remove so overlay always has a valid color
  }, [coverColor]);

  // Listen for cover image changes from MusicManager (base64 or null)
  useEffect(() => {
    const handler = (e: Event) => {
      const b64 = (e as CustomEvent<string | null>).detail;
      setCoverImageUrl(b64 ? "data:image/jpeg;base64," + b64 : null);
    };
    window.addEventListener("fluidCoverChanged", handler as EventListener);
    return () => window.removeEventListener("fluidCoverChanged", handler as EventListener);
  }, []);


  // NowPlaying 打开时延迟 500ms（覆盖展开动画 0.38s + 背景淡入 0.45s）再停用主窗口流体；
  // 关闭时立即恢复，让主窗口流体在收起动画期间已在底层显示
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (nowPlayingOpen) {
      timer = setTimeout(() => setMainFluidEnabled(false), 500);
    } else {
      setMainFluidEnabled(true);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [nowPlayingOpen]);

  // Redirect from NCM page when developer mode is disabled
  const prevDevMode = useRef(isDeveloperMode);
  useEffect(() => {
    if (prevDevMode.current && !isDeveloperMode && currentPage === "ncmstudio") {
      setCurrentPage("dashboard");
      localStorage.setItem(STORAGE_PAGE, "dashboard");
      showToast(
        lang === "zh" ? "开发者模式已关闭，已返回仪表盘" : "Developer mode disabled, returned to dashboard",
        "info", 3000
      );
    }
    prevDevMode.current = isDeveloperMode;
  }, [isDeveloperMode]);

  // Save current page with NCM Studio route guard
  const handleNavigate = (page: Page) => {
    if (page === "ncmstudio" && !isDeveloperMode) {
      setCurrentPage("dashboard");
      localStorage.setItem(STORAGE_PAGE, "dashboard");
      showToast(
        lang === "zh" ? "请先解锁开发者模式" : "Developer mode required",
        "warning", 3000
      );
      return;
    }
    setCurrentPage(page);
    localStorage.setItem(STORAGE_PAGE, page);
  };

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={handleNavigate} />,
    win32priority: <Win32Priority />,
    appcpupriority: <AppCpuPriority />,
    musicmanager: <MusicManager onNavigate={handleNavigate} fluidSettings={fluidSettings} onFluidSettingsChange={setFluidSettings} onOpenNowPlaying={() => setNowPlayingOpen(true)} />,
    backupcenter: <BackupCenter />,
    ncmstudio: <NcmStudio />,
    settings: <Settings />,
  };

  return (
    <GlassLayout>
      {/* Fluid background layer - covers entire window */}
      {mainFluidEnabled && (
        <NowPlayingBackground
          coverColor={coverColor}
          coverImageUrl={coverImageUrl}
          playing={audioState.playing}
          dim={fluidSettings.backgroundDim}
          type={fluidSettings.backgroundType}
          dynamicFluid={fluidSettings.dynamicFluid}
        />
      )}
      {/* Title Bar — sits above the body grid */}
      <div style={{ position: "relative", zIndex: 30, flexShrink: 0 }}>
        <TitleBar
          isMaximized={isMaximized}
          onToggleMaximize={() => window.electronAPI?.window.maximize()}
        />
      </div>

      {/* Body: sidebar + main content */}
      <div
        className="app-body"
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onPreload={preloadPage}
          onVersionTrigger={() => openGame()}
        />

        <GlassMain
          padding={settings.compactMode ? 16 : 24}
        >
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary key={currentPage}>
              {settings.animationSpeed === "off" ? (
                <div style={{ height: "100%", zoom: "var(--font-scale)" }}>{pages[currentPage]}</div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    variants={pageTransition}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: animDuration, ease: EASE_OUT }}
                    style={{
                      height: "100%",
                      zoom: `var(--font-scale)`,
                    }}
                  >
                    {pages[currentPage]}
                  </motion.div>
                </AnimatePresence>
              )}
            </ErrorBoundary>
          </Suspense>
        </GlassMain>
      </div>

      {/* Developer Unlock Game Overlay */}
      {isGameOpen && (
        <UnlockGameOverlay
          onSuccess={unlock}
          onClose={closeGame}
        />
      )}

      <ToastContainer />
      <ConfirmDialog />

      {/* 全窗口播放覆盖层 */}
      <NowPlayingOverlay
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
      />
    </GlassLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DevUnlockProvider>
        <ToastProvider>
          <ConfirmProvider>
            <LanguageProvider>
              <MusicPlayerProvider>
                <AppContent />
              </MusicPlayerProvider>
            </LanguageProvider>
          </ConfirmProvider>
        </ToastProvider>
      </DevUnlockProvider>
    </ThemeProvider>
  );
}
