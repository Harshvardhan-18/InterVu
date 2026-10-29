"use client";

import { useRef, useState } from "react";
import { Play, X, CornerDownLeft } from "lucide-react";
import { CODE_LANGUAGES, composeCodeAnswer, type CodeLanguage } from "@/lib/code-answer";
import { MAX_CODE_CHARS, runJavaScript, type RunResult } from "@/lib/sandbox";

interface CodeEditorProps {
  /** Receives the code (and optionally its output) formatted for the answer box. */
  onInsert: (text: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

/**
 * A small code editor for coding questions. JavaScript can be run safely in
 * the browser (see lib/sandbox.ts); other languages are only submitted as
 * text for the AI to review. Nothing runs on the server.
 */
export default function CodeEditor({ onInsert, onClose, disabled = false }: CodeEditorProps) {
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [includeOutput, setIncludeOutput] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const runnable = CODE_LANGUAGES.find((l) => l.id === language)?.runnable ?? false;
  const lineCount = Math.max(1, code.split("\n").length);

  const run = async () => {
    if (!runnable || running || !code.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await runJavaScript(code));
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      // Keep focus in the editor: insert two spaces instead of leaving the field.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart, selectionEnd } = el;
      const next = `${code.slice(0, selectionStart)}  ${code.slice(selectionEnd)}`;
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + 2;
      });
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  };

  const insert = () => {
    const outputLines = includeOutput && result && !result.timedOut ? result.output : null;
    const text = composeCodeAnswer(language, code, outputLines);
    if (text) onInsert(text);
  };

  return (
    <section
      id="code-editor"
      aria-label="Code editor"
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "14px",
        background: "var(--surface-1)",
        overflow: "hidden",
        marginBottom: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
        <label htmlFor="code-language" style={{ fontSize: "12px", color: "var(--text-muted)" }}>Language</label>
        <select
          id="code-language"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as CodeLanguage);
            setResult(null);
          }}
          style={selectStyle}
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", flex: 1, minWidth: "160px" }}>
          {runnable
            ? "Runs safely in your browser, offline and isolated."
            : "This language is not run here; your code is sent to the AI for review."}
        </span>
        <button id="run-code-btn" type="button" onClick={run} disabled={!runnable || running || !code.trim()} style={buttonStyle} title="Ctrl/Cmd + Enter">
          <Play size={12} /> {running ? "Running..." : "Run"}
        </button>
        <button type="button" aria-label="Close editor" onClick={onClose} style={{ ...buttonStyle, padding: "6px 8px" }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "flex" }}>
        <div
          aria-hidden="true"
          style={{
            padding: "10px 8px", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-muted)", background: "var(--surface-2)",
            userSelect: "none", minWidth: "36px",
          }}
        >
          {Array.from({ length: Math.min(lineCount, 200) }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          id="code-input"
          ref={areaRef}
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, MAX_CODE_CHARS))}
          onKeyDown={onKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Code"
          placeholder={runnable ? "// Write JavaScript here, then press Run" : "Write your solution here"}
          rows={Math.min(Math.max(lineCount, 8), 18)}
          wrap="off"
          style={{
            flex: 1, padding: "10px 12px", border: "none", outline: "none", resize: "vertical",
            background: "transparent", color: "var(--text-primary)", whiteSpace: "pre", overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12.5px", lineHeight: 1.6,
          }}
        />
      </div>

      {result && (
        <div id="code-output" role="status" aria-live="polite" style={{ borderTop: "1px solid var(--border-subtle)", padding: "10px 12px", background: "var(--surface-2)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Output ({result.durationMs} ms{result.timedOut ? ", timed out" : ""})
          </div>
          <pre style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "180px", overflow: "auto" }}>
            {result.output.map((l, i) => (
              <div key={i} style={{ color: l.level === "error" ? "#EF4444" : l.level === "warn" ? "#F59E0B" : "var(--text-primary)" }}>
                {l.level === "log" || l.level === "info" ? l.text : `[${l.level}] ${l.text}`}
              </div>
            ))}
            {result.output.length === 0 && !result.error && <span style={{ color: "var(--text-muted)" }}>(no output)</span>}
            {result.error && <div style={{ color: "#EF4444" }}>{result.error}</div>}
          </pre>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
        <button id="insert-code-btn" type="button" onClick={insert} disabled={!code.trim() || disabled} style={buttonStyle}>
          <CornerDownLeft size={12} /> Add to my answer
        </button>
        {runnable && result && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={includeOutput} onChange={(e) => setIncludeOutput(e.target.checked)} />
            Include the output (marked as self-reported)
          </label>
        )}
      </div>
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px",
  background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-secondary)",
  fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: "8px", fontSize: "12px", background: "var(--surface-2)",
  border: "1px solid var(--border-default)", color: "var(--text-primary)", fontFamily: "inherit",
};
