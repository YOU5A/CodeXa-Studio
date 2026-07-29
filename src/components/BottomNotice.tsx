/**
 * BottomNotice — 窗口底部居中 glass 提示条
 *
 * 点击预设等操作后短暂弹出，自动消失。
 * 样式基于 GlassTooltip 模板，圆角匹配 radii.lg。
 */

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

interface BottomNoticeProps {
  /** 是否可见 */
  show: boolean;
  /** 提示内容 */
  children: ReactNode;
  /** 自动消失毫秒数，默认 2000 */
  duration?: number;
  /** 消失后回调 */
  onDone?: () => void;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export function BottomNotice({ show, children, duration = 2000, onDone }: BottomNoticeProps) {
  // Auto-dismiss after duration
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      onDone?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onDone]);

  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={springTransition}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99999,
            pointerEvents: "none",
            backdropFilter: "blur(32px) saturate(2.2)",
            WebkitBackdropFilter: "blur(32px) saturate(2.2)",
            background: "rgba(18,18,28,0.40)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: "8px 20px",
            fontSize: 14,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default BottomNotice;
