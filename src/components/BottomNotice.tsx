/**
 * BottomNotice — 窗口底部居中 glass 提示条
 *
 * 点击预设等操作后短暂弹出，自动消失。
 * 样式基于 GlassTooltip 模板，圆角匹配 radii.lg。
 */

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

interface BottomNoticeProps {
  /** 是否可见 */
  show: boolean;
  /** 提示内容 */
  children: ReactNode;
  /** 自动消失毫秒数，默认 2000 */
  duration?: number;
  /** 提示色调 */
  tone?: "default" | "success" | "error";
  /** 消失后回调 */
  onDone?: () => void;
}

const noticeTransition = {
  type: "tween" as const,
  duration: 0.26,
  ease: "easeOut",
};

const toneStyles: Record<NonNullable<BottomNoticeProps["tone"]>, { background: string; border: string }> = {
  default: { background: "rgba(18,18,28,0.40)", border: "1px solid rgba(255,255,255,0.12)" },
  success: { background: "rgba(22,163,74,0.22)", border: "1px solid rgba(74,222,128,0.28)" },
  error: { background: "rgba(220,38,38,0.22)", border: "1px solid rgba(248,113,113,0.28)" },
};

export function BottomNotice({ show, children, duration = 2000, tone = "default", onDone }: BottomNoticeProps) {
  // 保存最新回调：父组件重渲染会生成新的 onDone 引用，若直接作为依赖，定时器会被反复重置、提示永不消失
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // Auto-dismiss after duration
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      onDoneRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, duration]);

  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 6, scale: 0.95, x: "-50%" }}
          transition={noticeTransition}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            zIndex: 99999,
            pointerEvents: "none",
            backdropFilter: "blur(32px) saturate(2.2)",
            WebkitBackdropFilter: "blur(32px) saturate(2.2)",
            ...toneStyles[tone],
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
