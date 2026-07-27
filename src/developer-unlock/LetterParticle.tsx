import { useRef, useEffect, useState, useCallback, type MouseEvent } from "react";

interface LetterParticleProps {
  letter: string;
  isTarget: boolean;
  isNext: boolean;
  isCollected: boolean;
  isFailing: boolean;
  viewportWidth: number;
  viewportHeight: number;
  index: number;
  total: number;
  initialX: number;
  initialScale: number;
  particleId: number;
  occupiedRef: React.RefObject<{ x: number; y: number }[]>;
  onCollect: (letter: string) => void;
  onWrongClick: () => void;
}

const COLLISION_RADIUS = 64;
const REPULSION_STRENGTH = 250;
const FRICTION = 0.96;
export default function LetterParticle({
  letter,
  isTarget,
  isNext,
  isCollected,
  isFailing,
  viewportWidth,
  viewportHeight,
  index,
  total,
  initialX,
  initialScale,
  particleId,
  occupiedRef,
  onCollect,
  onWrongClick,
}: LetterParticleProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const posRef = useRef({ x: 0, y: 0 });
  const rotRef = useRef(0);
  const hoveredRef = useRef(false);
  const draggingRef = useRef(false);
  const dragActivatedRef = useRef(false);
  const [glowPos, setGlowPos] = useState<{ x: number; y: number } | null>(null);
  const [glowVisible, setGlowVisible] = useState(false);

  const baseX = initialX;
  const initialY = -(40 + Math.abs(Math.sin(index * 3.7)) * 120);
  const gravity = 180 + Math.abs(Math.sin(index * 2.1)) * 80;
  const rotationSpeed = (Math.sin(index * 5.3) * 2.0);
  const swayAmplitude = 8 + Math.abs(Math.sin(index * 1.7)) * 16;
  const swayFrequency = 0.012 + Math.abs(Math.sin(index * 4.1)) * 0.012;
  const baseScale = initialScale;
  const bounceDamping = 0.5 + Math.abs(Math.sin(index * 2.9)) * 0.3;
  const fontSize = 64;
  const halfW = 44;
  const bottomMargin = 44;

  useEffect(() => {
    if (isCollected) return;

    let lastTime = performance.now();
    let yPos = initialY;
    let xPos = baseX;
    let vyVal = 0;
    let vxVal = 0;
    let rot = 0;
    let swayVal = index;
    let bounceCount = 0;
    let settledFrames = 0;
    let isSettling = false;
    let settleStartY = 0;
    let settleStartTime = 0;

    // Drag/fling tracking
    let runningVx = 0;
    let runningVy = 0;
    let lastDragX = 0;
    let lastDragY = 0;
    let lastDragT = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const bottomEdge = viewportHeight - bottomMargin;
      const dragging = draggingRef.current;

      if (!dragging) {
        // --- Normal physics ---
        vyVal += gravity * dt;
        vxVal *= FRICTION;

        // Sway
        const fullySettled = settledFrames > 90;
        if (!fullySettled) {
          swayVal += swayFrequency;
        }
        const speedFactor = Math.min(1, Math.abs(vyVal) / 40);
        const settledFactor = 1 - Math.min(1, bounceCount / 4);
        const settleRatio = Math.min(1, settledFrames / 120);
        const effectiveSway = fullySettled ? 0 : swayAmplitude * speedFactor * (1 - settledFactor * 0.7) * (1 - settleRatio * 0.7);
        vxVal += Math.cos(swayVal) * effectiveSway * swayFrequency * 60 * dt * 0.5;

        xPos += vxVal * dt;
        yPos += vyVal * dt;

        // Collision avoidance (only when not fully settled)
        const occupied = occupiedRef.current;
        if (occupied && !fullySettled) {
          for (let j = 0; j < occupied.length; j++) {
            if (j === particleId) continue;
            const other = occupied[j];
            if (!other) continue;
            const dx = xPos - other.x;
            const dy = yPos - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < COLLISION_RADIUS && dist > 0.1) {
              const ratio = (COLLISION_RADIUS - dist) / COLLISION_RADIUS;
              const pushX = (dx / dist) * ratio * REPULSION_STRENGTH * dt;
              xPos += pushX;
              vxVal += pushX * 3;
            }
          }
        }

        // Clamp X
        if (xPos < halfW) { xPos = halfW; vxVal = Math.abs(vxVal) * 0.55; }
        if (xPos > viewportWidth - halfW) { xPos = viewportWidth - halfW; vxVal = -Math.abs(vxVal) * 0.55; }

        // Safety top clamp only (no bounce, let gravity bring it back)
        if (yPos < -50) { yPos = -50; vyVal = 0; }

        // Ground handling
        if (yPos >= bottomEdge) {
          if (!isSettling && Math.abs(vyVal) < 15 && bounceCount >= 1) {
            isSettling = true;
            settleStartY = yPos;
            settleStartTime = now;
          }

          if (isSettling) {
            // Smooth spring settle
            const elapsed = (now - settleStartTime) / 1000;
            const targetY = bottomEdge;
            const springOmega = 10;
            const springDamping = 7;
            const displacement = yPos - targetY;
            vyVal += (-springOmega * springOmega * displacement - springDamping * vyVal) * dt;
            yPos += vyVal * dt;
            if (Math.abs(yPos - targetY) < 0.3 && Math.abs(vyVal) < 2) {
              yPos = targetY;
              vyVal = 0;
              vxVal *= 0.7;
            }
          } else {
            // Normal bounce
            if (yPos > bottomEdge && vyVal > 0) bounceCount++;
            yPos = bottomEdge;
            vyVal *= -bounceDamping;
            if (Math.abs(vyVal) < 3 || bounceCount >= 5) {
              vyVal = 0;
              yPos = bottomEdge;
            }
          }
        } else {
          isSettling = false;
        }

        // Settled frame tracking
        if (yPos >= bottomEdge && Math.abs(vyVal) < 1) {
          settledFrames++;
        } else {
          settledFrames = Math.max(0, settledFrames - 3);
        }

        // Rotation: decay after landing
        const settleRatioRot = Math.min(1, settledFrames / 120);
        const currentRotationSpeed = rotationSpeed * (1 - settleRatioRot * 0.95);
        rot += currentRotationSpeed * dt * 60;

        // Ground separation: push apart settled letters
        if (yPos >= bottomEdge && Math.abs(vyVal) < 1 && settledFrames > 60) {
          const occ = occupiedRef.current;
          if (occ) {
            for (let j = 0; j < occ.length; j++) {
              if (j === particleId) continue;
              const o = occ[j];
              if (!o) continue;
              const dxSep = xPos - o.x;
              const absDx = Math.abs(dxSep);
              if (absDx < 58 && absDx > 0.1) {
                xPos += Math.sign(dxSep) * (58 - absDx) * 3.5 * dt;
                vxVal += Math.sign(dxSep) * (58 - absDx) * 2 * dt;
              }
            }
          }
        }
      }

      posRef.current = { x: xPos, y: yPos };
      rotRef.current = rot;

      if (occupiedRef.current) {
        occupiedRef.current[particleId] = { x: xPos, y: yPos };
      }

      if (elRef.current) {
        const s = hoveredRef.current && !dragging ? baseScale * 1.08 : baseScale;
        const r = dragging ? 0 : rot;
        elRef.current.style.left = xPos + "px";
        elRef.current.style.top = yPos + "px";
        elRef.current.style.transform = "translate(-50%, -50%) rotate(" + r + "deg) scale(" + s + ")";
        elRef.current.style.transition = dragging ? "none" : "";
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    // --- Drag handlers ---
    let dragTimer: ReturnType<typeof setTimeout> | null = null;
    let mouseDownPos = { x: 0, y: 0 };

    const startDrag = (e: globalThis.MouseEvent) => {
      dragActivatedRef.current = true;
      draggingRef.current = true;
      const rect = elRef.current?.getBoundingClientRect();
      if (rect) {
        dragOffsetX = e.clientX - (rect.left + rect.width / 2);
        dragOffsetY = e.clientY - (rect.top + rect.height / 2);
      }
      runningVx = 0;
      runningVy = 0;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      lastDragT = performance.now();
    };

    const onMouseDown = (e: globalThis.MouseEvent) => {
      if (isCollected) return;
      e.stopPropagation();
      dragActivatedRef.current = false;
      mouseDownPos = { x: e.clientX, y: e.clientY };
      // Long-press timer: 200ms
      dragTimer = setTimeout(() => {
        startDrag(e);
      }, 200);
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragEnd);
    };

    const onDragMove = (e: globalThis.MouseEvent) => {
      // Cancel long-press timer and start drag if moved > 5px
      if (!dragActivatedRef.current) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (dx * dx + dy * dy > 25) {
          if (dragTimer) { clearTimeout(dragTimer); dragTimer = null; }
          startDrag(e);
        }
      }
      if (!draggingRef.current) return;
      xPos = e.clientX - dragOffsetX;
      yPos = e.clientY - dragOffsetY;
      // Clamp during drag
      if (xPos < halfW) xPos = halfW;
      if (xPos > viewportWidth - halfW) xPos = viewportWidth - halfW;
      if (yPos < -100) yPos = -100;
      if (yPos > viewportHeight - 10) yPos = viewportHeight - 10;

      // Track running velocity
      const now = performance.now();
      const dtSec = (now - lastDragT) / 1000;
      if (dtSec > 0.003) {
        runningVx = (e.clientX - lastDragX) / dtSec;
        runningVy = (e.clientY - lastDragY) / dtSec;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        lastDragT = now;
      }

      if (elRef.current) {
        elRef.current.style.left = xPos + "px";
        elRef.current.style.top = yPos + "px";
        elRef.current.style.transform = "translate(-50%, -50%) rotate(0deg) scale(" + baseScale + ")";
        elRef.current.style.transition = "none";
      }
    };

    const onDragEnd = () => {
      if (dragTimer) { clearTimeout(dragTimer); dragTimer = null; }
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      const wasDragged = dragActivatedRef.current;
      draggingRef.current = false;
      settledFrames = 0;
      bounceCount = 0;
      isSettling = false;

      // Use running velocity for fling
      vxVal = runningVx * 0.9;
      vyVal = runningVy * 0.5;
      // Clamp fling velocity (horizontal dominant)
      const maxFling = 4000;
      vxVal = Math.max(-maxFling, Math.min(maxFling, vxVal));
      vyVal = Math.max(-maxFling, Math.min(maxFling, vyVal));
      runningVx = 0;
      runningVy = 0;

      if (elRef.current) {
        elRef.current.style.transition = "";
      }
    };

    const el = elRef.current;
    if (el) {
      el.addEventListener("mousedown", onMouseDown);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (el) el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };
  }, [isCollected]);

  useEffect(() => {
    if (!isFailing) return;

    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const currentX = posRef.current.x;
    const currentY = posRef.current.y;
    const dx = currentX - centerX;
    const dy = currentY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const flySpeed = 600 + Math.random() * 500;

    if (elRef.current) {
      elRef.current.style.transition = "all 0.4s ease-in";
      elRef.current.style.left = (currentX + (dx / dist) * flySpeed) + "px";
      elRef.current.style.top = (currentY + (dy / dist) * flySpeed) + "px";
      elRef.current.style.opacity = "0";
      elRef.current.style.transform =
        "translate(-50%, -50%) rotate(" + (rotRef.current + (Math.random() - 0.5) * 360) + "deg) scale(" + baseScale + ")";
    }
  }, [isFailing, viewportWidth, viewportHeight, baseScale]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingRef.current) return;
    hoveredRef.current = true;
    if (!elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    setGlowPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setGlowVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false;
    setGlowVisible(false);
    setTimeout(() => setGlowPos(null), 350);
    if (elRef.current && !draggingRef.current) {
      elRef.current.style.transform =
        "translate(-50%, -50%) rotate(" + rotRef.current + "deg) scale(" + baseScale + ")";
    }
  }, [baseScale]);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (isCollected) return;
    // Suppress click if drag was activated (long-press or moved)
    if (dragActivatedRef.current) { dragActivatedRef.current = false; return; }
    if (isTarget && isNext) {
      onCollect(letter);
    } else {
      onWrongClick();
    }
  };

  const isHovered = glowPos && glowVisible && !draggingRef.current;

  return (
    <div
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={elRef}
      style={{
        position: "absolute",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize,
        fontWeight: 600,
        color: "rgba(255,255,255,0.85)",
        textShadow: isHovered
          ? "0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.25)"
          : "0 0 8px rgba(255,255,255,0.2)",
        cursor: draggingRef.current ? "grabbing" : "grab",
        userSelect: "none",
        opacity: isCollected ? 0 : 1,
        pointerEvents: isCollected ? "none" : "auto",
        willChange: "transform, left, top",
        padding: "8px 14px",
        borderRadius: 8,
        transition: isCollected
          ? "all 0.5s ease-out"
          : "textShadow 0.35s ease-in-out, opacity 0.35s ease-in-out",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          background: glowPos
            ? "radial-gradient(circle 90px at " + glowPos.x + "px " + glowPos.y + "px, rgba(255,255,255,0.22) 0%, transparent 70%)"
            : "transparent",
          opacity: glowVisible ? 1 : 0,
          transition: "opacity 0.35s ease-in-out",
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>
        {letter}
      </span>
    </div>
  );
}
