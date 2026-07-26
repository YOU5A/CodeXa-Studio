import { GlassButton } from "@/design-system/components";
import { sectionLabelStyle } from "./shared";
import { APP_VERSION } from "@/version";

interface AboutSectionProps {
  tx: Record<string, string>;
}

export default function AboutSection({ tx }: AboutSectionProps) {
  return (
    <>
      <div style={sectionLabelStyle}>{tx.about}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="./icon.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{tx.aboutTitle}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{tx.aboutVersion}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7 }}>
        <div>{tx.aboutDesc}</div>
        <div>{tx.aboutAuthor}</div>
        <div>{tx.aboutTech}</div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <GlassButton variant="secondary" size="sm"
          onClick={() => window.electronAPI?.shell.openExternal("https://github.com/YOU5A")}>
          {tx.github}
        </GlassButton>
        <GlassButton variant="secondary" size="sm"
          onClick={() => window.electronAPI?.shell.openExternal("https://space.bilibili.com/353017137")}>
          {tx.bilibli}
        </GlassButton>
        <GlassButton variant="secondary" size="sm"
          onClick={() => window.electronAPI?.shell.openExternal("https://you5a.github.io/UserTool")}>
          {tx.usertool}
        </GlassButton>
      </div>
    </>
  );
}
