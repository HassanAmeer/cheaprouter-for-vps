"use client";

import { useEffect, useRef, useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";
import Button, { type ButtonVariant } from "./Button";

// #6265 — preset for content-heavy modals: caps height on the OUTERMOST dialog
// wrapper only (single scroll owner) and keeps the inner body plain (no
// independent max-h/overflow), avoiding a double height cap that clips content.
export const TALL_MODAL_PROPS = {
  className: "max-h-[90vh] overflow-y-auto",
  bodyClassName: "p-6",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  variant?: "modal" | "sheet";
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  compactHeader?: boolean;
  maxWidth?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: React.ReactNode;
  message: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  variant = "modal",
  closeOnOverlay = true,
  showCloseButton = true,
  className,
  bodyClassName,
  compactHeader = false,
}: ModalProps) {
  const t = useTranslations("common");
  const titleId = useId();
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const sizes = {
    sm: "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-sm",
    md: "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-md",
    lg: "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-lg",
    xl: "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-xl",
    full: "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-4xl",
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Return keyboard users to the control that opened the dialog.
  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    previouslyFocusedRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Focus first focusable element
    const firstFocusable = dialog.querySelector(focusableSelector);
    const focusTimer = firstFocusable
      ? window.setTimeout(() => firstFocusable.focus(), 50)
      : undefined;

    const handleTab = (e) => {
      if (e.key !== "Tab") return;

      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      dialog.removeEventListener("keydown", handleTab);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (variant === "sheet") {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        {/* Backdrop with frosted glass effect */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
          onClick={closeOnOverlay ? onClose : undefined}
          aria-hidden="true"
        />

        {/* Cupertino iOS Right Slide-Over Sheet: 90% width on mobile, responsive sheet on desktop */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col",
            "w-[90vw] max-w-[90vw] sm:w-full sm:max-w-md md:max-w-lg lg:max-w-xl",
            "border-l border-black/10 dark:border-white/10 bg-surface text-text-main shadow-2xl backdrop-blur-2xl",
            "animate-in slide-in-from-right duration-250 ease-out h-full",
            className
          )}
        >
          {/* Top Cupertino drag handle pill */}
          <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

          {/* Header */}
          {(title || showCloseButton) && (
            <div
              className={cn(
                "flex items-center justify-between border-b border-black/5 dark:border-white/5",
                compactHeader ? "px-4 py-2.5" : "px-6 py-3.5"
              )}
            >
              <div className="flex items-center min-w-0">
                <div
                  className={cn(
                    "flex items-center gap-1.5 mr-3 shrink-0",
                    compactHeader ? "" : "gap-2 mr-4"
                  )}
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "rounded-full bg-[#FF5F56]",
                      compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
                  />
                  <div
                    className={cn(
                      "rounded-full bg-[#FFBD2E]",
                      compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
                  />
                  <div
                    className={cn(
                      "rounded-full bg-[#27C93F]",
                      compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
                  />
                </div>
                {title && (
                  <h2
                    id={titleId}
                    className={cn(
                      "font-semibold text-text-main truncate min-w-0",
                      compactHeader ? "text-sm" : "text-base sm:text-lg"
                    )}
                  >
                    {title}
                  </h2>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="p-1.5 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main transition-colors shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Scrollable Sheet Body */}
          <div className={cn("flex-1 overflow-y-auto custom-scrollbar", bodyClassName ?? "p-6")}>
            {children}
          </div>

          {/* Footer (if provided) */}
          {footer && (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-black/5 dark:border-white/5 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
              {footer}
            </div>
          )}

          {/* Mobile floating close button at bottom-right for 1-tap thumb dismissal */}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="sm:hidden fixed bottom-4 right-4 z-50 size-11 rounded-full bg-zinc-800/95 hover:bg-zinc-700 text-white shadow-2xl backdrop-blur-md border border-white/20 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              title={t("close")}
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "relative w-full bg-surface",
          "border border-black/10 dark:border-white/10",
          "rounded-card shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className={cn(
              "flex items-center justify-between border-b border-black/5 dark:border-white/5",
              compactHeader ? "px-4 py-2.5" : "p-6"
            )}
          >
            <div className="flex items-center min-w-0">
              <div
                className={cn(
                  "flex items-center gap-1.5 mr-3 shrink-0",
                  compactHeader ? "" : "gap-2 mr-4"
                )}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "rounded-full bg-[#FF5F56]",
                    compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                  )}
                />
                <div
                  className={cn(
                    "rounded-full bg-[#FFBD2E]",
                    compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                  )}
                />
                <div
                  className={cn(
                    "rounded-full bg-[#27C93F]",
                    compactHeader ? "w-2.5 h-2.5" : "w-3 h-3"
                  )}
                />
              </div>
              {title && (
                <h2
                  id={titleId}
                  className={cn(
                    "font-semibold text-text-main truncate min-w-0",
                    compactHeader ? "text-sm" : "text-lg"
                  )}
                >
                  {title}
                </h2>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label={t("close")}
                className="p-1.5 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={bodyClassName ?? "p-6 max-h-[calc(80vh-140px)] overflow-y-auto"}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-black/5 dark:border-white/5">
            {footer}
          </div>
        )}

        {/* Mobile floating close icon button in bottom-right corner for 1-tap thumb dismissal */}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="sm:hidden absolute bottom-3 right-3 z-30 w-8 h-8 rounded-full bg-zinc-200/95 dark:bg-zinc-700/95 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 shadow-md flex items-center justify-center transition-all cursor-pointer border border-black/10 dark:border-white/10"
            title={t("close")}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Confirm Modal helper
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("confirmTitle");
  const resolvedConfirmText = confirmText ?? t("confirmAction");
  const resolvedCancelText = cancelText ?? t("cancel");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {resolvedCancelText}
          </Button>
          <Button variant={variant} onClick={() => void onConfirm()} loading={loading}>
            {resolvedConfirmText}
          </Button>
        </>
      }
    >
      <p className="text-text-muted">{message}</p>
    </Modal>
  );
}
