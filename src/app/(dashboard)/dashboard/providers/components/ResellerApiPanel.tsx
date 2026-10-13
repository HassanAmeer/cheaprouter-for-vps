"use client";

/**
 * ResellerApiPanel — Providers page Tab 5 "Reseller API" (reseller spec §7a–7b).
 *
 * Operator control over the reseller downstream surface:
 *  - Provider exposure checkboxes → published via GET /api/v1/public/providers
 *    (persisted with POST { publishedProviders }).
 *  - Master BYOK ON/OFF switch (reuses ByokMasterToggleCard): OFF rejects any
 *    `x-upstream-key` pass-through with
 *    {"error": "BYOK is currently disabled by administrator"}.
 */

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/shared/components";
import { matchesSearch } from "@/shared/utils/turkishText";
import ByokMasterToggleCard from "../../endpoint/components/ByokMasterToggleCard";

interface PublicProvider {
  id: string;
  name: string;
  hasConnection: boolean;
  connectionCount: number;
  modelsCount: number;
  isPublished: boolean;
}

async function fetchPublicProviders(): Promise<PublicProvider[]> {
  const res = await fetch("/api/v1/public/providers?all=true");
  if (!res.ok) throw new Error(`Public providers API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.providers) ? data.providers : [];
}

export default function ResellerApiPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [published, setPublished] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  const applyProviders = useCallback((list: PublicProvider[]) => {
    setProviders(list);
    setPublished(new Set(list.filter((p) => p.isPublished).map((p) => p.id)));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      applyProviders(await fetchPublicProviders());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [applyProviders]);

  // Initial load: async work runs after the await inside the effect, so no
  // setState fires synchronously in the effect body (react-hooks rule).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const list = await fetchPublicProviders();
        if (cancelled) return;
        applyProviders(list);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load providers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applyProviders]);

  const toggle = useCallback((id: string, on: boolean) => {
    setPublished((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/public/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedProviders: [...published] }),
      });
      if (!res.ok) throw new Error(`Save returned ${res.status}`);
      setSavedTick(Date.now());
      window.setTimeout(() => setSavedTick(null), 2500);
      void refresh();
    } catch {
      setLoadError("Failed to save published providers");
    } finally {
      setSaving(false);
    }
  }, [published, refresh]);

  // Turkish-safe search via matchesSearch (empty query matches all).
  const visible = providers.filter(
    (p) => matchesSearch(p.id, filter) || matchesSearch(p.name, filter)
  );

  return (
    <div className="flex flex-col gap-4">
      <ByokMasterToggleCard />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-main">
              Exposed providers ({published.size} selected)
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Checked providers are served to reseller sites via GET /api/v1/public/providers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-main hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save exposure"}
          </button>
          {savedTick && <span className="text-xs font-medium text-emerald-500">Saved</span>}
        </div>

        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            search
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter providers…"
            className="w-full rounded-lg border border-border bg-bg-subtle pl-10 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>

        {loading && <p className="text-sm text-text-muted">Loading providers…</p>}
        {loadError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-xl border border-red-400/40 bg-red-500/10 text-sm text-red-600 dark:text-red-300"
          >
            {loadError}{" "}
            <button
              type="button"
              onClick={() => void refresh()}
              className="underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[560px] overflow-y-auto pr-1">
            {visible.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/70 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={published.has(p.id)}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                  className="size-4 accent-current shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text-main truncate">{p.name}</span>
                  <span className="block text-[11px] text-text-muted font-mono truncate">
                    {p.id} · {p.modelsCount} models
                    {p.hasConnection ? ` · ${p.connectionCount} conn` : " · no key"}
                  </span>
                </span>
              </label>
            ))}
            {visible.length === 0 && (
              <p className="text-sm text-text-muted col-span-full py-4 text-center">
                No providers match the filter.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
