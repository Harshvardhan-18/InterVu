interface ScoreRingProps {
  score: number;      // 0–100
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  className = "",
}: ScoreRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? "#22C55E"
      : score >= 65
      ? "#F59E0B"
      : "#EF4444";

  const grade =
    score >= 85
      ? "Excellent"
      : score >= 70
      ? "Good"
      : score >= 55
      ? "Average"
      : "Needs Work";

  return (
    <div
      className={className}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: size >= 120 ? "28px" : "20px",
              fontWeight: 800,
              color,
              lineHeight: 1,
              letterSpacing: "-1px",
            }}
          >
            {score}
          </span>
          {size >= 100 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              /100
            </span>
          )}
        </div>
      </div>
      {label !== undefined ? (
        <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
        </span>
      ) : (
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            borderRadius: "6px",
            padding: "2px 10px",
          }}
        >
          {grade}
        </span>
      )}
    </div>
  );
}
