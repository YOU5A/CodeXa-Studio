import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface UnlockArrivalAnimationProps {
  startX?: number;
  startY?: number;
  onComplete: () => void;
}

interface TargetMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

interface Point {
  x: number;
  y: number;
}

function buildPathFromPoints(pts: Point[]): string {
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length; i += 3) {
    d += ` C ${fmt(pts[i].x)} ${fmt(pts[i].y)} ${fmt(pts[i + 1].x)} ${fmt(pts[i + 1].y)} ${fmt(pts[i + 2].x)} ${fmt(pts[i + 2].y)}`;
  }
  return d + " Z";
}

interface KeyframeData {
  t: number;
  points: Point[];
}

function getKeyframePoints(targetW: number, targetH: number): KeyframeData[] {
  const W = Math.max(targetW, 40);
  const H = Math.max(targetH, 20);
  const cx = W / 2;
  const cy = H / 2;
  const R = H / 2;
  const k90 = 0.55228475;
  const k45 = 0.2652165;
  const sqrt2_2 = Math.SQRT1_2;

  // Frame 0: 30px 直径的纯圆水滴
  const r0 = 15;
  const L0 = k45 * r0;
  const p0: Point[] = [
    { x: cx, y: cy - r0 },
    { x: cx + L0, y: cy - r0 }, { x: cx + r0 * sqrt2_2 - L0 * sqrt2_2, y: cy - r0 * sqrt2_2 - L0 * sqrt2_2 }, { x: cx + r0 * sqrt2_2, y: cy - r0 * sqrt2_2 },
    { x: cx + r0 * sqrt2_2 + L0 * sqrt2_2, y: cy - r0 * sqrt2_2 + L0 * sqrt2_2 }, { x: cx + r0, y: cy - L0 }, { x: cx + r0, y: cy },
    { x: cx + r0, y: cy + L0 }, { x: cx + r0 * sqrt2_2 + L0 * sqrt2_2, y: cy + r0 * sqrt2_2 - L0 * sqrt2_2 }, { x: cx + r0 * sqrt2_2, y: cy + r0 * sqrt2_2 },
    { x: cx + r0 * sqrt2_2 - L0 * sqrt2_2, y: cy + r0 * sqrt2_2 + L0 * sqrt2_2 }, { x: cx + L0, y: cy + r0 }, { x: cx, y: cy + r0 },
    { x: cx - L0, y: cy + r0 }, { x: cx - r0 * sqrt2_2 + L0 * sqrt2_2, y: cy + r0 * sqrt2_2 + L0 * sqrt2_2 }, { x: cx - r0 * sqrt2_2, y: cy + r0 * sqrt2_2 },
    { x: cx - r0 * sqrt2_2 - L0 * sqrt2_2, y: cy + r0 * sqrt2_2 - L0 * sqrt2_2 }, { x: cx - r0, y: cy + L0 }, { x: cx - r0, y: cy },
    { x: cx - r0, y: cy - L0 }, { x: cx - r0 * sqrt2_2 - L0 * sqrt2_2, y: cy - r0 * sqrt2_2 + L0 * sqrt2_2 }, { x: cx - r0 * sqrt2_2, y: cy - r0 * sqrt2_2 },
    { x: cx - r0 * sqrt2_2 + L0 * sqrt2_2, y: cy - r0 * sqrt2_2 - L0 * sqrt2_2 }, { x: cx - L0, y: cy - r0 }, { x: cx, y: cy - r0 },
  ];

  function makeCapsule(wHalf: number, radius: number, vComp = 0): Point[] {
    const rEff = radius - vComp;
    const topY = cy - rEff;
    const botY = cy + rEff;
    const shoulderX = Math.max(0, wHalf - radius);
    return [
      { x: cx, y: topY },
      { x: cx + shoulderX / 3, y: topY }, { x: cx + (2 * shoulderX) / 3, y: topY }, { x: cx + shoulderX, y: topY },
      { x: cx + shoulderX + k90 * radius, y: topY }, { x: cx + wHalf, y: cy - k90 * rEff }, { x: cx + wHalf, y: cy },
      { x: cx + wHalf, y: cy + k90 * rEff }, { x: cx + shoulderX + k90 * radius, y: botY }, { x: cx + shoulderX, y: botY },
      { x: cx + (2 * shoulderX) / 3, y: botY }, { x: cx + shoulderX / 3, y: botY }, { x: cx, y: botY },
      { x: cx - shoulderX / 3, y: botY }, { x: cx - (2 * shoulderX) / 3, y: botY }, { x: cx - shoulderX, y: botY },
      { x: cx - shoulderX - k90 * radius, y: botY }, { x: cx - wHalf, y: cy + k90 * rEff }, { x: cx - wHalf, y: cy },
      { x: cx - wHalf, y: cy - k90 * rEff }, { x: cx - shoulderX - k90 * radius, y: topY }, { x: cx - shoulderX, y: topY },
      { x: cx - (2 * shoulderX) / 3, y: topY }, { x: cx - shoulderX / 3, y: topY }, { x: cx, y: topY },
    ];
  }

  // Frame 1: 预备微鼓形变（横向拉伸至 43px，纵向收缩至 27px，边缘带微澜）
  const rx1 = 21.5;
  const ry1 = 13.5;
  const L1x = rx1 * k45;
  const L1y = ry1 * k45;
  const p1: Point[] = [
    { x: cx, y: cy - ry1 },
    { x: cx + L1x * 1.2, y: cy - ry1 }, { x: cx + rx1 * 0.78 + 1.2 - L1x * sqrt2_2, y: cy - ry1 * 0.78 - 0.5 - L1y * sqrt2_2 }, { x: cx + rx1 * 0.78 + 1.2, y: cy - ry1 * 0.78 - 0.5 },
    { x: cx + rx1 * 0.78 + 1.2 + L1x * sqrt2_2, y: cy - ry1 * 0.78 - 0.5 + L1y * sqrt2_2 }, { x: cx + rx1, y: cy - L1y * 1.1 }, { x: cx + rx1, y: cy },
    { x: cx + rx1, y: cy + L1y * 1.1 }, { x: cx + rx1 * 0.76 + L1x * sqrt2_2, y: cy + ry1 * 0.82 + 0.6 - L1y * sqrt2_2 }, { x: cx + rx1 * 0.76, y: cy + ry1 * 0.82 + 0.6 },
    { x: cx + rx1 * 0.76 - L1x * sqrt2_2, y: cy + ry1 * 0.82 + 0.6 + L1y * sqrt2_2 }, { x: cx + L1x * 1.1, y: cy + ry1 + 0.3 }, { x: cx, y: cy + ry1 + 0.3 },
    { x: cx - L1x * 1.1, y: cy + ry1 + 0.3 }, { x: cx - rx1 * 0.77 - 0.6 + L1x * sqrt2_2, y: cy + ry1 * 0.80 + 0.4 + L1y * sqrt2_2 }, { x: cx - rx1 * 0.77 - 0.6, y: cy + ry1 * 0.80 + 0.4 },
    { x: cx - rx1 * 0.77 - 0.6 - L1x * sqrt2_2, y: cy + ry1 * 0.80 + 0.4 - L1y * sqrt2_2 }, { x: cx - rx1, y: cy + L1y * 1.1 }, { x: cx - rx1, y: cy },
    { x: cx - rx1, y: cy - L1y * 1.1 }, { x: cx - rx1 * 0.79 - L1x * sqrt2_2, y: cy - ry1 * 0.77 - 0.6 + L1y * sqrt2_2 }, { x: cx - rx1 * 0.79, y: cy - ry1 * 0.77 - 0.6 },
    { x: cx - rx1 * 0.79 + L1x * sqrt2_2, y: cy - ry1 * 0.77 - 0.6 - L1y * sqrt2_2 }, { x: cx - L1x * 1.2, y: cy - ry1 }, { x: cx, y: cy - ry1 },
  ];

  // Frame 2: 液态流舌向两侧喷展（宽度达 82%，中心保持饱满厚度）
  const wHalf2 = (W / 2) * 0.82;
  const neckX2 = wHalf2 * 0.58;
  const neckY2 = H * 0.36;
  const centerThick2 = H * 0.46;
  const tipH2 = H * 0.28;
  const p2: Point[] = [
    { x: cx, y: cy - centerThick2 },
    { x: cx + neckX2 * 0.45, y: cy - centerThick2 }, { x: cx + neckX2 - neckX2 * 0.25, y: cy - neckY2 }, { x: cx + neckX2, y: cy - neckY2 },
    { x: cx + neckX2 + (wHalf2 - neckX2) * 0.5, y: cy - neckY2 }, { x: cx + wHalf2, y: cy - tipH2 * k90 }, { x: cx + wHalf2, y: cy },
    { x: cx + wHalf2, y: cy + tipH2 * k90 }, { x: cx + neckX2 + (wHalf2 - neckX2) * 0.5, y: cy + neckY2 }, { x: cx + neckX2, y: cy + neckY2 },
    { x: cx + neckX2 - neckX2 * 0.25, y: cy + neckY2 }, { x: cx + neckX2 * 0.45, y: cy + centerThick2 }, { x: cx, y: cy + centerThick2 },
    { x: cx - neckX2 * 0.45, y: cy + centerThick2 }, { x: cx - neckX2 + neckX2 * 0.25, y: cy + neckY2 }, { x: cx - neckX2, y: cy + neckY2 },
    { x: cx - neckX2 - (wHalf2 - neckX2) * 0.5, y: cy + neckY2 }, { x: cx - wHalf2, y: cy + tipH2 * k90 }, { x: cx - wHalf2, y: cy },
    { x: cx - wHalf2, y: cy - tipH2 * k90 }, { x: cx - neckX2 - (wHalf2 - neckX2) * 0.5, y: cy - neckY2 }, { x: cx - neckX2, y: cy - neckY2 },
    { x: cx - neckX2 + neckX2 * 0.25, y: cy - neckY2 }, { x: cx - neckX2 * 0.45, y: cy - centerThick2 }, { x: cx, y: cy - centerThick2 },
  ];

  // Frame 3: 胶囊成形 (98.5% 宽度)
  const p3 = makeCapsule((W / 2) * 0.985, R);

  // Frame 4: 表面张力微冲回弹 (+2.5px 宽度超调)
  const p4 = makeCapsule(W / 2 + 2.5, R, 0.25);

  // Frame 5: 最终落定精准胶囊 (100% 宽度，完美半圆半径)
  const p5 = makeCapsule(W / 2, R, 0);

  return [
    { t: 0, points: p0 },
    { t: 0.16, points: p1 },
    { t: 0.45, points: p2 },
    { t: 0.72, points: p3 },
    { t: 0.88, points: p4 },
    { t: 1.0, points: p5 },
  ];
}

function interpolateFromKeyframes(kfs: KeyframeData[], progress: number): string {
  const t = Math.max(0, Math.min(1, progress));

  let idx = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].t && t <= kfs[i + 1].t) {
      idx = i;
      break;
    }
  }

  const kA = kfs[idx];
  const kB = kfs[idx + 1];
  const localRatio = (t - kA.t) / (kB.t - kA.t);
  const u = smoothstep(localRatio);

  const interp: Point[] = [];
  for (let j = 0; j < 25; j++) {
    interp.push({
      x: lerp(kA.points[j].x, kB.points[j].x, u),
      y: lerp(kA.points[j].y, kB.points[j].y, u),
    });
  }
  return buildPathFromPoints(interp);
}

function measureTarget(): TargetMetrics {
  const ncmBtn = document.querySelector<HTMLElement>('[data-nav-id="ncmstudio"]');
  if (ncmBtn) {
    const rect = ncmBtn.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    }
  }

  const musicBtn = document.querySelector<HTMLElement>('[data-nav-id="musicmanager"]');
  if (musicBtn) {
    const rect = musicBtn.getBoundingClientRect();
    const gap = 5;
    const estTop = rect.bottom + gap;
    return {
      left: rect.left,
      top: estTop,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: estTop + rect.height / 2,
    };
  }

  return {
    left: 10,
    top: 250,
    width: 200,
    height: 36,
    centerX: 110,
    centerY: 268,
  };
}

export function UnlockArrivalAnimation({ startX, startY, onComplete }: UnlockArrivalAnimationProps) {
  const defaultStartX = startX ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 500);
  const defaultStartY = startY ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 350);

  // 1. 获取终点几何信息
  const [target, setTarget] = useState<TargetMetrics>(() => measureTarget());
  const [animStage, setAnimStage] = useState<"flying" | "morphing" | "fading">("flying");

  // 预生成 Keyframes，插值运算极快 (0ms 开销)
  const keyframes = useMemo(() => getKeyframePoints(target.width, target.height), [target.width, target.height]);
  const [currentD, setCurrentD] = useState(() => interpolateFromKeyframes(keyframes, 0));

  useEffect(() => {
    // 挂载首帧立即重新测量已渲染的 DOM 元素真实坐标
    const initialTarget = measureTarget();
    setTarget(initialTarget);

    let animId: number;

    // 步骤一：平滑飞行 (Flight, 520ms) 由 Framer Motion 硬件加速平滑插值，彻底杜绝瞬移与掉帧
    const morphTimer = setTimeout(() => {
      // 步骤二：到达终点中心，再次精准校验 NCM 按钮当前几何并启动 5 阶段样条展开 (Morph, 850ms)
      const arrivalTarget = measureTarget();
      setTarget(arrivalTarget);

      setAnimStage("morphing");
      window.dispatchEvent(new CustomEvent("codexa-unlock-arrival"));

      const startTime = performance.now();
      const morphDuration = 850; // ms

      const frame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / morphDuration);

        const d = interpolateFromKeyframes(keyframes, progress);
        setCurrentD(d);

        if (progress < 1) {
          animId = requestAnimationFrame(frame);
        } else {
          // 步骤三：展开完成稳定落定，触发交接与自动跳转
          console.log("[UnlockArrival] Morph completed, triggering handoff & navigate to ncmstudio");
          window.dispatchEvent(new CustomEvent("codexa-unlock-handoff"));

          // 保持在终点柔和淡出与原生胶囊融合 (260ms)
          setAnimStage("fading");
          setTimeout(() => {
            onComplete();
          }, 280);
        }
      };

      animId = requestAnimationFrame(frame);
    }, 520);

    return () => {
      clearTimeout(morphTimer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [keyframes, onComplete]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cs-flight-wobble {
          0%, 100% { transform: scale(1, 1); }
          25% { transform: scale(1.10, 0.90); }
          50% { transform: scale(0.92, 1.08); }
          75% { transform: scale(1.05, 0.95); }
        }
      `}</style>

      {/* 
        运动容器：由 GPU 硬件加速的 Framer Motion transform 驱动
        飞行阶段使用优雅的 cubic-bezier 曲线平滑减速，绝不掉帧、绝不瞬移 
      */}
      <motion.div
        initial={{ x: defaultStartX, y: defaultStartY }}
        animate={{ x: target.centerX, y: target.centerY }}
        transition={{
          duration: 0.52,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      >
        {animStage === "flying" ? (
          /* ========================================================
             阶段一：水滴飞行态 (100% 还原图 1 的完美 Liquid Glass 质感)
             ======================================================== */
          <div
            style={{
              position: "absolute",
              left: -15,
              top: -15,
              width: 30,
              height: 30,
              borderRadius: "50%",
              // 完全使用图 1 的通透白亮径向渐变，绝无丑陋生硬的实心蓝圈
              background:
                "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.01) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              boxShadow:
                "0 8px 28px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.12), 0 0 24px rgba(255,255,255,0.20), inset 0 0 20px rgba(255,255,255,0.10)",
              animation: "cs-flight-wobble 0.9s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        ) : (
          /* ========================================================
             阶段二 & 三：原位 5 阶段样条形变展开态 (延续图 1 纯正 Liquid Glass 质感，零锯齿，零蓝色)
             ======================================================== */
          <div
            style={{
              position: "absolute",
              left: -target.width / 2,
              top: -target.height / 2,
              width: target.width,
              height: target.height,
              pointerEvents: "none",
              opacity: animStage === "fading" ? 0 : 1,
              transition: animStage === "fading" ? "opacity 0.26s ease-out" : "none",
            }}
          >
            <svg
              width={target.width}
              height={target.height}
              viewBox={`0 0 ${target.width} ${target.height}`}
              style={{
                position: "absolute",
                inset: 0,
                overflow: "visible",
                pointerEvents: "none",
              }}
            >
              <defs>
                {/* 纯正通透白亮 Liquid Glass 材质渐变，彻底消灭蓝色，与图 1 完美统一 */}
                <radialGradient id="cs-arrival-liquid-glass" cx="35%" cy="30%" r="75%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.50)" />
                  <stop offset="30%" stopColor="rgba(255, 255, 255, 0.20)" />
                  <stop offset="70%" stopColor="rgba(255, 255, 255, 0.08)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
                </radialGradient>
              </defs>

              <path
                d={currentD}
                fill="url(#cs-arrival-liquid-glass)"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.2"
                style={{
                  filter:
                    "drop-shadow(0 6px 20px rgba(0, 0, 0, 0.25)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.20))",
                }}
              />
            </svg>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
