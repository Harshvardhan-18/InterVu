"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type Message = {
  role: "interviewer" | "user";
  content: string;
  evaluation?: {
    score: number;
    brief_feedback: string;
    strengths: string[];
    weaknesses: string[];
  };
};

const MOCK_QUESTIONS = [
  "Tell me about yourself and why you're interested in this role.",
  "Explain the difference between BFS and DFS. When would you use each?",
  "What is the time and space complexity of Dijkstra's algorithm?",
  "Design a rate limiter for an API that handles 10,000 requests per second.",
  "Tell me about a time you disagreed with a teammate and how you resolved it.",
];

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id;

  const [messages, setMessages] = useState<Message[]>([
    { role: "interviewer", content: MOCK_QUESTIONS[0] },
  ]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [currentSection, setCurrentSection] = useState("Screening");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalQuestions = MOCK_QUESTIONS.length;
  const progress = Math.round((questionIndex / totalQuestions) * 100);

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;

    const userMsg: Message = { role: "user", content: answer };
    setMessages((prev) => [...prev, userMsg]);
    setAnswer("");
    setSubmitting(true);

    // TODO: POST /api/interviews/{id}/answer
    await new Promise((r) => setTimeout(r, 1500));

    const mockEval = {
      score: Math.round((6 + Math.random() * 4) * 10) / 10,
      brief_feedback: "Good answer! You demonstrated solid understanding.",
      strengths: ["Clear explanation", "Good use of examples"],
      weaknesses: ["Could mention edge cases"],
    };

    const nextIdx = questionIndex + 1;

    if (nextIdx >= totalQuestions) {
      setMessages((prev) => [
        ...prev,
        {
          role: "interviewer",
          content: "That concludes our interview. Great job! Let me generate your feedback report.",
          evaluation: mockEval,
        },
      ]);
      setComplete(true);
    } else {
      const sections = ["Screening", "Coding", "Role Specific", "Behavioral"];
      setCurrentSection(sections[Math.min(nextIdx, sections.length - 1)]);
      setMessages((prev) => [
        ...prev,
        { role: "interviewer", content: MOCK_QUESTIONS[nextIdx], evaluation: mockEval },
      ]);
      setQuestionIndex(nextIdx);
    }

    setSubmitting(false);
  };

  const scoreColor = (s: number) =>
    s >= 8 ? "text-green-400" : s >= 6 ? "text-yellow-400" : "text-red-400";

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/90 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            InterVu
          </span>
          <Separator orientation="vertical" className="h-5 bg-white/20" />
          <Badge
            id="section-badge"
            variant="outline"
            className="border-violet-500/40 text-violet-300 bg-violet-500/10"
          >
            {currentSection}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            {questionIndex + 1} / {totalQuestions}
          </span>
          <div className="w-32">
            <Progress
              id="interview-progress"
              value={progress}
              className="h-1.5 bg-white/10"
            />
          </div>
        </div>
      </header>

      {/* ── Chat ── */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] space-y-3`}>
              {/* Bubble */}
              <div
                className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                  msg.role === "interviewer"
                    ? "bg-white/8 border border-white/10 text-white"
                    : "bg-gradient-to-br from-violet-600 to-violet-700 text-white"
                }`}
              >
                {msg.role === "interviewer" && (
                  <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-widest mb-2">
                    Interviewer
                  </p>
                )}
                {msg.content}
              </div>

              {/* Evaluation card (shown after user answer) */}
              {msg.role === "interviewer" && msg.evaluation && i > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Previous answer score</span>
                    <span className={`font-bold text-base ${scoreColor(msg.evaluation.score)}`}>
                      {msg.evaluation.score}/10
                    </span>
                  </div>
                  <p className="text-muted-foreground">{msg.evaluation.brief_feedback}</p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-green-400 font-semibold mb-0.5">Strengths</p>
                      {msg.evaluation.strengths.map((s) => (
                        <p key={s} className="text-muted-foreground">• {s}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-red-400 font-semibold mb-0.5">Improve</p>
                      {msg.evaluation.weaknesses.map((w) => (
                        <p key={w} className="text-muted-foreground">• {w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {submitting && (
          <div className="flex justify-start">
            <div className="bg-white/8 border border-white/10 rounded-2xl px-5 py-4 text-sm text-muted-foreground animate-pulse">
              Evaluating your answer…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {complete ? (
            <Button
              id="view-report-btn"
              onClick={() => router.push(`/report/${interviewId}`)}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold"
            >
              View Full Report →
            </Button>
          ) : (
            <div className="flex gap-3 items-end">
              <Textarea
                id="answer-input"
                placeholder="Type your answer here… (Shift+Enter for new line)"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={3}
                className="flex-1 bg-white/5 border-white/15 focus:border-violet-500 text-white placeholder:text-muted-foreground/50 resize-none"
              />
              <Button
                id="submit-answer-btn"
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting}
                className="bg-violet-600 hover:bg-violet-500 text-white px-6 h-[76px] disabled:opacity-40"
              >
                {submitting ? "…" : "Send"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
