/**
 * Shimmer.tsx — shimmer-effect skeleton primitives and full-page loaders.
 *
 * The `.shimmer` class (globals.css) paints a light sweep that travels
 * left→right, giving every loading surface a consistent shimmer effect
 * that reads on both light and dark themes. These wrappers compose it
 * into rich, realistic skeletons matching each dashboard page layout.
 */

import type { HTMLAttributes, ReactNode, CSSProperties } from "react";
import { cn } from "@/shared/utils/cn";

export type ShimmerPageVariant =
  | "default"
  | "dashboard"
  | "home"
  | "providers"
  | "provider-detail"
  | "combos"
  | "users"
  | "table"
  | "models"
  | "curation"
  | "api-keys"
  | "endpoints"
  | "usage"
  | "limits"
  | "logs"
  | "settings";

/** A single shimmer block. Size it via `className` (e.g. "h-4 w-24"). */
export function Shimmer({
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer", className)}
      style={style}
      {...props}
    />
  );
}

/** Page header: title + optional subtitle and right-side action/badge. */
export function ShimmerHeader({
  titleWidth = "w-56",
  subtitleWidth = "w-80",
  action = false,
  badge = false,
  className,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  action?: boolean;
  badge?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2",
        className
      )}
      aria-hidden="true"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Shimmer className={cn("h-7 sm:h-8", titleWidth)} />
          {badge && <Shimmer className="h-5 w-16 rounded-full" />}
        </div>
        {subtitleWidth && <Shimmer className={cn("h-4", subtitleWidth)} />}
      </div>
      {action && (
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 w-28 rounded-lg" />
        </div>
      )}
    </div>
  );
}

/** Detail page header with back-button, provider logo, title, and actions. */
export function ShimmerDetailHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 pb-2", className)} aria-hidden="true">
      <Shimmer className="h-4 w-32" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Shimmer className="size-12 rounded-xl shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Shimmer className="h-7 w-48" />
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
            <Shimmer className="h-3.5 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** A row of navigation/category tabs. */
export function ShimmerTabs({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border pb-3 overflow-x-auto",
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer
          key={i}
          className={cn(
            "h-9 rounded-lg shrink-0",
            i === 0 ? "w-32 bg-primary/20" : "w-24 sm:w-28 opacity-80"
          )}
        />
      ))}
    </div>
  );
}

/** A toolbar row (search box + filter chips + buttons). */
export function ShimmerToolbar({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3", className)}
      aria-hidden="true"
    >
      <Shimmer className="h-9 min-w-[200px] flex-1 max-w-sm rounded-lg" />
      <div className="flex items-center gap-2">
        <Shimmer className="h-9 w-24 rounded-lg" />
        <Shimmer className="h-9 w-24 rounded-lg" />
      </div>
      <Shimmer className="h-9 w-28 rounded-lg ml-auto hidden sm:block" />
    </div>
  );
}

/** Single stat / metric card skeleton. */
export function ShimmerStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-5 space-y-3", className)}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <Shimmer className="h-3.5 w-24" />
        <Shimmer className="size-8 rounded-lg" />
      </div>
      <Shimmer className="h-7 w-20" />
      <div className="flex items-center gap-2">
        <Shimmer className="h-3 w-12 rounded-full" />
        <Shimmer className="h-3 w-28" />
      </div>
    </div>
  );
}

/** Responsive grid of stat / metric cards. */
export function ShimmerStats({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerStatCard key={i} />
      ))}
    </div>
  );
}

/** One card skeleton (icon + title + tags + action buttons). */
export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-5 space-y-4", className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shimmer className="size-11 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-3 w-20" />
          </div>
        </div>
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>

      <div className="space-y-2 pt-1">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Shimmer className="h-5 w-14 rounded-md" />
        <Shimmer className="h-5 w-14 rounded-md" />
        <Shimmer className="h-5 w-16 rounded-md" />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <Shimmer className="h-8 w-24 rounded-lg" />
        <Shimmer className="h-5 w-10 rounded-full" />
      </div>
    </div>
  );
}

/** Responsive grid of card skeletons. */
export function ShimmerCards({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}

/** Hero banner skeleton (used for Quick Start, Quick Combo Creator). */
export function ShimmerHero({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-6 space-y-5", className)}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-3.5 w-72" />
        </div>
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/80 bg-bg-subtle p-4 space-y-2">
            <Shimmer className="size-8 rounded-lg mb-2" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-3 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chart skeleton for analytics & metrics. */
export function ShimmerChart({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-6 space-y-4", className)}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-3 w-48" />
        </div>
        <Shimmer className="h-8 w-28 rounded-lg" />
      </div>
      <div className="h-52 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-border">
        {[40, 65, 30, 85, 55, 95, 70, 45, 80, 60, 90, 75].map((height, i) => (
          <Shimmer
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between pt-1">
        {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"].map((_, i) => (
          <Shimmer key={i} className="h-3 w-10" />
        ))}
      </div>
    </div>
  );
}

/** Table skeleton: header row + body rows with cells, badges, and action dots. */
export function ShimmerTable({
  rows = 6,
  cols = 5,
  toolbar = true,
  className,
}: {
  rows?: number;
  cols?: number;
  toolbar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Shimmer className="h-9 w-64 rounded-lg" />
          <div className="flex items-center gap-2">
            <Shimmer className="h-9 w-24 rounded-lg" />
            <Shimmer className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-bg-subtle/80 p-4 flex items-center justify-between">
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer key={c} className="h-3.5 w-20" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-1/4">
                <Shimmer className="size-6 rounded-md shrink-0" />
                <Shimmer className="h-3.5 w-3/4" />
              </div>
              <Shimmer className="h-3.5 w-16" />
              <Shimmer className="h-5 w-20 rounded-full" />
              <Shimmer className="h-3.5 w-24 hidden sm:block" />
              <Shimmer className="size-8 rounded-lg shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Vertical list of row skeletons (users, activity, consoles). */
export function ShimmerList({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shimmer className="size-10 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Shimmer className="h-4 w-36" />
                <Shimmer className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shimmer className="h-6 w-16 rounded-full" />
              <Shimmer className="size-8 rounded-lg" />
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-3 w-16" />
            </div>
            <Shimmer className="h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Settings-form skeleton: a stack of labeled field groups with toggles. */
export function ShimmerForm({
  groups = 3,
  className,
}: {
  groups?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)} aria-hidden="true">
      {Array.from({ length: groups }).map((_, g) => (
        <div
          key={g}
          className="rounded-xl border border-border bg-surface p-6 space-y-4"
        >
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-3 w-64" />
          <div className="flex items-center justify-between gap-4 pt-2">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-6 w-11 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-4 pt-2">
            <Shimmer className="h-4 w-36" />
            <Shimmer className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A convenience wrapper: header + (optional toolbar) + body content. */
export function ShimmerPage({
  header = true,
  action = false,
  toolbar = false,
  children,
  className,
}: {
  header?: boolean;
  action?: boolean;
  toolbar?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6 p-6", className)} aria-hidden="true">
      {header && <ShimmerHeader action={action} />}
      {toolbar && <ShimmerToolbar />}
      {children}
    </div>
  );
}

/**
 * ShimmerPageLoader — Master Full-Page Skeleton Loader.
 *
 * Provides tailored page skeletons matching the visual architecture of each route:
 * - "dashboard" / "home": Header + 4 Metric Cards + Quick Start Hero + Analytics & Topology
 * - "providers": Header + 5-Tab Bar + Search Toolbar + 6 Rich Provider Cards
 * - "provider-detail": Detail Header + Capabilities Prompt Box + Add Model Box + Models Table
 * - "combos": Header + Quick Combo Creator + Strategy Tabs & Grid
 * - "users": Header + User cards list with Quota bars & BYOK keys
 * - "table" / "models" / "curation" / "api-keys": Header + Filter Toolbar + Full Table
 * - "endpoints": Header + Tab Bar + 3 Endpoint Cards
 * - "usage" / "limits": Header + Stats Row + Chart Skeleton + Breakdown Table
 * - "logs": Header + Log Filter Chips + Live Log Terminal Rows
 * - "settings": Header + Tabs + Form Field Groups
 * - "default": Header + Stats Cards + Cards Grid
 */
export function ShimmerPageLoader({
  variant = "default",
  message,
  className,
}: {
  variant?: ShimmerPageVariant;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full space-y-6 p-6 animate-in fade-in duration-200", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {/* Optional subtle floating toast if a message is provided */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface/90 border border-border shadow-xl backdrop-blur-md text-xs font-medium text-text-muted">
          <span className="material-symbols-outlined text-primary text-[16px] animate-spin">
            progress_activity
          </span>
          <span>{message}</span>
        </div>
      )}

      {/* DASHBOARD / HOME VARIANT */}
      {(variant === "dashboard" || variant === "home") && (
        <>
          <ShimmerHeader titleWidth="w-64" subtitleWidth="w-96" action />
          <ShimmerStats count={4} />
          <ShimmerHero />
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <ShimmerChart />
            <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
              <Shimmer className="h-4 w-36 mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-bg-subtle">
                  <Shimmer className="size-7 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Shimmer className="h-3 w-28" />
                    <Shimmer className="h-2.5 w-20" />
                  </div>
                  <Shimmer className="h-4 w-12 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* PROVIDERS VARIANT */}
      {variant === "providers" && (
        <>
          <ShimmerHeader titleWidth="w-48" subtitleWidth="w-80" action badge />
          <ShimmerTabs count={5} />
          <ShimmerToolbar />
          <ShimmerCards count={6} />
        </>
      )}

      {/* PROVIDER DETAIL VARIANT */}
      {variant === "provider-detail" && (
        <>
          <ShimmerDetailHeader />
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shimmer className="size-6 rounded-md bg-primary/20" />
                <Shimmer className="h-4 w-52" />
              </div>
              <Shimmer className="h-8 w-28 rounded-lg" />
            </div>
            <Shimmer className="h-3 w-3/4" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <Shimmer className="h-4 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Shimmer className="h-9 rounded-lg" />
              <Shimmer className="h-9 rounded-lg" />
              <Shimmer className="h-9 rounded-lg" />
            </div>
          </div>

          <ShimmerTable rows={5} cols={5} />
        </>
      )}

      {/* COMBOS VARIANT */}
      {variant === "combos" && (
        <>
          <ShimmerHeader titleWidth="w-48" subtitleWidth="w-80" action />
          <ShimmerHero />
          <ShimmerTabs count={4} />
          <ShimmerCards count={6} />
        </>
      )}

      {/* USERS VARIANT */}
      {variant === "users" && (
        <>
          <ShimmerHeader titleWidth="w-52" subtitleWidth="w-72" action />
          <ShimmerToolbar />
          <ShimmerList rows={5} />
        </>
      )}

      {/* DATA TABLE / MODELS / CURATION / API-KEYS VARIANT */}
      {(variant === "table" || variant === "models" || variant === "curation" || variant === "api-keys") && (
        <>
          <ShimmerHeader titleWidth="w-56" subtitleWidth="w-80" action />
          <ShimmerTable rows={7} cols={5} />
        </>
      )}

      {/* ENDPOINTS VARIANT */}
      {variant === "endpoints" && (
        <>
          <ShimmerHeader titleWidth="w-56" subtitleWidth="w-96" action />
          <ShimmerTabs count={3} />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-48" />
                    <Shimmer className="h-3 w-64" />
                  </div>
                  <Shimmer className="h-8 w-20 rounded-lg" />
                </div>
                <Shimmer className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* USAGE / LIMITS VARIANT */}
      {(variant === "usage" || variant === "limits") && (
        <>
          <ShimmerHeader titleWidth="w-48" subtitleWidth="w-72" action />
          <ShimmerStats count={4} />
          <ShimmerChart />
          <ShimmerTable rows={5} cols={4} />
        </>
      )}

      {/* LOGS VARIANT */}
      {variant === "logs" && (
        <>
          <ShimmerHeader titleWidth="w-40" subtitleWidth="w-64" action />
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["All", "Info", "Warn", "Error", "Proxy"].map((_, i) => (
              <Shimmer key={i} className="h-8 w-20 rounded-full shrink-0" />
            ))}
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2 font-mono">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 border-b border-border/50 last:border-0">
                <Shimmer className="h-3 w-20" />
                <Shimmer className="h-5 w-14 rounded-md" />
                <Shimmer className="h-3 flex-1" />
                <Shimmer className="h-3 w-16" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* SETTINGS VARIANT */}
      {variant === "settings" && (
        <>
          <ShimmerHeader titleWidth="w-48" subtitleWidth="w-72" />
          <ShimmerTabs count={6} />
          <ShimmerForm groups={3} />
        </>
      )}

      {/* DEFAULT VARIANT */}
      {variant === "default" && (
        <>
          <ShimmerHeader titleWidth="w-56" subtitleWidth="w-80" action />
          <ShimmerStats count={4} />
          <ShimmerToolbar />
          <ShimmerCards count={6} />
        </>
      )}
    </div>
  );
}
