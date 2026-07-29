/**
 * 专辑封面主色提取器
 * 基于加权采样算法
 */

// --- 类型 ---

export type RGB = [number, number, number];
export type HSL = [number, number, number];

// --- HSL 转换 ---

export function rgbToHsl([r, g, b]: RGB): HSL {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === nr) h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6;
    else if (max === ng) h = ((nb - nr) / d + 2) / 6;
    else h = ((nr - ng) / d + 4) / 6;
  }
  return [h, s, l];
}

export function hslToRgb([h, s, l]: HSL): RGB {
  let r = 0, g = 0, b = 0;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
// --- ?????? ---

/**
 * ??? RGB ?????????????????
 *
 * ?????? HSL??????? ~0.85?????? ~0.25?
 * ?? ? ??????????????????????
 * ?? ? ??????????
 *
 * @param rgb ?? RGB ??
 * @returns ???? RGB ??
 */
export function softenColorForGlow(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  const targetLightness = 0.85;
  const targetSaturation = 0.25;

  // ???????????????????????
  const blend = 0.7; // 70% ???????? 30% ????
  const newS = s + (targetSaturation - s) * blend;
  const newL = l + (targetLightness - l) * blend;

  return hslToRgb([h, Math.max(0, Math.min(1, newS)), Math.max(0, Math.min(1, newL))]);
}


// --- 同步提取 ---

export function extractDominantColor(base64: string): RGB | null {
  try {
    const img = new Image();
    return null;
  } catch {
    return null;
  }
}

/**
 * 从 base64 图片异步提取主色
 *
 * 算法：
 * 1. 裁剪居中 → 取最大内接正方形
 * 2. 降采样 → 缩放到固定采样尺寸
 * 3. 加权投票 → 饱和度+空间距离加权
 * 4. 过滤 → 极亮/极暗/透明像素排除
 */
export async function extractDominantColorAsync(base64: string): Promise<RGB | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        if (naturalW === 0 || naturalH === 0) { resolve(null); return; }

        const canvas = document.createElement("canvas");
        const sampleSize = 80; // 80x80 采样，大于 50x50 足够
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }

        // 取图片最大内接正方形区域
        const squareSize = Math.min(naturalW, naturalH);
        const sx = Math.floor((naturalW - squareSize) / 2);
        const sy = Math.floor((naturalH - squareSize) / 2);

        ctx.drawImage(
          img,
          sx, sy, squareSize, squareSize,  // 源区域（正方形）
          0, 0, sampleSize, sampleSize,     // 目标区域
        );

        const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        const half = sampleSize / 2;

        // 颜色key -> weighted count
        const colorWeight = new Map<string, number>();
        const quantize = 6; // 量化到 6 级，比 4 级更精细

        for (let py = 0; py < sampleSize; py++) {
          for (let px = 0; px < sampleSize; px++) {
            const idx = (py * sampleSize + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // 透明跳过
            if (a < 128) continue;

            // 极暗/极亮过滤，减少黑白干扰
            const brightness = (r + g + b) / 3;
            if (brightness < 20 || brightness > 235) continue;

            // 饱和度计算用于加权
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
            // 基础权重 0.2 + 饱和度 0.8，使鲜艳颜色更优先
            const satWeight = 0.2 + saturation * 0.8;

            // 空间距离权重：中心区域优先
            const dx = (px - half) / half;
            const dy = (py - half) / half;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // sigma=0.6: 中心权重 1.0，边缘约 0.25
            const spatialWeight = Math.exp(-(dist * dist) / (2 * 0.6 * 0.6));

            const weight = satWeight * spatialWeight;

            // 量化
            const qr = Math.floor(r / quantize) * quantize;
            const qg = Math.floor(g / quantize) * quantize;
            const qb = Math.floor(b / quantize) * quantize;

            const key = qr + "," + qg + "," + qb;
            colorWeight.set(key, (colorWeight.get(key) || 0) + weight);
          }
        }

        if (colorWeight.size === 0) { resolve(null); return; }

        // 取权重最高的颜色
        let bestKey = "";
        let bestWeight = 0;
        for (const [key, w] of colorWeight) {
          if (w > bestWeight) {
            bestWeight = w;
            bestKey = key;
          }
        }

        if (bestKey) {
          const [r, g, b] = bestKey.split(",").map(Number);
          resolve([r, g, b]);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

// --- 调色板 ---

/**
 * 生成 5 色封面调色板 + 背景色
 */
export function generateCoverPalette(dominant: RGB): {
  colors: RGB[];
  background: RGB;
} {
  const [h, s, l] = rgbToHsl(dominant);

  const colors: RGB[] = [
    dominant,
    hslToRgb([(h + 0.05) % 1, Math.min(1, s * 1.1), Math.min(0.8, l * 1.15)]),
    hslToRgb([(h + 0.12) % 1, Math.min(1, s * 0.9), Math.max(0.2, l * 0.85)]),
    hslToRgb([(h - 0.08 + 1) % 1, Math.min(1, s * 1.05), Math.min(0.75, l + 0.1)]),
    hslToRgb([(h + 0.45) % 1, Math.min(1, s * 0.6), Math.min(0.7, l * 0.9)]),
  ];

  const background: RGB = hslToRgb([h, Math.min(1, s * 0.4), Math.max(0.04, l * 0.15)]);

  return { colors, background };
}
