"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { FileText, ShieldCheck, Trash2, Upload } from "lucide-react";
import { api, errorMessage, type ResumeInfo } from "@/lib/api";

const MAX_BYTES = 2 * 1024 * 1024;

const dateText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export default function ResumePage() {
  const [info, setInfo] = useState<ResumeInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.resume
      .get()
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e, "Could not load your resume settings."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Export a smaller PDF or DOCX, or paste the text into a .txt file.");
      return;
    }
    setBusy(true);
    try {
      setInfo(await api.resume.upload(file));
      setNotice("Resume saved. You can use it from the new-interview screen.");
    } catch (e) {
      setError(errorMessage(e, "Could not upload the resume."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  const remove = useCallback(async () => {
    if (!window.confirm("Delete the stored text of your resume?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setInfo(await api.resume.remove());
      setNotice("Resume deleted.");
    } catch (e) {
      setError(errorMessage(e, "Could not delete the resume."));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <AppShell>
      <div className="dash-content" style={{ padding: "32px", maxWidth: "760px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "6px" }}>
          Resume
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
          Optional. Upload a resume and the interviewer can ask about your own projects and experience.
        </p>

        <div
          id="resume-privacy"
          style={{ display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "14px", background: "rgba(104,169,186,0.08)", border: "1px solid rgba(104,169,186,0.25)", marginBottom: "24px" }}
        >
          <ShieldCheck size={18} color="#68a9ba" style={{ flexShrink: 0, marginTop: "2px" }} />
          <ul style={{ margin: 0, paddingLeft: "16px", listStyle: "disc", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <li>Only the extracted text is stored. The file itself is never kept.</li>
            <li>It is used only for interviews where you tick &ldquo;Tailor questions to my resume&rdquo;, and then sent to the AI provider (Groq) for that interview.</li>
            <li>PDF (with a text layer), DOCX or .txt, up to 2 MB. Scanned images are not supported.</li>
            <li>Deleting it stops future use. Copies already placed in the state of past interviews are not removed.</li>
          </ul>
        </div>

        {loadError && <p role="alert" style={{ color: "#EF4444", fontSize: "13px", marginBottom: "16px" }}>{loadError}</p>}

        {info?.has_resume && (
          <div id="resume-card" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <FileText size={16} color="#68a9ba" />
              <strong id="resume-filename" style={{ fontSize: "14px", color: "var(--text-primary)" }}>{info.filename}</strong>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {info.characters.toLocaleString()} characters{info.updated_at ? ` · updated ${dateText(info.updated_at)}` : ""}
              </span>
              <button id="delete-resume-btn" onClick={remove} disabled={busy} style={{ ...buttonStyle, marginLeft: "auto" }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-secondary)", background: "var(--surface-2)", padding: "12px 14px", borderRadius: "10px" }}>
              {info.preview}
              {info.characters > info.preview.length ? "…" : ""}
            </pre>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            id="resume-file-input"
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => void upload(e.target.files?.[0])}
            disabled={busy}
            aria-label="Choose a resume file"
            style={{ fontSize: "13px", color: "var(--text-secondary)" }}
          />
          {busy && <span role="status" style={{ fontSize: "12.5px", color: "var(--text-muted)" }}><Upload size={12} /> Working...</span>}
        </div>

        {error && <p id="resume-error" role="alert" style={{ color: "#EF4444", fontSize: "13px", marginTop: "14px", lineHeight: 1.5 }}>{error}</p>}
        {notice && <p id="resume-notice" role="status" style={{ color: "#22C55E", fontSize: "13px", marginTop: "14px" }}>{notice}</p>}
      </div>
    </AppShell>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "8px",
  background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-secondary)",
  fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
