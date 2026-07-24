/**
 * FluidBackground 视觉预设
 * 定义色彩方案、光斑运动参数
 */

import type { FluidPresetId } from "./config";

export interface ColorPalette {
  /** 主色调 RGB [0-255] */
  colors: [number, number, number][];
  /** 背景底色 RGB */
  background: [number, number, number];
}

export interface FluidPreset {
  id: FluidPresetId;
  name: { zh: string; en: string };
  palette: ColorPalette;
  /** 光斑数量 */
  blobCount: number;
  /** 光斑半径 (相对画布) */
  blobRadius: [number, number];
  /** 光斑不透明度范围 */
  blobOpacity: [number, number];
  /** 运动速度系数 */
  flowSpeed: number;
  /** 目标位置更新间隔 (ms) */
  driftInterval: number;
  /** 光斑扰动幅度 */
  jitter: number;
}

export const PRESETS: Record<FluidPresetId, FluidPreset> = {
  aurora: {
    id: "aurora",
    name: { zh: "极光", en: "Aurora" },
    palette: {
      colors: [
        [100, 210, 255],
        [140, 100, 255],
        [220, 80, 240],
        [80, 200, 200],
        [160, 140, 255],
      ],
      background: [8, 12, 28],
    },
    blobCount: 14,
    blobRadius: [0.25, 0.50],
    blobOpacity: [0.35, 0.65],
    flowSpeed: 0.6,
    driftInterval: 4000,
    jitter: 0.3,
  },
  ocean: {
    id: "ocean",
    name: { zh: "深海", en: "Ocean" },
    palette: {
      colors: [
        [30, 100, 200],
        [20, 150, 180],
        [60, 180, 220],
        [10, 80, 160],
        [40, 130, 210],
      ],
      background: [4, 10, 30],
    },
    blobCount: 10,
    blobRadius: [0.30, 0.55],
    blobOpacity: [0.30, 0.55],
    flowSpeed: 0.35,
    driftInterval: 5000,
    jitter: 0.2,
  },
  ember: {
    id: "ember",
    name: { zh: "余烬", en: "Ember" },
    palette: {
      colors: [
        [255, 120, 30],
        [240, 80, 20],
        [255, 180, 50],
        [200, 50, 10],
        [255, 150, 60],
      ],
      background: [20, 6, 2],
    },
    blobCount: 18,
    blobRadius: [0.18, 0.38],
    blobOpacity: [0.40, 0.70],
    flowSpeed: 0.8,
    driftInterval: 3000,
    jitter: 0.4,
  },
  nebula: {
    id: "nebula",
    name: { zh: "星云", en: "Nebula" },
    palette: {
      colors: [
        [180, 60, 220],
        [80, 40, 200],
        [220, 100, 200],
        [120, 80, 240],
        [200, 50, 180],
      ],
      background: [10, 4, 24],
    },
    blobCount: 16,
    blobRadius: [0.22, 0.48],
    blobOpacity: [0.35, 0.60],
    flowSpeed: 0.5,
    driftInterval: 4500,
    jitter: 0.35,
  },
  plasma: {
    id: "plasma",
    name: { zh: "等离子", en: "Plasma" },
    palette: {
      colors: [
        [255, 40, 80],
        [40, 200, 255],
        [255, 220, 40],
        [200, 40, 255],
        [40, 255, 140],
      ],
      background: [16, 8, 20],
    },
    blobCount: 20,
    blobRadius: [0.15, 0.35],
    blobOpacity: [0.45, 0.75],
    flowSpeed: 1.2,
    driftInterval: 2500,
    jitter: 0.5,
  },
  forest: {
    id: "forest",
    name: { zh: "森林", en: "Forest" },
    palette: {
      colors: [
        [50, 180, 100],
        [30, 140, 70],
        [100, 200, 60],
        [60, 160, 130],
        [120, 180, 80],
      ],
      background: [4, 14, 6],
    },
    blobCount: 12,
    blobRadius: [0.25, 0.52],
    blobOpacity: [0.30, 0.55],
    flowSpeed: 0.45,
    driftInterval: 5000,
    jitter: 0.25,
  },
  cover: {
    id: "cover",
    name: { zh: "封面颜色", en: "Cover Color" },
    palette: {
      colors: [
        [140, 120, 220],
        [200, 140, 180],
        [120, 160, 220],
        [180, 120, 200],
        [160, 140, 210],
      ],
      background: [10, 8, 22],
    },
    blobCount: 14,
    blobRadius: [0.22, 0.48],
    blobOpacity: [0.35, 0.65],
    flowSpeed: 0.5,
    driftInterval: 4000,
    jitter: 0.3,
  },
  fluid: {
    id: "fluid",
    name: { zh: "流体", en: "Fluid" },
    palette: {
      colors: [
        [140, 120, 220],
        [200, 140, 180],
        [120, 160, 220],
        [180, 120, 200],
        [160, 140, 210],
      ],
      background: [10, 8, 22],
    },
    blobCount: 14,
    blobRadius: [0.22, 0.48],
    blobOpacity: [0.35, 0.65],
    flowSpeed: 0.5,
    driftInterval: 4000,
    jitter: 0.3,
  },
  custom: {
    id: "custom",
    name: { zh: "自定义", en: "Custom" },
    palette: {
      colors: [
        [120, 120, 240],
        [240, 120, 120],
        [120, 240, 120],
        [240, 200, 100],
        [200, 120, 240],
      ],
      background: [8, 8, 24],
    },
    blobCount: 14,
    blobRadius: [0.20, 0.45],
    blobOpacity: [0.35, 0.60],
    flowSpeed: 0.5,
    driftInterval: 4000,
    jitter: 0.3,
  },
};

/** 主题名 → 预设 ID 自动映射 */
const THEME_PRESET_MAP: Record<string, FluidPresetId> = {
  light: "aurora",
  auto: "aurora",
  dark: "nebula",
  graphite: "ocean",
  midnight: "plasma",
  ocean: "ocean",
  emerald: "forest",
  crimson: "ember",
};

export function resolveAutoPreset(themeName?: string | null): FluidPresetId {
  if (themeName && THEME_PRESET_MAP[themeName]) {
    return THEME_PRESET_MAP[themeName];
  }
  return "aurora";
}
