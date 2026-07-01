"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { api, auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login({ name: name.trim(), email: email.trim() });
      auth.save(result);
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)",
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", padding: "40px 32px",
        background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
        borderRadius: "20px", boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <span style={{ fontSize: "18px", fontWeight: 700, background: "linear-gradient(135deg,#A78BFA,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            InterVu
          </span>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
          Welcome
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "28px" }}>
          Enter your details to start or continue your interview prep.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Your Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Harsh"
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)",
                outline: "none", fontFamily: "inherit",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Email
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="harsh@test.com"
              type="email"
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)",
                outline: "none", fontFamily: "inherit",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12.5px", color: "#EF4444" }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!name.trim() || !email.trim() || loading}
            style={{
              width: "100%", padding: "13px", borderRadius: "10px",
              background: name && email ? "linear-gradient(135deg,#7C3AED,#6366F1)" : "var(--surface-2)",
              border: "none", color: name && email ? "white" : "var(--text-muted)",
              fontSize: "14px", fontWeight: 700, cursor: name && email ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "all 0.2s ease",
              boxShadow: name && email ? "0 4px 16px rgba(124,58,237,0.35)" : "none",
            }}
          >
            {loading ? "Signing in…" : "Get Started"}
          </button>
        </div>

        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px", lineHeight: 1.6 }}>
          No password needed. We use your email to keep your interviews saved across sessions.
        </p>
      </div>
    </div>
  );
}