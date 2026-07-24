/**
 * FluidBackground 运行时配置与本地持久化
 * 独立存储，不与 AppSettings 耦合
 */

export interface FluidConfig {
  preset: FluidPresetId | "auto";
  intensity: number;          // 0-1，整体不透明度
  quality: "low" | "medium" | "high";
  interactive: boolean;       // 是否响应鼠标移动
  enabled: boolean;           // 总开关
  speedMultiplier: number;    // 流速倍率 0.1-3.0
  blurAmount: number;         // 模糊程度 0-1
  colorMode: "auto" | "cover" | "dynamic"; // 颜色模式
}

export type FluidPresetId =
  | "aurora"
  | "ocean"
  | "ember"
  | "nebula"
  | "plasma"
  | "forest"
  | "cover"
  | "fluid"
  | "custom";

export const DEFAULT_CONFIG: FluidConfig = {
  preset: "auto",
  intensity: 0.6,
  quality: "medium",
  interactive: true,
  enabled: true,
  speedMultiplier: 1.0,
  blurAmount: 0,
  colorMode: "auto",
};

const STORAGE_KEY = "fluid-background-config";

export function loadConfig(): FluidConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    console.warn("[FluidBackground] 配置加载失败，使用默认值");
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: FluidConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    console.warn("[FluidBackground] 配置保存失败");
  }
}