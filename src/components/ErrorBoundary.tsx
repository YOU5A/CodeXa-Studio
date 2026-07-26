import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { GlassEmptyState, GlassButton } from "@/design-system";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", minHeight: 300, padding: 24,
        }}>
          <GlassEmptyState
            style={{ borderRadius: "var(--radius)" }}
            icon={<AlertTriangle size={40} style={{ color: "var(--color-warning)" }} />}
            title={"页面加载失败"}
            description={this.state.error?.message ?? "发生了未知错误，请重试。"}
            action={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <GlassButton onClick={this.handleRetry}>
                  <RefreshCw size={16} style={{ marginRight: 6 }} />
                  {"重试"}
                </GlassButton>
                {isDev && this.state.error?.stack && (
                  <details style={{
                    maxWidth: 500, textAlign: "left", fontSize: 12,
                    color: "var(--text-tertiary)", cursor: "pointer",
                    padding: "8px 12px", borderRadius: 8,
                    background: "var(--glass-surface-1)",
                  }}>
                    <summary style={{ fontWeight: 600, marginBottom: 4 }}>
                      {"开发者日志 (Dev)"}
                    </summary>
                    <pre style={{
                      whiteSpace: "pre-wrap", wordBreak: "break-all",
                      margin: 0, fontFamily: "var(--font-mono, monospace)",
                    }}>
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
