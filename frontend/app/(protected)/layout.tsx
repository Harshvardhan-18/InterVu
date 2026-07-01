"use client";

import { useAuth } from "@/hooks/useAuth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Loading…
        </span>
      </div>
    );
  }

  if (!user) {
    // useAuth already triggers router.push("/login") internally,
    // this is just a fallback render while that redirect happens
    return null;
  }

  return <>{children}</>;
}
