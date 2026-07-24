/**
 * SvgFluidRenderer — SVG feTurbulence + feDisplacementMap 流体背景渲染器
 * 将输入图片分成 4 象限，通过 SVG 滤镜扭曲 + CSS 旋转动画产生有机流体效果
 * 参考: refined-now-playing-netease-next (SUlTlUS)
 */

import { useEffect, useRef, useCallback, type FC } from "react";
import "./SvgFluidRenderer.css";

export interface SvgFluidRendererProps {
  /** 图片 URL (base64 或 http URL) */
  imageUrl: string;
  /** 总开关 */
  enabled?: boolean;
  /** 是否固定位移量 (true=固定400, false=随时间正弦变化) */
  static?: boolean;
  /** 速度倍率 0.1-3.0 */
  speedMultiplier?: number;
  /** 是否暂停动画 */
  paused?: boolean;
  /** 目标帧率 (30/60) */
  targetFps?: number;
  /** 额外 CSS 类名 */
  className?: string;
}

const CANVAS_SIZE = 100;

const SvgFluidRenderer: FC<SvgFluidRendererProps> = ({
  imageUrl,
  enabled = true,
  static: isStatic = false,
  speedMultiplier = 1.0,
  paused = false,
  targetFps = 60,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const canvas3Ref = useRef<HTMLCanvasElement>(null);
  const canvas4Ref = useRef<HTMLCanvasElement>(null);
  const feDisplacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const feTurbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // 绘制 4 象限到 canvas
  const drawQuadrants = useCallback((src: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const halfW = Math.floor(w / 2);
      const halfH = Math.floor(h / 2);

      const canvases = [
        canvas1Ref.current, canvas2Ref.current,
        canvas3Ref.current, canvas4Ref.current,
      ];
      const sx = [0, halfW, 0, halfW];
      const sy = [0, 0, halfH, halfH];

      canvases.forEach((canvas, i) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(img, sx[i], sy[i], halfW, halfH, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      });

      // 随机 seed 让每次换图有不同湍流形态
      if (feTurbulenceRef.current) {
        feTurbulenceRef.current.setAttribute("seed", String(Math.floor(Math.random() * 1000)));
      }
    };
    img.src = src;
  }, []);

  // 当 imageUrl 变化时重绘
  useEffect(() => {
    if (imageUrl) {
      drawQuadrants(imageUrl);
    }
  }, [imageUrl, drawQuadrants]);

  // 动态位移量动画 (含帧率限制)
  useEffect(() => {
    if (isStatic || !enabled || paused) return;

    startTimeRef.current = performance.now();
    const frameInterval = 1000 / targetFps;
    let lastFrameTime = 0;

    const animate = (now: number) => {
      if (now - lastFrameTime < frameInterval) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;

      const elapsed = (now - startTimeRef.current) * 0.001 * speedMultiplier;
      // 正弦波 200-600 范围, 周期约 8 秒
      const scale = 400 + Math.sin(elapsed * Math.PI * 0.25) * 200;
      if (feDisplacementMapRef.current) {
        feDisplacementMapRef.current.setAttribute("scale", String(Math.round(scale)));
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isStatic, enabled, paused, speedMultiplier, targetFps]);

  // 暂停/恢复时重置位移
  useEffect(() => {
    if (paused || !enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (feDisplacementMapRef.current) {
        feDisplacementMapRef.current.setAttribute("scale", "400");
      }
    }
  }, [paused, enabled]);

  if (!enabled || !imageUrl) return null;

  return (
    <>
      {/* SVG 滤镜定义 (隐藏) */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter
          id="svg-fluid-filter"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          filterUnits="objectBoundingBox"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            ref={feTurbulenceRef}
            type="fractalNoise"
            baseFrequency="0.005"
            numOctaves="1"
            seed="0"
          />
          <feDisplacementMap
            ref={feDisplacementMapRef}
            in="SourceGraphic"
            scale={isStatic ? "400" : "400"}
          />
        </filter>
      </svg>

      {/* 流体容器 */}
      <div
        className={`svg-fluid-background${className ? " " + className : ""}`}
        style={{
          backgroundImage: `url(${imageUrl})`,
          display: enabled ? undefined : "none",
        }}
      >
        <div
          ref={containerRef}
          className={`svg-fluid-rect${paused ? " paused" : ""}`}
          style={{
            animationDuration: `${150 / speedMultiplier}s`,
          }}
        >
          <canvas ref={canvas1Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas2Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas3Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas4Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
        </div>
      </div>
    </>
  );
};

export default SvgFluidRenderer;