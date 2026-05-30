"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// Mock report — replace with real API call
const MOCK_REPORT = {
  company: "NVIDIA",
  role: "PTX Compiler Intern",
  overall_score: 78,
  strong_topics: ["Data Structures", "Algorithms", "System Design Basics"],
  weak_topics: ["Dynamic Programming", "Compiler Theory", "OS Internals"],
  section_scores: {
    Screening: 8.5,
    Coding: 6.8,
    "Role Specific": 7.9,
    Behavioral: 8.2,
  },
  recommendations: [
    "Practice 15 DP problems on LeetCode (Medium/Hard) — start with 0/1 Knapsack, LIS.",
    "Read 'Compilers: Principles, Techniques, and Tools' chapters 1–4.",
    "Review OS concepts: virtual memory, scheduling algorithms, context switching.",
    "Articulate trade-offs more explicitly when discussing design decisions.",
    "Use the STAR method for behavioral answers to improve structure.",
  ],
  summary:
    "Strong candidate with solid fundamentals in data structures and general algorithms. Needs to deepen knowledge in compiler theory and dynamic programming before the interview.",
};

const scoreColor = (s: number) =>
  s >= 8 ? "text-green-400" : s >= 6 ? "text-yellow-400" : "text-red-400";

const scoreBg = (s: number) =>
  s >= 8 ? "bg-green-500/20 border-green-500/30" : s >= 6 ? "bg-yellow-500/20 border-yellow-500/30" : "bg-red-500/20 border-red-500/30";

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();

  const report = MOCK_REPORT;
  const scorePercent = report.overall_score;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-700/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge
            variant="outline"
            className="border-violet-500/40 bg-violet-500/10 text-violet-300"
          >
            Interview Complete
          </Badge>
          <h1 className="text-4xl font-bold text-white">
            Your Feedback Report
          </h1>
          <p className="text-muted-foreground">
            {report.role} at {report.company}
          </p>
        </div>

        {/* Overall Score */}
        <Card
          id="overall-score-card"
          className="border-white/10 bg-white/5 text-center py-8"
        >
          <div
            className={`text-7xl font-extrabold mb-2 ${scoreColor(scorePercent / 10)}`}
          >
            {scorePercent}
          </div>
          <p className="text-muted-foreground text-sm">Overall Score / 100</p>
          <div className="mt-4 max-w-xs mx-auto">
            <Progress
              id="overall-progress"
              value={scorePercent}
              className="h-2 bg-white/10"
            />
          </div>
          <p className="mt-4 text-sm text-white/80 max-w-md mx-auto px-4">
            {report.summary}
          </p>
        </Card>

        {/* Section Scores */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">Section Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(report.section_scores).map(([section, score]) => (
              <div key={section}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white">{section}</span>
                  <span className={`font-semibold ${scoreColor(score)}`}>
                    {score}/10
                  </span>
                </div>
                <Progress
                  id={`section-${section.toLowerCase().replace(" ", "-")}`}
                  value={score * 10}
                  className="h-1.5 bg-white/10"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Strong / Weak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-400 text-base">💪 Strong Topics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {report.strong_topics.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="border-green-500/30 bg-green-500/10 text-green-300 mr-1.5 mb-1.5"
                >
                  {t}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-400 text-base">📚 Needs Work</CardTitle>
            </CardHeader>
            <CardContent>
              {report.weak_topics.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="border-red-500/30 bg-red-500/10 text-red-300 mr-1.5 mb-1.5"
                >
                  {t}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">🎯 Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-muted-foreground leading-relaxed">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            id="new-interview-btn"
            onClick={() => router.push("/interview/new")}
            className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold"
          >
            Start New Interview
          </Button>
          <Button
            id="dashboard-btn"
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="border-white/20 hover:bg-white/5 text-white"
          >
            Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
