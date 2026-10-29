import { Coins } from "lucide-react";
import type { UsageResponse } from "@/lib/api";

const n = (value: number) => value.toLocaleString("en-US");
const money = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;

interface UsageCardProps {
  data: UsageResponse;
}

/** AI usage in tokens (and dollars when the server has prices configured). */
export default function UsageCard({ data }: UsageCardProps) {
  if (data.all_time.total_tokens === 0 && !data.daily_token_limit) return null;
  const limit = data.daily_token_limit;
  const pct = limit ? Math.min(100, Math.round((data.today.total_tokens / limit) * 100)) : null;
  const cost = data.cost_estimates_enabled;

  return (
    <section
      id="usage-card"
      aria-label="AI usage"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "18px", padding: "18px 24px", marginBottom: "24px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Coins size={16} color="#68a9ba" />
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>AI usage</h2>
        <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--text-muted)" }}>Today resets at 00:00 UTC</span>
      </div>
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        <div>
          <div id="usage-today" style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
            {n(data.today.total_tokens)} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>tokens today</span>
          </div>
          {cost && data.today.estimated_cost_usd !== null && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>about {money(data.today.estimated_cost_usd)}</div>
          )}
        </div>
        <div>
          <div id="usage-all-time" style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
            {n(data.all_time.total_tokens)} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>all time</span>
          </div>
          {cost && data.all_time.estimated_cost_usd !== null && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>about {money(data.all_time.estimated_cost_usd)}</div>
          )}
        </div>
      </div>
      {limit && pct !== null && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "5px" }}>
            <span>Daily limit</span>
            <span>{n(data.today.total_tokens)} of {n(limit)}</span>
          </div>
          <div style={{ height: "6px", background: "var(--surface-3)", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: "6px", background: pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#68a9ba" }} />
          </div>
        </div>
      )}
    </section>
  );
}
