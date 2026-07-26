import { Zap, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { GlassSurface, GlassButton, GlassProgressBar } from "@/design-system/components";
import { space, fontSizes, radii } from "@/design-system/tokens";
import type { NcmDecodeBarProps } from "./types";

export default function DecodeBar({
  selCount, isDecoding, decodeProgress, results,
  onDecodeSelected, onOpenOutput, decodeSelectedLabel,
  openOutputLabel, decodingLabel,
  successLabel, failedLabel,
}: NcmDecodeBarProps) {
  const hasOutput = isDecoding || results.length > 0;

  return (
    <div style={{
      display: "flex", gap: space[3],
      flexShrink: 0, alignItems: "flex-end",
    }}>
      {/* Left: buttons */}
      <div style={{ width: "35%", minWidth: 200, flexShrink: 0 }}>
        <GlassSurface tier="regular" style={{
          display: "inline-flex", alignItems: "center", gap: space[2],
          padding: "8px 12px", borderRadius: radii.md,
          width: "fit-content",
        }}>
          <GlassButton variant="ghost" size="sm" onClick={onOpenOutput}>
            <ExternalLink size={14} />
            <span style={{ marginLeft: 4 }}>{openOutputLabel}</span>
          </GlassButton>
          <GlassButton
            variant="primary" size="sm" onClick={onDecodeSelected}
            disabled={selCount === 0 || isDecoding}
          >
            <Zap size={14} />
            <span style={{ marginLeft: 4 }}>{decodeSelectedLabel} ({selCount})</span>
          </GlassButton>
        </GlassSurface>
      </div>

      {/* Right: results card (in flow, aligned with MetadataPanel) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {hasOutput && (
          <GlassSurface tier="regular" style={{
            padding: 10, borderRadius: radii.md,
            maxHeight: 140, overflowY: "auto",
          }}>
            {isDecoding && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)", marginBottom: 3 }}>
                  {decodingLabel}
                </div>
                <GlassProgressBar value={decodeProgress} />
              </div>
            )}
            {results.length > 0 && (
              <>
                <div style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)", marginBottom: 4 }}>
                  {results.filter((r) => r.success).length} {successLabel}
                  {" / "}
                  {results.filter((r) => !r.success).length} {failedLabel}
                </div>
                <div style={{ fontSize: fontSizes.xs }}>
                  {results.map((r, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "2px 0",
                      color: r.success ? "var(--text-primary)" : "var(--danger)",
                    }}>
                      {r.success
                        ? <CheckCircle size={12} style={{ color: "var(--success)", flexShrink: 0 }} />
                        : <XCircle size={12} style={{ color: "var(--danger)", flexShrink: 0 }} />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.success
                          ? r.outputPath?.split("\\").pop() || r.outputPath
                          : r.errorMessage}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassSurface>
        )}
      </div>
    </div>
  );
}
