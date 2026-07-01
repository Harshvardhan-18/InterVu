"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Mic2,
  FileText,
  FileSearch,
  Settings,
  Zap,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/lib/api";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard },
  { href: "/interview/new",   label: "New Interview",    icon: Mic2 },
  { href: "/dashboard",       label: "Reports",          icon: FileText,    match: "/report" },
  { href: "/dashboard",       label: "Resume Analysis",  icon: FileSearch,  disabled: true },
  { href: "/dashboard",       label: "Settings",         icon: Settings,    disabled: true },
];

export default function Sidebar() {
  const user = auth.load();
  const userName = user?.name;
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        background: "var(--surface-1)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #7C3AED, #6366F1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(124,58,237,0.4)",
            }}
          >
            <Zap size={16} color="white" fill="white" />
          </div>
          <span
            style={{
              fontSize: "17px",
              fontWeight: 700,
              background: "linear-gradient(135deg, #A78BFA, #818CF8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.3px",
            }}
          >
            InterVu
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: "6px" }}>
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const matchPath = item.match || item.href;
          const isActive =
            pathname === item.href ||
            (matchPath !== "/" && pathname.startsWith(matchPath));

          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "10px",
                marginBottom: "2px",
                textDecoration: "none",
                fontSize: "13.5px",
                fontWeight: isActive ? 600 : 450,
                color: isActive ? "var(--text-primary)" : item.disabled ? "var(--text-muted)" : "var(--text-secondary)",
                background: isActive ? "rgba(139,92,246,0.12)" : "transparent",
                border: isActive ? "1px solid rgba(139,92,246,0.2)" : "1px solid transparent",
                transition: "all 0.15s ease",
                cursor: item.disabled ? "not-allowed" : "pointer",
                opacity: item.disabled ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isActive && !item.disabled) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !item.disabled) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = item.disabled ? "var(--text-muted)" : "var(--text-secondary)";
                }
              }}
            >
              <Icon
                size={16}
                color={isActive ? "#A78BFA" : "currentColor"}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.disabled && (
                <span style={{ fontSize: "9px", background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "4px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Soon
                </span>
              )}
              {isActive && <ChevronRight size={12} color="#A78BFA" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED, #6366F1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}
          >
            {userName?.charAt(0) || "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {userName || "User"}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.3 }}>Free Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
