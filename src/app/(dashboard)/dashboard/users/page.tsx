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

interface UserModelUsage {
  model: string;
  tokensUsed: number;
  requests: number;
  lastUsedAt: string | null;
}

interface ResellerUserEntry {
  id: string; // userId (UID)
  email: string;
  name: string | null;
  planTier: string;
  tokenBudget: number | null;
  tokensUsed: number;
  rpmLimit: number | null;
  isBanned: boolean;
  keysCount: number;
  modelQuotas?: Record<string, number>;
  modelUsage?: UserModelUsage[];
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

const PLAN_STYLES: Record<string, string> = {
  free: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  pro: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  business: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  enterprise: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  vip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function getPlanBadgeClass(plan: string): string {
  const key = plan?.toLowerCase() || "free";
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

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<"users" | "byok">("users");
  const [users, setUsers] = useState<ResellerUserEntry[]>([]);
  const [byokKeys, setByokKeys] = useState<UserByokKeyEntry[]>([]);
  const [publishedProviders, setPublishedProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tab 1: Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Tab 2: Search & Filter (BYOK)
  const [byokSearchQuery, setByokSearchQuery] = useState("");
  const [byokProviderFilter, setByokProviderFilter] = useState("all");
  const [byokStatusFilter, setByokStatusFilter] = useState("all");

  // Modals State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditQuotaModal, setShowEditQuotaModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<ResellerUserEntry | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedUserForUsage, setSelectedUserForUsage] = useState<ResellerUserEntry | null>(null);
  const [showKeyResultModal, setShowKeyResultModal] = useState(false);
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{ key: string; userId: string } | null>(null);

  // Form Fields: Add User
  const [formUserId, setFormUserId] = useState("");
  const [formUserName, setFormUserName] = useState("");
  const [formUserEmail, setFormUserEmail] = useState("");
  const [formPlanTier, setFormPlanTier] = useState("Free");
  const [formTokenLimitMillions, setFormTokenLimitMillions] = useState("10");
  const [formRpmLimit, setFormRpmLimit] = useState("60");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields: Edit Quota
  const [editPlanTier, setEditPlanTier] = useState("");
  const [editTokenLimitMillions, setEditTokenLimitMillions] = useState("");
  const [editRpmLimit, setEditRpmLimit] = useState("");
  const [editResetUsage, setEditResetUsage] = useState(false);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);

  // Tab 2: Attach BYOK Modal State
  const [showByokModal, setShowByokModal] = useState(false);
  const [byokSubmitting, setByokSubmitting] = useState(false);
  const [byokError, setByokError] = useState<string | null>(null);
  const [byokFormUserId, setByokFormUserId] = useState("");
  const [byokFormUserName, setByokFormUserName] = useState("");
  const [byokFormUserEmail, setByokFormUserEmail] = useState("");
  const [byokFormProviderId, setByokFormProviderId] = useState("");
  const [byokFormKey, setByokFormKey] = useState("");

  const { copied, copy } = useCopyToClipboard();

  const loadData = () => {
    fetch("/api/v1/reseller/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
          setByokKeys(data.byokKeys || []);
          if (data.publishedProviders) {
            setPublishedProviders(data.publishedProviders);
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
  }, []);

  // Filtered Users (Tab 1)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.id.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.planTier.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !u.isBanned) ||
        (statusFilter === "banned" && u.isBanned);

      const matchesPlan =
        planFilter === "all" || u.planTier.toLowerCase() === planFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [users, searchQuery, statusFilter, planFilter]);

  // Distinct Plans
  const distinctPlans = useMemo(() => {
    const plans = new Set<string>();
    users.forEach((u) => {
      if (u.planTier) plans.add(u.planTier);
    });
    return Array.from(plans);
  }, [users]);

  // Filtered BYOK Keys (Tab 2)
  const filteredByokKeys = useMemo(() => {
    return byokKeys.filter((b) => {
      const q = byokSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.userId.toLowerCase().includes(q) ||
        (b.userName && b.userName.toLowerCase().includes(q)) ||
        (b.userEmail && b.userEmail.toLowerCase().includes(q)) ||
        b.providerId.toLowerCase().includes(q) ||
        b.maskedKey.toLowerCase().includes(q);

      const matchesProvider =
        byokProviderFilter === "all" || b.providerId === byokProviderFilter;

      const matchesStatus =
        byokStatusFilter === "all" ||
        (byokStatusFilter === "active" && !b.isPaused) ||
        (byokStatusFilter === "paused" && b.isPaused);

      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [byokKeys, byokSearchQuery, byokProviderFilter, byokStatusFilter]);

  // Distinct BYOK Providers
  const distinctByokProviders = useMemo(() => {
    const s = new Set<string>();
    byokKeys.forEach((b) => s.add(b.providerId));
    return Array.from(s);
  }, [byokKeys]);

  // Handler: Toggle Ban Status
  const handleToggleBan = async (user: ResellerUserEntry) => {
    const newBannedState = !user.isBanned;
    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setBanStatus",
          userId: user.id,
          isBanned: newBannedState,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isBanned: newBannedState } : u))
        );
      }
    } catch (e) {
      console.error("Failed to toggle ban status", e);
    }
  };

  // Handler: Delete User
  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user ${userId}? This will remove the user, all their API keys, and BYOK credentials.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/reseller/users?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setByokKeys((prev) => prev.filter((b) => b.userId !== userId));
      }
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  // Handler: Open Edit Quota Modal
  const handleOpenEditQuota = (user: ResellerUserEntry) => {
    setSelectedUserForEdit(user);
    setEditPlanTier(user.planTier || "Free");
    setEditTokenLimitMillions(
      user.tokenBudget ? String(user.tokenBudget / 1_000_000) : ""
    );
    setEditRpmLimit(user.rpmLimit ? String(user.rpmLimit) : "");
    setEditResetUsage(false);
    setShowEditQuotaModal(true);
  };

  // Handler: Submit Edit Quota
  const handleSaveEditQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    setIsUpdatingQuota(true);
    try {
      const tokenBudget =
        editTokenLimitMillions.trim() !== ""
          ? Number(editTokenLimitMillions) * 1_000_000
          : null;
      const rpmLimit =
        editRpmLimit.trim() !== "" ? Number(editRpmLimit) : null;

      const res = await fetch("/api/v1/reseller/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateQuota",
          userId: selectedUserForEdit.id,
          plan: editPlanTier.trim() || "Free",
          tokenBudget,
          rpmLimit,
          resetUsage: editResetUsage,
        }),
      });

      if (res.ok) {
        setShowEditQuotaModal(false);
        loadData();
      }
    } catch (err) {
      console.error("Failed to update quota", err);
    } finally {
      setIsUpdatingQuota(false);
    }
  };

  // Handler: Issue API Key for User
  const handleIssueKeyForUser = async (user: ResellerUserEntry) => {
    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          plan: user.planTier,
          tokenBudget: user.tokenBudget,
          rpmLimit: user.rpmLimit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.apiKey) {
        setGeneratedKeyResult({ key: data.apiKey, userId: user.id });
        setShowKeyResultModal(true);
        loadData();
      }
    } catch (e) {
      console.error("Failed to issue key", e);
    }
  };

  // Handler: Add User Form Submit
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId.trim() || !formUserEmail.trim()) {
      setFormError("User ID and Email / Phone are mandatory.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const tokenBudget =
        formTokenLimitMillions.trim() !== ""
          ? Number(formTokenLimitMillions) * 1_000_000
          : null;
      const rpmLimit =
        formRpmLimit.trim() !== "" ? Number(formRpmLimit) : null;

      const res = await fetch("/api/v1/reseller/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertUser",
          userId: formUserId.trim(),
          userName: formUserName.trim() || formUserId.trim(),
          userEmail: formUserEmail.trim(),
          plan: formPlanTier.trim() || "Free",
          tokenBudget,
          rpmLimit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to add user");
      }

      setShowAddUserModal(false);
      setFormUserId("");
      setFormUserName("");
      setFormUserEmail("");
      loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Toggle BYOK Pause
  const handleToggleByokPause = async (item: UserByokKeyEntry) => {
    const newPaused = !item.isPaused;
    try {
      const res = await fetch("/api/v1/reseller/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pauseByok",
          userId: item.userId,
          providerId: item.providerId,
          paused: newPaused,
        }),
      });
      if (res.ok) {
        setByokKeys((prev) =>
          prev.map((k) => (k.id === item.id ? { ...k, isPaused: newPaused } : k))
        );
      }
    } catch (e) {
      console.error("Failed to toggle BYOK status", e);
    }
  };

  // Handler: Delete BYOK Key
  const handleDeleteByokKey = async (id: number) => {
    if (!confirm("Are you sure you want to remove this attached BYOK key?")) return;
    try {
      const res = await fetch(`/api/v1/reseller/users?byokId=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setByokKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete BYOK key", e);
    }
  };

  // Handler: Add BYOK Key Submit
  const handleByokFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!byokFormUserId.trim() || !byokFormProviderId.trim() || !byokFormKey.trim()) {
      setByokError("User ID, Provider, and Key are required.");
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
          apiKey: byokFormKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to save BYOK key");
      }

      setShowByokModal(false);
      setByokFormUserId("");
      setByokFormUserName("");
      setByokFormUserEmail("");
      setByokFormKey("");
      loadData();
    } catch (err: unknown) {
      setByokError(err instanceof Error ? err.message : String(err));
    } finally {
      setByokSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <ShimmerPageLoader />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[28px] text-action">group</span>
            <h1 className="text-2xl font-bold text-text-main">Users & Quotas</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
              UID-Centric Quota Pool
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Manage user accounts, quotas, plan descriptions, ban statuses, and BYOK credentials.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {activeTab === "users" ? (
            <Button
              onClick={() => {
                setFormError(null);
                setShowAddUserModal(true);
              }}
              className="flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Register User
            </Button>
          ) : (
            <Button
              onClick={() => {
                setByokError(null);
                setShowByokModal(true);
              }}
              className="flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              Connect BYOK Key
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          Users & Quotas
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-surface-raised border border-border text-text-muted font-normal">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("byok")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "byok"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          BYOK Providers
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-surface-raised border border-border text-text-muted font-normal">
            {byokKeys.length}
          </span>
        </button>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <Button size="sm" variant="ghost" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* TAB 1: USERS & QUOTAS */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Users</p>
                <p className="text-xl font-bold text-text-main">{users.length}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Active Users</p>
                <p className="text-xl font-bold text-text-main">
                  {users.filter((u) => !u.isBanned).length}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                <span className="material-symbols-outlined text-[24px]">block</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Banned Users</p>
                <p className="text-xl font-bold text-text-main">
                  {users.filter((u) => u.isBanned).length}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-[24px]">vpn_key</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Keys Issued</p>
                <p className="text-xl font-bold text-text-main">
                  {users.reduce((acc, u) => acc + (u.keysCount || 0), 0)}
                </p>
              </div>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by UID, Name, Email/Phone or Plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="banned">Banned Only</option>
                </select>
              </div>

              {distinctPlans.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-medium">Plan:</span>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary capitalize"
                  >
                    <option value="all">All Plans</option>
                    {distinctPlans.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="text-xs text-text-muted">
                Showing: <strong>{filteredUsers.length}</strong> of {users.length}
              </span>
            </div>
          </Card>

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                title="No Users Found"
                description={
                  searchQuery
                    ? "No users match your search query."
                    : "No users registered yet. Click 'Register User' to create the first account."
                }
                actionLabel={!searchQuery ? "Register User" : undefined}
                onAction={!searchQuery ? () => setShowAddUserModal(true) : undefined}
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
                      <th className="py-3 px-4">Plan / Description</th>
                      <th className="py-3 px-4 min-w-[200px]">Quota & Usage</th>
                      <th className="py-3 px-4 text-center">Keys Generated</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((user, index) => {
                      const totalBudget = user.tokenBudget || 0;
                      const used = user.tokensUsed || 0;
                      const percent =
                        totalBudget > 0 ? Math.min(100, Math.round((used / totalBudget) * 100)) : 0;
                      const modelUsageCount = user.modelUsage?.length || 0;

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-bg-subtle/30 transition-colors ${
                            user.isBanned ? "bg-red-500/5 opacity-80" : ""
                          }`}
                        >
                          {/* Row # */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-text-muted font-bold">
                            {index + 1}
                          </td>

                          {/* UID */}
                          <td className="py-3.5 px-4 font-mono text-xs text-amber-400 font-semibold">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              {user.id}
                            </span>
                          </td>

                          {/* User Name */}
                          <td className="py-3.5 px-4 font-medium text-text-main">
                            {user.name || "—"}
                          </td>

                          {/* Email / Phone */}
                          <td className="py-3.5 px-4 text-text-muted font-mono text-xs">
                            {user.email || "—"}
                          </td>

                          {/* Plan */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${getPlanBadgeClass(
                                user.planTier
                              )}`}
                            >
                              {user.planTier || "Free"}
                            </span>
                          </td>

                          {/* Quota & Usage */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-text-main">
                                  {formatTokens(user.tokenBudget)}
                                </span>
                                <span className="text-text-muted font-mono text-[11px]">
                                  {user.tokenBudget
                                    ? `${(used / 1_000_000).toFixed(1)}M used (${percent}%)`
                                    : `${(used / 1_000_000).toFixed(1)}M used`}
                                </span>
                              </div>

                              {user.tokenBudget && (
                                <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden border border-border">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      percent >= 90
                                        ? "bg-red-500"
                                        : percent >= 75
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-0.5">
                                {user.rpmLimit && (
                                  <span className="text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                                    {user.rpmLimit} RPM
                                  </span>
                                )}

                                {modelUsageCount > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedUserForUsage(user);
                                      setShowUsageModal(true);
                                    }}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">
                                      analytics
                                    </span>
                                    {modelUsageCount} model{modelUsageCount > 1 ? "s" : ""} used
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Keys Generated */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                user.keysCount > 0
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : "bg-surface-raised text-text-muted border-border"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">vpn_key</span>
                              {user.keysCount} {user.keysCount === 1 ? "key" : "keys"}
                            </span>
                          </td>

                          {/* Status (Active vs Banned toggle) */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleBan(user)}
                              title={user.isBanned ? "Click to Activate User" : "Click to Ban User"}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-all inline-flex items-center gap-1 ${
                                user.isBanned
                                  ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {user.isBanned ? "block" : "check_circle"}
                              </span>
                              {user.isBanned ? "Banned" : "Active"}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Quota */}
                              <button
                                onClick={() => handleOpenEditQuota(user)}
                                title="Edit Plan & Quota"
                                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-subtle transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  edit_note
                                </span>
                              </button>

                              {/* Issue API Key */}
                              <button
                                onClick={() => handleIssueKeyForUser(user)}
                                title="Generate API Key for this user"
                                className="p-1.5 rounded-lg text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  key_vertical
                                </span>
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                title="Delete User & Revoke All Keys"
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
        </div>
      )}

      {/* TAB 2: BYOK PROVIDERS */}
      {activeTab === "byok" && (
        <div className="space-y-6">
          {/* BYOK Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined text-[24px]">key</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Attached Keys</p>
                <p className="text-xl font-bold text-text-main">{byokKeys.length}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-[24px]">check_circle</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Active Keys</p>
                <p className="text-xl font-bold text-text-main">
                  {byokKeys.filter((b) => !b.isPaused).length}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-[24px]">pause_circle</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Paused Keys</p>
                <p className="text-xl font-bold text-text-main">
                  {byokKeys.filter((b) => b.isPaused).length}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <span className="material-symbols-outlined text-[24px]">hub</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">Distinct Providers</p>
                <p className="text-xl font-bold text-text-main">
                  {distinctByokProviders.length}
                </p>
              </div>
            </Card>
          </div>

          {/* BYOK Filter Bar */}
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
                  className="px-3 py-1.5 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary capitalize"
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

          {/* BYOK Table */}
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
                onAction={!byokSearchQuery ? () => setShowByokModal(true) : undefined}
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
                        <tr key={item.id} className="hover:bg-bg-subtle/30 transition-colors">
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-text-muted font-bold">
                            {index + 1}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-amber-400 font-semibold">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              {item.userId}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-medium text-text-main">
                            {item.userName || "—"}
                          </td>

                          <td className="py-3.5 px-4 text-text-muted font-mono text-xs">
                            {item.userEmail || "—"}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <ProviderIcon providerId={item.providerId} size={20} />
                              <span className="font-medium text-text-main capitalize">
                                {item.providerId}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-bg-subtle px-2 py-1 rounded border border-border text-text-main">
                                {item.maskedKey}
                              </code>
                              <button
                                onClick={() => copy(item.maskedKey, `byok_${item.id}`)}
                                title="Copy Masked Key"
                                className="text-text-muted hover:text-text-main transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isCopied ? "check" : "content_copy"}
                                </span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-text-muted text-xs">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            <span className="text-text-main">{item.requests} reqs</span>
                            {item.tokens > 0 && (
                              <span className="text-text-muted ml-1">
                                ({(item.tokens / 1_000_000).toFixed(2)}M)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                                item.isPaused
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {item.isPaused ? "Paused" : "Active"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleByokPause(item)}
                                className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
                                  item.isPaused
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                }`}
                              >
                                {item.isPaused ? "Resume" : "Pause"}
                              </button>
                              <button
                                onClick={() => handleDeleteByokKey(item.id)}
                                title="Delete BYOK key"
                                className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
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
        </div>
      )}

      {/* MODAL 1: REGISTER / ADD USER */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="Register New User & Assign Quota"
        className="max-w-md"
      >
        <form onSubmit={handleAddUserSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {formError}
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

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Plan / Description
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Free, Pro, VIP"
                value={formPlanTier}
                onChange={(e) => setFormPlanTier(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
              {["Free", "Pro", "VIP"].map((preset) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Token Budget (in Millions)
              </label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 50 (for 50M)"
                value={formTokenLimitMillions}
                onChange={(e) => setFormTokenLimitMillions(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                RPM Limit
              </label>
              <input
                type="number"
                placeholder="e.g. 60"
                value={formRpmLimit}
                onChange={(e) => setFormRpmLimit(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddUserModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT USER QUOTA */}
      <Modal
        isOpen={showEditQuotaModal}
        onClose={() => setShowEditQuotaModal(false)}
        title={`Update Quota — ${selectedUserForEdit?.name || selectedUserForEdit?.id}`}
        className="max-w-md"
      >
        <form onSubmit={handleSaveEditQuota} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Plan / Description
            </label>
            <input
              type="text"
              value={editPlanTier}
              onChange={(e) => setEditPlanTier(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Token Budget (Millions)
              </label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 50 (or empty for unlimited)"
                value={editTokenLimitMillions}
                onChange={(e) => setEditTokenLimitMillions(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                RPM Limit
              </label>
              <input
                type="number"
                placeholder="e.g. 60 (or empty for unlimited)"
                value={editRpmLimit}
                onChange={(e) => setEditRpmLimit(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-raised border border-border">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-main">
              <input
                type="checkbox"
                checked={editResetUsage}
                onChange={(e) => setEditResetUsage(e.target.checked)}
                className="rounded border-border text-primary focus:ring-0"
              />
              <span>
                <strong>Reset tokens used to 0</strong> (New billing cycle / top-up)
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowEditQuotaModal(false)}
              disabled={isUpdatingQuota}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdatingQuota}>
              {isUpdatingQuota ? "Updating..." : "Update Quota"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: MODEL USAGE BREAKDOWN */}
      <Modal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        title={`Model-wise Token Breakdown — ${selectedUserForUsage?.name || selectedUserForUsage?.id}`}
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-surface-raised border border-border flex items-center justify-between text-xs">
            <div>
              <span className="text-text-muted">Total Budget: </span>
              <strong className="text-text-main">{formatTokens(selectedUserForUsage?.tokenBudget || null)}</strong>
            </div>
            <div>
              <span className="text-text-muted">Total Consumed: </span>
              <strong className="text-amber-400">
                {((selectedUserForUsage?.tokensUsed || 0) / 1_000_000).toFixed(2)}M
              </strong>
            </div>
          </div>

          {selectedUserForUsage?.modelUsage && selectedUserForUsage.modelUsage.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-bg-subtle border-b border-border text-text-muted font-semibold">
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3 text-right">Tokens Consumed</th>
                    <th className="py-2.5 px-3 text-right">Requests</th>
                    <th className="py-2.5 px-3 text-right">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedUserForUsage.modelUsage.map((m, i) => (
                    <tr key={i} className="hover:bg-bg-subtle/30">
                      <td className="py-2.5 px-3 font-mono font-medium text-text-main">
                        {m.model}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-semibold">
                        {(m.tokensUsed / 1_000_000).toFixed(3)}M
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-muted">
                        {m.requests}
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-muted">
                        {m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted text-xs">
              No model usage recorded for this user yet.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowUsageModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: KEY GENERATED POPUP */}
      <Modal
        isOpen={showKeyResultModal}
        onClose={() => setShowKeyResultModal(false)}
        title="API Key Issued Successfully"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            A new API key has been generated for UID <strong>{generatedKeyResult?.userId}</strong>.
            This key uses the user&apos;s shared account quota.
          </p>

          <div className="p-3 rounded-lg bg-surface-raised border border-border">
            <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
              API Key:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedKeyResult?.key || ""}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-bg-subtle border border-border rounded text-text-main select-all"
              />
              <Button
                size="sm"
                onClick={() => generatedKeyResult?.key && copy(generatedKeyResult.key)}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowKeyResultModal(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: CONNECT BYOK KEY */}
      <Modal
        isOpen={showByokModal}
        onClose={() => setShowByokModal(false)}
        title="Connect BYOK Provider Key"
        className="max-w-md"
      >
        <form onSubmit={handleByokFormSubmit} className="space-y-4">
          {byokError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">User Name</label>
              <input
                type="text"
                placeholder="e.g. Hasan Ali"
                value={byokFormUserName}
                onChange={(e) => setByokFormUserName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Email / Phone</label>
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
              required
              value={byokFormProviderId}
              onChange={(e) => setByokFormProviderId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary capitalize"
            >
              <option value="">Select a provider...</option>
              {publishedProviders.length > 0
                ? publishedProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))
                : ["openai", "anthropic", "gemini", "deepseek", "groq"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              API Key <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              required
              placeholder="e.g. sk-ant-api03-..."
              value={byokFormKey}
              onChange={(e) => setByokFormKey(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle border border-border rounded-lg text-text-main focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-text-muted mt-1">
              CheapRouter will automatically mask this key upon saving.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowByokModal(false)}
              disabled={byokSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={byokSubmitting}>
              {byokSubmitting ? "Connecting..." : "Connect Key"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
