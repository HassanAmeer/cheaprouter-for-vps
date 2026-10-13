/**
 * Shimmer.tsx — shimmer-effect skeleton primitives.
 *
 * The `.shimmer` class (globals.css) paints a light sweep that travels
 * left→right, giving every loading surface a consistent shimmer effect
 * that reads on both light and dark themes. These wrappers compose it
 * into the shapes the dashboard pages render while their data resolves.
 */

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/** A single shimmer block. Size it via `className` (e.g. "h-4 w-24"). */
export function Shimmer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer", className)}
      {...props}
    />
  );
}

/** Page header: title + optional subtitle and right-side action. */
export function ShimmerHeader({
  titleWidth = "w-56",
  subtitleWidth = "w-80",
  action = false,
  className,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  action?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)} aria-hidden="true">
      <div className="space-y-2">
        <Shimmer className={cn("h-7", titleWidth)} />
        {subtitleWidth && <Shimmer className={cn("h-3.5", subtitleWidth)} />}
      </div>
      {action && <Shimmer className="h-9 w-32" />}
    </div>
  );
}

/** A toolbar row (search box + filter chips + buttons). */
export function ShimmerToolbar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden="true">
      <Shimmer className="h-9 flex-1 max-w-sm" />
      <Shimmer className="h-9 w-24" />
      <Shimmer className="h-9 w-24" />
      <Shimmer className="h-9 w-28 ml-auto" />
    </div>
  );
}

/** One card skeleton (icon + title + a couple of lines). */
export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-6", className)}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-4 gap-4">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="size-10 rounded-lg" />
      </div>
      <Shimmer className="h-8 w-16 mb-2" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

/** Responsive grid of card skeletons. */
export function ShimmerCards({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
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

/** Table skeleton: header row + N body rows × M columns. */
export function ShimmerTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface overflow-hidden", className)}
      aria-hidden="true"
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: cols }).map((_, c) => (
              <th key={c} className="p-3 text-left">
                <Shimmer className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="p-3">
                  <Shimmer className="h-3.5" style={{ width: `${75 - c * 8}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vertical list of row skeletons (logs, activity, consoles). */
export function ShimmerList({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <Shimmer className="size-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3.5" style={{ width: `${80 - i * 4}%` }} />
            <Shimmer className="h-3 w-1/2" />
          </div>
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Settings-form skeleton: a stack of labeled field groups. */
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
          <div className="flex items-center justify-between gap-4">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-6 w-11 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Shimmer className="h-4 w-36" />
            <Shimmer className="h-9 w-40" />
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
