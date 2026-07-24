import { AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToast, type ToastType } from "@/contexts/ToastContext";
import { GlassSurface, glassEntrance } from "@/design-system";
import { useTheme } from "@/hooks/useTheme";

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const colorMap: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

const GAP = 8;
const H = 42;

export default function ToastContainer() {
  const { toasts } = useToast();
  const { settings } = useTheme();

  return (
    <AnimatePresence>
      {toasts.map((toast, i) => (
        <GlassSurface
          key={toast.id}
          tier="thick"
          variants={glassEntrance}
          initial="hidden"
          animate={toast.exiting ? "exit" : "visible"}
          styleOverrides={{ radius: settings.borderRadius }}
          style={{
            position: "fixed",
            top: 56 + i * (H + GAP),
            right: 20,
            zIndex: 9999,
            minWidth: 240,
            maxWidth: 400,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            fontSize: 13,
            color: "var(--text-primary)",
          } as React.CSSProperties}
        >
          <span style={{ color: colorMap[toast.type], flexShrink: 0, display: "flex" }}>
            {iconMap[toast.type]}
          </span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
        </GlassSurface>
      ))}
    </AnimatePresence>
  );
}