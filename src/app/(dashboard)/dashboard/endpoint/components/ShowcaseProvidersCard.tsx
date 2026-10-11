"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useDisplayBaseUrl } from "@/shared/hooks";

interface ProviderItem {
  id: string;
  name: string;
  icon: string;
  iconUrl?: string;
  status: string;
  hasConnection?: boolean;
  connectionCount?: number;
  modelsCount?: number;
  models?: string[];
  isPublished?: boolean;
}

type FilterMode = "all" | "connected" | "available" | "selected";

export default function ShowcaseProvidersCard() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayBaseUrl = useDisplayBaseUrl();
  const { copy, copied } = useCopyToClipboard();

  const publicApiUrl = `${displayBaseUrl}/api/v1/public/providers`;

  // Fetch providers and current selection
  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all available providers
      const res = await fetch("/api/v1/public/providers?all=true");
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();

      if (data.success && Array.isArray(data.providers)) {
        setProviders(data.providers);

        // Pre-select published ones
        const published = new Set<string>();
        data.providers.forEach((p: ProviderItem) => {
          if (p.isPublished) published.add(p.id);
        });

        // If none explicitly published yet, default to all connected or top providers
        if (published.size === 0 && data.providers.length > 0) {
          const connected = data.providers.filter((p: ProviderItem) => p.hasConnection);
          if (connected.length > 0) {
            connected.forEach((p: ProviderItem) => published.add(p.id));
          } else {
            data.providers.slice(0, 8).forEach((p: ProviderItem) => published.add(p.id));
          }
        }

        setSelectedIds(published);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSavedSuccess(false);
  };

  const selectAll = () => {
    const all = new Set(filteredProviders.map((p) => p.id));
    setSelectedIds((prev) => new Set([...prev, ...all]));
    setSavedSuccess(false);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    setSavedSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/v1/public/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedProviders: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error("Failed to save selection");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save showcase providers");
    } finally {
      setSaving(false);
    }
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matches =
          p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Mode filter
      if (filterMode === "connected") return !!p.hasConnection;
      if (filterMode === "available") return !p.hasConnection;
      if (filterMode === "selected") return selectedIds.has(p.id);

      return true;
    });
  }, [providers, search, filterMode, selectedIds]);

  const connectedCount = useMemo(
    () => providers.filter((p) => p.hasConnection).length,
    [providers]
  );

  return (
    <Card className="mt-6 border border-border/80 bg-surface">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-action text-2xl">public</span>
            <h2 className="text-lg font-bold text-text-primary">
              Public Providers Showcase (Website API)
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-action/10 text-action">
              Website Integration
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Apni website par AI Providers showcase karne ke liye yahan se providers select karein.
            Aap <strong>Connected (keys configured)</strong> aur <strong>Available (catalog)</strong>{" "}
            dono qisam ke providers ko select kar sakte hain.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs font-medium text-emerald-500 flex items-center gap-1 animate-pulse">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Saved Successfully!
            </span>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 min-w-[120px] justify-center"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-sm">save</span>
            )}
            {saving ? "Saving..." : "Save Selection"}
          </Button>
        </div>
      </div>

      {/* API Endpoint Banner */}
      <div className="mt-4 p-3.5 rounded-xl bg-surface-raised border border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="px-2 py-1 text-xs font-mono font-bold rounded bg-emerald-500/10 text-emerald-500 uppercase shrink-0">
            GET
          </span>
          <code className="text-xs md:text-sm font-mono text-text-primary truncate">
            {publicApiUrl}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copy(publicApiUrl)}
            className="text-xs flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copied!" : "Copy API URL"}
          </Button>
          <a
            href={publicApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-raised text-text-muted hover:text-text-primary transition"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Test JSON
          </a>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="mt-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-raised border border-border text-xs">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 rounded-md transition font-medium ${
              filterMode === "all"
                ? "bg-surface text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            All ({providers.length})
          </button>
          <button
            onClick={() => setFilterMode("connected")}
            className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
              filterMode === "connected"
                ? "bg-surface text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Connected ({connectedCount})
          </button>
          <button
            onClick={() => setFilterMode("available")}
            className={`px-3 py-1 rounded-md transition font-medium ${
              filterMode === "available"
                ? "bg-surface text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Catalog ({providers.length - connectedCount})
          </button>
          <button
            onClick={() => setFilterMode("selected")}
            className={`px-3 py-1 rounded-md transition font-medium ${
              filterMode === "selected"
                ? "bg-surface text-action shadow-xs font-bold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Selected ({selectedIds.size})
          </button>
        </div>

        {/* Search & Bulk Selection */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Input
            placeholder="Search providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full lg:w-60 text-xs h-8"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-8 px-2">
              Select Visible
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-8 px-2">
              Clear All
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Providers Grid */}
      <div className="mt-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-text-muted gap-2">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-xs">Loading providers...</span>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            No matching providers found in this tab.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto p-1 pr-2">
            {filteredProviders.map((provider) => {
              const isSelected = selectedIds.has(provider.id);
              return (
                <div
                  key={provider.id}
                  onClick={() => toggleSelect(provider.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                    isSelected
                      ? "border-action bg-action/5 shadow-sm"
                      : "border-border bg-surface-raised/40 hover:border-border-hover hover:bg-surface-raised"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center p-1.5 shrink-0 border border-border/50">
                      <ProviderIcon providerId={provider.id} size={20} type="color" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate">
                        {provider.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-text-muted font-mono truncate">
                          {provider.id}
                        </span>
                        {provider.hasConnection ? (
                          <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-emerald-500/10 text-emerald-500">
                            Connected
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded font-medium bg-surface-raised text-text-muted border border-border/60">
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-2 shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div onClick
                      className="rounded border-border text-action focus:ring-action w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Website Preview */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">visibility</span>
          Website Live Preview ({selectedIds.size} Providers Selected):
        </div>
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-surface-raised border border-border/70 min-h-[50px] items-center">
          {selectedIds.size === 0 ? (
            <span className="text-xs text-text-muted italic">
              No providers selected. Tick providers above to show them here.
            </span>
          ) : (
            providers
              .filter((p) => selectedIds.has(p.id))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-medium text-text-primary shadow-xs"
                >
                  <ProviderIcon providerId={p.id} size={16} type="color" />
                  <span>{p.name}</span>
                  {p.hasConnection && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </Card>
  );
}
