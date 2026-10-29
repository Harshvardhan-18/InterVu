"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, ChevronRight, CheckCircle2, Send, Code2, Mic, MicOff, Volume2, VolumeX,
  ArrowRight, BarChart3, LogOut, AlertTriangle, RotateCcw,
} from "lucide-react";
import {
  api, errorMessage, isApiError,
  type AnswerStage, type Evaluation, type InterviewDetail,
} from "@/lib/api";
import NoticeBanner from "@/components/ui/notice-banner";
import CodeEditor from "@/components/ui/code-editor";
import { useVoice } from "@/hooks/useVoice";

type Message = {
  role: "interviewer" | "user";
  content: string;
  /** Evaluation of the candidate's previous answer, shown under this message. */
  evaluation?: Evaluation;
};

type LoadState = "loading" | "ready" | "not_found" | "error";

type SessionMeta = {
  company: string;
  role: string;
  difficulty: string;
  totalQuestions: number;
};

const CLOSING_MESSAGE = "Thank you for completing the interview! Your feedback report is ready.";

/**
 * Rebuild the chat from the stored history. Evaluations are attached to the
 * interviewer message that follows the evaluated answer, which matches how
 * they appear during a live session.
 */
function buildMessages(detail: InterviewDetail): Message[] {
  const messages: Message[] = [];
  let previousEvaluation: Evaluation | undefined;

  for (const entry of detail.history) {
    messages.push({ role: "interviewer", content: entry.question, evaluation: previousEvaluation });
    previousEvaluation = undefined;
    if (entry.answer !== null) {
      messages.push({ role: "user", content: entry.answer });
      previousEvaluation = entry.evaluation ?? undefined;
    }
  }

  if (detail.status === "completed" && messages.length > 0) {
    messages.push({ role: "interviewer", content: CLOSING_MESSAGE, evaluation: previousEvaluation });
  }
  return messages;
}

function totalPlannedQuestions(detail: InterviewDetail): number {
  return (detail.blueprint?.sections ?? []).reduce(
    (sum, section) => sum + (Number(section.questions) || 0),
    0,
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = Number(params.id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sessionLost, setSessionLost] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedEval, setExpandedEval] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Server-reported degradations (research or planner unavailable at start).
  const [notices, setNotices] = useState<string[]>([]);
  // Live progress of the answer being processed (streamed from the server).
  const [phase, setPhase] = useState<AnswerStage | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  // Type of the question currently being answered ("coding" | "technical" | "behavioral").
  const [currentType, setCurrentType] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const voice = useVoice(
    useCallback((text: string) => setAnswer((prev) => (prev ? `${prev} ${text}` : text)), []),
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Guards against double submits before React re-renders the disabled state.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(interviewId) || interviewId <= 0) return;
    const controller = new AbortController();

    api.interviews.get(interviewId, controller.signal)
      .then((data) => {
        setMessages(buildMessages(data));
        setAnsweredCount(data.history.filter((h) => h.answer !== null).length);
        setMeta({
          company: data.company,
          role: data.role,
          difficulty: data.difficulty,
          totalQuestions: totalPlannedQuestions(data),
        });
        setComplete(data.status === "completed");
        setNotices(data.blueprint?.warnings ?? []);
        setCurrentType(data.status === "completed" ? null : data.current_question_type);
        setLoadState("ready");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load interview data:", e);
        if (isApiError(e) && e.status === 404) {
          setLoadState("not_found");
        } else {
          setLoadError(errorMessage(e, "Failed to load this interview."));
          setLoadState("error");
        }
      });

    return () => controller.abort();
  }, [interviewId, reloadKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting, phase]);

  // Grow the answer box when text is added programmatically (dictation, code).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [answer]);

  const goToReport = useCallback(() => {
    router.push(`/report/${interviewId}`);
  }, [router, interviewId]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  };

  const handleSubmit = async () => {
    const text = answer.trim();
    if (!text || submittingRef.current || complete || sessionLost) return;

    submittingRef.current = true;
    voice.stopListening();
    setSubmitting(true);
    setPhase("evaluating");
    setLiveScore(null);
    setShowEditor(false);
    setSubmitError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setAnswer("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await api.interviews.submitAnswerStream(interviewId, text, {
        onStage: setPhase,
        // The score arrives before the next question exists: show it right away.
        onEvaluation: (ev) => setLiveScore(typeof ev.score === "number" ? ev.score : null),
      });
      setAnsweredCount((c) => c + 1);

      if (res.interview_complete) {
        // The backend stores the report on completion (or generates it lazily
        // on GET), so the report page can be opened straight away.
        setMessages((prev) => [
          ...prev,
          { role: "interviewer", content: "Thank you for completing the interview! Opening your feedback report...", evaluation: res.evaluation },
        ]);
        setComplete(true);
        goToReport();
        return;
      }

      const nextQuestion = res.next_question ?? "";
      const combinedText = res.next_acknowledgment
        ? `${res.next_acknowledgment} ${nextQuestion}`
        : nextQuestion;
      setMessages((prev) => [
        ...prev,
        { role: "interviewer", content: combinedText, evaluation: res.evaluation },
      ]);
      setCurrentType(res.next_question_type ?? null);
      voice.say(combinedText);
    } catch (e) {
      console.error("Failed to submit answer:", e);
      setMessages((prev) => prev.slice(0, -1));
      setAnswer(text);
      if (isApiError(e) && e.status === 410) {
        setSessionLost(true);
      } else if (isApiError(e) && e.status === 400 && /already completed/i.test(e.detail)) {
        setComplete(true);
      } else if (isApiError(e) && (e.status === 409 || e.timedOut)) {
        // The backend may still be processing the earlier submission of this
        // answer; reloading shows its result instead of answering twice.
        setSubmitError(
          "Your answer is still being processed. Wait a moment, then reload this page to see the next question.",
        );
      } else {
        setSubmitError(errorMessage(e, "Could not submit your answer. Please try again."));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setPhase(null);
      setLiveScore(null);
    }
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444";

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleEndEarly = async () => {
    if (ending || submittingRef.current) return;
    if (!sessionLost && !window.confirm("End the interview now and get a report based on the answers so far?")) {
      return;
    }
    setEnding(true);
    setEndError(null);
    try {
      await api.interviews.endEarly(interviewId);
      goToReport();
    } catch (e) {
      console.error("Failed to end interview early:", e);
      setEndError(errorMessage(e, "Could not end the interview. Please try again."));
      setEnding(false);
    }
  };

  // ── Non-ready states ──────────────────────────────────────────────────────

  const validId = Number.isFinite(interviewId) && interviewId > 0;
  const viewState: LoadState = validId ? loadState : "not_found";

  if (viewState === "loading") {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <span role="status" style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading interview...</span>
      </div>
    );
  }

  if (viewState === "not_found" || viewState === "error") {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "24px" }}>
        <div style={{ maxWidth: "420px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <AlertTriangle size={28} color="#F59E0B" />
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6 }}>
            {viewState === "not_found"
              ? "This interview does not exist or belongs to another account."
              : loadError}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            {viewState === "error" && (
              <button onClick={handleRetryLoad} style={secondaryButtonStyle}>
                <RotateCcw size={13} /> Retry
              </button>
            )}
            <Link href="/dashboard" style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestionNumber = complete ? answeredCount : answeredCount + 1;
  const inputDisabled = submitting || sessionLost;

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>

      {/* ── Left Sidebar (minimal, no structure exposed) ── */}
      <aside className="interview-sidebar" style={{
        width: "200px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border-subtle)", background: "var(--surface-1)",
        padding: "20px 16px", gap: "24px",
      }}>
        <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={13} color="white" fill="white" />
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, background: "linear-gradient(135deg,#9dc4ce,#7ec8d8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            InterVu
          </span>
        </Link>

        <div style={{ padding: "14px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            This is a live interview. Answer naturally; there is no fixed structure visible,
            just like a real one.
          </p>
        </div>

        {!complete && (
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {endError && (
              <p role="alert" style={{ fontSize: "11px", color: "#EF4444", lineHeight: 1.5 }}>{endError}</p>
            )}
            <button
              onClick={handleEndEarly}
              disabled={ending || answeredCount === 0}
              title={answeredCount === 0 ? "Answer at least one question first" : undefined}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                padding: "10px", borderRadius: "10px",
                background: "transparent", border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)", fontSize: "12px", fontWeight: 600,
                cursor: ending || answeredCount === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
                opacity: answeredCount === 0 ? 0.5 : 1,
              }}
            >
              <LogOut size={13} /> {ending ? "Ending..." : "End & Get Report"}
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Chat Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          padding: "0 28px", height: "56px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(9,9,11,0.8)", backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {meta ? `${meta.role} · ${meta.company}` : "Interview Session"}
            </span>
            {meta?.difficulty && (
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "rgba(104,169,186,0.12)", border: "1px solid rgba(104,169,186,0.25)", color: "#9dc4ce", flexShrink: 0 }}>
                {meta.difficulty}
              </span>
            )}
          </div>
          {meta && meta.totalQuestions > 0 && currentQuestionNumber > 0 && (
            <span aria-live="polite" style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>
              {complete
                ? `${answeredCount} answered`
                : `Question ${Math.min(currentQuestionNumber, meta.totalQuestions)} of ~${meta.totalQuestions}`}
            </span>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <NoticeBanner title="This interview is running in a reduced mode" messages={notices} />

          {messages.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No questions in this interview yet.</p>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "10px", animation: "fadeInUp 0.3s ease" }}>

              {msg.role === "interviewer" && msg.evaluation && (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  <button
                    onClick={() => setExpandedEval(expandedEval === i ? null : i)}
                    aria-expanded={expandedEval === i}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: "12px",
                      background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                      <BarChart3 size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 500 }}>Previous answer</span>
                      {msg.evaluation.fallback && (
                        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#F59E0B" }}>(placeholder score)</span>
                      )}
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: scoreColor(msg.evaluation.score ?? 0) }}>
                      {msg.evaluation.score ?? 0}/10
                    </span>
                    <ChevronRight size={13} color="var(--text-muted)" style={{ transform: expandedEval === i ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }} />
                  </button>

                  {expandedEval === i && (
                    <div style={{
                      marginTop: "6px", padding: "16px 18px", borderRadius: "12px",
                      background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                      animation: "fadeInUp 0.2s ease",
                    }}>
                      {msg.evaluation.fallback && (
                        <p style={{ fontSize: "12px", color: "#F59E0B", marginBottom: "10px", lineHeight: 1.5 }}>
                          Automatic scoring was unavailable for this answer, so this score is a placeholder.
                        </p>
                      )}
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.6 }}>
                        {msg.evaluation.brief_feedback}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Strengths</p>
                          {(msg.evaluation.strengths ?? []).map((s, k) => (
                            <div key={`${k}-${s}`} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "5px" }}>
                              <CheckCircle2 size={12} color="#22C55E" style={{ marginTop: "2px", flexShrink: 0 }} />
                              <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Improve</p>
                          {(msg.evaluation.weaknesses ?? []).map((w, k) => (
                            <div key={`${k}-${w}`} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "5px" }}>
                              <div style={{ width: "12px", height: "12px", borderRadius: "50%", border: "1.5px solid #F59E0B", marginTop: "2px", flexShrink: 0 }} />
                              <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{w}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {msg.role === "interviewer" ? (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={12} color="white" fill="white" />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#9dc4ce", textTransform: "uppercase", letterSpacing: "0.07em" }}>AI Interviewer</span>
                  </div>
                  <div style={{
                    padding: "18px 22px", borderRadius: "4px 18px 18px 18px",
                    background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                    fontSize: "14.5px", color: "var(--text-primary)", lineHeight: 1.7,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)", whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: "580px" }}>
                  <div style={{
                    padding: "16px 20px", borderRadius: "18px 4px 18px 18px",
                    background: "linear-gradient(135deg, rgba(104,169,186,0.25), rgba(104,169,186,0.2))",
                    border: "1px solid rgba(104,169,186,0.3)",
                    fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {submitting && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: "8px", animation: "fadeIn 0.2s ease" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg,#4d8fa2,#68a9ba)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={12} color="white" fill="white" />
              </div>
              <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "var(--surface-1)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span id="answer-progress" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {phase === "preparing_next"
                    ? `${liveScore !== null ? `Scored ${liveScore.toFixed(1)}/10. ` : ""}Preparing your next question`
                    : phase === "report"
                    ? "Writing your feedback report"
                    : "Evaluating"}
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          {sessionLost && (
            <div role="alert" style={{
              maxWidth: "680px", padding: "18px 20px", borderRadius: "14px",
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} color="#F59E0B" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#F59E0B" }}>Interview session lost</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                The live session for this interview is no longer available, most likely because the server restarted.
                Your answered questions are saved. You can get a report for them, or start a new interview.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {answeredCount > 0 && (
                  <button onClick={handleEndEarly} disabled={ending} style={secondaryButtonStyle}>
                    <LogOut size={13} /> {ending ? "Generating report..." : "Get report for answered questions"}
                  </button>
                )}
                <Link href="/interview/new" style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
                  Start a new interview <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{
          padding: "16px 28px 20px",
          borderTop: "1px solid var(--border-subtle)",
          background: "rgba(9,9,11,0.9)", backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}>
          {complete ? (
            <button
              id="view-report-btn"
              onClick={goToReport}
              style={{
                width: "100%", padding: "15px", borderRadius: "12px",
                background: "linear-gradient(135deg,#4d8fa2,#68a9ba)",
                border: "none", color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 8px 24px rgba(104,169,186,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}
            >
              View Full Report <ArrowRight size={16} />
            </button>
          ) : (
            <>
              {submitError && (
                <p role="alert" style={{ fontSize: "12.5px", color: "#EF4444", marginBottom: "8px" }}>{submitError}</p>
              )}
              {showEditor && (
                <CodeEditor
                  disabled={inputDisabled}
                  onClose={() => setShowEditor(false)}
                  onInsert={(text) => {
                    setAnswer((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${text}` : text));
                    setShowEditor(false);
                    textareaRef.current?.focus();
                  }}
                />
              )}
              <div style={{
                display: "flex", alignItems: "flex-end", gap: "10px",
                background: "var(--surface-1)", border: "1px solid var(--border-default)",
                borderRadius: "16px", padding: "12px 14px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                opacity: sessionLost ? 0.5 : 1,
              }}>
                <textarea
                  id="answer-input"
                  aria-label="Your answer"
                  ref={textareaRef}
                  value={answer}
                  disabled={inputDisabled}
                  onChange={e => { setAnswer(e.target.value); autoResize(e.target); }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={sessionLost ? "This session can no longer accept answers." : "Type your answer... (Enter to send, Shift+Enter for new line)"}
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6,
                    resize: "none", fontFamily: "inherit", minHeight: "24px", maxHeight: "160px",
                  }}
                />
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                  <button
                    id="toggle-editor-btn"
                    type="button"
                    aria-label={showEditor ? "Hide code editor" : "Write code"}
                    aria-pressed={showEditor}
                    title="Write code"
                    onClick={() => setShowEditor((v) => !v)}
                    disabled={inputDisabled}
                    style={{ ...iconButtonStyle, ...(currentType === "coding" && !showEditor ? { border: "1px solid rgba(104,169,186,0.6)", color: "#68a9ba" } : {}) }}
                  >
                    <Code2 size={15} />
                  </button>
                  {voice.support.speak && (
                    <button
                      id="toggle-read-aloud-btn"
                      type="button"
                      aria-label={voice.readAloud ? "Stop reading questions aloud" : "Read questions aloud"}
                      aria-pressed={voice.readAloud}
                      title="Read questions aloud"
                      onClick={() => voice.setReadAloud(!voice.readAloud)}
                      style={{ ...iconButtonStyle, ...(voice.readAloud ? { border: "1px solid rgba(104,169,186,0.6)", color: "#68a9ba" } : {}) }}
                    >
                      {voice.readAloud ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                  )}
                  {voice.support.dictate && (
                    <button
                      id="toggle-dictation-btn"
                      type="button"
                      aria-label={voice.listening ? "Stop dictation" : "Dictate your answer"}
                      aria-pressed={voice.listening}
                      title="Dictate your answer"
                      onClick={voice.toggleListening}
                      disabled={inputDisabled}
                      style={{ ...iconButtonStyle, ...(voice.listening ? { border: "1px solid rgba(239,68,68,0.6)", color: "#EF4444" } : {}) }}
                    >
                      {voice.listening ? <MicOff size={15} /> : <Mic size={15} />}
                    </button>
                  )}
                  <button
                    id="submit-answer-btn"
                    aria-label="Submit answer"
                    onClick={handleSubmit}
                    disabled={!answer.trim() || inputDisabled}
                    style={{
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: answer.trim() && !inputDisabled ? "linear-gradient(135deg,#4d8fa2,#68a9ba)" : "var(--surface-2)",
                      border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: answer.trim() && !inputDisabled ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                      boxShadow: answer.trim() && !inputDisabled ? "0 4px 12px rgba(104,169,186,0.4)" : "none",
                    }}
                  >
                    <Send size={15} color={answer.trim() && !inputDisabled ? "white" : "var(--text-muted)"} />
                  </button>
                </div>
              </div>
            </>
          )}
          {(voice.listening || voice.error) && (
            <p id="voice-status" role="status" style={{ fontSize: "11.5px", color: voice.error ? "#EF4444" : "var(--text-secondary)", textAlign: "center", marginTop: "8px" }}>
              {voice.error ??
                (voice.interim
                  ? `Listening: ${voice.interim}`
                  : "Listening... Dictation uses your browser's speech service (in Chrome, audio is sent to Google). InterVu never receives audio.")}
            </p>
          )}
          <p className="chat-input-hint" style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px",
  padding: "10px 16px", borderRadius: "10px",
  background: "var(--surface-1)", border: "1px solid var(--border-default)",
  color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

const iconButtonStyle: React.CSSProperties = {
  width: "36px", height: "36px", borderRadius: "10px",
  background: "var(--surface-2)", border: "1px solid var(--border-default)",
  color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", fontFamily: "inherit",
};
