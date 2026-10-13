"use client";

/**
 * QuickComboCreator — simplified combo creation (reseller spec §5a–5c).
 *
 * A compact card above the full combo workbench for the two core strategies:
 *  - Auto Failover (`priority`): 4–6 models in priority sequence — on
 *    timeout / 429 / 500 / quota exhaustion the router replays on the next
 *    model.
 *  - Random (`random`): each request picks a random candidate (load spread).
 *
 * Candidate models come ONLY from the Manage Models active list
 * (`provider_model_customizations.is_active`, via /api/v1/models/curation),
 * addressed by custom alias when one is set. The combo name doubles as the
 * `model` parameter for API calls (e.g. `auto-coding-combo`).
 */

import { useCallback, useEffect, useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import { matchesSearch } from "@/shared/utils/turkishText";

interface Candidate {
  key: string;
  providerId: string;
  modelId: string;
  target: string;
}

async function fetchActiveCandidates(): Promise<Candidate[]> {
  const res = await fetch("/api/v1/models/curation");
  if (!res.ok) throw new Error(`Curation API returned ${res.status}`);
  const data = await res.json();
  const modelsByProvider: Record<string, Array<{ id: string }>> = data?.modelsByProvider ?? {};
  const customizations: Array<{
    providerId: string;
    originalModelId: string;
    customAlias?: string | null;
    isActive?: boolean;
  }> = Array.isArray(data?.customizations) ? data.customizations : [];
  const aliasByModel = new Map<string, string>();
  const inactive = new Set<string>();
  for (const c of customizations) {
    const k = `${c.providerId}::${c.originalModelId}`;
    if (c.isActive === false) inactive.add(k);
    else if (c.customAlias) aliasByModel.set(k, c.customAlias);
  }
  const out: Candidate[] = [];
  for (const [providerId, models] of Object.entries(modelsByProvider)) {
    for (const m of models) {
      const k = `${providerId}::${m.id}`;
      if (inactive.has(k)) continue;
      out.push({
        key: k,
        providerId,
        modelId: m.id,
        target: aliasByModel.get(k) ?? `${providerId}/${m.id}`,
      });
    }
  }
  return out.sort((a, b) => a.target.localeCompare(b.target));
}

export default function QuickComboCreator({
  onCreated,
}: {
  onCreated?: (comboId: string) => void;
}) {
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<"priority" | "random">("priority");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Initial load: async work runs after the await inside the effect, so no
  // setState fires synchronously in the effect body (react-hooks rule).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const list = await fetchActiveCandidates();
        if (cancelled) return;
        setCandidates(list);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load active models");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCandidate = useCallback((key: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const create = useCallback(async () => {
    setFormError(null);
    const comboName = name.trim();
    if (!comboName) {
      setFormError("Give the combo a name / ID first (used as the `model` parameter).");
      return;
    }
    const targets = candidates.filter((c) => selected.has(c.key)).map((c) => c.target);
    if (targets.length === 0) {
      setFormError("Select at least one candidate model.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: comboName, models: targets, strategy }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(
          typeof data?.error === "string" ? data.error : `Create failed (${res.status})`
        );
        return;
      }
      setName("");
      setSelected(new Set());
      onCreated?.(data?.id ?? data?.name ?? comboName);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [name, candidates, selected, strategy, onCreated]);

  const visible = candidates.filter(
    (c) => matchesSearch(c.target, filter) || matchesSearch(c.modelId, filter)
  );

  return (
    <Card padding="sm">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="material-symbols-outlined text-[20px] text-text-muted">
          {collapsed ? "expand_more" : "expand_less"}
        </span>
        <span className="text-sm font-semibold">Quick combo</span>
        <span className="text-xs text-text-muted">
          Name + active models + failover/random — no wizard needed
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Custom combo name / ID
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. auto-coding-combo"
              />
              <span>
                Passed as the <code>model</code> parameter in API calls.
              </span>
            </label>
            <div className="flex flex-col gap-2 text-xs text-text-muted">
              <span>Core strategy (pick one)</span>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle
                    checked={strategy === "priority"}
                    onChange={() => setStrategy("priority")}
                  />
                  <span className="text-sm text-text-main">Auto failover</span>
                  <span className="text-text-muted">
                    Priority sequence — timeout / 429 / 500 / quota → next model
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle checked={strategy === "random"} onChange={() => setStrategy("random")} />
                  <span className="text-sm text-text-main">Random</span>
                  <span className="text-text-muted">
                    Each request picks a random candidate (load spread)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Candidate models — Manage Models active list only ({selected.size}/
                {candidates.length} selected)
              </span>
              <span className="flex-1" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
              />
            </div>
            {loading && <p className="text-xs text-text-muted">Loading active models…</p>}
            {loadError && (
              <p role="alert" className="text-xs text-red-500">
                {loadError}
              </p>
            )}
            {!loading && !loadError && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
                {visible.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/70 hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.key)}
                      onChange={(e) => toggleCandidate(c.key, e.target.checked)}
                      className="size-4 accent-current shrink-0"
                    />
                    <span
                      className="min-w-0 font-mono text-xs text-text-main truncate"
                      title={c.target}
                    >
                      {c.target}
                    </span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="text-xs text-text-muted col-span-full py-3 text-center">
                    {candidates.length === 0
                      ? "No active models — activate some in Providers → Manage Models first."
                      : "No candidates match the filter."}
                  </p>
                )}
              </div>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-500">
              {formError}
            </p>
          )}

          <div>
            <Button icon="add" onClick={() => void create()} disabled={creating || loading}>
              {creating ? "Creating…" : "Create combo"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
