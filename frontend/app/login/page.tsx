"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { api, auth, errorMessage, isApiError } from "@/lib/api";

// The URL does not change while this page is shown, so nothing to subscribe to.
const subscribeNoop = () => () => {};

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ?expired=1 is set by the API client after a 401. Reading window.location
  // through useSyncExternalStore avoids both a Suspense boundary (needed for
  // useSearchParams) and a hydration mismatch (server snapshot is false).
  const sessionExpired = useSyncExternalStore(
    subscribeNoop,
    () => new URLSearchParams(window.location.search).has("expired"),
    () => false,
  );
  const notice = sessionExpired ? "Your session expired. Please sign in again." : null;

  const handleLogin = async () => {
    if (!name.trim() || !email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login({ name: name.trim(), email: email.trim() });
      auth.save(result);
      router.replace("/dashboard");
    } catch (e) {
      console.error(e);
      setError(
        isApiError(e) && e.status === 422
          ? "Please enter your name and a valid email address."
          : errorMessage(e),
      );
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
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="#061014" fill="#061014" />
          </div>
          <span style={{ fontSize: "18px", fontWeight: 700, background: "linear-gradient(135deg,#e8fbff,#68a9ba)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
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
            <label htmlFor="login-name" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Your Name
            </label>
            <input
              id="login-name"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Harsh"
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)",
                outline: "none", fontFamily: "inherit",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#68a9ba"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
            />
          </div>

          <div>
            <label htmlFor="login-email" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Email
            </label>
            <input
              id="login-email"
              autoComplete="email"
              maxLength={254}
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
              onFocus={e => { e.currentTarget.style.borderColor = "#68a9ba"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
            />
          </div>

          {notice && !error && (
            <p role="status" style={{ fontSize: "12.5px", color: "#F59E0B" }}>{notice}</p>
          )}

          {error && (
            <p role="alert" style={{ fontSize: "12.5px", color: "#EF4444" }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!name.trim() || !email.trim() || loading}
            style={{
              width: "100%", padding: "13px", borderRadius: "10px",
              background: name && email ? "linear-gradient(135deg,#4d8fa2,#68a9ba)" : "var(--surface-2)",
              border: "none", color: name && email ? "#061014" : "var(--text-muted)",
              fontSize: "14px", fontWeight: 700, cursor: name && email ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "all 0.2s ease",
              boxShadow: name && email ? "0 4px 16px rgba(104,169,186,0.30)" : "none",
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