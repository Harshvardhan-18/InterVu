import { AlertTriangle } from "lucide-react";

interface NoticeBannerProps {
  title: string;
  messages: string[];
}

/**
 * Amber notice for degraded sessions (for example, live research or the AI
 * planner was unavailable). Renders nothing when there is nothing to say.
 */
export default function NoticeBanner({ title, messages }: NoticeBannerProps) {
  if (messages.length === 0) return null;
  return (
    <div
      role="status"
      id="degraded-notice"
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "14px 16px",
        borderRadius: "14px",
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.3)",
      }}
    >
      <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: "2px" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{title}</strong>
        {messages.map((message) => (
          <span key={message} style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
