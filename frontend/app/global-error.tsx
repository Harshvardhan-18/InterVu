"use client";

// global-error replaces the root layout — must render <html> and <body>
// Kept intentionally minimal to avoid React context issues during prerendering
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Error — InterVu</title>
        <meta charSet="utf-8" />
      </head>
      <body
        style={{
          margin: 0,
          padding: "48px 24px",
          background: "#09090B",
          color: "#FAFAFA",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          flexDirection: "column",
          gap: "16px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: "64px", margin: 0, lineHeight: 1 }}>⚡</p>
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: "14px", color: "#71717A", margin: 0 }}>
          An unexpected error occurred.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 22px",
              borderRadius: "10px",
              background: "#7C3AED",
              border: "none",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: "10px 22px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#A1A1AA",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
