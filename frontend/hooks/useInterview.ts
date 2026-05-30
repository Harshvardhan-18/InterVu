/**
 * useInterview hook
 * -----------------
 * Manages interview session state and communicates with the FastAPI backend.
 */

"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Evaluation = {
  score: number;
  correctness: number;
  depth: number;
  communication: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  brief_feedback: string;
};

export type InterviewSession = {
  interviewId: number | null;
  currentQuestion: string | null;
  blueprint: Record<string, unknown> | null;
  isComplete: boolean;
  loading: boolean;
  error: string | null;
};

export function useInterview() {
  const [session, setSession] = useState<InterviewSession>({
    interviewId: null,
    currentQuestion: null,
    blueprint: null,
    isComplete: false,
    loading: false,
    error: null,
  });

  /**
   * Start a new interview session.
   * Calls POST /api/interviews/start
   */
  const startInterview = useCallback(
    async (userId: number, company: string, role: string, difficulty: string) => {
      setSession((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`${API_BASE}/api/interviews/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, company, role, difficulty }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSession({
          interviewId: data.interview_id,
          currentQuestion: data.first_question,
          blueprint: data.blueprint,
          isComplete: false,
          loading: false,
          error: null,
        });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setSession((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    []
  );

  /**
   * Submit an answer and get the next question.
   * Calls POST /api/interviews/{id}/answer
   */
  const submitAnswer = useCallback(
    async (answer: string): Promise<{ evaluation: Evaluation; nextQuestion: string | null; complete: boolean }> => {
      if (!session.interviewId) throw new Error("No active interview session");
      setSession((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`${API_BASE}/api/interviews/${session.interviewId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSession((s) => ({
          ...s,
          currentQuestion: data.next_question ?? null,
          isComplete: data.interview_complete,
          loading: false,
        }));
        return {
          evaluation: data.evaluation,
          nextQuestion: data.next_question,
          complete: data.interview_complete,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setSession((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [session.interviewId]
  );

  /**
   * Fetch the feedback report.
   * Calls GET /api/reports/{id}
   */
  const fetchReport = useCallback(async (interviewId: number) => {
    const res = await fetch(`${API_BASE}/api/reports/${interviewId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  /**
   * Generate report after completing the interview.
   * Calls POST /api/reports/{id}
   */
  const generateReport = useCallback(async (interviewId: number) => {
    const res = await fetch(`${API_BASE}/api/reports/${interviewId}`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  return { session, startInterview, submitAnswer, fetchReport, generateReport };
}
