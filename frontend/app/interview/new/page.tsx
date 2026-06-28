"use client";
import {api} from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import {
  ArrowRight, ArrowLeft, Building2, Briefcase, Gauge,
  Loader2, CheckCircle2, Circle, Search, ChevronRight,
} from "lucide-react";

const COMPANIES = [
  { name: "Google",    color: "#4285F4", initials: "G"  },
  { name: "Amazon",    color: "#FF9900", initials: "A"  },
  { name: "NVIDIA",    color: "#76B900", initials: "N"  },
  { name: "Meta",      color: "#0866FF", initials: "M"  },
  { name: "Microsoft", color: "#00A4EF", initials: "MS" },
  { name: "Apple",     color: "#A2AAAD", initials: "AP" },
  { name: "Stripe",    color: "#635BFF", initials: "ST" },
  { name: "Uber",      color: "#1D9BF0", initials: "UB" },
];

const DIFFICULTIES = [
  { id: "Easy",   label: "Easy",   desc: "Entry level, warming up",    color: "#22C55E" },
  { id: "Medium", label: "Medium", desc: "Industry standard depth",    color: "#F59E0B" },
  { id: "Hard",   label: "Hard",   desc: "FAANG senior-level rigor",   color: "#EF4444" },
];

const PIPELINE_STEPS = [
  { key: "researching", label: "Researching company & role",        icon: Search  },
  { key: "extracting",  label: "Extracting interview patterns",      icon: Building2 },
  { key: "building",    label: "Building RAG knowledge base",        icon: Briefcase },
  { key: "generating",  label: "Generating interview blueprint",     icon: Gauge },
];

type PipelineStep = "researching" | "extracting" | "building" | "generating";
type Difficulty = "Easy" | "Medium" | "Hard";

export default function NewInterviewPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null);
  const [doneSteps, setDoneSteps] = useState<string[]>([]);

  const filteredCompanies = COMPANIES.filter(c =>
    c.name.toLowerCase().includes(companyQuery.toLowerCase())
  );

  const handleStart = async () => {
    if (!company || !role) return;
    setLoading(true);
    const steps: PipelineStep[] = ["researching", "extracting", "building", "generating"];
    setPipelineStep(steps[0]);
    try {
      const resultPromise = api.interviews.start({
        user_id: 1, // Replace with actual user ID
        username:"Harsh",
        company,
        role,
        difficulty,
      });

      for(let i = 1; i < steps.length; i++) {
        await new Promise(res => setTimeout(res, 1500)); // Simulate time taken for each step
        setDoneSteps(prev => [...prev, steps[i-1]]);
        setPipelineStep(steps[i]);
      }
      const result = await resultPromise;
      setDoneSteps(prev => [...prev, steps[steps.length - 1]]);
      router.push(`/interview/${result.interview_id}`);
    } catch (error) {
      console.error("Error starting interview:", error);
      alert("Failed to start interview. Please try again.");
      setLoading(false);
    }
  };

  const canProceed = step === 1 ? !!company : step === 2 ? !!role : true;

  const stepDots = [
    { n: 1, label: "Company"    },
    { n: 2, label: "Role"       },
    { n: 3, label: "Difficulty" },
    { n: 4, label: "Generate"   },
  ];

  return (
    <AppShell>
      <div style={{ padding: "40px 32px", maxWidth: "680px" }}>

        {/* Back */}
        <button
          id="back-btn"
          onClick={() => step > 1 && !loading ? setStep(s => s - 1) : router.push("/dashboard")}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "13px", fontFamily: "inherit",
            marginBottom: "32px", padding: 0, transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft size={14} /> {step > 1 && !loading ? "Back" : "Dashboard"}
        </button>

        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "6px" }}>
            New Interview
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
            Set up a personalised interview session powered by real company data.
          </p>
        </div>

        {/* Step dots */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "40px" }}>
          {stepDots.map((s, i) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < stepDots.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", fontSize: "11px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: step > s.n ? "linear-gradient(135deg,#22C55E,#16A34A)" : step === s.n ? "linear-gradient(135deg,#7C3AED,#6366F1)" : "var(--surface-2)",
                  border: `1px solid ${step > s.n ? "transparent" : step === s.n ? "transparent" : "var(--border-subtle)"}`,
                  color: step >= s.n ? "white" : "var(--text-muted)",
                  transition: "all 0.3s ease",
                  boxShadow: step === s.n ? "0 0 0 4px rgba(124,58,237,0.2)" : "none",
                }}>
                  {step > s.n ? <CheckCircle2 size={13} /> : s.n}
                </div>
                <span style={{ fontSize: "10px", fontWeight: 600, color: step >= s.n ? "var(--text-secondary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < stepDots.length - 1 && (
                <div style={{ flex: 1, height: "1px", background: step > s.n ? "rgba(34,197,94,0.4)" : "var(--border-subtle)", margin: "0 8px", marginBottom: "16px", transition: "background 0.3s ease" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Company ── */}
        {step === 1 && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>
                <Building2 size={13} style={{ display: "inline", marginRight: "6px" }} />
                Target Company
              </label>
              <div style={{ position: "relative" }}>
                <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  id="company-input"
                  value={companyQuery}
                  onChange={e => setCompanyQuery(e.target.value)}
                  placeholder="Search company…"
                  style={{
                    width: "100%", padding: "12px 14px 12px 38px",
                    background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                    borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {filteredCompanies.map((c) => {
                const selected = company === c.name;
                return (
                  <button
                    key={c.name}
                    id={`company-${c.name.toLowerCase()}`}
                    onClick={() => { setCompany(c.name); setCompanyQuery(c.name); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 16px", borderRadius: "12px", cursor: "pointer",
                      background: selected ? "rgba(124,58,237,0.12)" : "var(--surface-1)",
                      border: `1px solid ${selected ? "rgba(124,58,237,0.4)" : "var(--border-subtle)"}`,
                      transition: "all 0.2s ease", fontFamily: "inherit",
                      boxShadow: selected ? "0 0 0 3px rgba(124,58,237,0.1)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
                    onMouseLeave={(e) => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; } }}
                  >
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${c.color}18`, border: `1px solid ${c.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, color: c.color, flexShrink: 0 }}>
                      {c.initials}
                    </div>
                    <span style={{ fontSize: "13.5px", fontWeight: selected ? 600 : 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {c.name}
                    </span>
                    {selected && <CheckCircle2 size={15} color="#8B5CF6" style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>

            {/* Custom entry */}
            {companyQuery && !COMPANIES.find(c => c.name.toLowerCase() === companyQuery.toLowerCase()) && (
              <button
                onClick={() => setCompany(companyQuery)}
                style={{
                  width: "100%", padding: "12px", borderRadius: "12px",
                  background: company === companyQuery ? "rgba(124,58,237,0.12)" : "var(--surface-1)",
                  border: `1px solid ${company === companyQuery ? "rgba(124,58,237,0.4)" : "var(--border-subtle)"}`,
                  color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px",
                  marginBottom: "16px",
                }}
              >
                <Plus size={14} color="#8B5CF6" /> Use "{companyQuery}"
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Role ── */}
        {step === 2 && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px" }}>
              <Briefcase size={13} style={{ display: "inline", marginRight: "6px" }} />
              Role / Position
            </label>
            <input
              id="role-input"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Software Engineer L3, PTX Compiler Intern…"
              autoFocus
              style={{
                width: "100%", padding: "14px 16px",
                background: "var(--surface-1)", border: "1px solid var(--border-subtle)",
                borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                marginBottom: "20px",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.boxShadow = "none"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && role.trim()) setStep(3); }}
            />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Be specific — "SDE-1 Backend" gets better questions than "Engineer"
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {["Software Engineer L3", "SDE-1", "PTX Compiler Intern", "Production Engineer", "ML Engineer", "Frontend Engineer"].map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    padding: "7px 13px", borderRadius: "8px", fontSize: "12.5px",
                    background: role === r ? "rgba(124,58,237,0.12)" : "var(--surface-1)",
                    border: `1px solid ${role === r ? "rgba(124,58,237,0.35)" : "var(--border-subtle)"}`,
                    color: role === r ? "#A78BFA" : "var(--text-muted)",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s ease",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Difficulty ── */}
        {step === 3 && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "16px" }}>
              <Gauge size={13} style={{ display: "inline", marginRight: "6px" }} />
              Select Difficulty
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    id={`difficulty-${d.id.toLowerCase()}`}
                    onClick={() => setDifficulty(d.id as Difficulty)}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "18px 20px", borderRadius: "14px", cursor: "pointer",
                      background: selected ? `${d.color}0F` : "var(--surface-1)",
                      border: `1px solid ${selected ? `${d.color}40` : "var(--border-subtle)"}`,
                      transition: "all 0.2s ease", fontFamily: "inherit", textAlign: "left",
                      boxShadow: selected ? `0 0 0 3px ${d.color}18` : "none",
                    }}
                    onMouseEnter={(e) => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
                    onMouseLeave={(e) => { if (!selected) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-1)"; } }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: `${d.color}18`, border: `1px solid ${d.color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: d.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: selected ? d.color : "var(--text-primary)", marginBottom: "2px" }}>{d.label}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{d.desc}</div>
                    </div>
                    {selected ? <CheckCircle2 size={18} color={d.color} /> : <Circle size={18} color="var(--text-muted)" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Generate / Loading ── */}
        {step === 4 && (
          <div style={{ animation: "fadeInUp 0.3s ease" }}>
            {!loading ? (
              <div>
                {/* Summary */}
                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Interview Summary</h3>
                  {[
                    { label: "Company",    value: company },
                    { label: "Role",       value: role },
                    { label: "Difficulty", value: difficulty },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{item.label}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  id="start-interview-btn"
                  onClick={handleStart}
                  style={{
                    width: "100%", padding: "16px", borderRadius: "14px",
                    background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                    border: "none", color: "white", fontSize: "15px", fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
                    transition: "all 0.25s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(124,58,237,0.55)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.4)"; }}
                >
                  Generate Personalised Interview <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              /* Pipeline loader */
              <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", borderRadius: "20px", padding: "32px" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
                    <Loader2 size={24} color="white" style={{ animation: "spin-slow 1s linear infinite" }} />
                  </div>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>Building your interview…</h3>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Researching {company} · {role}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {PIPELINE_STEPS.map(({ key, label, icon: Icon }) => {
                    const isDone = doneSteps.includes(key);
                    const isActive = pipelineStep === key;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isDone ? "rgba(34,197,94,0.12)" : isActive ? "rgba(124,58,237,0.15)" : "var(--surface-2)",
                          border: `1px solid ${isDone ? "rgba(34,197,94,0.25)" : isActive ? "rgba(124,58,237,0.3)" : "var(--border-subtle)"}`,
                          transition: "all 0.3s ease",
                        }}>
                          {isDone ? <CheckCircle2 size={16} color="#22C55E" /> : isActive ? <Loader2 size={16} color="#8B5CF6" style={{ animation: "spin-slow 1s linear infinite" }} /> : <Icon size={16} color="var(--text-muted)" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13.5px", fontWeight: 600, color: isDone ? "#22C55E" : isActive ? "var(--text-primary)" : "var(--text-muted)", transition: "color 0.3s ease" }}>
                            {label}
                          </div>
                          {isActive && <div style={{ fontSize: "11px", color: "#8B5CF6", marginTop: "2px" }}>In progress…</div>}
                          {isDone && <div style={{ fontSize: "11px", color: "#22C55E", marginTop: "2px" }}>Complete</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Next button ── */}
        {step < 4 && !loading && (
          <div style={{ marginTop: "32px" }}>
            <button
              onClick={() => canProceed && setStep(s => s + 1)}
              disabled={!canProceed}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                background: canProceed ? "linear-gradient(135deg, #7C3AED, #6366F1)" : "var(--surface-2)",
                border: canProceed ? "none" : "1px solid var(--border-subtle)",
                color: canProceed ? "white" : "var(--text-muted)",
                fontSize: "14px", fontWeight: 600, cursor: canProceed ? "pointer" : "not-allowed",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: canProceed ? "0 6px 20px rgba(124,58,237,0.35)" : "none",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { if (canProceed) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(124,58,237,0.5)"; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = canProceed ? "0 6px 20px rgba(124,58,237,0.35)" : "none"; }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Plus({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
