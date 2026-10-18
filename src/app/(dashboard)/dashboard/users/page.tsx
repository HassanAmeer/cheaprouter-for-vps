"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, Button, Modal, ShimmerPageLoader, EmptyState } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { matchesSearch } from "@/shared/utils/turkishText";

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

interface UserKeyEntry {
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

function getPlanTextColor(plan: string): string {
  const p = plan?.toLowerCase() || "free";
  if (p === "pro" || p === "pro plan") return "text-zinc-200";
  if (p === "vip") return "text-emerald-300";
  if (p === "enterprise") return "text-purple-300";
  if (p === "business") return "text-amber-300";
  return "text-zinc-300";
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
  const [users, setUsers] = useState<ResellerUserEntry[]>([]);
  const [byokKeys, setByokKeys] = useState<UserByokKeyEntry[]>([]);
  const [userKeys, setUserKeys] = useState<UserKeyEntry[]>([]);
  const [publishedProviders, setPublishedProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Modals & Sheets State
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<ResellerUserEntry | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedUserForUsage, _setSelectedUserForUsage] = useState<ResellerUserEntry | null>(null);
  const [showKeyResultModal, setShowKeyResultModal] = useState(false);
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{
    key: string;
    userId: string;
  } | null>(null);

  // Cupertino iOS Slide-over Sheets State
  const [selectedUserForSheet, setSelectedUserForSheet] = useState<ResellerUserEntry | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAddUserSheetOpen, setIsAddUserSheetOpen] = useState(false);
  const [isEditUserSheetOpen, setIsEditUserSheetOpen] = useState(false);
  const [isSeedingMode, setIsSeedingMode] = useState(false);

  // Available Piped Models & Combos from API
  const [availableModelsData, setAvailableModelsData] = useState<{
    combos: Array<{ id: string; name: string; strategy?: string; description?: string }>;
    models: Array<{ id: string; name: string; providerId: string }>;
  }>({ combos: [], models: [] });

  // Keep selected sheet user reactively synced with users list
  const activeSheetUser = useMemo(() => {
    if (!selectedUserForSheet) return null;
    return users.find((u) => u.id === selectedUserForSheet.id) || selectedUserForSheet;
  }, [users, selectedUserForSheet]);

  // BYOK keys for current user in sheet
  const activeUserByokKeys = useMemo(() => {
    if (!activeSheetUser) return [];
    return byokKeys.filter((b) => b.userId === activeSheetUser.id);
  }, [byokKeys, activeSheetUser]);

  // Issued native API keys for current user in sheet
  const activeUserKeys = useMemo(() => {
    if (!activeSheetUser) return [];
    return userKeys.filter((k) => k.userId === activeSheetUser.id);
  }, [userKeys, activeSheetUser]);

  // Handle ESC key to dismiss slide-over sheets
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAddUserSheetOpen) setIsAddUserSheetOpen(false);
        if (isEditUserSheetOpen) setIsEditUserSheetOpen(false);
        if (isSheetOpen) setIsSheetOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSheetOpen, isAddUserSheetOpen, isEditUserSheetOpen]);

  // Form Fields: Add User (Cupertino iOS Sheet)
  const [formUserId, setFormUserId] = useState("");
  const [formUserName, setFormUserName] = useState("");
  const [formUserEmail, setFormUserEmail] = useState("");
  const [formPlanTier, setFormPlanTier] = useState("Free");
  const [formTokenLimitMillions, setFormTokenLimitMillions] = useState("10");
  const [formRpmLimit, setFormRpmLimit] = useState("60");
  const [formIsBanned, setFormIsBanned] = useState(false);
  const [formInitialByokKeysCount, setFormInitialByokKeysCount] = useState("0");
  const [formGenerateApiKey, setFormGenerateApiKey] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [modelFilterType, setModelFilterType] = useState<"all" | "combos" | "models">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields: Edit User (Cupertino iOS Sheet)
  const [editUserId, setEditUserId] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editPlanTier, setEditPlanTier] = useState("Free");
  const [editTokenLimitMillions, setEditTokenLimitMillions] = useState("");
  const [editRpmLimit, setEditRpmLimit] = useState("");
  const [editIsBanned, setEditIsBanned] = useState(false);
  const [editResetUsage, setEditResetUsage] = useState(false);
  const [editSelectedModelIds, setEditSelectedModelIds] = useState<string[]>([]);
  const [editModelSearchQuery, setEditModelSearchQuery] = useState("");
  const [editModelFilterType, setEditModelFilterType] = useState<"all" | "combos" | "models">("all");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false);

  const { copied, copy } = useCopyToClipboard();

  const loadData = () => {
    fetch("/api/v1/reseller/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
          setByokKeys(data.byokKeys || []);
          setUserKeys(data.userKeys || []);
          if (data.publishedProviders) {
            setPublishedProviders(data.publishedProviders);
          }
          if (data.availableModels) {
            setAvailableModelsData(data.availableModels);
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
      const q = searchQuery.trim();
      const matches =
        !q ||
        matchesSearch(u.id, q) ||
        (u.name ? matchesSearch(u.name, q) : false) ||
        (u.email ? matchesSearch(u.email, q) : false) ||
        matchesSearch(u.planTier, q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !u.isBanned) ||
        (statusFilter === "banned" && u.isBanned);

      const matchesPlan =
        planFilter === "all" || u.planTier.toLowerCase() === planFilter.toLowerCase();

      return matches && matchesStatus && matchesPlan;
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

  // Distinct BYOK Providers
  const distinctByokProviders = useMemo(() => {
    const s = new Set<string>();
    byokKeys.forEach((b) => s.add(b.providerId));
    return Array.from(s);
  }, [byokKeys]);

  // Flattened list of all piped combos and curated models
  const allPipedItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      type: "combo" | "model";
      providerId?: string;
      strategy?: string;
    }> = [];

    (availableModelsData.combos || []).forEach((c) => {
      list.push({
        id: c.id,
        name: c.name || c.id,
        type: "combo",
        strategy: c.strategy,
      });
    });

    (availableModelsData.models || []).forEach((m) => {
      list.push({
        id: m.id,
        name: m.name || m.id,
        type: "model",
        providerId: m.providerId,
      });
    });

    return list;
  }, [availableModelsData]);

  // Filtered piped models & combos for search in sheet
  const filteredPipedItems = useMemo(() => {
    return allPipedItems.filter((item) => {
      if (modelFilterType === "combos" && item.type !== "combo") return false;
      if (modelFilterType === "models" && item.type !== "model") return false;

      const q = modelSearchQuery.trim();
      if (!q) return true;
      return (
        matchesSearch(item.id, q) ||
        matchesSearch(item.name, q) ||
        (item.providerId ? matchesSearch(item.providerId, q) : false) ||
        (item.strategy ? matchesSearch(item.strategy, q) : false)
      );
    });
  }, [allPipedItems, modelSearchQuery, modelFilterType]);

  // Filtered piped models & combos for search in Edit User sheet
  const editFilteredPipedItems = useMemo(() => {
    return allPipedItems.filter((item) => {
      if (editModelFilterType === "combos" && item.type !== "combo") return false;
      if (editModelFilterType === "models" && item.type !== "model") return false;

      const q = editModelSearchQuery.trim();
      if (!q) return true;
      return (
        matchesSearch(item.id, q) ||
        matchesSearch(item.name, q) ||
        (item.providerId ? matchesSearch(item.providerId, q) : false) ||
        (item.strategy ? matchesSearch(item.strategy, q) : false)
      );
    });
  }, [allPipedItems, editModelSearchQuery, editModelFilterType]);

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
        if (selectedUserForSheet?.id === userId) {
          setIsSheetOpen(false);
          setSelectedUserForSheet(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  // Handler: Open Edit User Cupertino Sheet
  const handleOpenEditUser = (user: ResellerUserEntry) => {
    setSelectedUserForEdit(user);
    setEditUserId(user.id);
    setEditUserName(user.name || "");
    setEditUserEmail(user.email || "");
    setEditPlanTier(user.planTier || "Free");
    setEditTokenLimitMillions(user.tokenBudget ? String(user.tokenBudget / 1_000_000) : "");
    setEditRpmLimit(user.rpmLimit ? String(user.rpmLimit) : "");
    setEditIsBanned(user.isBanned);
    setEditResetUsage(false);
    setEditModelSearchQuery("");
    setEditModelFilterType("all");
    setEditUserError(null);

    const quotaKeys = user.modelQuotas ? Object.keys(user.modelQuotas) : [];
    if (quotaKeys.length > 0) {
      setEditSelectedModelIds(quotaKeys);
    } else {
      setEditSelectedModelIds(allPipedItems.map((m) => m.id));
    }

    setIsEditUserSheetOpen(true);
  };

  // Handler: Submit Edit User Form
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId.trim() || !editUserEmail.trim()) {
      setEditUserError("User ID and Email / Phone are mandatory.");
      return;
    }

    setIsUpdatingUser(true);
    setEditUserError(null);

    try {
      const tokenBudget =
        editTokenLimitMillions.trim() !== "" ? Number(editTokenLimitMillions) * 1_000_000 : null;
      const rpmLimit = editRpmLimit.trim() !== "" ? Number(editRpmLimit) : null;

      const modelQuotas: Record<string, number> = {};
      editSelectedModelIds.forEach((id) => {
        modelQuotas[id] = -1;
      });

      const res = await fetch("/api/v1/reseller/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertUser",
          userId: editUserId.trim(),
          userName: editUserName.trim() || editUserId.trim(),
          userEmail: editUserEmail.trim(),
          plan: editPlanTier.trim() || "Free",
          tokenBudget,
          rpmLimit,
          isBanned: editIsBanned,
          modelQuotas,
          resetUsage: editResetUsage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to update user");
      }

      setIsEditUserSheetOpen(false);
      loadData();
    } catch (err: unknown) {
      setEditUserError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingUser(false);
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

  // Handler: Open Add User Cupertino Sheet
  const handleOpenAddUser = () => {
    setIsSeedingMode(false);
    setFormUserId(`usr_${Math.floor(1000 + Math.random() * 9000)}`);
    setFormUserName("");
    setFormUserEmail("");
    setFormPlanTier("Free");
    setFormTokenLimitMillions("10");
    setFormRpmLimit("60");
    setFormIsBanned(false);
    setFormInitialByokKeysCount("0");
    setFormGenerateApiKey(false);
    setModelSearchQuery("");
    setModelFilterType("all");
    setFormError(null);
    setSelectedModelIds(allPipedItems.map((m) => m.id));
    setIsAddUserSheetOpen(true);
  };

  // Handler: Open Seed Test User Sheet (Pre-configured with 100M tokens per model & 30 RPM)
  const handleOpenSeedUser = () => {
    setIsSeedingMode(true);
    setFormUserId(`usr_pro_test_${Math.floor(1000 + Math.random() * 9000)}`);
    setFormUserName("Pro Test User");
    setFormUserEmail("pro.test@cheaproute.local");
    setFormPlanTier("Pro");
    const totalBudgetM = Math.max(allPipedItems.length * 100, 100);
    setFormTokenLimitMillions(String(totalBudgetM));
    setFormRpmLimit("30");
    setFormIsBanned(false);
    setFormInitialByokKeysCount("0");
    setFormGenerateApiKey(true);
    setModelSearchQuery("");
    setModelFilterType("all");
    setFormError(null);
    setSelectedModelIds(allPipedItems.map((m) => m.id));
    setIsAddUserSheetOpen(true);
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
      if (isSeedingMode) {
        const tokensPerModel = 100_000_000;
        const res = await fetch("/api/v1/reseller/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "seedUser",
            userId: formUserId.trim(),
            userName: formUserName.trim() || "Pro Test User",
            userEmail: formUserEmail.trim(),
            plan: formPlanTier.trim() || "Pro",
            tokenBudget: selectedModelIds.length * tokensPerModel,
            rpmLimit: formRpmLimit.trim() !== "" ? Number(formRpmLimit) : 30,
            selectedModelIds,
            tokensPerModel,
            generateApiKey: formGenerateApiKey,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || data.error || "Failed to seed user");
        }

        if (data.apiKey) {
          setGeneratedKeyResult({ key: data.apiKey, userId: formUserId.trim() });
          setShowKeyResultModal(true);
        }

        setIsAddUserSheetOpen(false);
        setIsSeedingMode(false);
        setFormUserId("");
        setFormUserName("");
        setFormUserEmail("");
        loadData();
        return;
      }

      const tokenBudget =
        formTokenLimitMillions.trim() !== "" ? Number(formTokenLimitMillions) * 1_000_000 : null;
      const rpmLimit = formRpmLimit.trim() !== "" ? Number(formRpmLimit) : null;

      const modelQuotas: Record<string, number> = {};
      selectedModelIds.forEach((id) => {
        modelQuotas[id] = -1;
      });

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
          isBanned: formIsBanned,
          modelQuotas,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to add user");
      }

      if (formGenerateApiKey) {
        try {
          const keyRes = await fetch("/api/v1/reseller/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: formUserId.trim(),
              userName: formUserName.trim() || formUserId.trim(),
              userEmail: formUserEmail.trim(),
              plan: formPlanTier.trim() || "Free",
              allowedModels: selectedModelIds,
              tokenBudget,
              rpmLimit,
            }),
          });
          const keyData = await keyRes.json();
          if (keyRes.ok && keyData.success && keyData.apiKey) {
            setGeneratedKeyResult({ key: keyData.apiKey, userId: formUserId.trim() });
            setShowKeyResultModal(true);
          }
        } catch (keyErr) {
          console.warn("User created, but API key creation had an issue:", keyErr);
        }
      }

      setIsAddUserSheetOpen(false);
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

  // Handler: Delete / Revoke User API Key
  const handleDeleteUserKey = async (id: number) => {
    if (!confirm("Are you sure you want to revoke and delete this API key?")) return;
    try {
      const res = await fetch(`/api/v1/reseller/users?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUserKeys((prev) => prev.filter((k) => k.id !== id));
        loadData();
      }
    } catch (e) {
      console.error("Failed to delete user key", e);
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsMetricsCollapsed(!isMetricsCollapsed)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main"
            title={isMetricsCollapsed ? "Expand Metrics Cards" : "Collapse Metrics Cards"}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMetricsCollapsed ? "visibility" : "visibility_off"}
            </span>
            {isMetricsCollapsed ? "Show Cards" : "Hide Cards"}
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenSeedUser}
            className="flex items-center gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold py-1.5"
            title="Seed Pro Test User with 100M tokens per piped model"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Seed Test User
          </Button>
          <Button onClick={handleOpenAddUser} className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Register User
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <Button size="sm" variant="ghost" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Unified View: Metrics, Filter & Table */}
      <div className="space-y-6">
        {/* Metrics Overview Cards (Collapsible) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Overview Metrics
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-surface-raised border border-border text-text-muted">
                8 Cards
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMetricsCollapsed(!isMetricsCollapsed)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text-main rounded-lg hover:bg-bg-subtle border border-transparent hover:border-border transition-all cursor-pointer"
              title={isMetricsCollapsed ? "Expand Metrics Cards" : "Collapse Metrics Cards"}
            >
              <span>{isMetricsCollapsed ? "Expand Cards" : "Collapse Cards"}</span>
              <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
                {isMetricsCollapsed ? "expand_more" : "expand_less"}
              </span>
            </button>
          </div>

          {!isMetricsCollapsed && (
            <div className="space-y-4">
              {/* Row 1: User Accounts & Quotas */}
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
                    <p className="text-xs text-text-muted">Total API Keys</p>
                    <p className="text-xl font-bold text-text-main">
                      {users.reduce((acc, u) => acc + (u.keysCount || 0), 0)}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Divider Line */}
              <div className="border-t border-border/70" />

              {/* Row 2: Providers & BYOK Ecosystem */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <span className="material-symbols-outlined text-[24px]">hub</span>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Allowed Providers</p>
                    <p className="text-xl font-bold text-text-main">
                      {publishedProviders.length > 0 ? publishedProviders.length : "All (370+)"}
                    </p>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <span className="material-symbols-outlined text-[24px]">cable</span>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Connected by Users</p>
                    <p className="text-xl font-bold text-text-main">{distinctByokProviders.length}</p>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <span className="material-symbols-outlined text-[24px]">key</span>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Attached BYOK Keys</p>
                    <p className="text-xl font-bold text-text-main">{byokKeys.length}</p>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined text-[24px]">check_circle</span>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Active BYOK Keys</p>
                    <p className="text-xl font-bold text-text-main">
                      {byokKeys.filter((b) => !b.isPaused).length}
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          )}
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
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
                <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                  <span className="material-symbols-outlined text-3xl">bolt</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-main">No Users Available</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Seed a default test user with 100 Million tokens allocated to each active piped model and combo (30 RPM limit), or manually register a custom account.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <Button
                    onClick={handleOpenSeedUser}
                    className="flex items-center gap-1.5 shadow-md font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    Seed Test User
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    Register User
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No Users Found"
                description={
                  searchQuery
                    ? "No users match your search query."
                    : "No users match the selected filters."
                }
                actionLabel={searchQuery ? "Clear Search" : undefined}
                onAction={searchQuery ? () => setSearchQuery("") : undefined}
              />
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-subtle/60 text-xs font-semibold text-text-muted">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 min-w-[200px]">Quota & Usage</th>
                    <th className="py-3 px-4 text-center">Keys & BYOK</th>
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
                        onClick={() => {
                          setSelectedUserForSheet(user);
                          setIsSheetOpen(true);
                        }}
                        className={`cursor-pointer hover:bg-bg-subtle/40 active:bg-bg-subtle/60 transition-colors ${
                          user.isBanned ? "bg-red-500/5 opacity-80" : ""
                        }`}
                      >
                        {/* Row # */}
                        <td className="py-3.5 px-3 text-center font-mono text-xs text-text-muted font-bold">
                          {index + 1}
                        </td>

                        {/* User: Name on top, UID pill underneath */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-text-main text-sm">
                              {user.name || "—"}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                {user.id}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Contact: Email / Phone */}
                        <td className="py-3.5 px-4">
                          <span
                            className="text-text-muted font-mono text-xs truncate max-w-[200px] block"
                            title={user.email || ""}
                          >
                            {user.email || "—"}
                          </span>
                        </td>

                        {/* Quota & Usage */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="space-y-1">
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

                            {user.tokenBudget ? (
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
                            ) : null}

                            <div className="flex items-center gap-2 pt-0.5">
                              {user.rpmLimit ? (
                                <span className="text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                                  {user.rpmLimit} RPM
                                </span>
                              ) : (
                                <span className="text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                                  Unlimited RPM
                                </span>
                              )}

                              {modelUsageCount > 0 && (
                                <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                                  <span className="material-symbols-outlined text-[12px]">
                                    analytics
                                  </span>
                                  {modelUsageCount} model{modelUsageCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Keys & BYOK Connected Providers */}
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const userByok = byokKeys.filter((b) => b.userId === user.id);
                            const pausedCount = userByok.filter((b) => b.isPaused).length;
                            const activeCount = userByok.length - pausedCount;
                            const distinctUserProviders = new Set(userByok.map((b) => b.providerId))
                              .size;

                            return (
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                {/* Connected BYOK Providers & Active/Paused Status */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10.5px] font-semibold text-zinc-300 tracking-tight leading-none">
                                    {userByok.length} BYOK ({distinctUserProviders}{" "}
                                    {distinctUserProviders === 1 ? "Prov" : "Provs"})
                                  </span>
                                  {userByok.length > 0 && (
                                    <span
                                      className={`text-[9.5px] px-1 py-0.5 rounded border font-medium leading-none ${
                                        pausedCount > 0
                                          ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                                      }`}
                                      title={`${activeCount} active, ${pausedCount} paused`}
                                    >
                                      {pausedCount > 0 ? `${pausedCount} paused` : `${activeCount} act`}
                                    </span>
                                  )}
                                </div>

                                {/* Keys Badge: smaller, compact Cupertino line design underneath */}
                                <span
                                  className={`h-[19px] px-2 text-[10.5px] font-medium tracking-tight rounded-[5px] border transition-all duration-150 inline-flex items-center justify-center gap-1.5 leading-none shadow-2xs ${
                                    user.keysCount > 0
                                      ? "bg-blue-500/10 text-blue-400 border-blue-500/35"
                                      : "bg-surface-raised/50 text-text-muted border-border/80"
                                  }`}
                                  title={`${user.keysCount} API ${user.keysCount === 1 ? "key" : "keys"} issued`}
                                >
                                  <svg
                                    className={`w-2.5 h-2.5 shrink-0 ${
                                      user.keysCount > 0 ? "text-blue-400" : "text-text-muted"
                                    }`}
                                    viewBox="0 0 14 14"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="5" cy="5" r="3" />
                                    <path d="M7.5 7.5L12 12M10 10l1.5-1.5" />
                                  </svg>
                                  <span>
                                    {user.keysCount} {user.keysCount === 1 ? "Key" : "Keys"}
                                  </span>
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status (Plan type in silver light color, Active/Banned in Cupertino line design badge) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {/* Plan type: Silver light color matching badge font size */}
                            <span
                              className={`text-[10.5px] font-semibold tracking-tight leading-none ${getPlanTextColor(
                                user.planTier
                              )}`}
                            >
                              {user.planTier || "Free"}
                            </span>

                            {/* Active vs Banned toggle: Cupertino line design badge */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleBan(user);
                              }}
                              title={user.isBanned ? "Click to Activate User" : "Click to Ban User"}
                              className={`h-[19px] px-2 text-[10.5px] font-medium tracking-tight rounded-[5px] border transition-all duration-150 inline-flex items-center justify-center gap-1.5 leading-none shadow-2xs active:scale-95 ${
                                user.isBanned
                                  ? "bg-red-500/10 text-red-400 border-red-500/35 hover:bg-red-500/20 hover:border-red-500/50"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                              }`}
                            >
                              {user.isBanned ? (
                                <svg
                                  className="w-2.5 h-2.5 text-red-400 shrink-0"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="4" y1="4" x2="10" y2="10" />
                                  <line x1="10" y1="4" x2="4" y2="10" />
                                </svg>
                              ) : (
                                <svg
                                  className="w-2.5 h-2.5 text-emerald-400 shrink-0"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 7.5 5.5 10 11 4.5" />
                                </svg>
                              )}
                              <span>{user.isBanned ? "Banned" : "Active"}</span>
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Edit User */}
                            <button
                              onClick={() => handleOpenEditUser(user)}
                              title="Edit User & Quotas"
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
                              <span className="material-symbols-outlined text-[18px]">delete</span>
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

      {/* CUPERTINO iOS SLIDE-OVER SHEET: REGISTER / ADD USER */}
      {isAddUserSheetOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300"
          onClick={() => setIsAddUserSheetOpen(false)}
        />
      )}

      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 w-[90vw] sm:w-[500px] md:w-[560px] max-w-full bg-bg-card border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isAddUserSheetOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-label="User Registration Sheet"
      >
        {/* Header: Title, subtitle & Top-Right Close Button */}
        <div className="p-4 border-b border-border bg-bg-card/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                isSeedingMode
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "bg-primary/10 border border-primary/20 text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSeedingMode ? "bolt" : "person_add"}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-main truncate">
                {isSeedingMode ? "Seed Pro Test User" : "Register New User"}
              </h2>
              <p className="text-xs text-text-muted truncate">
                {isSeedingMode
                  ? "⚡ Pre-allocated 100M Tokens per Active Model & Combo"
                  : "Cupertino iOS Account & Model Provisioning"}
              </p>
            </div>
          </div>

          {/* Top-Right Circular Close Button */}
          <button
            type="button"
            onClick={() => setIsAddUserSheetOpen(false)}
            className="size-8 rounded-full bg-surface-raised hover:bg-border/60 text-text-muted hover:text-text-main flex items-center justify-center transition-colors shrink-0"
            title="Close Sheet"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleAddUserSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Quick Seeding Banner */}
            {isSeedingMode && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-text-main text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Instant Test User Provisioning</span>
                </div>
                <p className="text-text-muted text-[11px] leading-relaxed">
                  Automatically grants <strong>100 Million tokens</strong> to each of the{" "}
                  <strong>{selectedModelIds.length}</strong> active piped models &amp; combos, sets a{" "}
                  <strong>30 RPM</strong> rate limit, and issues an active native API key for instant
                  testing in the Playground.
                </p>
              </div>
            )}

            {/* Section 1: User Identity */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                User Identity
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* User ID (UID) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-muted">
                      User ID (UID) <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormUserId(`usr_${Math.floor(1000 + Math.random() * 9000)}`)
                      }
                      className="text-[11px] text-primary hover:underline font-mono"
                    >
                      Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. usr_1001"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Full Name */}
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
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Email / Phone */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Email or Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hasan@example.com / +92 300 1234567"
                    value={formUserEmail}
                    onChange={(e) => setFormUserEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Account Status & Initial BYOK */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                Account Status &amp; BYOK
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* Approval / Status Segmented Switch */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Account Status &amp; Approval
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-bg-subtle rounded-xl border border-border/80 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormIsBanned(false)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        !formIsBanned
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-emerald-400" />
                      Approved (Active)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormIsBanned(true)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        formIsBanned
                          ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-red-400" />
                      Disapproved (Banned)
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 px-1">
                    {!formIsBanned
                      ? "User is approved to route queries and access assigned piped models."
                      : "User is suspended; incoming requests will be rejected immediately."}
                  </p>
                </div>

                {/* Initial BYOK Keys Count (default 0) */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Initial BYOK Keys Count
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        value={formInitialByokKeysCount}
                        onChange={(e) => setFormInitialByokKeysCount(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <span className="px-2.5 py-1.5 text-xs rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                      Slots Allotted
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 px-1">
                    Default keys count is 0. BYOK provider keys can be attached anytime after
                    registration.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Plan Tier & Quota Limits */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                Plan Tier &amp; Limits
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* Plan Type Description */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Plan Type Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Free, Pro Plan, VIP, Enterprise"
                    value={formPlanTier}
                    onChange={(e) => setFormPlanTier(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors mb-2"
                  />
                  {/* Quick preset chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {["Free", "Pro Plan", "VIP", "Enterprise", "Unlimited Quota"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormPlanTier(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          formPlanTier.toLowerCase() === preset.toLowerCase()
                            ? "bg-primary text-white border-primary font-semibold shadow-xs"
                            : "bg-bg-subtle border-border/80 text-text-muted hover:text-text-main"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Token Budget & RPM Limits */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Token Budget (Millions)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 10 (or empty for unlim)"
                      value={formTokenLimitMillions}
                      onChange={(e) => setFormTokenLimitMillions(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-[10px] text-text-muted px-1 mt-0.5 block">
                      {formTokenLimitMillions ? `${formTokenLimitMillions}M Tokens` : "Unlimited"}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      RPM Limit
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 60 (or empty for unlim)"
                      value={formRpmLimit}
                      onChange={(e) => setFormRpmLimit(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-[10px] text-text-muted px-1 mt-0.5 block">
                      {formRpmLimit ? `${formRpmLimit} req/min` : "Unlimited"}
                    </span>
                  </div>
                </div>

                {/* Optional: Generate API Key */}
                <div className="pt-2 border-t border-border/60">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-text-main">
                    <input
                      type="checkbox"
                      checked={formGenerateApiKey}
                      onChange={(e) => setFormGenerateApiKey(e.target.checked)}
                      className="size-4 rounded text-primary border-border focus:ring-primary/40"
                    />
                    <span className="font-medium">
                      Generate native API Key immediately on registration
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Piped AI Models & Combos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase">
                  Piped AI Models &amp; Combos ({selectedModelIds.length}/{allPipedItems.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedModelIds(allPipedItems.map((m) => m.id))}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedModelIds([])}
                    className="text-[11px] text-text-muted hover:text-text-main font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* Search & Type Filter Tabs */}
                <div className="space-y-2">
                  <div className="relative">
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute left-3 top-2.5">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search piped models, combos, providers..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    {modelSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setModelSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>

                  {/* Filter chips: All / Combos / Curated Models */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setModelFilterType("all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        modelFilterType === "all"
                          ? "bg-primary text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      All ({allPipedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelFilterType("combos")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        modelFilterType === "combos"
                          ? "bg-amber-500 text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      Combos ({availableModelsData.combos?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelFilterType("models")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        modelFilterType === "models"
                          ? "bg-blue-500 text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      Curated Models ({availableModelsData.models?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Scrollable list of models */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {filteredPipedItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-text-muted">
                      No piped models or combos match &quot;{modelSearchQuery}&quot;
                    </div>
                  ) : (
                    filteredPipedItems.map((item) => {
                      const isSelected = selectedModelIds.includes(item.id);
                      return (
                        <div
                          key={`${item.type}_${item.id}`}
                          onClick={() => {
                            setSelectedModelIds((prev) =>
                              isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-primary/5 border-primary/30 shadow-xs"
                              : "bg-bg-subtle/40 border-border/50 hover:border-border hover:bg-bg-subtle/80 opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* iOS style checkbox indicator */}
                            <div
                              className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-primary text-white"
                                  : "border border-border/80 bg-surface-raised"
                              }`}
                            >
                              {isSelected && (
                                <span className="material-symbols-outlined text-[15px] font-bold">
                                  check
                                </span>
                              )}
                            </div>

                            {/* Icon */}
                            {item.type === "combo" ? (
                              <div className="size-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[15px]">
                                  shuffle
                                </span>
                              </div>
                            ) : (
                              <div className="size-6 rounded-lg bg-bg-card border border-border flex items-center justify-center shrink-0">
                                <ProviderIcon providerId={item.providerId || "openai"} size={14} />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-text-main truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] font-mono text-text-muted truncate">
                                {item.id}
                              </div>
                            </div>
                          </div>

                          {/* Right: Type Badge */}
                          <div className="shrink-0">
                            {item.type === "combo" ? (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Combo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                                {item.providerId || "Model"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cupertino Sticky Bottom Bar with Close Button on Bottom-Right */}
          <div className="p-3.5 border-t border-border bg-bg-card/95 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => setIsAddUserSheetOpen(false)}
              disabled={isSubmitting}
              className="text-xs text-text-muted hover:text-text-main px-2 py-1 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {/* Save User Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 px-4 text-xs font-semibold ${
                  isSeedingMode ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                    {isSeedingMode ? "Seeding User..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">
                      {isSeedingMode ? "bolt" : "how_to_reg"}
                    </span>
                    {isSeedingMode ? "Seed Pro Test User (100M/Model)" : "Save User"}
                  </>
                )}
              </Button>

              {/* Bottom-Right Close Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddUserSheetOpen(false)}
                className="flex items-center gap-1 px-3.5 text-xs font-semibold bg-surface-raised hover:bg-border/60 text-text-main border border-border rounded-xl transition-all shadow-xs"
                title="Close Registration Sheet"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </Button>
            </div>
          </div>
        </form>
      </aside>

      {/* CUPERTINO iOS SLIDE-OVER SHEET: EDIT USER */}
      {isEditUserSheetOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300"
          onClick={() => setIsEditUserSheetOpen(false)}
        />
      )}

      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 w-[90vw] sm:w-[500px] md:w-[560px] max-w-full bg-bg-card border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isEditUserSheetOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-label="Edit User Sheet"
      >
        {/* Header: Title, subtitle & Top-Right Close Button */}
        <div className="p-4 border-b border-border bg-bg-card/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-main truncate">
                Edit User — {editUserName || editUserId}
              </h2>
              <p className="text-xs text-text-muted truncate">
                Cupertino iOS Account &amp; Model Provisioning
              </p>
            </div>
          </div>

          {/* Top-Right Circular Close Button */}
          <button
            type="button"
            onClick={() => setIsEditUserSheetOpen(false)}
            className="size-8 rounded-full bg-surface-raised hover:bg-border/60 text-text-muted hover:text-text-main flex items-center justify-center transition-colors shrink-0"
            title="Close Sheet"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveEditUser} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {editUserError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                <span>{editUserError}</span>
              </div>
            )}

            {/* Section 1: User Identity */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                User Identity
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    User ID (UID)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={editUserId}
                    className="w-full px-3 py-2 text-sm font-mono bg-bg-subtle/50 border border-border/70 rounded-xl text-text-muted cursor-not-allowed select-all"
                  />
                  <span className="text-[10px] text-text-muted px-1 mt-0.5 block">
                    Unique identifier cannot be modified.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    User Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hasan Ali"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Email or Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hasan@example.com / +92 300 1234567"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Account Status & BYOK Overview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                Account Status &amp; BYOK
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* Approval / Status Segmented Switch */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Account Status &amp; Approval
                  </label>
                  <div className="grid grid-cols-2 p-1 bg-bg-subtle rounded-xl border border-border/80 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditIsBanned(false)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        !editIsBanned
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-emerald-400" />
                      Approved (Active)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsBanned(true)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        editIsBanned
                          ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-red-400" />
                      Disapproved (Banned)
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 px-1">
                    {!editIsBanned
                      ? "User is approved to route traffic through assigned models."
                      : "User is suspended; incoming requests will return a banned response."}
                  </p>
                </div>

                {/* BYOK Keys Summary */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-subtle/60 border border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-purple-400">key</span>
                    <div>
                      <div className="text-xs font-semibold text-text-main">
                        {selectedUserForEdit?.keysCount || 0} API Keys Issued
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {byokKeys.filter((b) => b.userId === editUserId).length} BYOK Providers Connected
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUserForEdit) {
                        setSelectedUserForSheet(selectedUserForEdit);
                        setIsSheetOpen(true);
                      }
                    }}
                    className="text-[11px] text-purple-400 hover:underline font-medium"
                  >
                    View Keys &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Plan Tier & Quota Limits */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase px-1">
                Plan Tier &amp; Limits
              </span>
              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Plan Type Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Free, Pro Plan, VIP, Enterprise"
                    value={editPlanTier}
                    onChange={(e) => setEditPlanTier(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["Free", "Pro Plan", "VIP", "Enterprise", "Unlimited Quota"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditPlanTier(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          editPlanTier.toLowerCase() === preset.toLowerCase()
                            ? "bg-primary text-white border-primary font-semibold shadow-xs"
                            : "bg-bg-subtle border-border/80 text-text-muted hover:text-text-main"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Token Budget (Millions)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 50 (or empty for unlim)"
                      value={editTokenLimitMillions}
                      onChange={(e) => setEditTokenLimitMillions(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-[10px] text-text-muted px-1 mt-0.5 block">
                      {editTokenLimitMillions ? `${editTokenLimitMillions}M Tokens` : "Unlimited"}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      RPM Limit
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 60 (or empty for unlim)"
                      value={editRpmLimit}
                      onChange={(e) => setEditRpmLimit(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-[10px] text-text-muted px-1 mt-0.5 block">
                      {editRpmLimit ? `${editRpmLimit} req/min` : "Unlimited"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-text-main">
                    <input
                      type="checkbox"
                      checked={editResetUsage}
                      onChange={(e) => setEditResetUsage(e.target.checked)}
                      className="size-4 rounded text-amber-500 border-border focus:ring-amber-500/40"
                    />
                    <span className="font-medium text-amber-400">
                      Reset token usage counter back to 0
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Allowed Piped AI Models & Combos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase">
                  Allowed Piped Models &amp; Combos ({editSelectedModelIds.length}/{allPipedItems.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditSelectedModelIds(allPipedItems.map((m) => m.id))}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-text-muted text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setEditSelectedModelIds([])}
                    className="text-[11px] text-text-muted hover:text-text-main font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="bg-surface-raised/40 border border-border/70 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
                {/* Search & Type Filter Tabs */}
                <div className="space-y-2">
                  <div className="relative">
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute left-3 top-2.5">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search piped models, combos, providers..."
                      value={editModelSearchQuery}
                      onChange={(e) => setEditModelSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-bg-subtle/80 border border-border rounded-xl text-text-main focus:outline-none focus:border-primary transition-colors"
                    />
                    {editModelSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEditModelSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditModelFilterType("all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        editModelFilterType === "all"
                          ? "bg-primary text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      All ({allPipedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditModelFilterType("combos")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        editModelFilterType === "combos"
                          ? "bg-amber-500 text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      Combos ({availableModelsData.combos?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditModelFilterType("models")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        editModelFilterType === "models"
                          ? "bg-blue-500 text-white"
                          : "bg-bg-subtle text-text-muted hover:text-text-main border border-border/60"
                      }`}
                    >
                      Curated Models ({availableModelsData.models?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {editFilteredPipedItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-text-muted">
                      No piped models or combos match &quot;{editModelSearchQuery}&quot;
                    </div>
                  ) : (
                    editFilteredPipedItems.map((item) => {
                      const isSelected = editSelectedModelIds.includes(item.id);
                      return (
                        <div
                          key={`edit_${item.type}_${item.id}`}
                          onClick={() => {
                            setEditSelectedModelIds((prev) =>
                              isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-primary/5 border-primary/30 shadow-xs"
                              : "bg-bg-subtle/40 border-border/50 hover:border-border hover:bg-bg-subtle/80 opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-primary text-white"
                                  : "border border-border/80 bg-surface-raised"
                              }`}
                            >
                              {isSelected && (
                                <span className="material-symbols-outlined text-[15px] font-bold">
                                  check
                                </span>
                              )}
                            </div>

                            {item.type === "combo" ? (
                              <div className="size-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[15px]">shuffle</span>
                              </div>
                            ) : (
                              <div className="size-6 rounded-lg bg-bg-card border border-border flex items-center justify-center shrink-0">
                                <ProviderIcon providerId={item.providerId || "openai"} size={14} />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-text-main truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] font-mono text-text-muted truncate">
                                {item.id}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {item.type === "combo" ? (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Combo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                                {item.providerId || "Model"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cupertino Sticky Bottom Bar with Close Button on Bottom-Right */}
          <div className="p-3.5 border-t border-border bg-bg-card/95 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => setIsEditUserSheetOpen(false)}
              disabled={isUpdatingUser}
              className="text-xs text-text-muted hover:text-text-main px-2 py-1 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={isUpdatingUser}
                className="flex items-center gap-1.5 px-4 text-xs font-semibold"
              >
                {isUpdatingUser ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Changes
                  </>
                )}
              </Button>

              {/* Bottom-Right Close Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => setIsEditUserSheetOpen(false)}
                className="flex items-center gap-1 px-3.5 text-xs font-semibold bg-surface-raised hover:bg-border/60 text-text-main border border-border rounded-xl transition-all shadow-xs"
                title="Close Edit Sheet"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </Button>
            </div>
          </div>
        </form>
      </aside>

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
              <strong className="text-text-main">
                {formatTokens(selectedUserForUsage?.tokenBudget || null)}
              </strong>
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

      {/* Cupertino iOS Slide-over Sheet Backdrop */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300"
          onClick={() => setIsSheetOpen(false)}
        />
      )}

      {/* Cupertino iOS Slide-over Sheet Drawer */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 w-[90vw] sm:w-[480px] md:w-[520px] max-w-full bg-bg-card border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSheetOpen && activeSheetUser ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-label="User Details Sheet"
      >
        {activeSheetUser && (
          <>
            {/* Header: User avatar, Name, Plan badge & Top-Right Close Button */}
            <div className="p-4 border-b border-border bg-bg-card/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {(activeSheetUser.name || activeSheetUser.id).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-text-main truncate">
                      {activeSheetUser.name || "Unnamed User"}
                    </h2>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getPlanBadgeClass(
                        activeSheetUser.planTier
                      )}`}
                    >
                      {activeSheetUser.planTier || "Free"}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-mono truncate">
                    {activeSheetUser.email || "No email / phone"}
                  </p>
                </div>
              </div>

              {/* Top-Right Circular Close Button */}
              <button
                onClick={() => setIsSheetOpen(false)}
                className="size-8 rounded-full bg-surface-raised hover:bg-border/60 text-text-muted hover:text-text-main flex items-center justify-center transition-colors shrink-0"
                title="Close Sheet"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Sub-strip: UID & Joined Date */}
            <div className="px-4 py-2 bg-bg-subtle/50 border-b border-border/60 flex items-center justify-between text-[11px] font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <span>UID:</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                  {activeSheetUser.id}
                </span>
              </div>
              <div>
                Joined:{" "}
                {activeSheetUser.createdAt
                  ? new Date(activeSheetUser.createdAt).toLocaleDateString()
                  : "—"}
              </div>
            </div>

            {/* Cupertino Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {/* 1. Account Status & Ban Switch */}
              <div className="p-3.5 rounded-2xl bg-bg-subtle/40 border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-text-muted">
                      shield_person
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-text-main">Account Status</div>
                      <div className="text-[11px] text-text-muted">
                        {activeSheetUser.isBanned
                          ? "Account is suspended and blocked from API requests"
                          : "Account is active and permitted to use the API"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleBan(activeSheetUser)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                      activeSheetUser.isBanned
                        ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {activeSheetUser.isBanned ? "block" : "check_circle"}
                    </span>
                    {activeSheetUser.isBanned ? "Banned" : "Active"}
                  </button>
                </div>
              </div>

              {/* 2. Plan & Token Pool Quotas */}
              <div className="p-3.5 rounded-2xl bg-bg-subtle/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">
                      data_usage
                    </span>
                    <span className="text-xs font-semibold text-text-main">
                      Plan & Token Pool Limit
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getPlanBadgeClass(
                      activeSheetUser.planTier
                    )}`}
                  >
                    {activeSheetUser.planTier || "Free"}
                  </span>
                </div>

                {/* Token Progress Bar & Numbers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Tokens Consumed</span>
                    <span className="font-mono font-semibold text-text-main">
                      {((activeSheetUser.tokensUsed || 0) / 1_000_000).toFixed(2)}M /{" "}
                      {activeSheetUser.tokenBudget
                        ? `${(activeSheetUser.tokenBudget / 1_000_000).toFixed(1)}M`
                        : "Unlimited"}
                    </span>
                  </div>

                  {activeSheetUser.tokenBudget ? (
                    <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden border border-border">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (activeSheetUser.tokensUsed / activeSheetUser.tokenBudget) * 100 >= 90
                            ? "bg-red-500"
                            : (activeSheetUser.tokensUsed / activeSheetUser.tokenBudget) * 100 >= 75
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeSheetUser.tokensUsed / activeSheetUser.tokenBudget) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-text-muted">
                    <div className="p-2 rounded-xl bg-bg-card border border-border/60">
                      <div className="text-[10px] text-text-muted">Remaining Tokens</div>
                      <div className="font-semibold text-text-main font-mono text-xs mt-0.5">
                        {activeSheetUser.tokenBudget
                          ? `${Math.max(
                              0,
                              (activeSheetUser.tokenBudget - activeSheetUser.tokensUsed) / 1_000_000
                            ).toFixed(2)}M`
                          : "Unlimited Pool"}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-bg-card border border-border/60">
                      <div className="text-[10px] text-text-muted">Rate Limit</div>
                      <div className="font-semibold text-text-main font-mono text-xs mt-0.5">
                        {activeSheetUser.rpmLimit
                          ? `${activeSheetUser.rpmLimit} RPM`
                          : "Unlimited RPM"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Models & Quotas Breakdown */}
              <div className="p-3.5 rounded-2xl bg-bg-subtle/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-400">
                      psychology
                    </span>
                    <span className="text-xs font-semibold text-text-main">
                      Plan Models & Quota Usage
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted font-mono">
                    {activeSheetUser.modelUsage?.length || 0} active
                  </span>
                </div>

                {activeSheetUser.modelUsage && activeSheetUser.modelUsage.length > 0 ? (
                  <div className="rounded-xl border border-border/70 overflow-hidden divide-y divide-border/60 bg-bg-card">
                    {activeSheetUser.modelUsage.map((m, i) => {
                      const specificQuota = activeSheetUser.modelQuotas?.[m.model];
                      return (
                        <div
                          key={i}
                          className="p-2.5 flex items-center justify-between text-xs hover:bg-bg-subtle/40 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-mono font-medium text-text-main truncate">
                              {m.model}
                            </div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5">
                              <span>{m.requests} reqs</span>
                              <span>•</span>
                              <span>
                                Last:{" "}
                                {m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleDateString() : "—"}
                              </span>
                              {specificQuota ? (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-semibold">
                                    Quota: {(specificQuota / 1_000_000).toFixed(1)}M
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-amber-400 text-xs">
                              {(m.tokensUsed / 1_000_000).toFixed(3)}M
                            </div>
                            <div className="text-[10px] text-text-muted">tokens</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-dashed border-border/80 text-center text-xs text-text-muted bg-bg-card/50">
                    No specific model usage recorded yet. User draws from the shared token pool for
                    all models permitted under the <strong>{activeSheetUser.planTier}</strong> tier.
                  </div>
                )}
              </div>

              {/* 4. API Keys */}
              <div className="p-3.5 rounded-2xl bg-bg-subtle/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-blue-400">
                      vpn_key
                    </span>
                    <span className="text-xs font-semibold text-text-main">Issued API Keys</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {activeUserKeys.length} issued
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIssueKeyForUser(activeSheetUser)}
                      className="text-xs text-primary border-primary/30 h-7 px-2.5 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Issue Key
                    </Button>
                  </div>
                </div>

                {activeUserKeys.length > 0 ? (
                  <div className="space-y-2">
                    {activeUserKeys.map((k) => (
                      <div
                        key={k.id}
                        className="p-3 rounded-xl bg-bg-card border border-border/80 hover:border-border transition-colors space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 truncate">
                              {k.apiKey.length > 20
                                ? `${k.apiKey.slice(0, 10)}...${k.apiKey.slice(-6)}`
                                : k.apiKey}
                            </code>
                            <button
                              onClick={() => copy(k.apiKey, `key_${k.id}`)}
                              title="Copy API Key"
                              className="text-text-muted hover:text-text-main transition-colors shrink-0"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {copied === `key_${k.id}` ? "check" : "content_copy"}
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-text-muted">
                              {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "—"}
                            </span>
                            <button
                              onClick={() => handleDeleteUserKey(k.id)}
                              title="Revoke / Delete this API key"
                              className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Model & Limit Scope Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {k.allowedModels && k.allowedModels.length > 0 ? (
                            <span
                              className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium truncate max-w-[220px]"
                              title={`Allowed: ${k.allowedModels.join(", ")}`}
                            >
                              {k.allowedModels.length} Model{k.allowedModels.length > 1 ? "s" : ""}: {k.allowedModels.slice(0, 2).join(", ")}{k.allowedModels.length > 2 ? "..." : ""}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              All Piped Models &amp; Combos
                            </span>
                          )}

                          {k.tokenBudget ? (
                            <span className="px-2 py-0.5 rounded-md bg-surface-raised border border-border text-text-muted">
                              {(k.tokenBudget / 1_000_000).toFixed(1)}M Budget
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-surface-raised border border-border text-text-muted">
                              Pool Budget
                            </span>
                          )}

                          {k.rpmLimit ? (
                            <span className="px-2 py-0.5 rounded-md bg-surface-raised border border-border text-text-muted">
                              {k.rpmLimit} RPM
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-surface-raised border border-border text-text-muted">
                              Unlimited RPM
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-dashed border-border/80 text-center text-xs text-text-muted bg-bg-card/50">
                    <p>No native API keys issued yet. Click &quot;Issue Key&quot; to generate an active key.</p>
                  </div>
                )}
              </div>

              {/* 5. Connected BYOK Providers */}
              <div className="p-3.5 rounded-2xl bg-bg-subtle/40 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-purple-400">
                      hub
                    </span>
                    <span className="text-xs font-semibold text-text-main">BYOK Providers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted font-mono">
                      {activeUserByokKeys.length} connected
                    </span>
                  </div>
                </div>

                {activeUserByokKeys.length > 0 ? (
                  <div className="space-y-2">
                    {activeUserByokKeys.map((k) => (
                      <div
                        key={k.id}
                        className="p-3 rounded-xl bg-bg-card border border-border/80 hover:border-border transition-colors flex items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Left: Provider Thumbnail + Title & Key */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="size-9 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                            <ProviderIcon providerId={k.providerId} className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-text-main text-xs capitalize truncate">
                              {k.providerId}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-[11px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded border border-border/60 truncate max-w-[160px]">
                                {k.maskedKey}
                              </code>
                              <button
                                onClick={() => copy(k.maskedKey, `sheet_byok_${k.id}`)}
                                title="Copy Key"
                                className="text-text-muted hover:text-text-main transition-colors shrink-0"
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {copied === `sheet_byok_${k.id}` ? "check" : "content_copy"}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right: Date on top, Status (Active/Paused) underneath */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[10px] text-text-muted">
                            {k.createdAt
                              ? new Date(k.createdAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </span>
                          <button
                            onClick={() => handleToggleByokPause(k)}
                            title={k.isPaused ? "Click to Activate" : "Click to Pause"}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all inline-flex items-center gap-1 ${
                              k.isPaused
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            }`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {k.isPaused ? "Paused" : "Active (On)"}
                          </button>
                        </div>

                        {/* Delete action */}
                        <button
                          onClick={() => handleDeleteByokKey(k.id)}
                          title="Delete BYOK key"
                          className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-dashed border-border/80 text-center text-xs text-text-muted bg-bg-card/50">
                    <p>No BYOK providers connected yet for this user.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cupertino Sticky Bottom Bar with Close Button on Bottom-Right */}
            <div className="p-3 border-t border-border bg-bg-card/90 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-10">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEditUser(activeSheetUser)}
                  className="text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">manage_accounts</span>
                  Edit User
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleIssueKeyForUser(activeSheetUser)}
                  className="text-xs flex items-center gap-1 text-primary border-primary/30"
                >
                  <span className="material-symbols-outlined text-[15px]">key</span>
                  Issue Key
                </Button>
              </div>
              {/* Bottom-Right Close Button */}
              <Button
                size="sm"
                onClick={() => setIsSheetOpen(false)}
                className="flex items-center gap-1 px-3.5 text-xs font-semibold bg-surface-raised hover:bg-border/60 text-text-main border border-border rounded-xl transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
