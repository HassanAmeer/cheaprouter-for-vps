"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ConnectionItem {
  id: string;
  provider: string;
  name?: string | null;
  connectionStatus: "healthy" | "cooling_down" | "circuit_open" | "terminal";
  isCoolingDown?: boolean;
  cooldownRemainingMs?: number;
  testStatus?: string | null;
  rateLimitedUntil?: string | null;
}

interface BreakerItem {
  name: string;
  state: "CLOSED" | "DEGRADED" | "OPEN" | "HALF_OPEN";
  failureCount?: number;
}

interface ResilienceData {
  connections?: ConnectionItem[];
  breakers?: BreakerItem[];
}

export default function OperatorHealthBadge() {
  const router = useRouter();
  const [data, setData] = useState<ResilienceData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const res = await fetch("/api/resilience/connections");
        if (res.ok) {
          const json = await res.json();
          if (isMounted) setData(json);
        } else {
          // Fallback to /api/providers if resilience endpoint fails
          const provRes = await fetch("/api/providers");
          if (provRes.ok && isMounted) {
            const provJson = await provRes.json();
            const now = Date.now();
            const conns: ConnectionItem[] = (provJson.connections || []).map((c: any) => {
              const cooldownMs = c.rateLimitedUntil ? new Date(c.rateLimitedUntil).getTime() - now : 0;
              const isCooling = cooldownMs > 0;
              return {
                id: c.id,
                provider: c.provider,
                name: c.name,
                connectionStatus: isCooling ? "cooling_down" : c.testStatus === "unavailable" ? "terminal" : "healthy",
                isCoolingDown: isCooling,
                cooldownRemainingMs: Math.max(0, cooldownMs),
                testStatus: c.testStatus,
              };
            });
            setData({ connections: conns, breakers: [] });
          }
        }
      } catch {
        // Silent catch for resilience polling
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!data) {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500/80 border border-emerald-500/20 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium">All Systems Normal</span>
      </div>
    );
  }

  const coolingConnections = (data.connections || []).filter(
    (c) => c.isCoolingDown || c.connectionStatus === "cooling_down" || (c.cooldownRemainingMs ?? 0) > 0
  );

  const trippedBreakers = (data.breakers || []).filter(
    (b) => b.state === "OPEN" || b.state === "DEGRADED"
  );

  const hasIssues = coolingConnections.length > 0 || trippedBreakers.length > 0;

  // Primary affected provider name
  const primaryProvider =
    coolingConnections[0]?.provider ||
    trippedBreakers[0]?.name ||
    "Provider";

  const formattedProvider = primaryProvider.charAt(0).toUpperCase() + primaryProvider.slice(1);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer select-none ${
          hasIssues
            ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/30 shadow-sm"
            : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
        }`}
        title={hasIssues ? "Click to inspect failover & cooling details" : "All providers healthy"}
        aria-expanded={isOpen}
      >
        {hasIssues ? (
          <>
            <span className="material-symbols-outlined text-[15px] animate-bounce">warning</span>
            <span className="hidden md:inline">
              ⚠️ {formattedProvider} quota reached — failover active
              {coolingConnections.length > 1 && ` (+${coolingConnections.length - 1})`}
            </span>
            <span className="md:hidden">⚠️ Failover</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden md:inline">All Systems Normal</span>
            <span className="md:hidden">Normal</span>
          </>
        )}
      </button>

      {/* Detail Popover */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl p-3.5 shadow-xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: "var(--surface-overlay, rgba(17, 24, 39, 0.95))",
            borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.1))",
          }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${hasIssues ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`}
              />
              <span className="text-xs font-semibold text-text-main">
                {hasIssues ? "Failover & Resilience Active" : "Operational Health"}
              </span>
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Live</span>
          </div>

          {hasIssues ? (
            <div className="space-y-2 mb-3">
              {coolingConnections.map((c) => {
                const secsRemaining = Math.ceil((c.cooldownRemainingMs ?? 0) / 1000);
                return (
                  <div
                    key={c.id}
                    className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-medium text-amber-500">
                      <span>{c.name || c.provider}</span>
                      <span className="font-mono text-[11px]">
                        {secsRemaining > 0 ? `${secsRemaining}s cooldown` : "Quota reached"}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      Traffic automatically routed to backup connection / next combo target.
                    </span>
                  </div>
                );
              })}

              {trippedBreakers.map((b) => (
                <div
                  key={b.name}
                  className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between font-medium text-rose-500">
                    <span>{b.name} Breaker</span>
                    <span className="font-mono text-[11px] uppercase">{b.state}</span>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    Provider circuit tripped. Retrying with failover pool.
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 px-2 text-center text-xs text-text-muted">
              <span className="text-emerald-500 font-semibold block mb-1">🟢 100% Operational</span>
              All active keys and circuit breakers are ready with zero cooldowns.
            </div>
          )}

          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/providers");
              }}
              className="text-primary hover:underline font-medium text-[11px]"
            >
              Manage Providers & Keys →
            </button>
            <Link
              href="/dashboard/resilience"
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-main text-[11px]"
            >
              Resilience Matrix
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
