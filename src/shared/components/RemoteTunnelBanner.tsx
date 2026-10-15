"use client";

import { useState, useEffect } from "react";

export function RemoteTunnelBanner({ customHost }: { customHost?: string }) {
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState("201.18.218.29");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname;
      if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        setHost(currentHost);
      }
    }
  }, []);

  const effectiveHost = customHost || host;
  const command = `ssh -L 20128:localhost:20128 root@${effectiveHost}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-3.5 shadow-sm">
      {/* Moving Shimmer Effect */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 dark:via-white/5 to-transparent"
        style={{
          animation: "tunnelShimmer 2.5s ease-in-out infinite",
        }}
      />

      <style jsx>{`
        @keyframes tunnelShimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-lg">
            terminal
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Remote VPS Browser Login Tunnel (Zero Error Auth)
          </span>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">
          Agar aap remote VPS par hain aur Google/OAuth ko real authenticate karna chahte hain, to apne us laptop ke terminal mein jahan browser khula hai yeh command chalayein taake Google ka loopback bina kisi error ke CheapRoute tak pahunch jaye:
        </p>

        {/* Command Box with Gray Background */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-zinc-100 dark:bg-zinc-900/90 px-3 py-2">
          <code className="font-mono text-xs text-text-primary select-all break-all">
            {command}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              copied
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-zinc-200/80 dark:bg-zinc-800 text-text-muted hover:text-text-primary hover:bg-zinc-300 dark:hover:bg-zinc-700"
            }`}
            title="Copy command"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? "check" : "content_copy"}
            </span>
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-600/90 dark:text-amber-400/90">
          <span className="material-symbols-outlined text-xs">info</span>
          <span>
            Command chalane ke baad apne laptop browser mein{" "}
            <strong className="font-mono">http://localhost:20128</strong> khol kar Connect karein.
          </span>
        </div>
      </div>
    </div>
  );
}
