import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { getCssTransitionValues } from "@/utils/animations";
import type { Theme, AppSettings } from "@/types";
import { STORAGE_SETTINGS } from "@/constants/storage-keys";
import { defaultSettings } from "@/constants/default-settings";

/** Sync a partial settings object to the Bridge layer (non-blocking, best-effort). */
function syncSettingsToBridge(partial: Partial<AppSettings>) {
  window.electronAPI?.python.call("config.set", partial).catch(() => {});
}

/* ----- Dynamic theme CSS injection ----- */

const THEME_CSS_FILES: Record<string, string> = {
  graphite: "graphite",
  midnight: "midnight",
  ocean: "ocean",
  emerald: "emerald",
  crimson: "crimson",
};

const THEME_CSS_CACHE: Record<string, string> = {};

function injectThemeCss(theme: string) {
  const existing = document.getElementById("theme-injected");
  if (existing) existing.remove();

  if (theme === "light" || theme === "dark" || theme === "auto") return;

  const fileName = THEME_CSS_FILES[theme];
  if (!fileName) return;

  const style = document.createElement("style");
  style.id = "theme-injected";

  if (THEME_CSS_CACHE[theme]) {
    style.textContent = THEME_CSS_CACHE[theme];
    document.head.appendChild(style);
    return;
  }

  fetch("/themes/" + fileName + ".css")
    .then((r) => r.text())
    .then((css) => {
      THEME_CSS_CACHE[theme] = css;
      style.textContent = css;
      document.head.appendChild(style);
    })
    .catch(() => {});
}

/* ----- Helpers ----- */

function getSystemTheme(): "light" | "dark" {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSettings };
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s));
}

function resolveThemeToLightDark(theme: Theme): "light" | "dark" {
  if (theme === "auto") return getSystemTheme();
  if (["light", "graphite", "ocean", "emerald"].includes(theme)) return "light";
  return "dark";
}

/* ----- Theme Context ----- */

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);
  const resolvedLightDark = resolveThemeToLightDark(settings.theme);

  // ?? Initial sync: push loaded React settings to Bridge on mount ??
  useEffect(() => {
    syncSettingsToBridge(settings);
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?? Apply CSS variables ??
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedLightDark);
    root.setAttribute("data-theme-name", settings.theme);
    root.style.setProperty("--radius", settings.borderRadius + "px");
    root.style.setProperty("--window-opacity", String(settings.windowOpacity / 100));
    root.style.setProperty("--sidebar-width", settings.sidebarWidth + "px");
    root.style.setProperty("--font-scale", String(settings.fontScale / 100));
    const tv = getCssTransitionValues(settings.animationSpeed);
    root.style.setProperty("--transition-fast", tv.fast);
    root.style.setProperty("--transition-normal", tv.normal);
    root.style.setProperty("--transition-slow", tv.slow);
    injectThemeCss(settings.theme);
  }, [settings]);

  // ?? System theme listener ??
  useEffect(() => {
    if (settings.theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const t = getSystemTheme();
      document.documentElement.setAttribute("data-theme", t);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  // ?? Mutators (localStorage + state + Bridge mirror) ??

  const setTheme = useCallback((theme: Theme) => {
    setSettingsState(prev => {
      const next = { ...prev, theme };
      saveSettings(next);
      syncSettingsToBridge({ theme });
      return next;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      syncSettingsToBridge(partial);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const defaults = { ...defaultSettings };
    setSettingsState(defaults);
    saveSettings(defaults);
    syncSettingsToBridge(defaults);
  }, []);

  const toggleTheme = useCallback(() => {
    setSettingsState(prev => {
      const themes: Theme[] = ["light", "dark", "auto", "graphite", "midnight", "ocean", "emerald", "crimson"];
      const idx = themes.indexOf(prev.theme);
      const nextTheme = themes[(idx + 1) % themes.length];
      const next = { ...prev, theme: nextTheme };
      saveSettings(next);
      syncSettingsToBridge({ theme: nextTheme });
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme: settings.theme,
      resolvedTheme: resolvedLightDark,
      settings,
      setTheme,
      updateSettings,
      resetSettings,
      toggleTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
