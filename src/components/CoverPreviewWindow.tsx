import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';

interface CoverPreviewWindowProps {
  open: boolean;
  onClose: () => void;
  coverB64: string;
  coverRect: { left: number; top: number; width: number; height: number };
}

const SIZE = 146;
const GAP = 12;
const RAND_RANGE = 18;

/* ??? Close Dot ??? */
function CloseDot({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const DOT = 12;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label='Close'
      style={{
        width: DOT, height: DOT, minWidth: DOT, minHeight: DOT,
        borderRadius: '50%', border: 'none', padding: 0,
        cursor: 'default',
        background: '#FF5F57',
        position: 'absolute', top: 6, left: 6,
        zIndex: 2,
        boxShadow: '0 0 0 0.5px rgba(0,0,0,0.12), inset 0 1px 0.5px rgba(255,255,255,0.3), inset 0 -0.5px 1px rgba(0,0,0,0.08)',
        transition: 'background 0.15s ease',
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.12s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width='6' height='6' viewBox='0 0 6 6' fill='none' stroke='#5B0000' strokeWidth='1.2' strokeLinecap='round'>
          <line x1='1' y1='1' x2='5' y2='5' />
          <line x1='5' y1='1' x2='1' y2='5' />
        </svg>
      </span>
    </button>
  );
}

/* ??? Position helpers ??? */
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function computeEdgePoints(
  px: number, py: number, pSize: number,
  cx: number, cy: number, cw: number, ch: number,
) {
  const pcx = px + pSize / 2;
  const pcy = py + pSize / 2;
  const ccx = cx + cw / 2;
  const ccy = cy + ch / 2;
  const dx = pcx - ccx;
  const dy = pcy - ccy;

  type Edge = 'left' | 'right' | 'top' | 'bottom';
  let pEdge: Edge, cEdge: Edge;

  if (Math.abs(dx) > Math.abs(dy)) {
    pEdge = dx < 0 ? 'right' : 'left';
    cEdge = dx < 0 ? 'left' : 'right';
  } else {
    pEdge = dy < 0 ? 'bottom' : 'top';
    cEdge = dy < 0 ? 'top' : 'bottom';
  }

  const fracs = [0.33, 0.67];
  const points: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  for (const f of fracs) {
    let x1: number, y1: number, x2: number, y2: number;

    switch (pEdge) {
      case 'right':
        x1 = px + pSize; y1 = py + pSize * f; break;
      case 'left':
        x1 = px; y1 = py + pSize * f; break;
      case 'bottom':
        x1 = px + pSize * f; y1 = py + pSize; break;
      case 'top':
        x1 = px + pSize * f; y1 = py; break;
    }

    switch (cEdge) {
      case 'right':
        x2 = cx + cw; y2 = cy + ch * f; break;
      case 'left':
        x2 = cx; y2 = cy + ch * f; break;
      case 'bottom':
        x2 = cx + cw * f; y2 = cy + ch; break;
      case 'top':
        x2 = cx + cw * f; y2 = cy; break;
    }

    points.push({ x1, y1, x2, y2 });
  }

  return { points, pEdge, cEdge, dx, dy };
}

/* ??? Connection Lines ??? */
function ConnectionLines({
  pos,
  coverRect,
}: {
  pos: { x: number; y: number };
  coverRect: { left: number; top: number; width: number; height: number };
}) {
  if (coverRect.width === 0 || coverRect.height === 0) return null;

  const ep = computeEdgePoints(
    pos.x, pos.y, SIZE,
    coverRect.left, coverRect.top, coverRect.width, coverRect.height,
  );

  const cpDist = Math.min(
    Math.abs(ep.dx) / 3,
    Math.abs(ep.dy) / 3,
    GAP * 1.5,
  );

  const paths = ep.points.map((p, i) => {
    const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const cx1 = p.x1 + Math.cos(angle) * cpDist;
    const cy1 = p.y1 + Math.sin(angle) * cpDist;
    const cx2 = p.x2 - Math.cos(angle) * cpDist;
    const cy2 = p.y2 - Math.sin(angle) * cpDist;
    const d = `M${p.x1},${p.y1} C${cx1},${cy1} ${cx2},${cy2} ${p.x2},${p.y2}`;
    return (
      <g key={i}>
        <path
          d={d}
          fill='none'
          stroke='rgba(var(--accent-rgb, 59, 130, 246), 0.25)'
          strokeWidth={3}
          strokeLinecap='round'
        />
        <path
          d={d}
          fill='none'
          stroke='rgba(var(--accent-rgb, 59, 130, 246), 0.75)'
          strokeWidth={1.4}
          strokeDasharray='5,5'
          strokeLinecap='round'
        />
        <circle cx={p.x1} cy={p.y1} r={3} fill='var(--accent, #3b82f6)' />
        <circle cx={p.x2} cy={p.y2} r={3} fill='var(--accent, #3b82f6)' />
      </g>
    );
  });

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
      }}
      width='100%'
      height='100%'
    >
      {paths}
    </svg>
  );
}

/* ??? Main ??? */
export default function CoverPreviewWindow({
  open,
  onClose,
  coverB64,
  coverRect,
}: CoverPreviewWindowProps) {
  const calcInitialPos = useCallback(() => {
    const cw = coverRect.width || 220;
    const ch = coverRect.height || 220;
    const cl = coverRect.left || (window.innerWidth - 360);
    const ct = coverRect.top || 120;

    // 默认停靠在封面卡片左侧，并垂直稍微偏上
    let x = cl - SIZE - 24;
    let y = ct + 12;

    // 如果左侧超出安全边距，停靠在封面卡片下方或右侧
    if (x < 16) {
      x = Math.max(16, cl);
      y = ct + ch + 16;
    }

    x = clamp(x, 16, window.innerWidth - SIZE - 16);
    y = clamp(y, 16, window.innerHeight - SIZE - 16);
    return { x, y };
  }, [coverRect.left, coverRect.top, coverRect.width, coverRect.height]);

  const [pos, setPos] = useState(calcInitialPos);

  useEffect(() => {
    if (open) {
      setPos(calcInitialPos());
    }
  }, [open, calcInitialPos]);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const swayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !swayRef.current) return;
    const ctrl = animate(
      swayRef.current,
      { rotate: [-2.5, 2.5], y: [-5, 5] },
      { duration: 4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
    );
    return () => ctrl.stop();
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      setPos((prev) => ({
        x: clamp(prev.x, 0, window.innerWidth - SIZE),
        y: clamp(prev.y, 0, window.innerHeight - SIZE),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragging.current = true;
      setIsDragging(true);
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    },
    [pos],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!dragging.current) return;
        setPos({
          x: clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - SIZE),
          y: clamp(e.clientY - dragOffset.current.y, 0, window.innerHeight - SIZE),
        });
      });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <>
      {open &&
        createPortal(
          <ConnectionLines pos={pos} coverRect={coverRect} />,
          document.body,
        )}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 28,
                mass: 0.7,
              }}
              onMouseDown={handleMouseDown}
              style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                width: SIZE,
                height: SIZE,
                cursor: isDragging ? 'grabbing' : 'grab',
                zIndex: 9999,
                willChange: isDragging ? 'left, top' : 'auto',
              }}
            >
              <div
                ref={swayRef}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid rgba(255, 255, 255, 0.24)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.38), 0 0 16px rgba(var(--accent-rgb, 59, 130, 246), 0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
                }}
              >
                <CloseDot onClick={onClose} />
                <img
                  src={'data:image/jpeg;base64,' + coverB64}
                  alt='Cover Preview'
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  draggable={false}
                />
                {/* 底部微型毛玻璃指示标签 */}
                <div style={{
                  position: 'absolute',
                  bottom: 6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  新封面预览
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
