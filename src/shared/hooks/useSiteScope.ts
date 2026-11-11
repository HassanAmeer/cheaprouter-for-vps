"use client";

/**
 * Load a site's provider allowlist for the dashboard.
 *
 * `providers: null` means the site inherits the global pool (no restriction),
 * which is also the answer for "no site selected". A non-null Set means only
 * those providers are exposed to that site.
 */
import { useCallback, useEffect, useState } from "react";

export interface SiteScopeRow {
  provider: string;
  models: string[];
  isEnabled: boolean;
}

export interface SiteScopeState {
  loading: boolean;
  /** null = inherit the global pool (show everything). */
  providers: Set<string> | null;
  /** Raw allowlist rows (provider + models), for exposure management. */
  rows: SiteScopeRow[];
  routes: string[];
  name: string | null;
  subdomains: string[];
  /** Re-fetch after a write (exposure edits). */
  reload: () => void;
}

const EMPTY_STATE = {
  loading: false,
  providers: null as Set<string> | null,
  rows: [] as SiteScopeRow[],
  routes: [] as string[],
  name: null as string | null,
  subdomains: [] as string[],
};

/**
 * Loaded payload tagged with the site it belongs to. Tagging (instead of a
 * "loading" flag set inside the effect) keeps the effect free of synchronous
 * setState calls and makes "stale site" detectable during render.
 */
interface LoadedState {
  loadedSiteId: string | null;
  providers: Set<string> | null;
  rows: SiteScopeRow[];
  routes: string[];
  name: string | null;
  subdomains: string[];
}

/**
 * Cross-component invalidation: the exposure editor and every consumer of the
 * scope live in different components on the same page, so a write announces
 * itself instead of the editor owning everyone's state.
 */
export const SITE_SCOPE_CHANGED_EVENT = "cheaproute:site-scope-changed";

export function notifySiteScopeChanged(): void {
  try {
    window.dispatchEvent(new Event(SITE_SCOPE_CHANGED_EVENT));
  } catch {
    // Non-browser (SSR) — nothing to notify.
  }
}

export function useSiteScope(siteId: string | null): SiteScopeState {
  const [state, setState] = useState<LoadedState>({
    loadedSiteId: null,
    providers: null,
    rows: [],
    routes: [],
    name: null,
    subdomains: [],
  });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const onChange = () => setTick((value) => value + 1);
    window.addEventListener(SITE_SCOPE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SITE_SCOPE_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        const rows: SiteScopeRow[] = Array.isArray(data?.providers)
          ? (
              data.providers as Array<{ provider: string; models?: string[]; isEnabled?: boolean }>
            )
              .filter((row) => row?.provider)
              .map((row) => ({
                provider: row.provider,
                models: Array.isArray(row.models) ? row.models : [],
                isEnabled: row.isEnabled !== false,
              }))
          : [];
        const enabled = rows.filter((row) => row.isEnabled).map((row) => row.provider);
        setState({
          loadedSiteId: siteId,
          providers: enabled.length > 0 ? new Set(enabled) : null,
          rows,
          routes: Array.isArray(data?.routes) ? (data.routes as string[]) : [],
          name: typeof data?.site?.name === "string" ? data.site.name : null,
          subdomains: Array.isArray(data?.site?.subdomains) ? data.site.subdomains : [],
        });
      } catch {
        if (cancelled) return;
        setState({
          loadedSiteId: siteId,
          providers: null,
          rows: [],
          routes: [],
          name: null,
          subdomains: [],
        });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [siteId, tick]);

  if (!siteId) {
    return { ...EMPTY_STATE, reload };
  }

  // Another site's payload is still in state — treat it as "loading" so no
  // stale allowlist leaks into the current website's UI.
  if (state.loadedSiteId !== siteId) {
    return { ...EMPTY_STATE, loading: true, reload };
  }

  return {
    loading: false,
    providers: state.providers,
    rows: state.rows,
    routes: state.routes,
    name: state.name,
    subdomains: state.subdomains,
    reload,
  };
}
