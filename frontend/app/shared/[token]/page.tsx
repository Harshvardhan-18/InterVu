"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, AlertTriangle, BookOpen, CheckCircle2, ChevronRight, Clock, Zap } from "lucide-react";
import ScoreRing from "@/components/ui/score-ring";
import { api, errorMessage, isApiError, type SharedReport } from "@/lib/api";

type LoadState = "loading" | "ready" | "unavailable" | "error";

const gradeLabel = (score: number) =>
  score >= 90 ? "Excellent" : score >= 76 ? "Good" : score >= 61 ? "Average" : score >= 41 ? "Below Average" : "Needs Work";

const scoreColor = (s: number) => (s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444");

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * Public, read-only view of a report opened through a share link. It needs no
 * account: the token in the URL is the credential, and the API only returns a
 * fixed set of fields (never the name, email or answers).
 */
export default function SharedReportPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api.shared
      .get(token, controller.signal)
      .then((report) => {
        setData(report);
        setState("ready");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (isApiError(e) && e.status === 404) {
          setState("unavailable");
        } else {
          setError(errorMessage(e, "Could not load this report."));
          setState("error");
        }
      });
    return () => controller.abort();
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "32px 20px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", marginBottom: "28px" }}>
          <span style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={13} color="white" fill="white" />
          </span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>InterVu</span>
        </Link>
        {children}
      </div>
    </div>
  );

  if (!token || state === "unavailable") {
    return shell(
      <div id="shared-unavailable" role="alert" style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <AlertTriangle size={18} color="#F59E0B" style={{ marginTop: "2px" }} />
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            This shared report is not available
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            The link may have expired, been switched off by its owner, or been copied incorrectly.
          </p>
        </div>
      </div>,
    );
  }

  if (state === "loading") {
    return shell(<span role="status" style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading report...</span>);
  }

  if (state === "error" || !data) {
    return shell(
      <p role="alert" style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{error ?? "Could not load this report."}</p>,
    );
  }

  const report = data.report;
  const overall = data.overall_score ?? 0;
  const sections = Object.entries(report.section_scores ?? {}).map(([name, score]) => [name, Number(score) || 0] as const);
  const strong = report.strong_topics ?? [];
  const weak = report.weak_topics ?? [];
  const recommendations = report.recommendations ?? [];

  return shell(
    <>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", background: "rgba(104,169,186,0.12)", border: "1px solid rgba(104,169,186,0.3)", color: "#68a9ba", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Shared report
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatDate(data.created_at)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
            <Clock size={11} /> link expires {formatDate(data.expires_at)}
          </span>
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "4px" }}>
          Mock interview feedback
        </h1>
        <p id="shared-title" style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
          {data.role} · {data.company}
          {data.difficulty ? ` · ${data.difficulty}` : ""}
        </p>
      </div>

      <div className="report-hero-card" style={{ borderRadius: "20px", padding: "32px", background: "linear-gradient(135deg, rgba(104,169,186,0.12) 0%, rgba(104,169,186,0.08) 50%, rgba(9,9,11,0) 100%)", border: "1px solid rgba(104,169,186,0.2)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "32px" }}>
        <ScoreRing score={overall} size={130} strokeWidth={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "19px", fontWeight: 800, color: "var(--text-primary)" }}>Overall performance</h2>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px", background: "rgba(104,169,186,0.12)", border: "1px solid rgba(104,169,186,0.3)", color: "#68a9ba" }}>
              {gradeLabel(overall)}
            </span>
          </div>
          {report.summary && (
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>{report.summary}</p>
          )}
        </div>
      </div>

      {sections.length > 0 && (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "18px", padding: "22px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Section breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {sections.map(([name, score]) => (
              <div key={name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{name}</span>
                  <span style={{ color: scoreColor(score), fontWeight: 700 }}>{score.toFixed(1)}/10</span>
                </div>
                <div style={{ height: "6px", background: "var(--surface-3)", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, score * 10))}%`, background: scoreColor(score), borderRadius: "6px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="report-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "var(--surface-1)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "18px", padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#22C55E", marginBottom: "12px" }}>Strong areas</h3>
          {strong.length === 0 ? (
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>None identified.</span>
          ) : (
            strong.map((t, i) => (
              <div key={`${i}-${t}`} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                <CheckCircle2 size={14} color="#22C55E" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{t}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "18px", padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#EF4444", marginBottom: "12px" }}>Areas to improve</h3>
          {weak.length === 0 ? (
            <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>None identified.</span>
          ) : (
            weak.map((t, i) => (
              <div key={`${i}-${t}`} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{t}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "18px", padding: "22px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <BookOpen size={15} color="#68a9ba" />
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Recommendations</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "var(--surface-2)" }}>
                <ChevronRight size={14} color="#68a9ba" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
        Generated by InterVu. This view only shows what the owner chose to share.
      </p>
    </>,
  );
}
