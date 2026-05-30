/**
 * InterVu API client
 * Typed wrapper around all backend endpoints.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Blueprint = {
  interview_type: string;
  estimated_duration_minutes: number;
  sections: Array<{ name: string; type: string; questions: number; focus_areas: string[] }>;
};

export type StartInterviewResponse = {
  interview_id: number;
  first_question: string;
  blueprint: Blueprint;
};

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

export type SubmitAnswerResponse = {
  evaluation: Evaluation;
  next_question: string | null;
  interview_complete: boolean;
};

export type ReportResponse = {
  interview_id: number;
  company: string;
  role: string;
  overall_score: number;
  report: {
    strong_topics: string[];
    weak_topics: string[];
    section_scores: Record<string, number>;
    recommendations: string[];
    summary: string;
  };
  created_at: string;
};

// ── API Methods ───────────────────────────────────────────────────────────────

export const api = {
  interviews: {
    start: (body: {
      user_id: number;
      company: string;
      role: string;
      difficulty: string;
    }) =>
      request<StartInterviewResponse>("/api/interviews/start", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: number) =>
      request<{ id: number; company: string; role: string; difficulty: string; status: string; blueprint: Blueprint }>(
        `/api/interviews/${id}`
      ),

    submitAnswer: (id: number, answer: string) =>
      request<SubmitAnswerResponse>(`/api/interviews/${id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      }),

    complete: (id: number) =>
      request<{ message: string; interview_id: number }>(
        `/api/interviews/${id}/complete`,
        { method: "POST" }
      ),
  },

  reports: {
    get: (interviewId: number) =>
      request<ReportResponse>(`/api/reports/${interviewId}`),

    generate: (interviewId: number) =>
      request<{ message: string; report: ReportResponse["report"] }>(
        `/api/reports/${interviewId}`,
        { method: "POST" }
      ),
  },
};
