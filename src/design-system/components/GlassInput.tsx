/**
 * GlassInput — Liquid Glass Input Field
 *
 * Replaces .input-field CSS class. Supports text inputs,
 * textareas, and wrapped select elements.
 *
 * Uses ultraThin glass tier for the input background.
 * Focus state uses glassFocusRing animation for Apple-style glow.
 */

import { forwardRef, type ReactNode } from "react";
import type { HTMLMotionProps } from "framer-motion";
import { motion } from "framer-motion";
import { glassFocusRing, glassFocusRingOut } from "../animations";
import { space, radii, fontSizes } from "../tokens";

export interface GlassInputProps extends Omit<HTMLMotionProps<"input">, "children"> {
  children?: ReactNode;
  /** Input type: text, textarea, or select (renders as wrapper) */
  as?: "input" | "textarea" | "select";
  /** Error state styling */
  error?: boolean;
  /** Full width (default: true) */
  fullWidth?: boolean;
}

const baseInputStyle: React.CSSProperties = {
  background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.04) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.03) 50%, rgba(var(--glass-glow-rgb,255,255,255),0.06) 100%), var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "none",
  borderRadius: radii.lg,
  padding: String(space[2]) + "px " + String(space[4]) + "px",
  fontSize: fontSizes.sm,
  outline: "none",
  transition: "all var(--transition-fast) ease",
  width: "100%",
  backdropFilter: "blur(10px) saturate(1.4)",
  WebkitBackdropFilter: "blur(10px) saturate(1.4)",
  boxShadow: "0 0 0 1px var(--border-color), inset 0 1px 1px rgba(var(--glass-glow-rgb,255,255,255),0.06)",
  "--glass-angle": (115 + Math.random() * 40) + "deg",
  "--glass-highlight-opacity": String(0.5 + Math.random() * 0.5),
  "--glass-noise-opacity": String(0.01 + Math.random() * 0.02),
};

const errorFocusStyle = {
  borderColor: "var(--danger)",
  boxShadow: "0 0 0 3px rgba(255,59,48,0.12)",
};

export const GlassInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, GlassInputProps>(
  function GlassInput(
    {
      as = "input",
      error = false,
      fullWidth = true,
      style,
      children,
      ...rest
    },
    ref
  ) {
    const composedStyle: React.CSSProperties = {
      ...baseInputStyle,
      ...(error
        ? { borderColor: "var(--danger)", boxShadow: "0 0 0 3px rgba(255,59,48,0.12)" }
        : {}),
      ...(fullWidth ? {} : { width: undefined }),
      ...(as === "textarea" ? { resize: "vertical", minHeight: 80 } : {}),
      ...(style as React.CSSProperties),
    };

    // Input/textarea: use motion.input or motion.textarea
    if (as === "textarea") {
      return (
        <motion.textarea
          ref={ref as any}
          style={composedStyle}
          whileFocus={error ? errorFocusStyle : glassFocusRing}
          {...(rest as any)}
        />
      );
    }

    if (as === "select") {
      // Select wrapper for child <select> elements
      return (
        <motion.div
          style={{
            ...composedStyle,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            appearance: "none" as any,
          }}
        >
          {children}
        </motion.div>
      );
    }

    // Default: input
    return (
      <motion.input
        ref={ref as any}
        style={composedStyle}
        whileFocus={error ? errorFocusStyle : glassFocusRing}
        {...(rest as any)}
      />
    );
  }
);

export default GlassInput;
