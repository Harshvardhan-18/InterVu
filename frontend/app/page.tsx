"use client";
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowRight, Zap, Search, Brain, Database, Map, Bot, BarChart3, ChevronDown, Command } from "lucide-react";
import CommandPalette from "@/components/ui/command-palette";

const FEATURES = [
  { icon: Search,    color: "#8B5CF6", title: "Research Agent",       desc: "Scours Tavily + Firecrawl to pull real job descriptions, interview experiences, and engineering blogs." },
  { icon: Brain,     color: "#6366F1", title: "Knowledge Extraction", desc: "Gemini extracts structured skills, topics, interview rounds, and difficulty from noisy web content." },
  { icon: Database,  color: "#22C55E", title: "RAG Knowledge Base",   desc: "Content is chunked, embedded with sentence-transformers, and stored in ChromaDB for semantic retrieval." },
  { icon: Map,       color: "#F59E0B", title: "Interview Blueprint",  desc: "Generates a custom interview plan — sections, question counts, and focus areas tailored to the role." },
  { icon: Bot,       color: "#8B5CF6", title: "Adaptive Interview",   desc: "LangGraph orchestrates a multi-turn interview that adjusts difficulty based on your real-time performance." },
  { icon: BarChart3, color: "#22C55E", title: "Instant Feedback",     desc: "Post-interview report with scores, strong/weak topics, and personalised study recommendations." },
];

const STEPS = [
  { num: "01", title: "Enter Company & Role", desc: "Tell InterVu where you're interviewing — e.g., NVIDIA PTX Compiler Intern or Google L3." },
  { num: "02", title: "Research Pipeline",    desc: "Agents search the web, scrape pages, and extract structured knowledge into ChromaDB." },
  { num: "03", title: "Blueprint Generated",  desc: "A custom interview plan is created with adaptive sections and difficulty calibration." },
  { num: "04", title: "Interview Begins",     desc: "Answer questions. The AI evaluates each answer and adjusts the next question accordingly." },
  { num: "05", title: "Get Your Report",      desc: "Receive an overall score, topic breakdown, and personalised improvement recommendations." },
];

export default function HomePage() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", overflowX: "hidden" }}>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
        background: scrolled ? "rgba(9,9,11,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        transition: "all 0.3s ease",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "9px",
              background: "linear-gradient(135deg, #7C3AED, #6366F1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(124,58,237,0.5)",
            }}>
              <Zap size={14} color="white" fill="white" />
            </div>
            <span style={{
              fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px",
              background: "linear-gradient(135deg, #A78BFA, #818CF8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              InterVu
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)", fontSize: "13px", cursor: "pointer",
                transition: "all 0.2s ease", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
            >
              <Search size={13} />
              Search
              <kbd style={{ fontSize: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "1px 5px", display: "flex", alignItems: "center", gap: "2px" }}>
                <Command size={9} /> K
              </kbd>
            </button>
            <Link href="/dashboard" style={{ textDecoration: "none", padding: "7px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", background: "transparent", transition: "all 0.2s ease" }}>
              Dashboard
            </Link>
            <Link href="/interview/new" style={{ textDecoration: "none" }}>
              <button
                id="nav-start-btn"
                style={{
                  padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                  background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                  border: "none", color: "white", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                  transition: "all 0.2s ease", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(124,58,237,0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(124,58,237,0.35)"; }}
              >
                Start Interview
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative", paddingTop: "160px", paddingBottom: "120px",
        textAlign: "center", overflow: "hidden",
      }}>
        {/* Background glows */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "500px", background: "radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "20%", left: "20%", width: "400px", height: "300px", background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "10%", right: "15%", width: "350px", height: "250px", background: "radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 70%)", borderRadius: "50%" }} />
          {/* Grid pattern */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 70%)",
          }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", marginBottom: "32px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8B5CF6", animation: "blink 2s ease infinite" }} />
            <span style={{ fontSize: "12.5px", fontWeight: 500, color: "#A78BFA", letterSpacing: "0.01em" }}>
              Powered by Gemini 2.5 · LangGraph · RAG
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(44px, 7vw, 76px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: "24px", color: "var(--text-primary)" }}>
            Ace Every{" "}
            <span style={{
              background: "linear-gradient(135deg, #A78BFA 0%, #818CF8 50%, #67E8F9 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Interview
            </span>
          </h1>

          <p style={{ fontSize: "18px", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: "560px", margin: "0 auto 40px", fontWeight: 400 }}>
            InterVu researches your target company, builds a personalised knowledge base, then conducts an adaptive AI interview — scoring every answer in real time.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/interview/new" style={{ textDecoration: "none" }}>
              <button
                id="hero-cta-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "14px 28px", borderRadius: "14px", fontSize: "15px", fontWeight: 600,
                  background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                  border: "none", color: "white", cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
                  transition: "all 0.25s ease", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(124,58,237,0.55)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.4)"; }}
              >
                Start Free Interview
                <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <button
                id="hero-dashboard-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "14px 24px", borderRadius: "14px", fontSize: "15px", fontWeight: 500,
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s ease", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; }}
              >
                View Dashboard
              </button>
            </Link>
          </div>

          {/* Social proof strip */}
          <div style={{ marginTop: "48px", display: "flex", alignItems: "center", justifyContent: "center", gap: "32px", flexWrap: "wrap" }}>
            {[["Gemini 2.5", "#A78BFA"], ["LangGraph", "#818CF8"], ["ChromaDB", "#67E8F9"], ["Tavily RAG", "#A78BFA"]].map(([label, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "12px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Scroll to explore</span>
          <ChevronDown size={14} style={{ animation: "fadeInUp 1s ease infinite alternate" }} />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "100px 24px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "12px" }}>
            The Full Pipeline
          </p>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.8px", marginBottom: "16px" }}>
            Every interview grounded in real data
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "0 auto", fontSize: "16px", lineHeight: 1.65 }}>
            Not generic questions. Real company data, real interview patterns, real feedback.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                style={{
                  padding: "28px", borderRadius: "18px",
                  background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                  transition: "all 0.25s ease",
                  animationDelay: `${i * 80}ms`,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${f.color}35`;
                  el.style.background = "var(--surface-2)";
                  el.style.transform = "translateY(-3px)";
                  el.style.boxShadow = `0 16px 48px rgba(0,0,0,0.3), 0 0 0 1px ${f.color}20`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--border-subtle)";
                  el.style.background = "var(--surface-1)";
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                }}
              >
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${f.color}15`, border: `1px solid ${f.color}25`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                  <Icon size={20} color={f.color} />
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px", letterSpacing: "-0.2px" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "80px 24px 120px", borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "12px" }}>
              How It Works
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.8px" }}>
              From zero to offer-ready
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                style={{
                  display: "flex", gap: "20px", alignItems: "flex-start",
                  padding: "20px 24px", borderRadius: "14px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: i === 0 ? "linear-gradient(135deg, #7C3AED, #6366F1)" : "var(--surface-2)",
                    border: `1px solid ${i === 0 ? "transparent" : "var(--border-subtle)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700,
                    color: i === 0 ? "white" : "var(--text-muted)",
                    boxShadow: i === 0 ? "0 4px 16px rgba(124,58,237,0.4)" : "none",
                  }}>
                    {step.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)", marginTop: "4px" }} />
                  )}
                </div>
                <div style={{ paddingTop: "6px" }}>
                  <h4 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "5px" }}>{step.title}</h4>
                  <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: "56px" }}>
            <Link href="/interview/new" style={{ textDecoration: "none" }}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "14px 32px", borderRadius: "14px", fontSize: "15px", fontWeight: 600,
                background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                border: "none", color: "white", cursor: "pointer",
                boxShadow: "0 8px 32px rgba(124,58,237,0.4)", fontFamily: "inherit",
                transition: "all 0.25s ease",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(124,58,237,0.55)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.4)"; }}
              >
                Start Preparing Now <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "linear-gradient(135deg, #7C3AED, #6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={11} color="white" fill="white" />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 700, background: "linear-gradient(135deg, #A78BFA, #818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            InterVu
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Built with Gemini 2.5 · LangGraph · ChromaDB · Next.js
        </p>
      </footer>
    </div>
  );
}
