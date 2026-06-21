"use client";
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, ChevronRight, CheckCircle2, Send,
  ArrowRight, BarChart3, LogOut
} from "lucide-react";
import { api, type Evaluation } from "@/lib/api";

type Message = {
  role: "interviewer" | "user";
  content: string;
  evaluation?: Evaluation;
};

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = Number(params.id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [complete, setComplete] = useState(false);
  const [expandedEval, setExpandedEval] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!interviewId) return;
    api.interviews.get(interviewId).then(
      data => {
        const rebuiltMessages: Message[] = [];

        for (const entry of data.history) {
          rebuiltMessages.push({
            role: "interviewer",
            content: entry.question,
            evaluation: entry.evaluation ?? undefined,
          });
          if (entry.answer !== null) {
            rebuiltMessages.push({ role: "user", content: entry.answer });
          }
        }
        setMessages(rebuiltMessages);

        if (data.status === "completed") {
          setComplete(true);
        }
      }).catch(e => {
        console.error("Failed to load interview data:", e);
      }).finally(() => setLoadingInitial(false));
  }, [interviewId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    const userMsg: Message = { role: "user", content: answer };
    setMessages(prev => [...prev, userMsg]);
    const submittedAnswer = answer;
    setAnswer("");
    setSubmitting(true);

    try {
      const res = await api.interviews.submitAnswer(interviewId, submittedAnswer);

      if (res.interview_complete || !res.next_question) {
        setMessages(prev => [
          ...prev,
          { role: "interviewer", content: "Thank you for completing the interview! Let me put together your feedback.", evaluation: res.evaluation }
        ]);
        setComplete(true);
      } else {
        const combinedText = res.next_acknowledgment
          ? `${res.next_acknowledgment} ${res.next_question}`
          : res.next_question;
        setMessages(prev => [
          ...prev,
          { role: "interviewer", content: combinedText, evaluation: res.evaluation }
        ]);
      }
    } catch (e) {
      console.error("Failed to submit answer:", e);
      setMessages(prev => prev.slice(0, -1));
      setAnswer(submittedAnswer);
    } finally {
      setSubmitting(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444";

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleEndEarly = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await api.interviews.endEarly(interviewId);
      router.push(`/report/${interviewId}`);
    } catch (e) {
      console.error("Failed to end interview early:", e);
      setEnding(false);
    }
  };

  if (loadingInitial) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading interview…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>

      {/* ── Left Sidebar — minimal, no structure exposed ── */}
      <aside style={{
        width: "200px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border-subtle)", background: "var(--surface-1)",
        padding: "20px 16px", gap: "24px",
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={13} color="white" fill="white" />
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, background: "linear-gradient(135deg,#A78BFA,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            InterVu
          </span>
        </Link>

        <div style={{ padding: "14px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            This is a live interview. Answer naturally — there's no fixed structure visible,
            just like a real one.
          </p>
        </div>

        {!complete && (
          <button
            onClick={handleEndEarly}
            disabled={ending || messages.length === 0}
            style={{
              marginTop: "auto",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "10px", borderRadius: "10px",
              background: "transparent", border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)", fontSize: "12px", fontWeight: 600,
              cursor: ending ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >
            <LogOut size={13} /> {ending ? "Ending…" : "End & Get Report"}
          </button>
        )}
      </aside>

      {/* ── Main Chat Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", height: "56px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(9,9,11,0.8)", backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Interview Session
          </span>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "10px", animation: "fadeInUp 0.3s ease" }}>

              {msg.role === "interviewer" ? (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={12} color="white" fill="white" />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.07em" }}>AI Interviewer</span>
                  </div>
                  <div style={{
                    padding: "18px 22px", borderRadius: "4px 18px 18px 18px",
                    background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                    fontSize: "14.5px", color: "var(--text-primary)", lineHeight: 1.7,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: "580px" }}>
                  <div style={{
                    padding: "16px 20px", borderRadius: "18px 4px 18px 18px",
                    background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.2))",
                    border: "1px solid rgba(139,92,246,0.3)",
                    fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7,
                  }}>
                    {msg.content}
                  </div>
                </div>
              )}

              {msg.role === "interviewer" && msg.evaluation && (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  <button
                    onClick={() => setExpandedEval(expandedEval === i ? null : i)}
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
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: scoreColor(msg.evaluation.score) }}>
                      {msg.evaluation.score}/10
                    </span>
                    <ChevronRight size={13} color="var(--text-muted)" style={{ transform: expandedEval === i ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }} />
                  </button>

                  {expandedEval === i && (
                    <div style={{
                      marginTop: "6px", padding: "16px 18px", borderRadius: "12px",
                      background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                      animation: "fadeInUp 0.2s ease",
                    }}>
                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.6 }}>
                        {msg.evaluation.brief_feedback}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Strengths</p>
                          {msg.evaluation.strengths.map(s => (
                            <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "5px" }}>
                              <CheckCircle2 size={12} color="#22C55E" style={{ marginTop: "2px", flexShrink: 0 }} />
                              <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Improve</p>
                          {msg.evaluation.weaknesses.map(w => (
                            <div key={w} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "5px" }}>
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
            </div>
          ))}

          {submitting && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", animation: "fadeIn 0.2s ease" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={12} color="white" fill="white" />
              </div>
              <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "var(--surface-1)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Evaluating</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
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
              onClick={() => router.push(`/report/${interviewId}`)}
              style={{
                width: "100%", padding: "15px", borderRadius: "12px",
                background: "linear-gradient(135deg,#7C3AED,#6366F1)",
                border: "none", color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}
            >
              View Full Report <ArrowRight size={16} />
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "flex-end", gap: "10px",
              background: "var(--surface-1)", border: "1px solid var(--border-default)",
              borderRadius: "16px", padding: "12px 14px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}>
              <textarea
                id="answer-input"
                ref={textareaRef}
                value={answer}
                onChange={e => { setAnswer(e.target.value); autoResize(e.target); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
                rows={1}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6,
                  resize: "none", fontFamily: "inherit", minHeight: "24px", maxHeight: "160px",
                }}
              />
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <button
                  id="submit-answer-btn"
                  onClick={handleSubmit}
                  disabled={!answer.trim() || submitting}
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: answer.trim() && !submitting ? "linear-gradient(135deg,#7C3AED,#6366F1)" : "var(--surface-2)",
                    border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: answer.trim() && !submitting ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                    boxShadow: answer.trim() && !submitting ? "0 4px 12px rgba(124,58,237,0.4)" : "none",
                  }}
                >
                  <Send size={15} color={answer.trim() && !submitting ? "white" : "var(--text-muted)"} />
                </button>
              </div>
            </div>
          )}
          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "8px" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}