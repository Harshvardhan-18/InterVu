"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import StatCard from "@/components/ui/stat-card";
import InterviewCard from "@/components/ui/interview-card";
import CommandPalette from "@/components/ui/command-palette";
import {
  Mic2, BarChart3, Trophy, AlertTriangle, Plus, ArrowRight, Command, Zap,
} from "lucide-react";
import {api, type InterviewSummary} from "@/lib/api";

const CURRENT_USER_ID = 1;

export default function DashboardPage() {
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(()=>{
    api.interviews.list(CURRENT_USER_ID)
    .then(setInterviews)
    .catch(err => console.error("Error fetching interviews:", err))
    .finally(() => setLoading(false));
  },[])

  const completed = interviews.filter(i => i.score !== null);
  const avgScore = completed.length > 0 ? Math.round(completed.reduce((a,i) => a + (i.score??0), 0) / completed.length) : 0;
  const best =  completed.length > 0 ? [...completed].sort((a, b) => (b.score??0) - (a.score??0))[0] : null;
  const worst = completed.length > 0 ? [...completed].sort((a, b) => (a.score??0) - (b.score??0))[0] : null;

  return (
    <AppShell>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <div style={{ padding: "32px", maxWidth: "1100px" }}>
        {/* ── Top bar ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
              Welcome back, Harshvardhan
            </h1>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Continue improving your interview readiness.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 14px", borderRadius: "10px", fontSize: "12.5px",
                background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
            >
              <Command size={12} />
              <span>Command</span>
              <kbd style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "1px 4px" }}>K</kbd>
            </button>
            <button
              id="new-interview-dashboard-btn"
              onClick={() => router.push("/interview/new")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                border: "none", color: "white", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                transition: "all 0.2s ease", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(124,58,237,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(124,58,237,0.35)"; }}
            >
              <Plus size={15} /> New Interview
            </button>
          </div>
        </div>

        {/* ── Hero card ── */}
        <div style={{
          borderRadius: "20px", padding: "28px 32px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.1) 50%, rgba(9,9,11,0) 100%)",
          border: "1px solid rgba(139,92,246,0.2)",
          marginBottom: "24px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", background: "radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #7C3AED, #6366F1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}>
              <Zap size={18} color="white" fill="white" />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>Ready to practice?</h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Your next interview session is waiting.</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/interview/new")}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--text-primary)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
          >
            Start Interview <ArrowRight size={14} />
          </button>
        </div>
        { loading && interviews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          <StatCard id="stat-interviews" label="Total Interviews"  value={interviews.length}   icon={Mic2}         iconColor="#8B5CF6" trend="up"   trendLabel="+2 this week" />
          <StatCard id="stat-avg-score"  label="Average Score"    value={`${avgScore}/100`}         icon={BarChart3}    iconColor="#6366F1" trend="up"   trendLabel="+4 pts" />
          {best && (
            <StatCard id="stat-best"       label="Top Performance"  value={best.company}              icon={Trophy}       iconColor="#22C55E" trend="up"   trendLabel={`${best.score}/100`} />
          )}
          {worst && (
            <StatCard id="stat-weak"       label="Needs Attention"  value={worst.company}             icon={AlertTriangle} iconColor="#F59E0B" trend="down" trendLabel={`${worst.score}/100`} />
          )}
        </div>
        )}
        {/* ── Stat cards ── */}

        {/* ── Interview History ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              Interview History
            </h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{interviews.length} sessions</span>
          </div>
          {loading ? (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading...</span>
          ): interviews.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No interviews yet. Start your first one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {interviews.map((interview, i) => (
                <div
                  key={interview.id}
                  style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(8px)", transition: `all 0.35s ease ${i * 60}ms` }}
                >
                  <InterviewCard
                    id={`interview-card-${interview.id}`}
                    company={interview.company}
                    role={interview.role}
                    date={interview.date}
                    score={interview.score}
                    status={interview.status as "in_progress" | "completed" | "scheduled"}
                    skills={interview.skills}
                    onClick={() => router.push(interview.status === "completed" ? `/report/${interview.id}` : `/interview/${interview.id}`)}
                  />
                </div>
              ))}
            </div>
          )
          }
        </div>
      </div>
    </AppShell>
  );
}
