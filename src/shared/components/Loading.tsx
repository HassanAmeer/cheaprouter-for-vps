"use client";

import type { HTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";

type SpinnerSize = "sm" | "md" | "lg" | "xl";
type LoadingType = "spinner" | "page" | "skeleton" | "card";

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
  xl: "size-12",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

interface PageLoadingProps {
  message?: string;
  className?: string;
}

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  type?: LoadingType;
  className?: string;
  message?: string;
  size?: SpinnerSize;
  label?: string;
}

// Spinner loading
export function Spinner({ size = "md", className, label }: SpinnerProps) {
  const t = useTranslations("common");
  const ariaLabel = label ?? t("loading");
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn("inline-flex", className)}
    >
      <span className="sr-only">{ariaLabel}</span>
      <span
        aria-hidden="true"
        className={cn(
          // `spinner-icon` (globals.css) supplies the flex-centering, not Tailwind
          // utilities: the Material Symbols block in globals.css is UNLAYERED and
          // therefore outranks Tailwind's layered utilities, so a plain `flex`
          // class could never override its `display: inline-block`.
          "material-symbols-outlined spinner-icon text-primary animate-spin motion-reduce:animate-none",
          spinnerSizes[size]
        )}
      >
        progress_activity
      </span>
    </span>
  );
}

import { ShimmerCard, ShimmerPageLoader, type ShimmerPageVariant } from "./Shimmer";

// Full page loading using rich shimmer skeleton
export function PageLoading({
  message,
  variant = "default",
  className,
}: PageLoadingProps & { variant?: ShimmerPageVariant }) {
  return <ShimmerPageLoader variant={variant} message={message} className={className} />;
}

// Skeleton loading with shimmer effect
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer rounded-lg bg-border", className)}
      {...props}
    />
  );
}

// Card skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return <ShimmerCard className={className} />;
}

// Default export
export default function Loading({
  type = "spinner",
  className,
  message,
  size,
  label,
  ...props
}: LoadingProps) {
  switch (type) {
    case "page":
      return <PageLoading message={message} className={className} />;
    case "skeleton":
      return <Skeleton className={className} {...props} />;
    case "card":
      return <CardSkeleton />;
    default:
      return <Spinner size={size} className={className} label={label} />;
  }
}
