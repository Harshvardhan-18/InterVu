export default function NotFound() {
  return (
    <html lang="en">
      <head><title>404 — InterVu</title></head>
      <body style={{ margin: 0, background: "#09090B", color: "#FAFAFA", fontFamily: "Inter, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "24px", textAlign: "center", padding: "24px" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        </div>
        <div>
          <p style={{ fontSize: "80px", fontWeight: 900, lineHeight: 1, letterSpacing: "-4px", marginBottom: "8px", background: "linear-gradient(135deg,#A78BFA,#818CF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>404</p>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Page not found</h1>
          <p style={{ fontSize: "13px", color: "#71717A", marginBottom: "24px" }}>The page you&apos;re looking for doesn&apos;t exist.</p>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "11px 24px", borderRadius: "12px", background: "linear-gradient(135deg,#7C3AED,#6366F1)", color: "white", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
            ← Back to Home
          </a>
        </div>
      </body>
    </html>
  );
}
