"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/app-shell";
import ScoreRing from "@/components/ui/score-ring";
import SharePanel from "@/components/ui/share-panel";
import {
  ArrowRight, CheckCircle2, AlertCircle, BookOpen,
  TrendingUp, ChevronRight, BarChart3, ArrowLeft,
  AlertTriangle, Download, Printer, RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { api, errorMessage, isApiError, type ReportResponse } from "@/lib/api";


const scoreColor = (s: number) =>
  s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444";

const scoreBg = (s: number) =>
  s >= 8
    ? { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" }
    : s >= 6
    ? { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" }
    : { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };

const gradeLabel = (score: number) =>
  score >= 90 ? "Excellent" : score >= 76 ? "Good" : score >= 61 ? "Average" : score >= 41 ? "Below Average" : "Needs Work";

const gradeColor = (score: number) =>
  score >= 76 ? "#22C55E" : score >= 61 ? "#F59E0B" : "#EF4444";

type LoadState = "loading" | "ready" | "not_ready" | "error";

/** Safe file name fragment. */
const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "report";

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = Number(params.id);
  const validId = Number.isFinite(interviewId) && interviewId > 0;

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    api.reports.get(interviewId, controller.signal)
      .then((data) => {
        setReport(data);
        setLoadState("ready");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch report:", e);
        if (isApiError(e) && e.status === 404) {
          setError(e.detail);
          setLoadState("not_ready");
        } else {
          setError(errorMessage(e, "Failed to load report. Please try again."));
          setLoadState("error");
        }
      });
    return () => controller.abort();
  }, [interviewId, validId, reloadKey]);

  const reload = () => {
    setError(null);
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await api.reports.generate(interviewId);
      reload();
    } catch (e) {
      console.error("Failed to regenerate report:", e);
      setRegenerateError(errorMessage(e, "Could not regenerate the report."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intervu-report-${report.interview_id}-${slug(report.company)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const viewState: LoadState = validId ? loadState : "error";

  if (viewState === "loading") {
    return (
      <AppShell>
        <div style={{ padding: "32px", maxWidth: "900px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "8px" }}>
          <span role="status" style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading report...</span>
          <span style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
            If the report is still being generated this can take up to a minute.
          </span>
        </div>
      </AppShell>
    );
  }

  if (viewState !== "ready" || !report) {
    const message = !validId
      ? "Invalid report link."
      : viewState === "not_ready"
      ? error ?? "This report is not ready yet."
      : error ?? "Report not available.";
    return (
      <AppShell>
        <div style={{ padding: "32px", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} color="#F59E0B" />
            <p role="alert" style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{message}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {validId && viewState === "error" && (
              <button onClick={reload} style={secondaryButtonStyle}>
                <RotateCcw size={13} /> Retry
              </button>
            )}
            {validId && viewState === "not_ready" && (
              <Link href={`/interview/${interviewId}`} style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
                Continue interview <ArrowRight size={13} />
              </Link>
            )}
            <button onClick={() => router.push("/dashboard")} style={secondaryButtonStyle}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const body = report.report;
  const overall = report.overall_score ?? body.overall_score ?? 0;
  const sectionScores = Object.entries(body.section_scores ?? {}).map(
    ([label, score]) => [label, Number(score) || 0] as const,
  );
  const chartData = sectionScores.map(([name, score]) => ({ name, score }));
  const strongTopics = body.strong_topics ?? [];
  const weakTopics = body.weak_topics ?? [];
  const recommendations = body.recommendations ?? [];
  const date = new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const grade = gradeLabel(overall);
  const gColor = gradeColor(overall);

  return (
    <AppShell>
      <div className="dash-content print-area" style={{ padding: "32px", maxWidth: "900px" }}>

        {/* Back */}
        <button
          className="no-print"
          onClick={() => router.push("/dashboard")}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "13px", fontFamily: "inherit",
            marginBottom: "28px", padding: 0, transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {/* ── Header ── */}
        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22C55E",
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>
                Interview Complete
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>·</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{date}</span>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "4px" }}>
              Feedback Report
            </h1>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
              {report.role} · {report.company}
            </p>
          </div>

          <div className="no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button id="download-report-btn" onClick={handleDownloadJson} style={secondaryButtonStyle}>
              <Download size={13} /> Download JSON
            </button>
            <button id="print-report-btn" onClick={() => window.print()} style={secondaryButtonStyle}>
              <Printer size={13} /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* ── Fallback notice ── */}
        {body.fallback && (
          <div className="no-print" role="status" style={{
            padding: "16px 18px", borderRadius: "14px", marginBottom: "20px",
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>
            <AlertTriangle size={16} color="#F59E0B" />
            <span style={{ flex: 1, minWidth: "200px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              The AI could not generate a full report for this interview, so a placeholder is shown.
              {regenerateError ? ` ${regenerateError}` : ""}
            </span>
            <button onClick={handleRegenerate} disabled={regenerating} style={secondaryButtonStyle}>
              <RotateCcw size={13} /> {regenerating ? "Regenerating..." : "Regenerate report"}
            </button>
          </div>
        )}

        {/* ── Hero score card ── */}
        <div className="report-hero-card" style={{
          borderRadius: "20px", padding: "36px",
          background: "linear-gradient(135deg, rgba(104,169,186,0.12) 0%, rgba(104,169,186,0.08) 50%, rgba(9,9,11,0) 100%)",
          border: "1px solid rgba(104,169,186,0.2)",
          marginBottom: "24px", display: "flex", alignItems: "center", gap: "40px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "240px", height: "240px", background: "radial-gradient(ellipse, rgba(104,169,186,0.15) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

          <ScoreRing score={overall} size={140} strokeWidth={10} />

          <div className="report-hero-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="report-hero-header" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>Overall Performance</h2>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px",
                background: `${gColor}1A`, border: `1px solid ${gColor}40`, color: gColor,
              }}>{grade}</span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: "480px", marginBottom: "20px" }}>
              {body.summary}
            </p>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{sectionScores.length}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sections</div>
              </div>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{overall}/100</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section scores ── */}
        {sectionScores.length > 0 && (
          <div className="print-avoid-break" style={{
            background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
            borderRadius: "18px", padding: "24px", marginBottom: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <BarChart3 size={16} color="#68a9ba" />
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Section Breakdown</h3>
            </div>

            {chartData.length > 1 && (
              <div
                role="img"
                aria-label={`Section scores: ${chartData.map((d) => `${d.name} ${d.score.toFixed(1)} of 10`).join(", ")}`}
                style={{ width: "100%", height: Math.max(160, chartData.length * 44), marginBottom: "20px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(104,169,186,0.12)" />
                    <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: "#5a8898", fontSize: 11 }} stroke="rgba(104,169,186,0.2)" />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#9dc4ce", fontSize: 12 }} stroke="rgba(104,169,186,0.2)" />
                    <Tooltip
                      cursor={{ fill: "rgba(104,169,186,0.08)" }}
                      contentStyle={{ background: "#111d24", border: "1px solid rgba(104,169,186,0.25)", borderRadius: "10px", fontSize: "12px", color: "#e8fbff" }}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={scoreColor(d.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {sectionScores.map(([label, score]) => {
                const pct = Math.max(0, Math.min(100, (score / 10) * 100));
                const c = scoreColor(score);
                const { bg, border } = scoreBg(score);
                return (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                      <span style={{
                        fontSize: "12px", fontWeight: 700, padding: "2px 10px", borderRadius: "6px",
                        background: bg, border: `1px solid ${border}`, color: c,
                      }}>
                        {score.toFixed(1)}/10
                      </span>
                    </div>
                    <div style={{ height: "6px", background: "var(--surface-3)", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, borderRadius: "6px",
                        background: `linear-gradient(90deg, ${c}, ${c}CC)`,
                        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Strong / Weak ── */}
        <div className="report-grid-2 print-avoid-break" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          {/* Strengths */}
          <div style={{ background: "var(--surface-1)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "18px", padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={15} color="#22C55E" />
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#22C55E" }}>Strong Areas</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {strongTopics.length === 0 && (
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>None identified yet.</span>
              )}
              {strongTopics.map((t, i) => (
                <div key={`${i}-${t}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <CheckCircle2 size={14} color="#22C55E" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1px" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div style={{ background: "var(--surface-1)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "18px", padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={15} color="#EF4444" />
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#EF4444" }}>Areas to Improve</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {weakTopics.length === 0 && (
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>None identified.</span>
              )}
              {weakTopics.map((t, i) => (
                <div key={`${i}-${t}`} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid #EF4444", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1px" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Study Roadmap ── */}
        {recommendations.length > 0 && (
          <div className="print-avoid-break" style={{
            background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
            borderRadius: "18px", padding: "24px", marginBottom: "24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(104,169,186,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={15} color="#68a9ba" />
              </div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Recommendations</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "var(--surface-2)" }}>
                  <ChevronRight size={14} color="#68a9ba" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Share (only real reports can be shared) ── */}
        {!body.fallback && <SharePanel interviewId={interviewId} />}

        {/* ── Actions ── */}
        <div className="report-actions no-print" style={{ display: "flex", gap: "12px" }}>
          <button
            id="new-interview-btn"
            onClick={() => router.push("/interview/new")}
            style={{
              flex: 1, padding: "14px", borderRadius: "12px",
              background: "linear-gradient(135deg,#4d8fa2,#68a9ba)",
              border: "none", color: "white", fontSize: "14px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 20px rgba(104,169,186,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(104,169,186,0.55)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(104,169,186,0.4)"; }}
          >
            Start New Interview <ArrowRight size={15} />
          </button>
          <button
            id="review-transcript-btn"
            onClick={() => router.push(`/interview/${interviewId}`)}
            style={{
              padding: "14px 24px", borderRadius: "12px",
              background: "var(--surface-1)", border: "1px solid var(--border-default)",
              color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
            }}
          >
            Review Transcript
          </button>
          <button
            id="dashboard-btn"
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "14px 24px", borderRadius: "12px",
              background: "var(--surface-1)", border: "1px solid var(--border-default)",
              color: "var(--text-secondary)", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
          >
            Dashboard
          </button>
        </div>
      </div>
    </AppShell>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px",
  padding: "9px 14px", borderRadius: "10px",
  background: "var(--surface-1)", border: "1px solid var(--border-default)",
  color: "var(--text-secondary)", fontSize: "12.5px", fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
