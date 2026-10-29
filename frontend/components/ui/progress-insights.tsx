import { Target, TrendingDown, TrendingUp } from "lucide-react";
import type { ProgressResponse } from "@/lib/api";

const sectionColor = (score: number) =>
  score >= 8 ? "#22C55E" : score >= 6 ? "#F59E0B" : "#EF4444";

interface ProgressInsightsProps {
  data: ProgressResponse;
}

/**
 * "Where to focus" panel: weakest sections (0-10 averages), the topics that
 * keep coming up as weak, and a short practice list. Shown on the dashboard
 * once at least one scored report exists.
 */
export default function ProgressInsights({ data }: ProgressInsightsProps) {
  if (data.reports_count < 1) return null;

  const weakestSections = data.section_averages.slice(0, 4);
  const improvement = data.improvement;

  return (
    <section
      id="progress-insights"
      aria-label="Progress insights"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "22px 24px",
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
        <Target size={16} color="#68a9ba" />
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Where to focus</h2>
        {improvement !== null && (
          <span
            id="progress-improvement"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: improvement >= 0 ? "#22C55E" : "#EF4444",
            }}
          >
            {improvement >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {improvement >= 0 ? "+" : ""}
            {improvement} pts since your first interview
          </span>
        )}
      </div>

      <div className="report-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <h3 style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
            Weakest sections
          </h3>
          {weakestSections.length === 0 ? (
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>No section scores yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {weakestSections.map((s) => (
                <div key={s.section}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{s.section}</span>
                    <span style={{ color: sectionColor(s.average), fontWeight: 700 }}>{s.average.toFixed(1)}/10</span>
                  </div>
                  <div style={{ height: "6px", background: "var(--surface-3)", borderRadius: "6px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, s.average * 10))}%`,
                        background: sectionColor(s.average),
                        borderRadius: "6px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
            Practice next
          </h3>
          {data.weak_topics.length === 0 ? (
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              No repeated weak topics yet. Nice work.
            </p>
          ) : (
            <ul id="practice-next-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.weak_topics.slice(0, 5).map((t) => (
                <li
                  key={t.topic}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "var(--surface-2)",
                    fontSize: "12.5px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.topic}</span>
                  <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    weak in {t.count} interview{t.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
