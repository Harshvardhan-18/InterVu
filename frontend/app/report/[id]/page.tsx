"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import ScoreRing from "@/components/ui/score-ring";
import {
  ArrowRight, CheckCircle2, AlertCircle, BookOpen,
  TrendingUp, ChevronRight, BarChart3, ArrowLeft,
} from "lucide-react";
import {api, type ReportResponse} from "@/lib/api";


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


export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = Number(params.id);

  const [report,setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    if(!interviewId) {return}
    api.reports.get(interviewId)
    .then(setReport)
    .catch((e)=>{
      console.error("Failed to fetch report:", e);
      setError("Failed to load report. Please try again later.");
    }).finally(()=> setLoading(false));
  },[interviewId]);

  if (loading) {
    return (
      <AppShell>
        <div style={{ padding: "32px", maxWidth: "900px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading report…</span>
        </div>
      </AppShell>
    );
  }

  if (error || !report) {
    return (
      <AppShell>
        <div style={{ padding: "32px", maxWidth: "900px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>{error ?? "Report not available."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "10px 18px", borderRadius: "10px",
              background: "var(--surface-1)", border: "1px solid var(--border-default)",
              color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  const sectionScores = Object.entries(report.report.section_scores);
  const date = new Date(report.created_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const grade = gradeLabel(report.overall_score);
  const gColor = gradeColor(report.overall_score);

  return (
    <AppShell>
      <div style={{ padding: "32px", maxWidth: "900px" }}>

        {/* Back */}
        <button
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
        <div style={{ marginBottom: "32px" }}>
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

        {/* ── Hero score card ── */}
        <div style={{
          borderRadius: "20px", padding: "36px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(99,102,241,0.08) 50%, rgba(9,9,11,0) 100%)",
          border: "1px solid rgba(139,92,246,0.2)",
          marginBottom: "24px", display: "flex", alignItems: "center", gap: "40px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "240px", height: "240px", background: "radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

          <ScoreRing score={report.overall_score} size={140} strokeWidth={10} />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>Overall Performance</h2>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22C55E",
              }}>{grade}</span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: "480px", marginBottom: "20px" }}>
              {report.report.summary}
            </p>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{sectionScores.length}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sections</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section scores ── */}
        {sectionScores.length > 0 && (
          <div style={{
            background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
            borderRadius: "18px", padding: "24px", marginBottom: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <BarChart3 size={16} color="#8B5CF6" />
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Section Breakdown</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {sectionScores.map(([label, score]) => {
              const pct = (score / 10) * 100;
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          {/* Strengths */}
          <div style={{ background: "var(--surface-1)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "18px", padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={15} color="#22C55E" />
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#22C55E" }}>Strong Areas</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {report.report.strong_topics.map(t => (
                <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
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
              {report.report.weak_topics.map(t => (
                <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid #EF4444", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1px" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Study Roadmap ── */}
        {report.report.recommendations.length > 0 && (
          <div style={{
            background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
            borderRadius: "18px", padding: "24px", marginBottom: "24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={15} color="#8B5CF6" />
              </div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Recommendations</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {report.report.recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "var(--surface-2)" }}>
                  <ChevronRight size={14} color="#8B5CF6" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            id="new-interview-btn"
            onClick={() => router.push("/interview/new")}
            style={{
              flex: 1, padding: "14px", borderRadius: "12px",
              background: "linear-gradient(135deg,#7C3AED,#6366F1)",
              border: "none", color: "white", fontSize: "14px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 20px rgba(124,58,237,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(124,58,237,0.55)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(124,58,237,0.4)"; }}
          >
            Start New Interview <ArrowRight size={15} />
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
