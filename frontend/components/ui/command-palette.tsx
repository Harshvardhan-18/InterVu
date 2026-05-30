"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Mic2, FileText, Plus, Search, ArrowRight,
} from "lucide-react";

const COMMANDS = [
  { id: "dashboard",    label: "Go to Dashboard",       icon: LayoutDashboard, href: "/dashboard" },
  { id: "new-interview",label: "Start New Interview",   icon: Mic2,            href: "/interview/new" },
  { id: "reports",      label: "View Reports",          icon: FileText,        href: "/dashboard" },
  { id: "new-session",  label: "Quick Interview Setup", icon: Plus,            href: "/interview/new" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, filtered.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && filtered[selected]) {
        router.push(filtered[selected].href);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, onClose, router]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search commands…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          />
          <kbd style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", borderRadius: "5px", padding: "2px 7px" }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ padding: "8px", maxHeight: "320px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              const isActive = i === selected;
              return (
                <div
                  key={cmd.id}
                  onClick={() => { router.push(cmd.href); onClose(); }}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: isActive ? "rgba(139,92,246,0.12)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(139,92,246,0.2)" : "transparent"}`,
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: isActive ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={15} color={isActive ? "#A78BFA" : "var(--text-muted)"} />
                  </div>
                  <span style={{ fontSize: "13.5px", color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isActive ? 500 : 400 }}>
                    {cmd.label}
                  </span>
                  {isActive && <ArrowRight size={13} color="#A78BFA" style={{ marginLeft: "auto" }} />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "16px" }}>
          {[["↑↓", "Navigate"], ["↵", "Open"], ["Esc", "Close"]].map(([key, hint]) => (
            <div key={hint} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <kbd style={{ fontSize: "10px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "1px 5px" }}>
                {key}
              </kbd>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
