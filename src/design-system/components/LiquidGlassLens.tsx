/**
 * LiquidGlassLens - 苹果 Liquid Glass 物理折射与色散水滴透镜
 *
 * 参考自 demos/demo.html 的物理折射数学模型与开源 live DOM 折射方案：
 * - 中心恢复正常，边缘放大畸变
 * - 径向多通道 RGB 色散 (Chromatic Aberration)
 * - 左上角菲涅尔主聚光 + 底部环境二次反光 + 边缘暗角
 * - 拖拽时的运动弹性形变 (Squash & Stretch)
 */

import { memo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface LiquidGlassLensProps {
  /** 是否处于激活状态 */
  active: boolean;
  /** 当前水滴中心 X 坐标 */
  x: number;
  /** 当前水滴中心 Y 坐标 */
  y: number;
  /** 水滴半径，默认 85px */
  radius?: number;
  /** 是否处于拖动状态 (影响弹性拉伸) */
  isDragging?: boolean;
}

export const LiquidGlassLens = memo(function LiquidGlassLens({
  active,
  x,
  y,
  radius = 85,
  isDragging = false,
}: LiquidGlassLensProps) {
  const prevPos = useRef({ x, y });
  const stretchRef = useRef({ sx: 1, sy: 1, angle: 0 });

  // 根据鼠标移动速度计算弹性拉伸形变
  useEffect(() => {
    if (!active) return;
    const dx = x - prevPos.current.x;
    const dy = y - prevPos.current.y;
    const speed = Math.sqrt(dx * dx + dy * dy);
    prevPos.current = { x, y };

    if (speed > 1) {
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const factor = Math.min(speed / 25, 0.28);
      stretchRef.current = {
        sx: 1 + factor,
        sy: 1 - factor * 0.6,
        angle,
      };
    } else {
      stretchRef.current = { sx: 1, sy: 1, angle: 0 };
    }
  }, [x, y, active]);

  const size = radius * 2;

  return (
    <>
      {/* 隐藏的 SVG 滤镜定义：用于 Live DOM 的边缘折射与 3 通道色散 */}
      <svg
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <defs>
          <filter
            id="liquid-glass-lens-refract"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            {/* 边缘置换贴图：平滑径向过渡 */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="2"
              seed="12"
              result="noise"
            />
            {/* 色散分离：Red 通道外偏折 */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
              result="redPass"
            />
            {/* 色散分离：Blue 通道内偏折 */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="7"
              xChannelSelector="B"
              yChannelSelector="R"
              result="bluePass"
            />
            <feBlend in="redPass" in2="bluePass" mode="screen" result="blendedDispersion" />
            <feBlend in="SourceGraphic" in2="blendedDispersion" mode="normal" />
          </filter>
        </defs>
      </svg>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isDragging ? [1, 1.05, 1] : 1,
              opacity: 1,
              rotate: stretchRef.current.angle,
            }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }}
            transition={{
              type: "spring",
              damping: 18,
              stiffness: 260,
              mass: 0.7,
            }}
            style={{
              position: "fixed",
              left: x - radius,
              top: y - radius,
              width: size,
              height: size,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 999999,
              willChange: "transform, left, top",
              /* 背景物理折射与通透高斯模糊层 */
              backdropFilter: "blur(2.5px) saturate(1.8) contrast(1.12)",
              WebkitBackdropFilter: "blur(2.5px) saturate(1.8) contrast(1.12)",
              /* 外围投影与菲涅尔外发光 */
              boxShadow: `
                0 16px 40px -8px rgba(0, 0, 0, 0.35),
                0 4px 16px rgba(0, 113, 227, 0.22),
                inset 0 0 0 1px rgba(255, 255, 255, 0.55),
                inset 0 2px 4px 0 rgba(255, 255, 255, 0.8),
                inset 0 -2px 6px 0 rgba(0, 0, 0, 0.25)
              `,
              overflow: "hidden",
            }}
          >
            {/* 1. 左上角主菲涅尔聚光弧 (Specular Highlight) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 35% 28%,
                  rgba(255, 255, 255, 0.85) 0%,
                  rgba(255, 255, 255, 0.25) 32%,
                  transparent 65%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 2. 底部环境二次反光弧 (Bottom Rim Light) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 65% 82%,
                  rgba(255, 255, 255, 0.35) 0%,
                  rgba(255, 255, 255, 0.08) 35%,
                  transparent 55%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 3. 边缘暗角透镜圈 (Edge Vignette) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 50% 50%,
                  transparent 60%,
                  rgba(0, 0, 0, 0.04) 75%,
                  rgba(0, 0, 0, 0.18) 100%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 4. 边缘彩虹微色散轮廓光环 (RGB Dispersion Ring) */}
            <div
              style={{
                position: "absolute",
                inset: 1,
                borderRadius: "inherit",
                padding: 1.5,
                background: `conic-gradient(
                  from 180deg at 50% 50%,
                  rgba(255, 95, 109, 0.45) 0deg,
                  rgba(255, 255, 255, 0.85) 45deg,
                  rgba(56, 189, 248, 0.55) 120deg,
                  rgba(192, 132, 252, 0.45) 220deg,
                  rgba(255, 95, 109, 0.45) 360deg
                )`,
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                pointerEvents: "none",
                opacity: 0.85,
              }}
            />

            {/* 5. 中心水波纹微折射透光点 */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "55%",
                height: "55%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 80%)",
                pointerEvents: "none",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default LiquidGlassLens;
