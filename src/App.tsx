import { useState, useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme, ThemeProvider } from "./hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "./utils/animations";
import { ToastProvider } from "./contexts/ToastContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { MusicPlayerProvider, useMusicPlayer } from "./contexts/MusicPlayerContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import ToastContainer from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import type { Page } from "./types";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import { GlassLayout, GlassMain, pageTransition } from "./design-system";
import FluidBackground from "./components/FluidBackground";
import { loadFluidSettings, type FluidSettingsValues } from "./components/FluidSettingsPanel";
import type { RGB } from "./utils/colorExtractor";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Win32Priority = lazy(() => import("./pages/Win32Priority"));
const AppCpuPriority = lazy(() => import("./pages/AppCpuPriority"));
const MusicManager = lazy(() => import("./pages/MusicManager"));
const BackupCenter = lazy(() => import("./pages/BackupCenter"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", minHeight: 200,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid var(--border-color)",
        borderTopColor: "var(--accent)",
        animation: "spin 0.6s linear infinite",
      }} />
    </div>
  );
}

function AppContent() {
  const { theme, resolvedTheme, settings, setTheme, updateSettings } = useTheme();
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return (localStorage.getItem("codexa-studio-page") as Page) || "dashboard";
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const animDuration = getAnimDuration(settings.animationSpeed);
  const { playingFile, audioState } = useMusicPlayer();
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => loadFluidSettings());
  const [coverColor, setCoverColor] = useState<RGB | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

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
      setCoverColor((e as CustomEvent<RGB | null>).detail);
    };
    window.addEventListener("fluidCoverColorChanged", handler as EventListener);
    return () => window.removeEventListener("fluidCoverColorChanged", handler as EventListener);
  }, []);

  // Fetch cover image for SVG fluid background when playing file changes
  useEffect(() => {
    if (!playingFile) {
      setCoverImageUrl(null);
      return;
    }
    let cancelled = false;
    const fetchCover = async () => {
      try {
        const result = await window.electronAPI?.python.call("music.extract_cover", { filepath: playingFile });
        if (!cancelled && result?.cover) {
          setCoverImageUrl("data:image/jpeg;base64," + result.cover);
        }
      } catch {
        if (!cancelled) setCoverImageUrl(null);
      }
    };
    fetchCover();
    return () => { cancelled = true; };
  }, [playingFile]);

  // Save current page
  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    localStorage.setItem("codexa-studio-page", page);
  };

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={handleNavigate} />,
    win32priority: <Win32Priority />,
    appcpupriority: <AppCpuPriority />,
    musicmanager: <MusicManager onNavigate={handleNavigate} fluidSettings={fluidSettings} onFluidSettingsChange={setFluidSettings} />,
    backupcenter: <BackupCenter />,
    settings: <Settings />,
  };

  return (
    <GlassLayout>
      {/* Fluid background layer - covers entire window */}
      <FluidBackground
        enabled={fluidSettings.enabled}
        preset={fluidSettings.style}
        intensity={fluidSettings.intensity}
        speedMultiplier={fluidSettings.speedMultiplier}
        blurAmount={fluidSettings.blurAmount}
        quality={fluidSettings.fps === 30 ? "low" : "high"}
        targetFps={fluidSettings.fps}
        colorMode={fluidSettings.colorMode}
        coverColor={coverColor}
        coverImageUrl={coverImageUrl}
        playing={audioState.playing}
        interactive={false}
      />
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
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

        <GlassMain
          padding={settings.compactMode ? 16 : 24}
        >
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </GlassMain>
      </div>

      <ToastContainer />
      <ConfirmDialog />
    </GlassLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <LanguageProvider>
            <MusicPlayerProvider>
              <AppContent />
            </MusicPlayerProvider>
          </LanguageProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
