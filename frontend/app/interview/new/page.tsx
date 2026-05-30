"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EXAMPLE_ROLES = [
  { company: "Google", role: "Software Engineer L3" },
  { company: "Amazon", role: "SDE-1" },
  { company: "NVIDIA", role: "PTX Compiler Intern" },
  { company: "Meta", role: "Production Engineer" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export default function NewInterviewPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "researching" | "building" | "starting">("idle");

  const handleStart = async () => {
    if (!company.trim() || !role.trim()) return;
    setLoading(true);

    // Simulate pipeline steps (replace with real API calls)
    setStep("researching");
    await new Promise((r) => setTimeout(r, 1500));
    setStep("building");
    await new Promise((r) => setTimeout(r, 1500));
    setStep("starting");
    await new Promise((r) => setTimeout(r, 1000));

    // TODO: POST /api/interviews/start and get interview_id
    router.push(`/interview/1`);
  };

  const fillExample = (ex: { company: string; role: string }) => {
    setCompany(ex.company);
    setRole(ex.role);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-700/15 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-xl">
        {/* Back */}
        <button
          id="back-btn"
          onClick={() => router.push("/")}
          className="text-muted-foreground hover:text-white text-sm mb-8 flex items-center gap-2 transition-colors"
        >
          ← Back to Home
        </button>

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-white">New Interview</CardTitle>
            <CardDescription>
              Enter the company and role you&apos;re preparing for. InterVu will research
              and build a personalised interview for you.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Quick fill */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                Quick fill
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_ROLES.map((ex) => (
                  <button
                    key={`${ex.company}-${ex.role}`}
                    id={`example-${ex.company.toLowerCase()}`}
                    onClick={() => fillExample(ex)}
                    className="text-xs border border-white/15 rounded-full px-3 py-1 text-muted-foreground hover:border-violet-500/60 hover:text-white transition-all"
                  >
                    {ex.company} · {ex.role}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label htmlFor="company-input" className="text-sm text-muted-foreground mb-1.5 block">
                  Company
                </label>
                <Input
                  id="company-input"
                  placeholder="e.g., NVIDIA"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="bg-white/5 border-white/15 focus:border-violet-500 text-white placeholder:text-muted-foreground/60"
                />
              </div>
              <div>
                <label htmlFor="role-input" className="text-sm text-muted-foreground mb-1.5 block">
                  Role
                </label>
                <Input
                  id="role-input"
                  placeholder="e.g., PTX Compiler Intern"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-white/5 border-white/15 focus:border-violet-500 text-white placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    id={`difficulty-${d.toLowerCase()}`}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      difficulty === d
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-white/10 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress steps */}
            {loading && (
              <div className="space-y-2 py-2">
                {[
                  { key: "researching", label: "🔍 Researching company & role…" },
                  { key: "building", label: "🧠 Building knowledge base…" },
                  { key: "starting", label: "🚀 Generating interview blueprint…" },
                ].map(({ key, label }) => {
                  const steps = ["researching", "building", "starting"];
                  const currentIdx = steps.indexOf(step);
                  const thisIdx = steps.indexOf(key);
                  const done = thisIdx < currentIdx;
                  const active = thisIdx === currentIdx;

                  return (
                    <div key={key} className={`text-sm flex items-center gap-2 transition-all ${active ? "text-violet-300" : done ? "text-green-400" : "text-muted-foreground/40"}`}>
                      <span>{done ? "✓" : active ? "⟳" : "○"}</span>
                      {label}
                    </div>
                  );
                })}
              </div>
            )}

            {/* CTA */}
            <Button
              id="start-interview-btn"
              onClick={handleStart}
              disabled={!company.trim() || !role.trim() || loading}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? "Preparing your interview…" : "Start Interview →"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
