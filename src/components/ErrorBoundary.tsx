import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassEmptyState, GlassButton } from '@/design-system';
import { DevLogPanel } from './DevLogPanel';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: 300, padding: 24,
        }}>
          <GlassEmptyState
            style={{ borderRadius: 'var(--radius)' }}
            icon={<AlertTriangle size={40} style={{ color: 'var(--color-warning)' }} />}
            title={'\u9875\u9762\u52a0\u8f7d\u5931\u8d25'}
            description={this.state.error?.message ?? '\u53d1\u751f\u4e86\u672a\u77e5\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5\u3002'}
            action={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <GlassButton onClick={this.handleRetry}>
                  <RefreshCw size={16} style={{ marginRight: 6 }} />
                  {'\u91cd\u8bd5'}
                </GlassButton>
                {isDev && this.state.error?.stack && (
                  <DevLogPanel errorStack={this.state.error.stack} />
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
