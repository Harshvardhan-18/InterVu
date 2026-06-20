"use client";
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, ChevronRight, CheckCircle2, Circle, Send,
  ArrowRight, Mic, Paperclip, BarChart3, LogOut
} from "lucide-react";
import {api,type Blueprint, type Evaluation} from "@/lib/api";

type Message = {
  role: "interviewer" | "user";
  content: string;
  evaluation?: Evaluation;
};

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = Number(params.id);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [complete, setComplete] = useState(false);
  const [currentSection, setCurrentSection] = useState("");
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [expandedEval, setExpandedEval] = useState<number | null>(null);
  const [ending,setEnding] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(()=> {
    if(!interviewId) {
      return;
    }
    api.interviews.get(interviewId).then(
      data=>{
        setBlueprint(data.blueprint);
        setCurrentSection(data.current_section ?? data.blueprint.sections[0]?.name ?? "");

        const rebuiltMessages: Message[] = [];
        let answeredCount = 0;
        let runningScoreSum = 0;

        for (const entry of data.history) {
          rebuiltMessages.push({
            role: "interviewer",
            content: entry.question,
            evaluation: entry.evaluation ?? undefined,
          });
          if (entry.answer!== null) {
            rebuiltMessages.push({role: "user", content: entry.answer});
            answeredCount++;
            if (entry.evaluation) {
              runningScoreSum += entry.evaluation.score; // Convert to 100-point scale
            }
          }
        }
        setMessages(rebuiltMessages);
        setQuestionsAnswered(answeredCount);
        if(answeredCount > 0) {
          setLiveScore(Math.round(runningScoreSum / answeredCount) * 10);
        }
        if(data.status==="completed"){
          setComplete(true);
        }
      }).catch(e=>{
        console.error("Failed to load interview data:", e);
      }).finally(()=>setLoadingInitial(false));
  },[interviewId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  const totalQuestions = blueprint?.sections.reduce((sum, s) => sum + s.questions, 0) ?? 0;
  const progress = totalQuestions > 0 ? Math.round((questionsAnswered / totalQuestions) * 100) : 0;

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    const userMsg: Message = { role: "user", content: answer };
    setMessages(prev => [...prev, userMsg]);
    const submittedAnswer = answer;
    setAnswer("");
    setSubmitting(true);

    try{
      const res= await api.interviews.submitAnswer(interviewId, submittedAnswer);
      const newAnswered = questionsAnswered + 1;
      setQuestionsAnswered(newAnswered);

      const scoreOutOf100=Math.round(res.evaluation.score * 10);
      const newLive = liveScore === null ? scoreOutOf100 : Math.round((liveScore * (newAnswered - 1) + scoreOutOf100) / newAnswered);
      setLiveScore(newLive);

      if(res.interview_complete || !res.next_question) {
        setMessages(prev => [
          ...prev,
          { role: "interviewer", content: "Thank you for completing the interview! We're processing your results.", evaluation: res.evaluation }
        ]);
        setComplete(true);
      }else{
        if(res.next_section) {setCurrentSection(res.next_section);}
        setMessages(prev => [
          ...prev,
          { role: "interviewer", content: res.next_question!, evaluation: res.evaluation }
        ]);
      }
    }catch(e){
      console.error("Failed to submit answer:", e);
      setMessages(prev => prev.slice(0,-1));
      setAnswer(submittedAnswer);
    }finally{
      setSubmitting(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "#22C55E" : s >= 6 ? "#F59E0B" : "#EF4444";

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleEndEarly = async () =>{
    if (ending) return;
    setEnding(true);
    try{
      await api.interviews.endEarly(interviewId);
      router.push(`/report/${interviewId}`);
    }catch(e){
      console.error("Failed to end interview early:", e);
      setEnding(false);
    }
  }

  if (loadingInitial) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading interview…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        width: "220px", flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border-subtle)", background: "var(--surface-1)",
        padding: "20px 16px", gap: "24px", overflowY: "auto",
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={13} color="white" fill="white" />
          </div>
          <span style={{ fontSize: "15px", fontWeight: 700, background: "linear-gradient(135deg,#A78BFA,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            InterVu
          </span>
        </Link>

        {/* Progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Progress</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>{questionsAnswered}/{totalQuestions}</span>
          </div>
          <div style={{ height: "4px", background: "var(--surface-3)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#7C3AED,#6366F1)", borderRadius: "4px", transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Question {questionsAnswered+1}</span>
            <span style={{ fontSize: "10px", color: "#8B5CF6", fontWeight: 600 }}>{progress}%</span>
          </div>
        </div>

        {/* Current section badge */}
        <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
          <p style={{ fontSize: "10px", color: "#8B5CF6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>Current Section</p>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{currentSection}</p>
        </div>

        {/* Topics */}
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>Topics</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {blueprint?.sections.map((s) => {
              const done = s.name !== currentSection && blueprint.sections.findIndex(x=>x.name === s.name) < blueprint.sections.findIndex(x=>x.name === currentSection);
              const active = s.name === currentSection;
              return (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {done
                    ? <CheckCircle2 size={13} color="#22C55E" style={{ flexShrink: 0 }} />
                    : active
                      ? <div style={{ width: "13px", height: "13px", borderRadius: "50%", border: "2px solid #8B5CF6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#8B5CF6" }} /></div>
                      : <Circle size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: "12px", color: done ? "#22C55E" : active ? "var(--text-primary)" : "var(--text-muted)", fontWeight: active ? 600 : 400 }}>
                    {s.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live score */}
        {liveScore !== null && (
          <div style={{ marginTop: "auto" }}>
            <div style={{ padding: "16px", borderRadius: "12px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <BarChart3 size={16} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>Live Score</p>
              <p style={{ fontSize: "28px", fontWeight: 800, color: liveScore >= 75 ? "#22C55E" : liveScore >= 60 ? "#F59E0B" : "#EF4444", letterSpacing: "-1px" }}>
                {liveScore}
              </p>
              <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>/ 100</p>
            </div>
          </div>
        )}

        {!complete && (
          <button
            onClick={handleEndEarly}
            disabled={ending || messages.length === 0}
            style={{
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

        {/* Top bar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", height: "56px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(9,9,11,0.8)", backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Interview Session
            </span>
            <ChevronRight size={13} color="var(--text-muted)" />
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px",
              background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#A78BFA",
            }}>
              {currentSection}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Q{questionsAnswered+1} of {totalQuestions}
            </span>
            <div style={{ width: "80px", height: "3px", background: "var(--surface-3)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#7C3AED,#6366F1)", transition: "width 0.5s ease" }} />
            </div>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "10px", animation: "fadeInUp 0.3s ease" }}>

              {/* Bubble */}
              {msg.role === "interviewer" ? (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  {/* Label */}
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

              {/* Evaluation card */}
              {msg.role === "interviewer" && msg.evaluation && i > 0 && (
                <div style={{ maxWidth: "680px", width: "100%" }}>
                  <button
                    onClick={() => setExpandedEval(expandedEval === i ? null : i)}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: "12px",
                      background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
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

          {/* Thinking state */}
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

        {/* ── Input area ── */}
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
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px rgba(124,58,237,0.55)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(124,58,237,0.4)"; }}
            >
              View Full Report <ArrowRight size={16} />
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "flex-end", gap: "10px",
              background: "var(--surface-1)", border: "1px solid var(--border-default)",
              borderRadius: "16px", padding: "12px 14px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              transition: "border-color 0.2s ease",
            }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.5)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3), 0 0 0 3px rgba(124,58,237,0.1)"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)"; }}
            >
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
                  title="Attach Resume"
                  style={{ width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Paperclip size={14} color="var(--text-muted)" />
                </button>
                <button
                  title="Voice Input"
                  style={{ width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Mic size={14} color="var(--text-muted)" />
                </button>
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
                  onMouseEnter={(e) => { if (answer.trim() && !submitting) { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
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
