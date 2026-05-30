"use client";

interface InterviewCardProps {
  id?: string;
  company: string;
  role: string;
  date: string;
  score: number;
  status: "completed" | "in-progress" | "scheduled";
  skills?: string[];
  onClick?: () => void;
}

const COMPANY_COLORS: Record<string, string> = {
  Google:    "#4285F4",
  Amazon:    "#FF9900",
  NVIDIA:    "#76B900",
  Meta:      "#0866FF",
  Microsoft: "#00A4EF",
  Apple:     "#A2AAAD",
  Netflix:   "#E50914",
  Uber:      "#000000",
  Stripe:    "#635BFF",
  Airbnb:    "#FF5A5F",
};

const COMPANY_INITIALS: Record<string, string> = {
  Google:    "G",
  Amazon:    "A",
  NVIDIA:    "N",
  Meta:      "M",
  Microsoft: "MS",
  Apple:     "AP",
  Netflix:   "NF",
  Uber:      "U",
  Stripe:    "ST",
  Airbnb:    "AB",
};

export default function InterviewCard({
  id,
  company,
  role,
  date,
  score,
  status,
  skills = [],
  onClick,
}: InterviewCardProps) {
  const accentColor = COMPANY_COLORS[company] ?? "#8B5CF6";
  const initials = COMPANY_INITIALS[company] ?? company.slice(0, 2).toUpperCase();

  const scoreColor =
    score >= 80 ? "#22C55E" : score >= 65 ? "#F59E0B" : "#EF4444";

  const statusConfig = {
    completed:    { label: "Completed",   bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)",  color: "#22C55E" },
    "in-progress":{ label: "In Progress", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", color: "#F59E0B" },
    scheduled:    { label: "Scheduled",   bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", color: "#6366F1" },
  }[status];

  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      id={id}
      onClick={onClick}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `${accentColor}40`;
        el.style.background = "var(--surface-2)";
        el.style.transform = "translateY(-2px) scale(1.005)";
        el.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}20`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border-subtle)";
        el.style.background = "var(--surface-1)";
        el.style.transform = "translateY(0) scale(1)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Subtle accent line on left */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "16px",
          bottom: "16px",
          width: "3px",
          borderRadius: "0 4px 4px 0",
          background: accentColor,
          opacity: 0.6,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Company logo */}
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}28`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 800,
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {role}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "6px",
                background: statusConfig.bg,
                border: `1px solid ${statusConfig.border}`,
                color: statusConfig.color,
                flexShrink: 0,
              }}
            >
              {statusConfig.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 500 }}>
              {company}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>·</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formattedDate}</span>
          </div>
          {skills.length > 0 && (
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              {skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "5px",
                    padding: "2px 7px",
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: scoreColor,
              lineHeight: 1,
              letterSpacing: "-0.5px",
            }}
          >
            {score}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>/100</div>
        </div>
      </div>
    </div>
  );
}
