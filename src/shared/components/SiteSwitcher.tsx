"use client";

/**
 * Sidebar site switcher.
 *
 * A "site" is one of the operator's frontends: a display name plus one or
 * more subdomains. The list lives in `config/sites.json` (see
 * `src/lib/sites/siteRegistry.ts`) — the dashboard reads it through
 * `/api/sites` and can add a site with the "+" button.
 *
 * The switcher writes the active site into the URL (`?site=<id>`) so every
 * dashboard page can scope itself to it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface SiteItem {
  id: string;
  name: string;
  subdomains: string[];
}

export function SiteSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name: name.trim(), subdomains: list }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Failed to add site");
        return;
      }
      setName("");
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
    <div ref={rootRef} className="relative mb-3">
      {showAdd ? (
        <div className="rounded-xl border border-border bg-bg-subtle p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            New site
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Site name (e.g. Site A — blog)"
            aria-label="Site name"
            className="w-full rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
          <textarea
            value={subdomains}
            onChange={(e) => setSubdomains(e.target.value)}
            placeholder={"subdomains, one per line\nsite-a.myapp.com\nwww.site-a.myapp.com"}
            aria-label="Subdomains"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 font-mono text-[11px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitSite}
              disabled={saving || !name.trim() || !subdomains.trim()}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add site"}
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
          className="w-full flex items-center gap-2 rounded-xl border border-border bg-bg-subtle/60 px-2.5 py-2 text-left hover:bg-bg-subtle transition-colors"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-text-muted/40"}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-text-main">
              {active ? active.name : "All sites (global)"}
            </span>
            <span className="block truncate text-[10px] text-text-muted">
              {active ? active.subdomains[0] || active.id : `${sites.length} site(s) configured`}
            </span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-text-muted">expand_more</span>
        </button>
      )}

      {open && !showAdd && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-bg-primary shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => selectSite("")}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-text-muted hover:bg-bg-subtle"
          >
            <span
              className={`size-2 rounded-full ${activeSiteId ? "bg-text-muted/40" : "bg-emerald-500"}`}
            />
            All sites (global)
          </button>
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => selectSite(site.id)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-bg-subtle"
            >
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${site.id === activeSiteId ? "bg-emerald-500" : "bg-text-muted/40"}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-text-main">
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
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(true);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-text-main hover:bg-bg-subtle"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">add</span>
              Add site
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SiteSwitcher;
