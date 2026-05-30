"use client";
export const dynamic = 'force-dynamic';

import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import ScoreRing from "@/components/ui/score-ring";
import {
  ArrowRight, CheckCircle2, AlertCircle, BookOpen,
  TrendingUp, Calendar, ChevronRight, BarChart3,
  Zap, ArrowLeft,
} from "lucide-react";

const MOCK_REPORT = {
  company: "NVIDIA",
  role: "PTX Compiler Intern",
  date: "May 28, 2025",
  overall_score: 78,
  grade: "Good",
  summary: "Strong candidate with solid fundamentals in data structures and general algorithms. Needs to deepen knowledge in compiler theory and dynamic programming before the interview.",
  section_scores: [
    { label: "Screening",     score: 8.5, max: 10 },
    { label: "Coding",        score: 6.8, max: 10 },
    { label: "Role Specific", score: 7.9, max: 10 },
    { label: "Behavioral",    score: 8.2, max: 10 },
  ],
  strong_topics: [
    { label: "Data Structures",     detail: "Arrays, Trees, Heaps" },
    { label: "Graph Algorithms",    detail: "BFS, DFS, Dijkstra" },
    { label: "OOP Principles",      detail: "Design patterns, SOLID" },
    { label: "System Design Basics",detail: "Load balancing, Caching" },
  ],
  weak_topics: [
    { label: "Dynamic Programming", detail: "Memoization, tabulation" },
    { label: "Compiler Theory",     detail: "Parsing, AST, IR" },
    { label: "OS Internals",        detail: "Scheduling, virtual memory" },
    { label: "Behavioral Depth",    detail: "STAR method, structured stories" },
  ],
  recommendations: [
    { week: "Week 1", title: "Graph & Tree Mastery",        tasks: ["15 LeetCode graph problems (Medium)", "Implement Dijkstra, Bellman-Ford from scratch", "Study tree serialization & traversals"] },
    { week: "Week 2", title: "Dynamic Programming Sprint",  tasks: ["0/1 Knapsack, LIS, Edit Distance", "Solve 20 DP problems (Medium/Hard)", "Pattern recognition: top-down vs bottom-up"] },
    { week: "Week 3", title: "Compiler & Behavioral Prep",  tasks: ["Read AIMA Compiler chapters 1–4", "Practice 10 STAR-method behavioral answers", "Review OS: scheduling, virtual memory, IPC"] },
  ],
};

const scoreColor = (s: number) =>
  s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444";

const scoreBg = (s: number) =>
  s >= 8
    ? { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" }
    : s >= 6
    ? { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" }
    : { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const report = MOCK_REPORT;

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
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{report.date}</span>
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
              }}>Good</span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: "480px", marginBottom: "20px" }}>
              {report.summary}
            </p>
            <div style={{ display: "flex", gap: "24px" }}>
              {[
                { label: "Questions", value: "5" },
                { label: "Sections",  value: "4" },
                { label: "Duration",  value: "~30 min" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section scores ── */}
        <div style={{
          background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
          borderRadius: "18px", padding: "24px", marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <BarChart3 size={16} color="#8B5CF6" />
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Section Breakdown</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {report.section_scores.map(s => {
              const pct = (s.score / s.max) * 100;
              const c = scoreColor(s.score);
              const { bg, border } = scoreBg(s.score);
              return (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{s.label}</span>
                    <span style={{
                      fontSize: "12px", fontWeight: 700, padding: "2px 10px", borderRadius: "6px",
                      background: bg, border: `1px solid ${border}`, color: c,
                    }}>
                      {s.score}/{s.max}
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
              {report.strong_topics.map(t => (
                <div key={t.label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <CheckCircle2 size={14} color="#22C55E" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1px" }}>{t.label}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{t.detail}</div>
                  </div>
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
              {report.weak_topics.map(t => (
                <div key={t.label} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid #EF4444", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1px" }}>{t.label}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Study Roadmap ── */}
        <div style={{
          background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
          borderRadius: "18px", padding: "24px", marginBottom: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={15} color="#8B5CF6" />
            </div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Recommended Study Plan</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {report.recommendations.map((rec, i) => (
              <div
                key={rec.week}
                style={{
                  padding: "18px", borderRadius: "14px",
                  background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.3)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "8px", fontSize: "11px", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "white",
                    background: i === 0 ? "linear-gradient(135deg,#7C3AED,#6366F1)" : i === 1 ? "linear-gradient(135deg,#059669,#10B981)" : "linear-gradient(135deg,#D97706,#F59E0B)",
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{rec.week}</span>
                </div>
                <h4 style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px", lineHeight: 1.3 }}>
                  {rec.title}
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {rec.tasks.map(task => (
                    <div key={task} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#8B5CF6", marginTop: "6px", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

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
