"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
  ShimmerPageLoader,
  EmptyState,
} from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

interface ResellerUserKey {
  id: number;
  userId: string;
  userName: string | null;
  userEmail: string;
  planTier: string;
  apiKey: string;
  apiKeyId?: string | null;
  allowedModels: string[];
  tokenBudget: number | null;
  tokensUsed: number;
  rpmLimit: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserByokKeyEntry {
  id: number;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  providerId: string;
  maskedKey: string;
  isPaused: boolean;
  lastUsedAt: string | null;
  requests: number;
  tokens: number;
  createdAt: string;
  updatedAt: string;
}

interface AvailableModelsData {
  combos: Array<{ id: string; name: string; strategy?: string; description?: string }>;
  models: Array<{ id: string; name: string; providerId: string }>;
}

const PLAN_STYLES: Record<string, string> = {
  free: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  pro: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  business: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  enterprise: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function getPlanBadgeClass(plan: string): string {
  const key = plan.toLowerCase();
  return PLAN_STYLES[key] || "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

function formatTokens(tokenBudget: number | null): string {
  if (!tokenBudget || tokenBudget <= 0) return "Unlimited";
  if (tokenBudget >= 1_000_000) {
    const m = tokenBudget / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M Tokens`;
  }
  if (tokenBudget >= 1_000) {
    return `${Math.round(tokenBudget / 1000)}K Tokens`;
  }
  return `${tokenBudget} Tokens`;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Unlimited";
  try {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) return expiresAt;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return expiresAt;
  }
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 12) return "••••••••••••";
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<"apiKeys" | "byok">("apiKeys");
  const [userKeys, setUserKeys] = useState<ResellerUserKey[]>([]);
  const [byokKeys, setByokKeys] = useState<UserByokKeyEntry[]>([]);
  const [publishedProviders, setPublishedProviders] = useState<string[]>([]);
  const [availableData, setAvailableData] = useState<AvailableModelsData>({
    combos: [],
    models: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter (Tab 1: API Keys)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");

  // Search & Filter (Tab 2: BYOK)
  const [byokSearchQuery, setByokSearchQuery] = useState("");
  const [byokProviderFilter, setByokProviderFilter] = useState("all");
  const [byokStatusFilter, setByokStatusFilter] = useState("all");

  // Tab 1: Create Key Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form Fields
  const [formUserId, setFormUserId] = useState("");
  const [formUserName, setFormUserName] = useState("");
  const [formUserEmail, setFormUserEmail] = useState("");
  const [formPlanTier, setFormPlanTier] = useState("Free");
  const [allowAllModels, setAllowAllModels] = useState(true);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [formTokenLimitMillions, setFormTokenLimitMillions] = useState("");
  const [formRpmLimit, setFormRpmLimit] = useState("");
  const [formExpiryPreset, setFormExpiryPreset] = useState("unlimited");
  const [formCustomExpiry, setFormCustomExpiry] = useState("");

  // Tab 2: Attach BYOK Modal State
  const [showByokModal, setShowByokModal] = useState(false);
  const [byokSubmitting, setByokSubmitting] = useState(false);
  const [byokError, setByokError] = useState<string | null>(null);
  const [byokFormUserId, setByokFormUserId] = useState("");
  const [byokFormUserName, setByokFormUserName] = useState("");
  const [byokFormUserEmail, setByokFormUserEmail] = useState("");
  const [byokFormProviderId, setByokFormProviderId] = useState("");
  const [byokFormKey, setByokFormKey] = useState("");

  // Key Generated Success Modal
  const [createdKeyResult, setCreatedKeyResult] = useState<ResellerUserKey | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});

  const { copied, copy } = useCopyToClipboard();

  const loadData = () => {
    fetch("/api/v1/reseller/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUserKeys(data.userKeys || []);
          setByokKeys(data.byokKeys || []);
          if (data.publishedProviders) {
            setPublishedProviders(data.publishedProviders);
          }
          if (data.availableModels) {
            setAvailableData(data.availableModels);
          }
          setLoadError(null);
        } else {
          setLoadError(data.error?.message || "Failed to load users data");
        }
      })
      .catch((err) => setLoadError(err.message || "Failed to load users data"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCreateModal = () => {
    setFormUserId(`usr_${Date.now().toString(36)}`);
    setFormUserName("");
    setFormUserEmail("");
    setFormPlanTier("Free");
    setAllowAllModels(true);
    setSelectedModels([]);
    setFormTokenLimitMillions("");
    setFormRpmLimit("");
    setFormExpiryPreset("unlimited");
    setFormCustomExpiry("");
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleOpenByokModal = () => {
    setByokFormUserId("");
    setByokFormUserName("");
    setByokFormUserEmail("");
    setByokFormProviderId(publishedProviders[0] || "anthropic");
    setByokFormKey("");
    setByokError(null);
    setShowByokModal(true);
  };

  const handleToggleModelSelection = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId.trim()) {
      setCreateError("User ID (UID) is required.");
      return;
    }
    if (!formUserName.trim()) {
      setCreateError("User Name is required.");
      return;
    }
    if (!formUserEmail.trim()) {
      setCreateError("Email or Phone Number is required.");
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    // Calculate expiry
    let expiresAt: string | null = null;
    if (formExpiryPreset === "7d") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      expiresAt = d.toISOString();
    } else if (formExpiryPreset === "30d") {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expiresAt = d.toISOString();
    } else if (formExpiryPreset === "90d") {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      expiresAt = d.toISOString();
    } else if (formExpiryPreset === "1y") {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expiresAt = d.toISOString();
    } else if (formExpiryPreset === "custom" && formCustomExpiry) {
      expiresAt = new Date(formCustomExpiry).toISOString();
    }

    // Calculate tokens
    let tokenBudget: number | null = null;
    if (formTokenLimitMillions.trim()) {
      const num = parseFloat(formTokenLimitMillions.trim());
      if (!isNaN(num) && num > 0) {
        tokenBudget = Math.round(num * 1_000_000);
      }
    }

    // Calculate RPM
    let rpmLimit: number | null = null;
    if (formRpmLimit.trim()) {
      const num = parseInt(formRpmLimit.trim(), 10);
      if (!isNaN(num) && num > 0) {
        rpmLimit = num;
      }
    }

    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formUserId.trim(),
          userName: formUserName.trim(),
          userEmail: formUserEmail.trim(),
          planTier: formPlanTier.trim() || "Free",
          allowedModels: allowAllModels ? [] : selectedModels,
          tokenBudget,
          rpmLimit,
          expiresAt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to create user API key");
      }

      setShowCreateModal(false);
      setCreatedKeyResult(data.userKey);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveByokKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!byokFormUserId.trim()) {
      setByokError("User ID (UID) is required.");
      return;
    }
    if (!byokFormProviderId.trim()) {
      setByokError("Provider is required.");
      return;
    }
    if (!byokFormKey.trim()) {
      setByokError("API Key is required.");
      return;
    }

    setByokSubmitting(true);
    setByokError(null);

    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addByok",
          userId: byokFormUserId.trim(),
          userName: byokFormUserName.trim() || undefined,
          userEmail: byokFormUserEmail.trim() || undefined,
          providerId: byokFormProviderId.trim(),
          maskedKey: byokFormKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to save BYOK key");
      }

      setShowByokModal(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setByokError(message);
    } finally {
      setByokSubmitting(false);
    }
  };

  const handleTogglePauseByok = async (item: UserByokKeyEntry) => {
    const nextPaused = !item.isPaused;
    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pauseByok",
          userId: item.userId,
          providerId: item.providerId,
          paused: nextPaused,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setByokKeys((prev) =>
          prev.map((k) => (k.id === item.id ? { ...k, isPaused: nextPaused } : k))
        );
      } else {
        alert(data.error?.message || "Failed to toggle BYOK key status");
      }
    } catch (err) {
      alert("Error: " + String(err));
    }
  };

  const handleDeleteByokKey = async (item: UserByokKeyEntry) => {
    if (
      !confirm(
        `Revoke & delete BYOK key for ${item.providerId} belonging to ${
          item.userName || item.userId
        }?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/reseller/users?userId=${encodeURIComponent(
          item.userId
        )}&providerId=${encodeURIComponent(item.providerId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error?.message || "Failed to delete BYOK key");
      }
    } catch (err) {
      alert("Error: " + String(err));
    }
  };

  const handleDeleteKey = async (id: number, userName: string | null) => {
    if (!confirm(`Are you sure you want to revoke and delete API key for ${userName || `row #${id}`}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/reseller/users?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error?.message || "Failed to delete key");
      }
    } catch (err) {
      alert("Error deleting key: " + String(err));
    }
  };

  const toggleRevealKey = (id: number) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter keys (Tab 1)
  const filteredKeys = useMemo(() => {
    return userKeys.filter((k) => {
      if (selectedPlanFilter !== "all") {
        if (k.planTier.toLowerCase() !== selectedPlanFilter.toLowerCase()) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        k.userId.toLowerCase().includes(q) ||
        (k.userName && k.userName.toLowerCase().includes(q)) ||
        k.userEmail.toLowerCase().includes(q) ||
        k.apiKey.toLowerCase().includes(q)
      );
    });
  }, [userKeys, searchQuery, selectedPlanFilter]);

  // Filter BYOK keys (Tab 2)
  const filteredByokKeys = useMemo(() => {
    return byokKeys.filter((b) => {
      if (byokProviderFilter !== "all") {
        if (b.providerId.toLowerCase() !== byokProviderFilter.toLowerCase()) return false;
      }
      if (byokStatusFilter === "active" && b.isPaused) return false;
      if (byokStatusFilter === "paused" && !b.isPaused) return false;

      if (!byokSearchQuery.trim()) return true;
      const q = byokSearchQuery.toLowerCase();
      return (
        b.userId.toLowerCase().includes(q) ||
        (b.userName && b.userName.toLowerCase().includes(q)) ||
        (b.userEmail && b.userEmail.toLowerCase().includes(q)) ||
        b.providerId.toLowerCase().includes(q) ||
        b.maskedKey.toLowerCase().includes(q)
      );
    });
  }, [byokKeys, byokSearchQuery, byokProviderFilter, byokStatusFilter]);

  // Distinct providers in BYOK
  const distinctByokProviders = useMemo(() => {
    const set = new Set<string>();
    byokKeys.forEach((b) => set.add(b.providerId));
    return Array.from(set);
  }, [byokKeys]);

  if (isLoading) {
    return <ShimmerPageLoader variant="users" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[28px]">
              group_add
            </span>
            Users & API Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage user accounts, issue scoped router keys, and track multi-tenant BYOK credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "apiKeys" ? (
            <Button variant="primary" icon="add" onClick={handleOpenCreateModal}>
              Issue API Key
            </Button>
          ) : (
            <Button variant="primary" icon="key" onClick={handleOpenByokModal}>
              Connect BYOK Key
            </Button>
          )}
        </div>
      </div>

      {/* TOP TABS: Issued API Keys vs BYOK Providers */}
      <div className="flex items-center gap-2 border-b border-border pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("apiKeys")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "apiKeys"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">vpn_key</span>
          Issued API Keys
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "apiKeys"
                ? "bg-primary/15 text-primary"
                : "bg-bg-subtle text-text-muted"
            }`}
          >
            {userKeys.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("byok")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "byok"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">hub</span>
          BYOK Providers
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "byok"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-bg-subtle text-text-muted"
            }`}
          >
            {byokKeys.length}
          </span>
        </button>
      </div>

      {loadError && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {loadError}
        </Card>
      )}

      {/* ========================================================= */}
      {/* TAB 1: ISSUED API KEYS */}
      {/* ========================================================= */}
      {activeTab === "apiKeys" && (
        <>
          {/* Filter and Search Bar */}
          <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by UID, Name, Email/Phone or Key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted font-medium">Plan Filter:</span>
              <select
                value={selectedPlanFilter}
                onChange={(e) => setSelectedPlanFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <span className="text-xs text-text-muted">
                Total: <strong>{filteredKeys.length}</strong>
              </span>
            </div>
          </Card>

          {/* Users Table */}
          {filteredKeys.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                title="No Users or API Keys Found"
                description={
                  searchQuery
                    ? "No users match your search criteria."
                    : "No user API keys have been issued yet. Click 'Issue API Key' to generate one."
                }
                actionLabel={!searchQuery ? "Issue First Key" : undefined}
                onAction={!searchQuery ? handleOpenCreateModal : undefined}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden p-0 border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle/60 text-xs font-semibold text-text-muted">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">User ID (UID)</th>
                      <th className="py-3 px-4">User Name</th>
                      <th className="py-3 px-4">Email / Phone</th>
                      <th className="py-3 px-4">API Key</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Allowed Models</th>
                      <th className="py-3 px-4">Token Limit</th>
                      <th className="py-3 px-4">Rate Limit</th>
                      <th className="py-3 px-4">Time / Expiry</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredKeys.map((item, index) => {
                      const isRevealed = !!revealedKeys[item.id];
                      const displayKey = isRevealed ? item.apiKey : maskApiKey(item.apiKey);
                      const isCopied = copied === `key_${item.id}`;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-bg-subtle/30 transition-colors"
                        >
                          {/* # Row Number */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-text-muted font-bold">
                            {index + 1}
                          </td>

                          {/* User ID (UID) */}
                          <td className="py-3.5 px-4 font-mono text-xs text-primary font-semibold">
                            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                              {item.userId}
                            </span>
                          </td>

                          {/* User Name */}
                          <td className="py-3.5 px-4 font-medium text-text-main">
                            {item.userName || "—"}
                          </td>

                          {/* Email / Phone */}
                          <td className="py-3.5 px-4 text-text-muted font-mono text-xs">
                            {item.userEmail}
                          </td>

                          {/* API Key */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs bg-bg-subtle px-2 py-1 rounded border border-border text-text-main select-all">
                                {displayKey}
                              </code>
                              <button
                                type="button"
                                title={isRevealed ? "Hide Key" : "Reveal Key"}
                                onClick={() => toggleRevealKey(item.id)}
                                className="p-1 hover:bg-bg-subtle rounded text-text-muted hover:text-text-main transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isRevealed ? "visibility_off" : "visibility"}
                                </span>
                              </button>
                              <button
                                type="button"
                                title="Copy API Key"
                                onClick={() => copy(item.apiKey, `key_${item.id}`)}
                                className="p-1 hover:bg-bg-subtle rounded text-text-muted hover:text-primary transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isCopied ? "check" : "content_copy"}
                                </span>
                              </button>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getPlanBadgeClass(
                                item.planTier
                              )}`}
                            >
                              {item.planTier}
                            </span>
                          </td>

                          {/* Allowed Models */}
                          <td className="py-3.5 px-4">
                            {item.allowedModels && item.allowedModels.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {item.allowedModels.slice(0, 3).map((m) => (
                                  <span
                                    key={m}
                                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-bg-subtle text-text-main border border-border truncate max-w-[120px]"
                                    title={m}
                                  >
                                    {m}
                                  </span>
                                ))}
                                {item.allowedModels.length > 3 && (
                                  <span
                                    className="text-[10px] px-1 py-0.5 rounded bg-bg-subtle text-text-muted border border-border"
                                    title={item.allowedModels.slice(3).join(", ")}
                                  >
                                    +{item.allowedModels.length - 3} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                                All Available Models
                              </span>
                            )}
                          </td>

                          {/* Token Limit */}
                          <td className="py-3.5 px-4 font-mono text-xs text-text-main">
                            {formatTokens(item.tokenBudget)}
                          </td>

                          {/* Rate Limit */}
                          <td className="py-3.5 px-4 font-mono text-xs text-text-main">
                            {item.rpmLimit ? `${item.rpmLimit} RPM` : "Unlimited"}
                          </td>

                          {/* Expiry */}
                          <td className="py-3.5 px-4 text-xs text-text-muted">
                            {formatExpiry(item.expiresAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Copy Key"
                                onClick={() => copy(item.apiKey, `key_${item.id}`)}
                                className="p-1.5 hover:bg-bg-subtle rounded text-text-muted hover:text-text-main transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {copied === `key_${item.id}` ? "check" : "content_copy"}
                                </span>
                              </button>
                              <button
                                type="button"
                                title="Revoke / Delete Key"
                                onClick={() => handleDeleteKey(item.id, item.userName)}
                                className="p-1.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-400 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BYOK PROVIDERS */}
      {/* ========================================================= */}
      {activeTab === "byok" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-[24px]">key</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Connected BYOK Keys</p>
                <p className="text-xl font-bold text-text-main">{byokKeys.length}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Users With BYOK</p>
                <p className="text-xl font-bold text-text-main">
                  {new Set(byokKeys.map((b) => b.userId)).size}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-[24px]">hub</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Distinct Providers Used</p>
                <p className="text-xl font-bold text-text-main">
                  {distinctByokProviders.length}
                </p>
              </div>
            </Card>
          </div>

          {/* BYOK Filter and Search Bar */}
          <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search BYOK by UID, Name, Provider or Key..."
                value={byokSearchQuery}
                onChange={(e) => setByokSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Provider:</span>
                <select
                  value={byokProviderFilter}
                  onChange={(e) => setByokProviderFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="all">All Providers</option>
                  {distinctByokProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Status:</span>
                <select
                  value={byokStatusFilter}
                  onChange={(e) => setByokStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="all">All</option>
                  <option value="active">Active Only</option>
                  <option value="paused">Paused Only</option>
                </select>
              </div>

              <span className="text-xs text-text-muted">
                Total: <strong>{filteredByokKeys.length}</strong>
              </span>
            </div>
          </Card>

          {/* BYOK Keys Table */}
          {filteredByokKeys.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                title="No BYOK Keys Attached"
                description={
                  byokSearchQuery
                    ? "No user BYOK keys match your filter."
                    : "No users have attached their own provider keys yet. Click 'Connect BYOK Key' to register one."
                }
                actionLabel={!byokSearchQuery ? "Connect BYOK Key" : undefined}
                onAction={!byokSearchQuery ? handleOpenByokModal : undefined}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden p-0 border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle/60 text-xs font-semibold text-text-muted">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">User ID (UID)</th>
                      <th className="py-3 px-4">User Name</th>
                      <th className="py-3 px-4">Email / Phone</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Masked Key</th>
                      <th className="py-3 px-4">Date Attached</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredByokKeys.map((item, index) => {
                      const isCopied = copied === `byok_${item.id}`;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-bg-subtle/30 transition-colors"
                        >
                          {/* Row # */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-text-muted font-bold">
                            {index + 1}
                          </td>

                          {/* UID */}
                          <td className="py-3.5 px-4 font-mono text-xs text-amber-400 font-semibold">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              {item.userId}
                            </span>
                          </td>

                          {/* User Name */}
                          <td className="py-3.5 px-4 font-medium text-text-main">
                            {item.userName || "—"}
                          </td>

                          {/* Email / Phone */}
                          <td className="py-3.5 px-4 text-text-muted font-mono text-xs">
                            {item.userEmail || "—"}
                          </td>

                          {/* Provider */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <ProviderIcon providerId={item.providerId} size={20} />
                              <span className="font-medium text-text-main capitalize">
                                {item.providerId}
                              </span>
                            </div>
                          </td>

                          {/* Masked Key */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs bg-bg-subtle px-2 py-1 rounded border border-border text-text-main">
                                {item.maskedKey}
                              </code>
                              <button
                                type="button"
                                title="Copy Masked Key"
                                onClick={() => copy(item.maskedKey, `byok_${item.id}`)}
                                className="p-1 hover:bg-bg-subtle rounded text-text-muted hover:text-primary transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isCopied ? "check" : "content_copy"}
                                </span>
                              </button>
                            </div>
                          </td>

                          {/* Date Attached */}
                          <td className="py-3.5 px-4 text-xs text-text-muted font-mono">
                            {formatExpiry(item.createdAt)}
                          </td>

                          {/* Usage */}
                          <td className="py-3.5 px-4 text-xs font-mono text-text-muted">
                            <div>{item.requests || 0} reqs</div>
                            <div className="text-[11px] text-text-muted/70">
                              {formatTokens(item.tokens)}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {item.isPaused ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <span className="size-1.5 rounded-full bg-amber-400" />
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <span className="size-1.5 rounded-full bg-emerald-400" />
                                Active
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title={item.isPaused ? "Resume Key" : "Pause Key"}
                                onClick={() => handleTogglePauseByok(item)}
                                className="p-1.5 hover:bg-bg-subtle rounded text-text-muted hover:text-text-main transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {item.isPaused ? "play_arrow" : "pause"}
                                </span>
                              </button>
                              <button
                                type="button"
                                title="Delete BYOK Key"
                                onClick={() => handleDeleteByokKey(item)}
                                className="p-1.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-400 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL: ISSUE API KEY (Tab 1) */}
      {/* ========================================================= */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Issue User API Key"
        size="lg"
      >
        <form onSubmit={handleCreateKey} className="space-y-5">
          {createError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {createError}
            </div>
          )}

          {/* Section 1: User Identity (The 3 Required Entries) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-main border-b border-border pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">person</span>
              1. User Information (Mandatory)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  User ID (UID) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. usr_1001"
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  User Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hasan Ali"
                  value={formUserName}
                  onChange={(e) => setFormUserName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Email or Phone <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. hasan@example.com / +92300..."
                  value={formUserEmail}
                  onChange={(e) => setFormUserEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Plan Name */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Plan Name / Description
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Free, Pro, Business, VIP..."
                  value={formPlanTier}
                  onChange={(e) => setFormPlanTier(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  {["Free", "Pro", "Business"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormPlanTier(preset)}
                      className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                        formPlanTier.toLowerCase() === preset.toLowerCase()
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-subtle border-border text-text-muted hover:text-text-main"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Model Selection (From Combos & Manage Models) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <h3 className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-amber-500">
                  smart_toy
                </span>
                2. Model Access (Combos & Curated Models)
              </h3>
              <label className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAllModels}
                  onChange={(e) => setAllowAllModels(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                Allow All Models & Combos (Unlimited)
              </label>
            </div>

            {!allowAllModels && (
              <div className="p-3 bg-bg-subtle/50 border border-border rounded-lg space-y-3 max-h-56 overflow-y-auto">
                {/* Active Combos */}
                {availableData.combos.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-amber-500 block mb-1.5">
                      Combos ({availableData.combos.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableData.combos.map((combo) => {
                        const isSelected = selectedModels.includes(combo.id);
                        return (
                          <button
                            key={combo.id}
                            type="button"
                            onClick={() => handleToggleModelSelection(combo.id)}
                            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                              isSelected
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                : "bg-bg-surface text-text-muted border-border hover:border-text-muted"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">tune</span>
                            {combo.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Curated Models */}
                {availableData.models.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-primary block mb-1.5">
                      Active Models from Manage Models ({availableData.models.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableData.models.map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => handleToggleModelSelection(model.id)}
                            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                              isSelected
                                ? "bg-primary/20 text-primary border-primary/50"
                                : "bg-bg-surface text-text-muted border-border hover:border-text-muted"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            {model.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableData.combos.length === 0 && availableData.models.length === 0 && (
                  <p className="text-xs text-text-muted italic">
                    No active combos or curated models found. Enable models in Manage Models or create combos.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Limits (Token limit, RPM, Duration / Time) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-main border-b border-border pb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">speed</span>
              3. Limits (Leave blank for Unlimited)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Token Limit */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Token Budget (Millions)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 50 (50M) — Blank = Unlimited"
                  value={formTokenLimitMillions}
                  onChange={(e) => setFormTokenLimitMillions(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Requests Per Minute (RPM)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 60 — Blank = Unlimited"
                  value={formRpmLimit}
                  onChange={(e) => setFormRpmLimit(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {/* Expiry Duration */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Time Validity / Expiration
                </label>
                <select
                  value={formExpiryPreset}
                  onChange={(e) => setFormExpiryPreset(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="unlimited">Unlimited Time</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="90d">90 Days</option>
                  <option value="1y">1 Year</option>
                  <option value="custom">Custom Date...</option>
                </select>
              </div>
            </div>

            {formExpiryPreset === "custom" && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Custom Expiration Date
                </label>
                <input
                  type="datetime-local"
                  value={formCustomExpiry}
                  onChange={(e) => setFormCustomExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowCreateModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Generate API Key"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: CONNECT BYOK KEY (Tab 2) */}
      {/* ========================================================= */}
      <Modal
        isOpen={showByokModal}
        onClose={() => setShowByokModal(false)}
        title="Connect User BYOK Key"
        size="md"
      >
        <form onSubmit={handleSaveByokKey} className="space-y-4 py-1">
          {byokError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {byokError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              User ID (UID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. usr_1001"
              value={byokFormUserId}
              onChange={(e) => setByokFormUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                User Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Hasan Ali"
                value={byokFormUserName}
                onChange={(e) => setByokFormUserName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Email or Phone (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. hasan@example.com"
                value={byokFormUserEmail}
                onChange={(e) => setByokFormUserEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Provider <span className="text-red-400">*</span>
            </label>
            <select
              value={byokFormProviderId}
              onChange={(e) => setByokFormProviderId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary capitalize"
            >
              {publishedProviders.length > 0 ? (
                publishedProviders.map((pid) => (
                  <option key={pid} value={pid}>
                    {pid}
                  </option>
                ))
              ) : (
                <>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="groq">Groq</option>
                  <option value="mistral">Mistral AI</option>
                  <option value="openrouter">OpenRouter</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              API Key (BYOK) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. sk-ant-api03-... or sk-proj-..."
              value={byokFormKey}
              onChange={(e) => setByokFormKey(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-text-muted mt-1">
              The user&apos;s personal key for this provider. Requests using BYOK routing will direct through this credential.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowByokModal(false)}
              disabled={byokSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={byokSubmitting}>
              {byokSubmitting ? "Connecting..." : "Connect Key"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: KEY GENERATED SUCCESS (Tab 1) */}
      {/* ========================================================= */}
      {createdKeyResult && (
        <Modal
          isOpen={!!createdKeyResult}
          onClose={() => setCreatedKeyResult(null)}
          title="API Key Generated Successfully"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3 text-emerald-400">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
              <div className="text-xs">
                <p className="font-semibold text-emerald-300">Key is Active & Live</p>
                <p className="mt-0.5 text-text-muted">
                  Please copy this key now. It can immediately be used for API requests at{" "}
                  <code>/v1/chat/completions</code>.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Generated API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdKeyResult.apiKey}
                  className="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-lg text-primary select-all"
                />
                <Button
                  variant="primary"
                  onClick={() => copy(createdKeyResult.apiKey, "generated_key_modal")}
                >
                  {copied === "generated_key_modal" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-bg-subtle border border-border rounded-lg text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">User ID:</span>
                <span className="text-text-main font-semibold">{createdKeyResult.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">User Name:</span>
                <span className="text-text-main">{createdKeyResult.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Email / Phone:</span>
                <span className="text-text-main">{createdKeyResult.userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Plan:</span>
                <span className="text-text-main font-semibold">{createdKeyResult.planTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Token Limit:</span>
                <span className="text-text-main">{formatTokens(createdKeyResult.tokenBudget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">RPM Limit:</span>
                <span className="text-text-main">
                  {createdKeyResult.rpmLimit ? `${createdKeyResult.rpmLimit} RPM` : "Unlimited"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Expiry:</span>
                <span className="text-text-main">{formatExpiry(createdKeyResult.expiresAt)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setCreatedKeyResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
