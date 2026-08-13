"use client";
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">

      {/* ── Full-screen video background ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src="/Porcelain fold.webm"
      />

      {/* ── Dark overlay for readability ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(6,10,14,0.55) 0%, rgba(6,10,14,0.40) 40%, rgba(6,10,14,0.65) 100%)",
        }}
      />

      {/* ── Navbar ── */}
      <nav
        className="absolute top-0 left-0 right-0 z-20"
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "18px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "9px",
                background: "linear-gradient(135deg, #4d8fa2, #68a9ba)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 14px rgba(104,169,186,0.40)",
                flexShrink: 0,
              }}
            >
              <Zap size={14} color="#061014" fill="#061014" />
            </div>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "-0.3px",
                background: "linear-gradient(135deg, #e8fbff, #68a9ba)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              InterVu
            </span>
          </Link>

          {/* Nav link */}
          <Link
            href="/interview/new"
            style={{
              textDecoration: "none",
              fontSize: "18px",
              fontWeight: 500,
              fontFamily: "var(--font-telma)",
              color: "rgba(232,251,255,0.70)",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#e8fbff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(232,251,255,0.70)";
            }}
          >
            Start Interview
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center"
        style={{ padding: "0 24px", paddingTop: "64px" }}
      >
        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(48px, 8vw, 88px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-3px",
            marginBottom: "24px",
            color: "#e8fbff",
          }}
        >
          Ace Every{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #9dc4ce 0%, #68a9ba 50%, #e8fbff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "var(--font-telma)", fontWeight:600,
              padding: "0 15px 0 0",
            }}
          >
            Interview
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            color: "rgba(232,251,255,0.60)",
            lineHeight: 1.7,
            maxWidth: "520px",
            marginBottom: "40px",
            fontWeight: 400,
          }}
        >
          InterVu researches your target company, builds a personalised
          knowledge base, then conducts an adaptive AI interview while
          scoring every answer in real time.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/interview/new" style={{ textDecoration: "none" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "",
                background: "linear-gradient(135deg, #4d8fa2, #68a9ba)",
                border: "none",
                color: "#061014",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(104,169,186,0.35)",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(104,169,186,0.50)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(104,169,186,0.35)";
              }}
            >
              Start Free Interview
              <ArrowRight size={16} />
            </button>
          </Link>

          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 24px",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 500,
                background: "rgba(6,10,14,0.55)",
                border: "1px solid rgba(232,251,255,0.15)",
                color: "rgba(232,251,255,0.75)",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(104,169,186,0.12)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(104,169,186,0.30)";
                (e.currentTarget as HTMLElement).style.color = "#e8fbff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(6,10,14,0.55)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,251,255,0.15)";
                (e.currentTarget as HTMLElement).style.color = "rgba(232,251,255,0.75)";
              }}
            >
              View Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
