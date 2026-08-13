"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import { Menu } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>

      {/* ── Backdrop (mobile only) ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Sidebar drawer ── */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0,
          height: "100vh",
          zIndex: 50,
          // Desktop: always visible. Mobile: slide in/out.
        }}
        className={`app-sidebar-drawer ${sidebarOpen ? "app-sidebar-open" : ""}`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Desktop spacer so main content doesn't go under sidebar ── */}
      <div className="app-sidebar-spacer" />

      {/* ── Main ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden" }}>

        {/* Mobile top bar */}
        <div className="app-mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "none", border: "none",
              cursor: "pointer", padding: "6px",
              borderRadius: "8px", color: "var(--text-secondary)",
              display: "flex", alignItems: "center",
            }}
          >
            <Menu size={20} />
          </button>
          <span style={{
            marginLeft: "10px", fontSize: "15px", fontWeight: 700,
            background: "linear-gradient(135deg, #e8fbff, #68a9ba)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            InterVu
          </span>
        </div>

        {children}
      </main>

      {/* Scoped responsive CSS */}
      <style>{`
        /* Desktop: sidebar always on-screen, spacer reserves its width */
        .app-sidebar-drawer {
          transform: translateX(0);
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .app-sidebar-spacer {
          width: 240px;
          flex-shrink: 0;
        }
        .app-mobile-topbar {
          display: none;
        }

        /* Mobile: sidebar hides off-screen, toggled open by class */
        @media (max-width: 767px) {
          .app-sidebar-drawer {
            transform: translateX(-100%);
          }
          .app-sidebar-drawer.app-sidebar-open {
            transform: translateX(0);
          }
          .app-sidebar-spacer {
            display: none;
          }
          .app-mobile-topbar {
            display: flex;
            align-items: center;
            padding: 0 16px;
            height: 52px;
            border-bottom: 1px solid var(--border-subtle);
            background: var(--surface-1);
            position: sticky;
            top: 0;
            z-index: 30;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}
