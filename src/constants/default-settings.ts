import type { AppSettings } from "@/types";
import type { AnimationSpeed } from "@/utils/animations";

export const defaultSettings: AppSettings = {
  windowOpacity: 100,
  borderRadius: 20,
  animationSpeed: "fast" as AnimationSpeed,
  rememberSize: true,
  rememberPosition: true,
  sidebarWidth: 240,
  fontScale: 120,
  compactMode: false,
  theme: "auto",
};
