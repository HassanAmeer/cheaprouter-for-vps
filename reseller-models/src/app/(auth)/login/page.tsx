"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Login failed");
        return;
      }
      router.push(data?.user?.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07080a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0a0d14",
          border: "1px solid #161b26",
          borderRadius: 12,
          padding: "36px 32px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "1px",
              marginBottom: 16,
            }}
          >
            <div style={{ width: 28, height: 28 }}>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" fill="#0E1219" stroke="#E11D48" strokeWidth="2" />
                <path d="M11 11L7 16L11 21" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 11L11 16L15 21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 21L25 16L21 11" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 21L21 16L17 11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span>UNOROUTER</span>
          </Link>

          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            Sign In
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--uno-text-muted)" }}>
            Admins sign in with username <span style={{ fontFamily: "var(--uno-font-mono)", color: "#fff" }}>admin</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontFamily: "var(--uno-font-mono)",
                fontWeight: 700,
                color: "var(--uno-text-muted)",
                textTransform: "uppercase",
                marginBottom: 6,
                letterSpacing: "0.5px",
              }}
            >
              Email or Username
            </label>
            <input
              style={{
                width: "100%",
                background: "#07090e",
                border: "1px solid #1a2233",
                borderRadius: 6,
                color: "#ffffff",
                padding: "10px 14px",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              placeholder="e.g. admin or user@example.com"
              required
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  fontFamily: "var(--uno-font-mono)",
                  fontWeight: 700,
                  color: "var(--uno-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Password
              </label>
            </div>
            <input
              type="password"
              style={{
                width: "100%",
                background: "#07090e",
                border: "1px solid #1a2233",
                borderRadius: 6,
                color: "#ffffff",
                padding: "10px 14px",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: 12,
                fontFamily: "var(--uno-font-mono)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              background: "#E11D48",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              marginTop: 4,
              transition: "background 0.15s ease",
            }}
          >
            {busy ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        {/* Footer Links */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid #161b26",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--uno-text-muted)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "#E11D48", textDecoration: "none", fontWeight: 600 }}>
              Register
            </Link>
          </span>
          <Link href="/" style={{ color: "var(--uno-text-muted)", textDecoration: "none" }}>
            ← Home
          </Link>
        </div>
      </div>
    </div>
  );
}
