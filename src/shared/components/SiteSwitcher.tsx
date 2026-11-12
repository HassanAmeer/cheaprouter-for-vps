"use client";

/**
 * Sidebar website switcher.
 *
 * A "site" is one of the operator's frontends. Adding one takes a single
 * field — the domain/subdomain; the display label is derived from that host
 * (`deriveSiteName` in `src/lib/sites/siteInput.ts`). The list lives in
 * `config/sites.json` (see `src/lib/sites/siteRegistry.ts`) — the dashboard
 * reads it through `/api/sites`.
 *
 * Placement: the `nav` variant (the default in `Sidebar`) renders a compact
 * Cupertino-style pill directly under the Providers item, tight against it.
 * The `header` variant is the older tall card that sat under the brand row.
 *
 * The switcher writes the active site into the URL (`?site=<id>`) so every
 * dashboard page can scope itself to it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/shared/utils/cn";

interface SiteItem {
  id: string;
  name: string;
  subdomains: string[];
}

export interface SiteSwitcherProps {
  /**
   * `header` — the full-width card under the brand row.
   * `nav` — a compact Cupertino-style pill rendered inside the sidebar nav,
   *         directly under the Providers item (the operator's default).
   */
  variant?: "header" | "nav";
}

export function SiteSwitcher({ variant = "header" }: SiteSwitcherProps = {}) {
  /** Compact pill (sidebar nav) instead of the tall card (sidebar header). */
  const compact = variant === "nav";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [subdomains, setSubdomains] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeSiteId = searchParams.get("site") || "";

  const loadSites = useCallback(async () => {
    try {
      const res = await fetch("/api/sites", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.sites)) setSites(data.sites);
    } catch {
      // The registry is optional — the dashboard works without it.
    }
  }, []);

  useEffect(() => {
    // Initial load of the registry — the effect only fetches, it never sets
    // state synchronously (the state write happens in the fetch callback).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!open && !showAdd) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, showAdd]);

  const selectSite = (siteId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (siteId) params.set("site", siteId);
    else params.delete("site");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setOpen(false);
  };

  const submitSite = async () => {
    setSaving(true);
    setError(null);
    try {
      const list = subdomains
        .split(/[\s,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No name: the server derives the label from the first domain.
        body: JSON.stringify({ subdomains: list }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Failed to add site");
        return;
      }
      setSubdomains("");
      setShowAdd(false);
      await loadSites();
      const created = data?.site?.id as string | undefined;
      if (created) selectSite(created);
    } catch {
      setError("Network error while adding the site");
    } finally {
      setSaving(false);
    }
  };

  const active = sites.find((site) => site.id === activeSiteId) ?? null;

  return (
    <div ref={rootRef} className={compact ? "relative" : "relative mb-3"}>
      {showAdd ? (
        <div className="rounded-xl border border-border bg-bg-subtle p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            New website
          </div>
          <textarea
            value={subdomains}
            onChange={(e) => setSubdomains(e.target.value)}
            placeholder={"domain or subdomain, one per line\nexample.com\nshop.example.com"}
            aria-label="Website domain"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 font-mono text-[11px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitSite}
              disabled={saving || !subdomains.trim()}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add website"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Website scope"
          title={active ? active.name : "All sites (global)"}
          className={cn(
            "w-full flex items-center text-left transition-colors",
            compact
              ? "gap-1.5 rounded-[10px] bg-black/[0.045] px-2 py-[5px] hover:bg-black/[0.075] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
              : "gap-2 rounded-xl border border-border bg-bg-subtle/60 px-2.5 py-2 hover:bg-bg-subtle"
          )}
        >
          <span
            className={cn(
              "shrink-0 rounded-full",
              compact ? "size-1.5" : "size-2",
              active ? "bg-emerald-500" : "bg-text-muted/40"
            )}
            aria-hidden="true"
          />
          {compact ? (
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-main">
              {active ? active.name : "All sites (global)"}
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-text-main">
                {active ? active.name : "All sites (global)"}
              </span>
              <span className="block truncate text-[10px] text-text-muted">
                {active ? active.subdomains[0] || active.id : `${sites.length} site(s) configured`}
              </span>
            </span>
          )}
          <span
            className={cn(
              "material-symbols-outlined shrink-0 leading-none text-text-muted/70",
              compact ? "text-[14px]" : "text-[16px] text-text-muted"
            )}
          >
            {compact ? "unfold_more" : "expand_more"}
          </span>
        </button>
      )}

      {open && !showAdd && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 overflow-hidden rounded-xl border border-black/10 bg-bg-primary/95 shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10",
            compact ? "mt-0.5" : "mt-1"
          )}
        >
          <button
            type="button"
            onClick={() => selectSite("")}
            className={cn(
              "w-full flex items-center gap-2 text-left text-text-muted hover:bg-bg-subtle",
              compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
            )}
          >
            <span
              className={cn(
                "rounded-full",
                compact ? "size-1.5" : "size-2",
                activeSiteId ? "bg-text-muted/40" : "bg-emerald-500"
              )}
            />
            All sites (global)
          </button>
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => selectSite(site.id)}
              className={cn(
                "w-full flex items-start gap-2 text-left hover:bg-bg-subtle",
                compact ? "px-2 py-1.5" : "px-3 py-2"
              )}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full",
                  compact ? "mt-1 size-1.5" : "mt-1 size-2",
                  site.id === activeSiteId ? "bg-emerald-500" : "bg-text-muted/40"
                )}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate font-medium text-text-main",
                    compact ? "text-[11px]" : "text-xs"
                  )}
                >
                  {site.name}
                </span>
                {site.subdomains.length > 0 && (
                  <span className="block truncate font-mono text-[10px] text-text-muted">
                    {site.subdomains.join(", ")}
                  </span>
                )}
              </span>
            </button>
          ))}
          <div className={cn("border-t border-border", compact ? "p-1.5" : "p-2")}>
            <button
              type="button"
              onClick={() => {
                setShowAdd(true);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg font-medium text-text-main hover:bg-bg-subtle",
                compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1.5 text-xs"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-primary",
                  compact ? "text-[14px]" : "text-[15px]"
                )}
              >
                add
              </span>
              Add website
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SiteSwitcher;
