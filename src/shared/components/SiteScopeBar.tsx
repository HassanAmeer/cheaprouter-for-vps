"use client";

/**
 * Website scope selector for the Providers page.
 *
 * Provider CONNECTIONS (credentials) are global — one pool shared by every
 * site. What a site scopes is what it EXPOSES (providers/models), plus its
 * routes, API keys and usage. This bar makes that explicit and writes the
 * active site into the URL (`?site=<id>`), the same convention the sidebar
 * switcher uses, so every site-aware page picks it up.
 *
 * When a site is selected the bar also edits its exposure allowlist:
 *   - no provider added → the site inherits the global pool (nothing hidden)
 *   - one or more added → only those providers are exposed to the site
 *
 * The list comes from `/api/sites` (the `config/sites.json` registry).
 */
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { notifySiteScopeChanged, useSiteScope } from "@/shared/hooks/useSiteScope";

interface SiteOption {
  id: string;
  name: string;
  subdomains: string[];
}

export function SiteScopeBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [providerToAdd, setProviderToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSiteId = searchParams?.get("site") || "";
  const scope = useSiteScope(activeSiteId || null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sites", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.sites)) setSites(data.sites);
      } catch {
        // The registry is optional — the page works as a single global scope.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectSite = useCallback(
    (siteId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (siteId) params.set("site", siteId);
      else params.delete("site");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  /** Persist the whole allowlist (the API replaces it atomically). */
  const saveProviders = useCallback(
    async (providers: string[]) => {
      if (!activeSiteId) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(activeSiteId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providers: providers.map((provider) => ({ provider, isEnabled: true })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error?.message || "Failed to save the site exposure");
          return;
        }
        notifySiteScopeChanged();
      } catch {
        setError("Network error while saving the site exposure");
      } finally {
        setSaving(false);
      }
    },
    [activeSiteId]
  );

  const exposed = scope.rows.map((row) => row.provider);
  const active = sites.find((site) => site.id === activeSiteId) ?? null;

  const addProvider = () => {
    const provider = providerToAdd.trim().toLowerCase();
    if (!provider) return;
    if (exposed.includes(provider)) {
      setProviderToAdd("");
      return;
    }
    setProviderToAdd("");
    void saveProviders([...exposed, provider]);
  };

  return (
    <div className="rounded-xl border border-border bg-bg-subtle/50">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <span className="material-symbols-outlined text-[15px]">language</span>
          Website
        </span>

        <select
          value={activeSiteId}
          onChange={(event) => selectSite(event.target.value)}
          aria-label="Website scope"
          className="min-w-[180px] rounded-lg border border-border bg-bg-primary px-2 py-1 text-xs text-text-main focus:border-primary/50 focus:outline-none"
        >
          <option value="">All sites (global)</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        <span className="min-w-0 flex-1 truncate text-[11px] text-text-muted">
          {active
            ? active.subdomains.length > 0
              ? active.subdomains.join(", ")
              : "No subdomain configured yet"
            : "Credentials are shared by every site — this only scopes what the site exposes."}
        </span>
      </div>

      {activeSiteId && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
          {scope.rows.length === 0 ? (
            <span className="text-[11px] text-text-muted">
              {scope.loading
                ? "Loading exposure…"
                : "Inherits the global pool — every provider is exposed to this site."}
            </span>
          ) : (
            <>
              <span className="text-[11px] font-medium text-text-muted">Exposed:</span>
              {exposed.map((provider) => (
                <span
                  key={provider}
                  className="flex items-center gap-1 rounded-full border border-border bg-bg-primary px-2 py-0.5 text-[11px] text-text-main"
                >
                  {provider}
                  <button
                    type="button"
                    onClick={() => void saveProviders(exposed.filter((p) => p !== provider))}
                    disabled={saving}
                    aria-label={`Stop exposing ${provider}`}
                    className="text-text-muted hover:text-red-400 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none">close</span>
                  </button>
                </span>
              ))}
            </>
          )}

          <span className="flex items-center gap-1">
            <input
              value={providerToAdd}
              onChange={(event) => setProviderToAdd(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addProvider();
                }
              }}
              placeholder="provider id (e.g. openai)"
              aria-label="Add an exposed provider"
              className="w-[160px] rounded-lg border border-border bg-bg-primary px-2 py-1 text-[11px] text-text-main placeholder:text-text-muted focus:border-primary/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={addProvider}
              disabled={saving || !providerToAdd.trim()}
              className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-text-main hover:bg-bg-primary disabled:opacity-50"
            >
              Expose
            </button>
          </span>

          {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}

export default SiteScopeBar;
