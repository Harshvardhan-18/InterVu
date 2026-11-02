"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, MicOff, Phone, PhoneOff, RotateCcw, Send, Settings2, SkipForward, Code2 } from "lucide-react";
import type { VoiceCall } from "@/hooks/useVoiceCall";
import { RATE_OPTIONS, SILENCE_OPTIONS_MS, formatClock, phaseLabel } from "@/lib/voice-call";

interface VoiceCallOverlayProps {
  call: VoiceCall;
  company: string;
  role: string;
  /** The question the interviewer should speak when the call starts. */
  currentQuestion: string;
  questionNumber: number;
  totalQuestions: number;
  questionType: string | null;
  /** Leave the call and open the code editor. */
  onOpenEditor: () => void;
}

/**
 * Full-screen "phone call" with the AI interviewer: the interviewer speaks,
 * then listens; pausing for a moment sends the answer. Everything runs on the
 * browser's own speech features.
 */
export default function VoiceCallOverlay({
  call, company, role, currentQuestion, questionNumber, totalQuestions, questionType, onOpenEditor,
}: VoiceCallOverlayProps) {
  const [showSettings, setShowSettings] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { phase, muted } = call;

  // Keyboard: Escape hangs up; Tab stays inside the call screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || phase === "idle") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        call.end();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = root.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), [href]");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [call, phase]);

  // Move focus into the call when it opens.
  useEffect(() => {
    if (phase === "ready") rootRef.current?.querySelector<HTMLElement>("#start-call-btn")?.focus();
  }, [phase]);

  if (phase === "idle") return null;

  const hasWords = call.yourText.trim().length > 0;
  const orbClass =
    phase === "speaking" ? "call-orb-speaking" : phase === "thinking" ? "call-orb-thinking" : phase === "listening" && !muted ? "call-orb-listening" : "";
  const orbColors =
    phase === "error"
      ? "linear-gradient(135deg,#b7791f,#f59e0b)"
      : phase === "paused" || (phase === "listening" && muted)
      ? "linear-gradient(135deg,#3b4a52,#5b6b73)"
      : "linear-gradient(135deg,#4d8fa2,#68a9ba)";
  const showRings = phase === "speaking" || (phase === "listening" && !muted && hasWords);
  const englishFirst = [...call.voices].sort((a, b) => Number(b.lang.startsWith("en")) - Number(a.lang.startsWith("en")));

  return (
    <div
      ref={rootRef}
      id="voice-call"
      role="dialog"
      aria-modal="true"
      aria-label="Voice call with the AI interviewer"
      style={{
        position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column",
        background: "radial-gradient(ellipse at 50% 30%, #12262e 0%, #070d10 70%)", color: "var(--text-primary)",
        overflowY: "auto",
      }}
    >
      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>AI interviewer</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {role} · {company}
          </div>
        </div>
        {phase !== "ready" && (
          <div id="call-timer" aria-label="Call duration" style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22C55E", marginRight: 8 }} />
            {formatClock(call.elapsed)}
          </div>
        )}
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Question {Math.max(1, questionNumber)}{totalQuestions > 0 ? ` of ~${totalQuestions}` : ""}
        </span>
        <button
          id="call-settings-btn"
          type="button"
          aria-label="Call settings"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((v) => !v)}
          style={{ ...smallRoundStyle, ...(showSettings ? { borderColor: "rgba(104,169,186,0.6)", color: "#68a9ba" } : {}) }}
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showSettings && (
        <div id="call-settings" style={{ margin: "0 20px 8px", padding: "14px 16px", borderRadius: "14px", background: "var(--surface-1)", border: "1px solid var(--border-default)", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            Pause before sending
            <select id="call-silence" value={call.silenceMs} onChange={(e) => call.setSilenceMs(Number(e.target.value))} style={selectStyle}>
              {SILENCE_OPTIONS_MS.map((ms) => (
                <option key={ms} value={ms}>{ms / 1000} seconds</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Interviewer voice
            <select id="call-voice" value={call.voiceURI ?? ""} onChange={(e) => call.setVoiceURI(e.target.value || null)} style={selectStyle}>
              <option value="">Automatic</option>
              {englishFirst.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Speaking speed
            <select id="call-rate" value={call.rate} onChange={(e) => call.setRate(Number(e.target.value))} style={selectStyle}>
              {RATE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r === 1 ? "Normal" : `${r}x`}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── Orb and state ── */}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 8px" }}>
        <div style={{ position: "relative", width: "clamp(120px, 28vw, 180px)", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {showRings && [0, 0.8, 1.6].map((delay) => (
            <span key={delay} className="call-ring" aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(104,169,186,0.5)", animationDelay: `${delay}s` }} />
          ))}
          <div
            id="call-orb"
            data-phase={phase}
            className={orbClass}
            aria-hidden="true"
            style={{
              width: "100%", height: "100%", borderRadius: "50%", background: orbColors,
              boxShadow: phase === "listening" && !muted ? "0 0 60px rgba(104,169,186,0.45)" : phase === "speaking" ? "0 0 80px rgba(104,169,186,0.55)" : "0 0 30px rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.4s ease, box-shadow 0.4s ease",
            }}
          >
            {phase === "thinking" ? (
              <span style={{ width: "42%", height: "42%", borderRadius: "50%", border: "4px solid rgba(255,255,255,0.25)", borderTopColor: "white" }} />
            ) : phase === "listening" || phase === "paused" ? (
              muted || phase === "paused" ? <MicOff size={44} color="white" /> : <Mic size={44} color="white" />
            ) : (
              <Phone size={44} color="white" />
            )}
          </div>
        </div>
        <p id="call-status" role="status" aria-live="polite" style={{ marginTop: "24px", fontSize: "17px", fontWeight: 700 }}>
          {phaseLabel(phase, muted)}
        </p>
        {phase === "thinking" && (
          <p style={{ marginTop: "4px", fontSize: "12.5px", color: "var(--text-muted)" }}>This can take a few seconds.</p>
        )}
        {phase === "paused" && (
          <p style={{ marginTop: "4px", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center" }}>
            It has been quiet for a while. Tap the microphone when you are ready to continue.
          </p>
        )}
      </div>

      {/* ── Ready / error panels ── */}
      {phase === "ready" && (
        <div style={{ maxWidth: "520px", margin: "8px auto 0", padding: "0 20px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
            The interviewer will speak each question, then listen. When you stop talking for a moment, your answer is sent
            automatically. You can mute, repeat a question, or switch to typing at any time.
          </p>
          <p id="call-privacy" style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "12px" }}>
            Speech is handled by your browser. In Chrome, what you say is processed by Google&apos;s speech service. InterVu
            never receives audio, only the text of your answers.
          </p>
          {!call.supported && (
            <p role="alert" style={{ fontSize: "13px", color: "#F59E0B", marginTop: "12px" }}>
              This browser does not support voice calls. Chrome or Edge on desktop work best.
            </p>
          )}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px", flexWrap: "wrap" }}>
            <button id="start-call-btn" type="button" disabled={!call.supported} onClick={() => call.start(currentQuestion)} style={{ ...primaryStyle, opacity: call.supported ? 1 : 0.5, cursor: call.supported ? "pointer" : "not-allowed" }}>
              <Phone size={16} /> Start call
            </button>
            <button id="cancel-call-btn" type="button" onClick={call.end} style={secondaryStyle}>Not now</button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div role="alert" id="call-error" style={{ maxWidth: "520px", margin: "8px auto 0", padding: "0 20px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#F59E0B", lineHeight: 1.6 }}>{call.error}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
            <button id="call-retry-btn" type="button" onClick={call.retry} style={secondaryStyle}>
              <RotateCcw size={14} /> Try again
            </button>
            <button id="call-typing-btn-error" type="button" onClick={call.switchToTyping} style={secondaryStyle}>
              <Keyboard size={14} /> Switch to typing
            </button>
          </div>
        </div>
      )}

      {/* ── Captions ── */}
      {phase !== "ready" && phase !== "error" && (
        <div style={{ width: "100%", maxWidth: "680px", margin: "12px auto 0", padding: "0 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {questionType === "coding" && (
            <div id="call-coding-hint" style={{ padding: "10px 14px", borderRadius: "12px", background: "rgba(104,169,186,0.1)", border: "1px solid rgba(104,169,186,0.25)", fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: "180px" }}>This is a coding question. Talk me through your approach out loud, or open the editor to type code.</span>
              <button id="call-open-editor-btn" type="button" onClick={onOpenEditor} style={{ ...secondaryStyle, padding: "7px 12px", fontSize: "12px" }}>
                <Code2 size={13} /> Open editor
              </button>
            </div>
          )}
          <div style={captionBoxStyle}>
            <div style={captionLabelStyle}>Interviewer</div>
            <p id="call-interviewer-text" aria-live="polite" style={{ fontSize: "15px", lineHeight: 1.6, maxHeight: "9em", overflowY: "auto" }}>
              {call.interviewerText}
            </p>
          </div>
          <div style={{ ...captionBoxStyle, borderColor: hasWords ? "rgba(104,169,186,0.4)" : "var(--border-subtle)" }}>
            <div style={captionLabelStyle}>You</div>
            <p id="call-your-text" style={{ fontSize: "15px", lineHeight: 1.6, minHeight: "1.6em", maxHeight: "9em", overflowY: "auto", color: hasWords ? "var(--text-primary)" : "var(--text-muted)", fontStyle: hasWords ? "normal" : "italic" }}>
              {hasWords
                ? call.yourText
                : phase === "listening" && !muted
                ? "Start speaking whenever you are ready."
                : phase === "thinking"
                ? ""
                : phase === "speaking"
                ? "Press skip to answer straight away."
                : "Your microphone is off."}
            </p>
            {call.silenceArmedAt !== null && phase === "listening" && !muted && hasWords && (
              <div style={{ marginTop: "10px" }}>
                <div style={{ height: "4px", background: "var(--surface-3)", borderRadius: "4px", overflow: "hidden" }}>
                  <div key={call.silenceArmedAt} id="call-countdown" className="call-countdown" style={{ height: "100%", background: "#68a9ba", animationDuration: `${call.silenceMs}ms` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", gap: "8px" }}>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Sending your answer. Keep talking to add more.</span>
                  <button id="call-send-now-btn" type="button" onClick={call.sendNow} style={{ ...secondaryStyle, padding: "5px 10px", fontSize: "11.5px" }}>
                    <Send size={11} /> Send now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ marginTop: "auto", padding: "24px 20px 32px", display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
        {(phase === "listening" || phase === "paused") && (
          <ControlButton id="call-mute-btn" label={muted ? "Turn microphone on" : "Mute microphone"} pressed={muted} onClick={call.toggleMute} caption={muted ? "Unmute" : "Mute"}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </ControlButton>
        )}
        {phase === "speaking" && (
          <ControlButton id="call-skip-btn" label="Skip the interviewer and answer now" onClick={call.skipToListening} caption="Answer now">
            <SkipForward size={22} />
          </ControlButton>
        )}
        {(phase === "listening" || phase === "paused" || phase === "speaking") && (
          <ControlButton id="call-repeat-btn" label="Hear the question again" onClick={call.repeatQuestion} caption="Repeat">
            <RotateCcw size={22} />
          </ControlButton>
        )}
        {phase !== "ready" && phase !== "error" && (
          <ControlButton id="call-typing-btn" label="Switch to typing" onClick={call.switchToTyping} caption="Type instead">
            <Keyboard size={22} />
          </ControlButton>
        )}
        {phase !== "ready" && (
          <ControlButton id="call-end-btn" label="End the call" onClick={call.end} caption="End call" danger>
            <PhoneOff size={22} />
          </ControlButton>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  id, label, caption, onClick, pressed, danger, children,
}: {
  id: string; label: string; caption: string; onClick: () => void; pressed?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        style={{
          width: 56, height: 56, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          background: danger ? "#DC2626" : pressed ? "rgba(239,68,68,0.15)" : "var(--surface-2)",
          border: danger ? "1px solid #EF4444" : `1px solid ${pressed ? "rgba(239,68,68,0.6)" : "var(--border-default)"}`,
          color: danger ? "white" : pressed ? "#EF4444" : "var(--text-primary)",
        }}
      >
        {children}
      </button>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{caption}</span>
    </div>
  );
}

const smallRoundStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "10px", background: "var(--surface-2)", border: "1px solid var(--border-default)",
  color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};
const primaryStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "8px", padding: "13px 26px", borderRadius: "999px",
  background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", border: "none", color: "#061014", fontSize: "15px", fontWeight: 700,
  fontFamily: "inherit",
};
const secondaryStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "999px",
  background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-secondary)",
  fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const captionBoxStyle: React.CSSProperties = {
  padding: "14px 16px", borderRadius: "14px", background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
};
const captionLabelStyle: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px",
};
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" };
const selectStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: "8px", fontSize: "12.5px", background: "var(--surface-2)",
  border: "1px solid var(--border-default)", color: "var(--text-primary)", fontFamily: "inherit", minWidth: "150px",
};
