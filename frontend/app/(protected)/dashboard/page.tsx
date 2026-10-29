"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import StatCard from "@/components/ui/stat-card";
import InterviewCard from "@/components/ui/interview-card";
import CommandPalette from "@/components/ui/command-palette";
import ProgressInsights from "@/components/ui/progress-insights";
import UsageCard from "@/components/ui/usage-card";
import {
  Mic2,
  BarChart3,
  Trophy,
  AlertTriangle,
  Plus,
  ArrowRight,
  Command,
  Zap,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api, auth, errorMessage, type InterviewSummary, type ProgressResponse, type UsageResponse } from "@/lib/api";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function DashboardPage() {
  const user = auth.load();
  const userName = user?.name ?? "there";
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Optional analytics panel: a failure here must never block the dashboard.
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.interviews
      .list({ limit: 100 })
      .then((data) => {
        if (cancelled) return;
        setInterviews(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching interviews:", err);
        setLoadError(errorMessage(err, "Could not load your interviews."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    api.progress
      .get(controller.signal)
      .then(setProgress)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn("Progress insights unavailable:", err);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    api.usage
      .get(controller.signal)
      .then(setUsage)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn("Usage unavailable:", err);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  // ── Aggregates (scores are 0-100 and null until a report exists) ──────────
  const completedCount = interviews.filter((i) => i.status === "completed").length;
  const scored = interviews.filter(
    (i): i is InterviewSummary & { score: number } => typeof i.score === "number",
  );
  const inProgress = interviews.filter((i) => i.status === "in_progress");

  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, i) => a + i.score, 0) / scored.length)
      : null;
  const best =
    scored.length > 0
      ? scored.reduce((top, i) => (i.score > top.score ? i : top), scored[0])
      : null;

  // Oldest first for the trend line.
  const trendData = [...scored]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((i) => ({ label: shortDate(i.date), score: i.score, company: i.company }));

  const lastDelta =
    trendData.length >= 2
      ? trendData[trendData.length - 1].score - trendData[trendData.length - 2].score
      : null;

  return (
    <AppShell>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <div className="dash-content" style={{ padding: "32px", maxWidth: "1100px" }}>
        {/* ── Top bar ── */}
        <div
          className="dash-topbar"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "32px",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              Welcome back, {userName}!
            </h1>
            <p
              style={{
                fontSize: "13.5px",
                color: "var(--text-secondary)",
                marginTop: "4px",
              }}
            >
              Continue improving your interview readiness.
            </p>
          </div>

          <div className="dash-topbar-actions" style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={() => setCmdOpen(true)}
              className="dash-cmd-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 14px",
                borderRadius: "10px",
                fontSize: "12.5px",
                background: "var(--surface-1)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border-default)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border-subtle)";
              }}
            >
              <Command size={12} />
              <span>Command</span>
              <kbd
                style={{
                  fontSize: "10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "4px",
                  padding: "1px 4px",
                }}
              >
                K
              </kbd>
            </button>
            <button
              id="new-interview-dashboard-btn"
              onClick={() => router.push("/interview/new")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                background: "linear-gradient(135deg, #4d8fa2, #68a9ba)",
                border: "none",
                color: "#061014",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(104,169,186,0.35)",
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(-1px)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 8px 24px rgba(104,169,186,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 4px 16px rgba(104,169,186,0.35)";
              }}
            >
              <Plus size={15} /> New Interview
            </button>
          </div>
        </div>

        {/* ── Hero card ── */}
        <div
          style={{
            borderRadius: "20px",
            padding: "28px 32px",
            background:
              "linear-gradient(135deg, rgba(104,169,186,0.15) 0%, rgba(104,169,186,0.1) 50%, rgba(9,9,11,0) 100%)",
            border: "1px solid rgba(104,169,186,0.2)",
            marginBottom: "24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-40px",
              right: "-40px",
              width: "200px",
              height: "200px",
              background:
                "radial-gradient(ellipse, rgba(104,169,186,0.2) 0%, transparent 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #4d8fa2, #68a9ba)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(104,169,186,0.4)",
              }}
            >
              <Zap size={18} color="white" fill="white" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {inProgress.length > 0 ? "Pick up where you left off" : "Ready to practice?"}
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {inProgress.length > 0
                  ? `You have ${inProgress.length} interview${inProgress.length === 1 ? "" : "s"} in progress.`
                  : "Your next interview session is waiting."}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {inProgress.length > 0 && (
              <button
                id="resume-latest-btn"
                onClick={() => router.push(`/interview/${inProgress[0].id}`)}
                style={heroButtonStyle}
              >
                Resume {inProgress[0].company} <ArrowRight size={14} />
              </button>
            )}
            <button
              onClick={() => router.push("/interview/new")}
              style={heroButtonStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.1)";
              }}
            >
              Start Interview <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {loadError && (
          <div
            role="alert"
            style={{
              display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
              padding: "14px 18px", borderRadius: "14px", marginBottom: "24px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <AlertTriangle size={16} color="#EF4444" />
            <span style={{ flex: 1, fontSize: "13px", color: "var(--text-secondary)" }}>{loadError}</span>
            <button onClick={retry} style={smallButtonStyle}>
              <RotateCcw size={12} /> Retry
            </button>
          </div>
        )}

        {/* ── Stat cards ── */}
        {!loading && interviews.length > 0 && (
          <div
            className="stat-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <StatCard
              id="stat-completed"
              label="Interviews Completed"
              value={completedCount}
              icon={Mic2}
              iconColor="#68a9ba"
              trend="neutral"
              trendLabel={`${interviews.length} total`}
            />
            <StatCard
              id="stat-avg-score"
              label="Average Score"
              value={avgScore === null ? "--" : `${avgScore}/100`}
              icon={BarChart3}
              iconColor="#68a9ba"
              trend={lastDelta === null ? undefined : lastDelta > 0 ? "up" : lastDelta < 0 ? "down" : "neutral"}
              trendLabel={
                lastDelta === null ? undefined : `${lastDelta > 0 ? "+" : ""}${lastDelta} pts last`
              }
            />
            <StatCard
              id="stat-best"
              label="Best Performance"
              value={best ? best.company : "--"}
              icon={Trophy}
              iconColor="#22C55E"
              trend={best ? "up" : undefined}
              trendLabel={best ? `${best.score}/100` : undefined}
            />
            <StatCard
              id="stat-in-progress"
              label="In Progress"
              value={inProgress.length}
              icon={AlertTriangle}
              iconColor="#F59E0B"
            />
          </div>
        )}

        {/* ── Where to focus ── */}
        {!loading && progress && <ProgressInsights data={progress} />}

        {/* ── AI usage ── */}
        {!loading && usage && <UsageCard data={usage} />}

        {/* ── Score trend ── */}
        {!loading && scored.length > 0 && (
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "18px",
              padding: "22px 24px",
              marginBottom: "32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <TrendingUp size={16} color="#68a9ba" />
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Score Trend</h2>
            </div>
            {trendData.length < 2 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Complete one more interview to see how your score changes over time.
              </p>
            ) : (
              <div
                role="img"
                aria-label={`Score trend: ${trendData.map((d) => `${d.label} ${d.company} ${d.score}`).join(", ")}`}
                style={{ width: "100%", height: 220 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                    <CartesianGrid stroke="rgba(104,169,186,0.12)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#5a8898", fontSize: 11 }} stroke="rgba(104,169,186,0.2)" />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#5a8898", fontSize: 11 }} stroke="rgba(104,169,186,0.2)" />
                    <Tooltip
                      contentStyle={{ background: "#111d24", border: "1px solid rgba(104,169,186,0.25)", borderRadius: "10px", fontSize: "12px", color: "#e8fbff" }}
                      labelStyle={{ color: "#9dc4ce" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Score"
                      stroke="#68a9ba"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#68a9ba", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── Interview History ── */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Interview History
            </h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {interviews.length} session{interviews.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }} aria-busy="true">
              {[0, 1, 2].map((k) => (
                <div key={k} className="skeleton" style={{ height: "84px", borderRadius: "16px" }} />
              ))}
            </div>
          ) : interviews.length === 0 && !loadError ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                borderRadius: "18px",
                border: "1px dashed var(--border-default)",
                background: "var(--surface-1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Mic2 size={28} color="#68a9ba" />
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                No interviews yet
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "360px", lineHeight: 1.6 }}>
                Pick a company and role, and InterVu will research real interview patterns and run a
                tailored mock interview with you.
              </p>
              <button
                id="empty-state-start-btn"
                onClick={() => router.push("/interview/new")}
                style={{ ...heroButtonStyle, background: "linear-gradient(135deg, #4d8fa2, #68a9ba)", color: "#061014", border: "none" }}
              >
                Start your first interview <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {interviews.map((interview, i) => (
                <div
                  key={interview.id}
                  style={{ animation: `fadeInUp 0.35s ease ${Math.min(i, 10) * 60}ms both` }}
                >
                  <InterviewCard
                    id={`interview-card-${interview.id}`}
                    company={interview.company}
                    role={interview.role}
                    date={interview.date}
                    score={interview.score}
                    status={interview.status}
                    skills={interview.skills}
                    onClick={() =>
                      router.push(
                        interview.status === "completed"
                          ? `/report/${interview.id}`
                          : `/interview/${interview.id}`,
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const heroButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 20px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: 600,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
};

const smallButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 600,
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontFamily: "inherit",
};
