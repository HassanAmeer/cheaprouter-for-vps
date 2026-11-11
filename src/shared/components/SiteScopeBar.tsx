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
 * Adding a site is done right here (name + subdomains) — `POST /api/sites`
 * writes `config/sites.json` and mirrors the identity into the DB, and the new
 * site is selected immediately so its exposure can be edited in place.
 *
 * The list comes from `/api/sites` (the `config/sites.json` registry).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { notifySiteScopeChanged, useSiteScope } from "@/shared/hooks/useSiteScope";
import { parseNewSite } from "@/lib/sites/siteInput";

interface SiteOption {
  id: string;
  name: string;
  subdomains: string[];
}

export interface SiteProviderOption {
  id: string;
  name: string;
}

interface SiteScopeBarProps {
  /**
   * Providers the operator can expose (id + display name). When omitted the
   * exposure picker falls back to a free-text provider-id input.
   */
  providers?: SiteProviderOption[];
}

const inputClass =
  "rounded-lg border border-border bg-bg-primary px-2 py-1 text-xs text-text-main placeholder:text-text-muted focus:border-primary/50 focus:outline-none";

export function SiteScopeBar({ providers }: SiteScopeBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [providerToAdd, setProviderToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── "Add site" inline form ────────────────────────────────────────────────
  const [showAddSite, setShowAddSite] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteSubdomains, setSiteSubdomains] = useState("");
  const [addingSite, setAddingSite] = useState(false);
  const [addSiteError, setAddSiteError] = useState<string | null>(null);
  const siteNameRef = useRef<HTMLInputElement>(null);

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

  const providerOptions = useMemo(() => {
    const list: SiteProviderOption[] = Array.isArray(providers) ? [...providers] : [];
    const seen = new Set(list.map((option) => option.id));
    // Exposed providers that are not in the catalog (e.g. removed from the
    // registry) must stay visible/removable — show them by raw id.
    for (const row of scope.rows) {
      if (!seen.has(row.provider)) {
        seen.add(row.provider);
        list.push({ id: row.provider, name: row.provider });
      }
    }
    return list;
  }, [providers, scope.rows]);

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
    async (providersToSave: string[]) => {
      if (!activeSiteId) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(activeSiteId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providers: providersToSave.map((provider) => ({ provider, isEnabled: true })),
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

  const openAddSite = () => {
    setShowAddSite(true);
    setAddSiteError(null);
    // Focus after the form is on screen (React commits before the frame).
    requestAnimationFrame(() => siteNameRef.current?.focus());
  };

  const submitAddSite = async () => {
    const parsed = parseNewSite({ name: siteName, subdomains: siteSubdomains });
    if (!parsed.ok) {
      setAddSiteError((parsed as { error: string }).error);
      return;
    }
    setAddingSite(true);
    setAddSiteError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.name, subdomains: parsed.subdomains }),
      });
      const data = await res.json().catch(() => ({}));
      const created = data?.site as SiteOption | undefined;
      if (!res.ok || !created?.id) {
        setAddSiteError(data?.error?.message || "Failed to add the site");
        return;
      }
      setSites((prev) => {
        if (Array.isArray(data?.sites)) return data.sites as SiteOption[];
        return [...prev.filter((site) => site.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setShowAddSite(false);
      setSiteName("");
      setSiteSubdomains("");
      // Select the new site so its exposure can be edited immediately.
      selectSite(created.id);
    } catch {
      setAddSiteError("Network error while adding the site");
    } finally {
      setAddingSite(false);
    }
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
          className={`min-w-[180px] ${inputClass}`}
        >
          <option value="">All sites (global)</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => (showAddSite ? setShowAddSite(false) : openAddSite())}
          aria-expanded={showAddSite}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-primary px-2 py-1 text-[11px] font-medium text-text-main hover:bg-bg-subtle"
        >
          <span className="material-symbols-outlined text-[14px] leading-none">
            {showAddSite ? "close" : "add"}
          </span>
          {showAddSite ? "Cancel" : "Add site"}
        </button>

        <span className="min-w-0 flex-1 truncate text-[11px] text-text-muted">
          {active
            ? active.subdomains.length > 0
              ? active.subdomains.join(", ")
              : "No subdomain configured yet"
            : "Credentials are shared by every site — this only scopes what the site exposes."}
        </span>
      </div>

      {showAddSite && (
        <div
          className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-2"
          data-testid="add-site-form"
        >
          <label className="flex flex-col gap-1 text-[11px] text-text-muted">
            Site name
            <input
              ref={siteNameRef}
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitAddSite();
                }
              }}
              placeholder="Tokendeal"
              aria-label="Site name"
              className={`w-[180px] ${inputClass}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-text-muted">
            Subdomains (comma or space separated)
            <input
              value={siteSubdomains}
              onChange={(event) => setSiteSubdomains(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitAddSite();
                }
              }}
              placeholder="router.example.com, *.example.com"
              aria-label="Site subdomains"
              className={`w-[280px] ${inputClass}`}
            />
          </label>
          <button
            type="button"
            onClick={() => void submitAddSite()}
            disabled={addingSite || !siteName.trim() || !siteSubdomains.trim()}
            className={`px-3 py-1 rounded-lg bg-[image:var(--grad-brand)] text-white text-[11px] font-semibold shadow-sm hover:brightness-105 disabled:opacity-50 disabled:hover:brightness-100 ${inputClass} border-0`}
          >
            {addingSite ? "Adding…" : "Add site"}
          </button>
          {addSiteError && <span className="text-[11px] text-red-400">{addSiteError}</span>}
        </div>
      )}

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
              {scope.rows.map((row) => (
                <span
                  key={row.provider}
                  className="flex items-center gap-1 rounded-full border border-border bg-bg-primary px-2 py-0.5 text-[11px] text-text-main"
                >
                  {row.provider}
                  <button
                    type="button"
                    onClick={() => void saveProviders(exposed.filter((p) => p !== row.provider))}
                    disabled={saving}
                    aria-label={`Stop exposing ${row.provider}`}
                    className="text-text-muted hover:text-red-400 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none">close</span>
                  </button>
                </span>
              ))}
            </>
          )}

          {providerOptions.length > 0 ? (
            <select
              value={providerToAdd}
              onChange={(event) => {
                setProviderToAdd(event.target.value);
                const provider = event.target.value.trim().toLowerCase();
                if (!provider) return;
                if (exposed.includes(provider)) return;
                void saveProviders([...exposed, provider]);
              }}
              aria-label="Add an exposed provider"
              disabled={saving}
              className={inputClass}
            >
              <option value="">Expose a provider…</option>
              {providerOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={exposed.includes(option.id)}
                >
                  {option.name === option.id ? option.id : `${option.name} (${option.id})`}
                </option>
              ))}
            </select>
          ) : (
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
                className={`w-[160px] ${inputClass}`}
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
          )}

          {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}

export default SiteScopeBar;