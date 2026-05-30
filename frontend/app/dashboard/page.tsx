"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Mock past interviews — replace with real API
const PAST_INTERVIEWS = [
  {
    id: 1,
    company: "NVIDIA",
    role: "PTX Compiler Intern",
    date: "2025-05-28",
    score: 78,
    status: "completed",
    sections: 4,
  },
  {
    id: 2,
    company: "Amazon",
    role: "SDE-1",
    date: "2025-05-25",
    score: 84,
    status: "completed",
    sections: 4,
  },
  {
    id: 3,
    company: "Google",
    role: "Software Engineer L3",
    date: "2025-05-20",
    score: 71,
    status: "completed",
    sections: 5,
  },
];

const scoreColor = (s: number) =>
  s >= 80 ? "text-green-400" : s >= 65 ? "text-yellow-400" : "text-red-400";

export default function DashboardPage() {
  const router = useRouter();

  const avgScore =
    Math.round(
      PAST_INTERVIEWS.reduce((acc, i) => acc + i.score, 0) / PAST_INTERVIEWS.length
    );

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-violet-700/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track your interview preparation progress
            </p>
          </div>
          <Button
            id="new-interview-dashboard-btn"
            onClick={() => router.push("/interview/new")}
            className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold"
          >
            + New Interview
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Interviews", value: PAST_INTERVIEWS.length, icon: "🎤" },
            { label: "Avg Score", value: `${avgScore}/100`, icon: "📊" },
            { label: "Companies", value: new Set(PAST_INTERVIEWS.map((i) => i.company)).size, icon: "🏢" },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="border-white/10 bg-white/5 text-center py-6"
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Interview history */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Interview History</h2>
          <div className="space-y-3">
            {PAST_INTERVIEWS.map((interview) => (
              <Card
                key={interview.id}
                id={`interview-card-${interview.id}`}
                className="border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                onClick={() => router.push(`/report/${interview.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-600/40 border border-white/10 flex items-center justify-center text-lg">
                      🎤
                    </div>
                    <div>
                      <p className="text-white font-medium">{interview.role}</p>
                      <p className="text-muted-foreground text-sm">
                        {interview.company} · {interview.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className="border-green-500/30 bg-green-500/10 text-green-400 text-xs"
                    >
                      {interview.status}
                    </Badge>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${scoreColor(interview.score)}`}>
                        {interview.score}
                      </div>
                      <div className="text-[10px] text-muted-foreground">/ 100</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
