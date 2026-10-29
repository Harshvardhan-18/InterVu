"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Lock } from "lucide-react";
import { api, errorMessage, type ShareStatus } from "@/lib/api";

const EXPIRY_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const expiryText = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

interface SharePanelProps {
  interviewId: number;
}

/**
 * Opt-in public link to the report. Nothing is shared until the owner clicks
 * "Create link"; the link expires and can be revoked here at any time.
 */
export default function SharePanel({ interviewId }: SharePanelProps) {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.reports.share
      .get(interviewId)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "Could not load sharing settings."));
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.reports.share.create(interviewId, days));
    } catch (e) {
      setError(errorMessage(e, "Could not create the link."));
    } finally {
      setBusy(false);
    }
  }, [interviewId, days]);

  const revoke = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.reports.share.revoke(interviewId));
      setCopied(false);
    } catch (e) {
      setError(errorMessage(e, "Could not stop sharing."));
    } finally {
      setBusy(false);
    }
  }, [interviewId]);

  const url =
    status?.shared && typeof window !== "undefined" ? `${window.location.origin}${status.path}` : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (for example on plain http): select the text instead.
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="share-panel"
      className="no-print"
      aria-label="Share this report"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "18px",
        padding: "20px 24px",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <Link2 size={16} color="#68a9ba" />
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>Share this report</h3>
      </div>
      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "14px" }}>
        Anyone with the link can read your score, summary, topics and recommendations until it expires.
        It never shows your name, email or answers. Nothing is shared unless you create a link.
      </p>

      {status === null && !error && (
        <span role="status" style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Loading...</span>
      )}

      {status && !status.shared && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="share-expiry" style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Link expires after
          </label>
          <select
            id="share-expiry"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={busy}
            style={{
              padding: "8px 10px", borderRadius: "8px", fontSize: "12.5px",
              background: "var(--surface-2)", border: "1px solid var(--border-default)",
              color: "var(--text-primary)", fontFamily: "inherit",
            }}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
          <button id="create-share-btn" onClick={create} disabled={busy} style={buttonStyle}>
            <Link2 size={13} /> {busy ? "Creating..." : "Create link"}
          </button>
        </div>
      )}

      {status?.shared && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              id="share-url"
              ref={inputRef}
              readOnly
              value={url}
              aria-label="Public link"
              onFocus={(e) => e.currentTarget.select()}
              style={{
                flex: 1, minWidth: "220px", padding: "9px 12px", borderRadius: "8px", fontSize: "12.5px",
                background: "var(--surface-2)", border: "1px solid var(--border-default)",
                color: "var(--text-primary)", fontFamily: "inherit",
              }}
            />
            <button id="copy-share-btn" onClick={copy} style={buttonStyle}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <button id="revoke-share-btn" onClick={revoke} disabled={busy} style={buttonStyle}>
              <Lock size={13} /> {busy ? "Stopping..." : "Stop sharing"}
            </button>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Expires {expiryText(status.expires_at)}. Stopping sharing disables the link immediately.
          </span>
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontSize: "12.5px", color: "#EF4444", marginTop: "10px" }}>{error}</p>
      )}
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px",
  padding: "9px 14px", borderRadius: "10px",
  background: "var(--surface-2)", border: "1px solid var(--border-default)",
  color: "var(--text-secondary)", fontSize: "12.5px", fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
