import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            InterVu
          </span>
          <div className="flex gap-3">
            <Link href="/interview/new">
              <Button
                id="nav-start-btn"
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                Start Interview
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-40 pb-28 px-6 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-700/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[300px] bg-cyan-700/15 rounded-full blur-[100px]" />
        </div>

        <Badge
          id="hero-badge"
          className="mb-6 border-violet-500/50 bg-violet-500/10 text-violet-300 text-sm px-4 py-1.5"
          variant="outline"
        >
          Powered by Gemini 2.5 · LangGraph · RAG
        </Badge>

        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
          Ace Every<br />
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Interview
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10 leading-relaxed">
          InterVu researches your target company, builds a personalised knowledge base,
          then conducts an adaptive AI interview — scoring every answer and producing
          actionable feedback.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/interview/new">
            <Button
              id="hero-cta-btn"
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold px-8 shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-105"
            >
              Start Free Interview →
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button
              id="hero-dashboard-btn"
              size="lg"
              variant="outline"
              className="border-white/20 hover:bg-white/5 text-white"
            >
              View Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-4 text-white">
          The Full Pipeline
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
          Every interview is grounded in real company data — not generic questions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-violet-500/40 hover:bg-white/8 transition-all duration-300"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Flow ── */}
      <section className="py-24 px-6 border-t border-white/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-16">How It Works</h2>
          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-5 text-left">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{step.title}</h4>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-8 text-center text-muted-foreground text-sm">
        <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
          InterVu
        </span>{" "}
        · Built with Gemini, LangGraph & ChromaDB
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: "🔍",
    title: "Research Agent",
    desc: "Scours Tavily + Firecrawl to pull real job descriptions, interview experiences, and company engineering blogs.",
  },
  {
    icon: "🧠",
    title: "Knowledge Extraction",
    desc: "Gemini extracts structured skills, topics, interview rounds, and difficulty from noisy web content.",
  },
  {
    icon: "📚",
    title: "RAG Knowledge Base",
    desc: "Content is chunked, embedded with sentence-transformers, and stored in ChromaDB for semantic retrieval.",
  },
  {
    icon: "🗺️",
    title: "Interview Blueprint",
    desc: "Generates a custom interview plan — sections, question counts, and focus areas tailored to the role.",
  },
  {
    icon: "🤖",
    title: "Adaptive Interview",
    desc: "LangGraph orchestrates a multi-turn interview that adjusts difficulty based on your performance in real time.",
  },
  {
    icon: "📊",
    title: "Instant Feedback",
    desc: "Detailed post-interview report with scores, strong/weak topics, and personalised study recommendations.",
  },
];

const STEPS = [
  {
    title: "Enter Company & Role",
    desc: "Tell InterVu where you're interviewing — e.g., NVIDIA PTX Compiler Intern.",
  },
  {
    title: "Research Pipeline Runs",
    desc: "Agents search the web, scrape pages, and extract structured knowledge into ChromaDB.",
  },
  {
    title: "Blueprint is Generated",
    desc: "A custom interview plan is created with sections and adaptive difficulty.",
  },
  {
    title: "Adaptive Interview Begins",
    desc: "Answer questions. The AI evaluates each answer and adjusts the next question accordingly.",
  },
  {
    title: "Get Your Report",
    desc: "Receive an overall score, topic-level breakdown, and personalised improvement recommendations.",
  },
];
