import { useRef, useEffect } from 'react';
import { useMouseGlow } from '@/hooks/useMouseGlow';

interface DevLogPanelProps {
  errorStack: string;
}

export function DevLogPanel({ errorStack }: DevLogPanelProps) {
  const { containerRef, overlayRef, containerProps } = useMouseGlow(
    'rgba(255,255,255,0.10)',
    400
  );
  const preRef = useRef<HTMLPreElement>(null);

  // Force text selection on the pre element via direct DOM manipulation
  // to override any inherited user-select:none from globals.css
  useEffect(() => {
    const pre = preRef.current;
    if (pre) {
      pre.style.setProperty('user-select', 'text', 'important');
      pre.style.setProperty('-webkit-user-select', 'text', 'important');
      pre.style.setProperty('cursor', 'text', 'important');
    }
  }, []);

  return (
    <div
      ref={containerRef}
      {...containerProps}
      style={{
        position: 'relative',
        maxWidth: 500,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Glow overlay */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          borderRadius: 'inherit',
        }}
      />
      <details style={{
        position: 'relative',
        textAlign: 'left' as const,
        fontSize: 12,
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        padding: '8px 12px',
        background: 'var(--glass-surface-1)',
        zIndex: 1,
        border: '1px solid transparent',
        borderRadius: 'inherit',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
      }}>
        <summary style={{
          fontWeight: 600,
          marginBottom: 4,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}>
          {'\u5f00\u53d1\u8005\u65e5\u5fd7 (Dev)'}
        </summary>
        <pre
          ref={preRef}
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {errorStack}
        </pre>
      </details>
    </div>
  );
}

export default DevLogPanel;
