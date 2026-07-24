/**
 * FluidBackground Canvas 2D 渲染引擎
 * 基于多彩光斑流动：径向渐变圆 + alpha 混合
 * 灵感参考 AMLL MeshGradientRenderer, 简化实现
 */

import type { FluidConfig, FluidPresetId } from "./config";
import { PRESETS, resolveAutoPreset, type FluidPreset } from "./presets";
import { generateCoverPalette } from "@/utils/colorExtractor";

// ---------- 类型 ----------

interface Blob {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: [number, number, number];
  radius: number;
  opacity: number;
}

interface QualitySettings {
  resolutionScale: number;
  blurPasses: number;
}

const QUALITY: Record<string, QualitySettings> = {
  low:    { resolutionScale: 0.25, blurPasses: 1 },
  medium: { resolutionScale: 0.5,  blurPasses: 2 },
  high:   { resolutionScale: 0.75, blurPasses: 3 },
};

// ---------- 工具函数 ----------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 简易 smooth noise (基于正弦哈希) */
function smoothNoise(x: number, y: number, t: number): number {
  const a = Math.sin(x * 3.7 + t * 0.3) * Math.cos(y * 4.1 + t * 0.4);
  const b = Math.sin((x + y) * 2.3 + t * 0.5) * Math.cos(x * 5.7 - t * 0.35);
  return (a + b) * 0.5;
}

// ---------- FluidRenderer ----------

export class FluidRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private offCanvas: HTMLCanvasElement | null = null;
  private offCtx: CanvasRenderingContext2D | null = null;

  private blobs: Blob[] = [];
  private animFrameId = 0;
  private running = false;
  private visible = true;

  private config: FluidConfig;
  private currentPreset: FluidPreset;
  private coverColor: [number, number, number] | null = null;
  private coverPalette: { colors: [number, number, number][]; background: [number, number, number] } | null = null;

  private lastTime = 0;
  private elapsedSinceDrift = 0;
  private globalTime = 0;

  private width = 0;
  private height = 0;

  private reducedMotion = false;
  private motionMediaQuery?: MediaQueryList;

  // FPS limiting
  private targetFps = 60;
  private frameInterval = 1000 / 60;
  private lastFrameTimestamp = 0;

  // ---------- 构造与生命周期 ----------

  constructor(canvas: HTMLCanvasElement, config: FluidConfig) {
    this.canvas = canvas;
    this.config = { ...config };
    this.currentPreset = this.resolvePreset(config.preset);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.initContext();
    this.spawnBlobs();
    this.setupMotionListener();
  }

  private initContext(): void {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    this.offCanvas = document.createElement("canvas");
    this.offCtx = this.offCanvas.getContext("2d", { alpha: true });
  }

  private setupMotionListener(): void {
    this.motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
      if (e.matches) {
        this.stop();
      } else if (this.running === false && this.visible) {
        this.start();
      }
    };
    this.motionMediaQuery.addEventListener("change", handler);
  }

  // ---------- 预设解析 ----------

  private resolvePreset(presetId: FluidPresetId | "auto"): FluidPreset {
    if (presetId === "auto") {
      const themeName = document.documentElement.dataset.themeName;
      return PRESETS[resolveAutoPreset(themeName)] ?? PRESETS.aurora;
    }
    if (presetId === "cover") {
      // "cover" preset: use cover palette if available, fallback to aurora
      return PRESETS.cover ?? PRESETS.aurora;
    }
    return PRESETS[presetId] ?? PRESETS.aurora;
  }

  // ---------- 光斑生成 ----------

  private spawnBlobs(): void {
    const p = this.currentPreset;
    const count = p.blobCount;
    this.blobs = [];

    // When cover/auto mode and cover palette is available, use cover colors
    const isCoverLike = this.config.colorMode === "cover";
    const colorSource = (isCoverLike && this.coverPalette)
      ? this.coverPalette.colors
      : p.palette.colors;

    for (let i = 0; i < count; i++) {
      this.blobs.push({
        x: Math.random(),
        y: Math.random(),
        targetX: Math.random(),
        targetY: Math.random(),
        color: colorSource[i % colorSource.length],
        radius: rand(p.blobRadius[0], p.blobRadius[1]),
        opacity: rand(p.blobOpacity[0], p.blobOpacity[1]),
      });
    }
  }

  // ---------- 配置更新 ----------

  updateConfig(config: Partial<FluidConfig>): void {
    const prevPreset = this.config.preset;
    const prevColorMode = this.config.colorMode;
    const prevEnabled = this.config.enabled;
    Object.assign(this.config, config);

    // Handle enabled toggle - just start/stop, no DOM manipulation
    if (config.enabled !== undefined && config.enabled !== prevEnabled) {
      if (config.enabled) {
        if (!this.running) this.start();
      } else {
        this.stop();
        // Clear canvas to blank when disabled
        const ctx = this.ctx;
        if (ctx && this.canvas) {
          ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
      }
    }

    if (config.preset !== undefined && config.preset !== prevPreset) {
      this.currentPreset = this.resolvePreset(config.preset);
      this.spawnBlobs();
    }
    // Switch to/from cover/auto mode: reassign blob colors
    if (config.colorMode !== undefined && config.colorMode !== prevColorMode) {
      const isCoverLike = (mode: string) => mode === "cover";
      if (isCoverLike(config.colorMode) && this.coverPalette) {
        const paletteColors = this.coverPalette.colors;
        for (let i = 0; i < this.blobs.length; i++) {
          this.blobs[i].color = paletteColors[i % paletteColors.length];
        }
      } else if (isCoverLike(prevColorMode) && !isCoverLike(config.colorMode)) {
        this.spawnBlobs();
      }
    }
    if (config.intensity !== undefined) {
      this.canvas!.style.opacity = String(config.intensity);
    }
  }

  setPreset(presetId: FluidPresetId | "auto"): void {
    this.updateConfig({ preset: presetId });
  }

  // ---------- 鼠标交互 ----------

  /** 在指定位置注入光斑扰动 */
  splat(nx: number, ny: number, force = 1.0): void {
    if (!this.config.interactive) return;
    // Guard against NaN from pointer events on zero-size canvas
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    // 随机扰动附近光斑的 target
    for (const blob of this.blobs) {
      const dx = blob.x - nx;
      const dy = blob.y - ny;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.25) {
        const strength = (1 - dist / 0.25) * force;
        blob.targetX += (blob.targetX - nx) * strength * 0.5;
        blob.targetY += (blob.targetY - ny) * strength * 0.5;
        blob.targetX = Math.max(0, Math.min(1, blob.targetX));
        blob.targetY = Math.max(0, Math.min(1, blob.targetY));
      }
    }
  }

  // ---------- 封面颜色 ----------

  /** Set cover dominant color - used by cover and auto color modes */
  setCoverColor(color: [number, number, number] | null): void {
    this.coverColor = color;
    if (color) {
      this.coverPalette = generateCoverPalette(color);
      // Reassign blob colors when in cover or auto mode
      if ((this.config.colorMode === "cover" || this.config.colorMode === "auto") && this.blobs.length > 0) {
        const paletteColors = this.coverPalette.colors;
        for (let i = 0; i < this.blobs.length; i++) {
          this.blobs[i].color = paletteColors[i % paletteColors.length];
        }
      }
    } else {
      this.coverPalette = null;
      // Restore preset colors when cover is removed while in cover/auto mode
      if (this.config.colorMode === "cover" || this.config.colorMode === "auto") {
        this.spawnBlobs();
      }
    }
  }

  // ---------- 动画控制 ----------

  start(): void {
    if (this.running || this.reducedMotion) return;
    this.running = true;
    this.lastTime = performance.now();
    this.lastFrameTimestamp = this.lastTime;
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  destroy(): void {
    this.stop();
    this.motionMediaQuery?.removeEventListener("change", () => {});
    this.canvas = null;
    this.ctx = null;
    this.offCanvas = null;
    this.offCtx = null;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v && !this.running && !this.reducedMotion) {
      this.start();
    } else if (!v) {
      this.stop();
    }
  }

  /** Set target FPS for frame rate limiting */
  setTargetFps(fps: number): void {
    this.targetFps = Math.max(15, Math.min(120, fps));
    this.frameInterval = 1000 / this.targetFps;
  }

  // ---------- 主循环 ----------

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    // FPS limiting: skip frames that arrive before the interval
    const frameElapsed = timestamp - this.lastFrameTimestamp;
    if (frameElapsed < this.frameInterval) {
      this.animFrameId = requestAnimationFrame(this.loop);
      return;
    }
    this.lastFrameTimestamp = timestamp;

    const dt = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;
    this.globalTime += dt;

    if (dt > 0) {
      this.updateBlobs(dt);
      this.render();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // ---------- 光斑运动 ----------

    private updateBlobs(dt: number): void {
    const p = this.currentPreset;
    const baseSpeed = p.flowSpeed * this.config.speedMultiplier * (dt / 1000);
    // Clamp lerp factor to prevent overshoot at high speeds
    const speed = Math.min(baseSpeed, 0.95);
    this.elapsedSinceDrift += dt;

    // Scale drift interval inversely with speed for smooth motion at any speed
    const effectiveDriftInterval = p.driftInterval / Math.sqrt(Math.max(0.1, this.config.speedMultiplier));

    // Regularly update target positions
    if (this.elapsedSinceDrift >= effectiveDriftInterval) {
      this.elapsedSinceDrift = 0;
      for (const blob of this.blobs) {
        blob.targetX = Math.max(0.05, Math.min(0.95, blob.targetX + rand(-p.jitter, p.jitter)));
        blob.targetY = Math.max(0.05, Math.min(0.95, blob.targetY + rand(-p.jitter, p.jitter)));
      }
    }

    // Move blobs toward targets
    for (const blob of this.blobs) {
      const noiseVal = smoothNoise(blob.x, blob.y, this.globalTime * 0.001) * 0.3;
      const nx = lerp(blob.x, blob.targetX + noiseVal, speed * 0.8);
      const ny = lerp(blob.y, blob.targetY + noiseVal, speed * 0.8);
      // Clamp to prevent NaN propagation
      blob.x = Number.isFinite(nx) ? Math.max(0, Math.min(1, nx)) : blob.x;
      blob.y = Number.isFinite(ny) ? Math.max(0, Math.min(1, ny)) : blob.y;
    }
  }

  // ---------- 渲染 ----------

  private render(): void {
    const canvas = this.canvas!;
    const ctx = this.ctx!;
    const offCanvas = this.offCanvas!;
    const offCtx = this.offCtx!;

    const w = canvas.width;
    const h = canvas.height;

    if (w === 0 || h === 0) return;

    // 计算离屏分辨率
    const qs = QUALITY[this.config.quality] ?? QUALITY.medium;
    const offW = Math.max(64, Math.floor(w * qs.resolutionScale));
    const offH = Math.max(64, Math.floor(h * qs.resolutionScale));

    if (offCanvas.width !== offW || offCanvas.height !== offH) {
      offCanvas.width = offW;
      offCanvas.height = offH;
    }

    // 1. 清空离屏画布
    offCtx.clearRect(0, 0, offW, offH);

    // 2. 填充背景底色
    // Auto mode: use cover palette when available, otherwise preset
    // Cover mode: force cover palette (fallback to preset if unavailable)
    const useCoverPalette = this.config.colorMode === "cover" && this.coverPalette;
    const palette = useCoverPalette
      ? this.coverPalette!
      : this.currentPreset.palette;
    const bg = palette.background;
    offCtx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    offCtx.fillRect(0, 0, offW, offH);

    // 3. 绘制光斑
        const isCoverMode = this.config.colorMode === "cover" && !!this.coverPalette;

    for (const blob of this.blobs) {
      // Guard against NaN/Infinity propagation from splat or updateBlobs
      if (!Number.isFinite(blob.x) || !Number.isFinite(blob.y) || !Number.isFinite(blob.radius)) continue;
      if (!Number.isFinite(offW) || !Number.isFinite(offH)) break;

      const cx = blob.x * offW;
      const cy = blob.y * offH;
      const r = blob.radius * Math.min(offW, offH);

      // r must be positive for createRadialGradient
      if (!Number.isFinite(r) || r <= 0) continue;

      const [cr, cg, cb] = blob.color;
      const alpha = blob.opacity * this.config.intensity * (isCoverMode ? 1.5 : 1.0);

      const grad = offCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${alpha * 0.4})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

      offCtx.fillStyle = grad;
      offCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

        // 4. Blit offscreen to main canvas (browser auto-bilinear upscales for soft look)
    ctx.clearRect(0, 0, w, h);

    // Apply blur via canvas filter (GPU-accelerated in modern Chromium)
    if (this.config.blurAmount > 0) {
      ctx.filter = `blur(${this.config.blurAmount * 20}px)`;
    } else {
      ctx.filter = "none";
    }

    ctx.drawImage(offCanvas, 0, 0, w, h);
    ctx.filter = "none";
  }

  // ---------- 尺寸自适应 ----------

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const qs = QUALITY[this.config.quality] ?? QUALITY.medium;
    const scale = dpr * qs.resolutionScale;
    this.canvas.width = Math.floor(width * scale);
    this.canvas.height = Math.floor(height * scale);
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.width = width;
    this.height = height;
  }
}
