/* eslint-disable @next/next/no-img-element */
"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
// Direct module imports, not the "@/shared/components" barrel: the barrel
// re-exports Sidebar/Header/composites (and transitively the whole dashboard
// shell) which would otherwise ship in the /login page chunks.
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const t = useTranslations("auth");
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "CheapRoute";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [oidcEnabled, setOidcEnabled] = useState<boolean | null>(null);
  const [oidcDisablePasswordLogin, setOidcDisablePasswordLogin] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [nodeVersion, setNodeVersion] = useState(null);
  const [nodeCompatible, setNodeCompatible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/settings/require-login`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.nodeVersion) setNodeVersion(data.nodeVersion);
          if (data.nodeCompatible === false) setNodeCompatible(false);
          if (data.authenticated === true || data.requireLogin === false) {
            window.location.href = "/dashboard";
            return;
          }
          setHasPassword(!!data.hasPassword);
          setSetupComplete(!!data.setupComplete);
          setOidcEnabled(!!data.oidcEnabled);
          setOidcDisablePasswordLogin(!!data.oidcDisablePasswordLogin);
        } else {
          setHasPassword(true);
          setSetupComplete(true);
          setOidcEnabled(false);
          setOidcDisablePasswordLogin(false);
        }
      } catch {
        clearTimeout(timeoutId);
        setHasPassword(true);
        setSetupComplete(true);
        setOidcEnabled(false);
        setOidcDisablePasswordLogin(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("cheaproute_login_time", String(Date.now()));
        window.location.href = "/dashboard";
      } else {
        const data = await res.json();
        // (#521) If no password is set, redirect to onboarding instead of showing an error
        if (data.needsSetup) {
          window.location.href = "/dashboard/onboarding";
          return;
        }
        setError(data.error || t("invalidPassword"));
      }
    } catch {
      setError(t("errorOccurredRetry"));
    } finally {
      setLoading(false);
    }
  };

  const nodeWarningBanner =
    !nodeCompatible && nodeVersion ? (
      <div className="w-full max-w-lg mx-auto mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="bg-red-950/60 border-2 border-red-500/40 rounded-2xl p-6 shadow-lg shadow-red-900/20 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-red-400 text-[28px]">error</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-red-300 mb-1">
                {t("nodeIncompatibleTitle")}
              </h3>
              <p className="text-sm text-red-200/80 leading-relaxed mb-3">
                {t("nodeIncompatibleDesc", { version: nodeVersion })}
              </p>
              <div className="bg-black/40 rounded-lg px-4 py-3 font-mono text-sm border border-red-500/20">
                <div className="flex items-center gap-2 text-red-300/60 mb-1">
                  <span className="material-symbols-outlined text-[14px]">terminal</span>
                  <span className="text-xs">{t("nodeIncompatibleFixLabel")}</span>
                </div>
                <code className="text-amber-300">nvm install 22 && nvm use 22</code>
              </div>
              <p className="text-xs text-red-300/50 mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">info</span>
                {t("nodeIncompatibleHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  if (
    hasPassword === null ||
    setupComplete === null ||
    oidcEnabled === null ||
    (oidcEnabled && oidcDisablePasswordLogin === null)
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <span className="text-sm text-text-muted">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (!hasPassword && !setupComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 mb-6">
              <span className="material-symbols-outlined text-primary text-[40px]">
                rocket_launch
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">{t("welcome")}</h1>
            <p className="text-text-muted mt-2">{t("configureInstance")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("runOnboardingWizard")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("startOnboarding")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">
            {appName} — {t("unifiedProxy")}
          </p>
        </div>
      </div>
    );
  }

  if (!hasPassword && setupComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {nodeWarningBanner}
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/10 mb-6">
              <span className="material-symbols-outlined text-amber-500 text-[40px]">
                shield_person
              </span>
            </div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">
              {t("secureYourInstance")}
            </h1>
            <p className="text-text-muted mt-2">{t("passwordNotEnabled")}</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft">
            <div className="text-center">
              <p className="text-text-muted leading-relaxed mb-6">{t("setPasswordDescription")}</p>
              <Button
                variant="primary"
                className="w-full h-11 text-sm font-medium"
                onClick={() => router.push("/dashboard/onboarding")}
              >
                {t("configurePassword")}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted/60 mt-8">
            {appName} — {t("unifiedAiApiProxy")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {nodeWarningBanner && (
        <div className="flex justify-center pt-6 px-6">{nodeWarningBanner}</div>
      )}
      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div
            className={`w-full max-w-sm transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-11 rounded-xl overflow-hidden border border-border bg-surface-hover/50 flex items-center justify-center shrink-0 shadow-sm">
                  <img
                    src="/cheaprouter-logo.jpg"
                    alt={appName}
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xl font-bold text-text-main tracking-tight truncate">
                    {appName}
                  </span>
                  <span className="text-[11px] text-text-muted truncate">
                    AI Gateway & Router
                  </span>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-text-main tracking-tight">{t("signIn")}</h1>
              <p className="text-text-muted mt-1 text-sm">
                {oidcEnabled && oidcDisablePasswordLogin
                  ? t("continueWithOidc")
                  : t("enterPassword")}
              </p>
            </div>

            {oidcEnabled && oidcDisablePasswordLogin ? (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full h-11 text-sm font-medium flex items-center justify-center gap-2"
                  onClick={() => (window.location.href = "/api/auth/oidc/login")}
                >
                  <span className="material-symbols-outlined text-lg">login</span>
                  {t("continueWithOidc")}
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-5 w-full">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-main">{t("password")}</label>
                    <Input
                      type="password"
                      placeholder={t("enterPassword")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="h-11"
                    />
                    {error && (
                      <p className="text-sm text-red-500 flex items-center gap-1.5 pt-1">
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                      </p>
                    )}
                    <p className="text-xs text-text-muted/60 pt-0.5">{t("defaultPasswordHint")}</p>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-11 text-sm font-medium"
                    loading={loading}
                  >
                    {t("continue")}
                  </Button>
                </form>

                {oidcEnabled && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full h-11 text-sm font-medium flex items-center justify-center gap-2"
                      onClick={() => (window.location.href = "/api/auth/oidc/login")}
                    >
                      <span className="material-symbols-outlined text-lg">login</span>
                      {t("continueWithOidc")}
                    </Button>
                  </div>
                )}
              </>
            )}

            {!oidcEnabled && (
              <div className="mt-6 pt-6 border-t border-border">
                <a
                  href="/forgot-password"
                  className="text-sm text-text-muted hover:text-primary transition-colors"
                >
                  {t("forgotPassword")}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent items-center justify-center p-12 border-l border-border/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div
            className={`max-w-md transition-all duration-700 delay-200 ease-out relative z-10 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  Unified Multi-Provider Routing
                </div>
                <h2 className="text-2xl font-bold text-text-main mb-2">
                  {appName} AI Gateway
                </h2>
                <p className="text-text-muted leading-relaxed text-sm">
                  One endpoint to connect 370+ LLMs with zero latency overhead, smart auto-failover, and real-time cost management.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    icon: "hub",
                    title: "370+ LLM Providers & Unified API",
                    desc: "Single endpoint compatible with OpenAI, Anthropic, and Gemini SDKs with automatic format conversion.",
                  },
                  {
                    icon: "alt_route",
                    title: "Smart Combos & Auto-Fallback",
                    desc: "20 routing strategies with provider circuit breakers, cooldown tracking, and zero downtime failovers.",
                  },
                  {
                    icon: "savings",
                    title: "Cost & Quota Transparency",
                    desc: "Live token metrics, granular provider limits, full model catalog, and free tier rankings.",
                  },
                  {
                    icon: "terminal",
                    title: "Playground & Developer Studio",
                    desc: "Interactive multi-model studio with live streaming, parameters inspection, and responsive controls.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3.5 p-3.5 rounded-xl bg-surface/70 backdrop-blur-sm border border-border hover:border-primary/40 transition-colors"
                  >
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                      <span className="material-symbols-outlined text-[18px]">
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-main">{item.title}</h3>
                      <p className="text-xs text-text-muted leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
