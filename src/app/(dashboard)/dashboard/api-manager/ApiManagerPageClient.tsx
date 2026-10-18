"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button, Input, Modal, ShimmerPageLoader } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { matchesSearch } from "@/shared/utils/turkishText";
import { extractApiErrorMessage } from "@/shared/http/apiErrorMessage";

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  isActive?: boolean;
  isBanned?: boolean;
}

type StatusFilter = "all" | "active" | "paused";

export default function ApiManagerPageClient() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Create Key modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userNameInput, setUserNameInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [keyNameInput, setKeyNameInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Success modal after creating key
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyItem | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status toggle loading state
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Clipboard copy
  const { copied, copy } = useCopyToClipboard();

  // Fetch API keys
  const fetchKeys = useCallback(() => {
    fetch("/api/keys")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch keys: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setKeys(Array.isArray(data.keys) ? data.keys : []);
      })
      .catch((err) => {
        console.error("Error loading API keys:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Copy API key handler with reveal support
  const handleCopyKey = async (item: ApiKeyItem) => {
    const copyId = `key_${item.id}`;
    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(item.id)}/reveal`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.key === "string") {
          await copy(data.key, copyId);
          return;
        }
      }
    } catch {
      // Fallback below
    }
    await copy(item.key, copyId);
  };

  // Toggle active / paused status
  const handleToggleStatus = async (item: ApiKeyItem) => {
    const nextStatus = item.isActive === false; // If currently paused (false), new status is active (true)
    setUpdatingStatusId(item.id);

    // Optimistic update
    setKeys((prev) =>
      prev.map((k) => (k.id === item.id ? { ...k, isActive: nextStatus } : k))
    );

    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }
    } catch (err) {
      console.error("Error updating key status:", err);
      // Revert optimistic update
      setKeys((prev) =>
        prev.map((k) => (k.id === item.id ? { ...k, isActive: !nextStatus } : k))
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Delete key handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, "Failed to delete API key"));
      }

      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error deleting key");
    } finally {
      setIsDeleting(false);
    }
  };

  // Create key handler
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserName = userNameInput.trim();
    if (!finalUserName) {
      setCreateError("User Name is required");
      return;
    }

    const finalUserId = userIdInput.trim() || finalUserName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const finalKeyName = keyNameInput.trim() || `${finalUserName}'s Key`;

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalKeyName,
          userName: finalUserName,
          userId: finalUserId,
          scopes: ["self:usage"],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errorData, "Failed to create API key"));
      }

      const created = await res.json();
      const newKeyItem: ApiKeyItem = {
        id: created.id,
        name: created.name || finalKeyName,
        key: created.key,
        userId: created.userId || finalUserId,
        userName: created.userName || finalUserName,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      setKeys((prev) => [newKeyItem, ...prev]);
      setIsCreateModalOpen(false);
      setUserNameInput("");
      setUserIdInput("");
      setKeyNameInput("");
      setNewlyCreatedKey(newKeyItem);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error creating key");
    } finally {
      setIsCreating(false);
    }
  };

  // Format date nicely
  const formatDate = (isoString: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  // Count metrics for filters
  const counts = useMemo(() => {
    let active = 0;
    let paused = 0;
    for (const k of keys) {
      if (k.isActive === false || k.isBanned === true) {
        paused += 1;
      } else {
        active += 1;
      }
    }
    return { all: keys.length, active, paused };
  }, [keys]);

  // Filter keys by status & search query
  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      // 1. Status Filter
      if (statusFilter === "active") {
        if (k.isActive === false || k.isBanned === true) return false;
      } else if (statusFilter === "paused") {
        if (k.isActive !== false && k.isBanned !== true) return false;
      }

      // 2. Search Query (User ID, User Name, API Key, Key Name)
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        const matchesUser = matchesSearch(k.userName || "", query);
        const matchesUid = matchesSearch(k.userId || "", query);
        const matchesKey = matchesSearch(k.key || "", query);
        const matchesName = matchesSearch(k.name || "", query);
        if (!matchesUser && !matchesUid && !matchesKey && !matchesName) {
          return false;
        }
      }

      return true;
    });
  }, [keys, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              API Keys
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
              {counts.all} {counts.all === 1 ? "key" : "keys"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your generated API keys, view owners, monitor status, and toggle pause/resume.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Generate Key
        </Button>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by User Name, User ID, or API Key..."
            className="w-full pl-10 pr-9 py-2 text-sm rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-800/40 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "all"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "active"
                ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active ({counts.active})
          </button>
          <button
            onClick={() => setStatusFilter("paused")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "paused"
                ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Paused ({counts.paused})
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <ShimmerPageLoader />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <span className="material-symbols-outlined text-2xl">vpn_key_off</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {searchQuery ? "No matching API keys found" : "No API keys created yet"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {searchQuery
                ? "Try searching with a different user name, ID, or clear the search query."
                : "Generate your first API key using the button above to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/60 dark:bg-zinc-800/40 text-[11px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[180px]">User</th>
                  <th className="py-3 px-4 min-w-[220px]">API Key</th>
                  <th className="py-3 px-4 min-w-[140px]">Created Date</th>
                  <th className="py-3 px-4 min-w-[130px]">Status</th>
                  <th className="py-3 px-4 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                {filteredKeys.map((item, index) => {
                  const isKeyActive = item.isActive !== false && !item.isBanned;
                  const isUpdating = updatingStatusId === item.id;
                  const isCopied = copied === `key_${item.id}`;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* # Index */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        {index + 1}
                      </td>

                      {/* User (Name + ID) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-zinc-400">
                              account_circle
                            </span>
                            {item.userName || item.name || "Default User"}
                          </span>
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                              <span className="text-[10px] text-zinc-400">UID:</span>
                              {item.userId || item.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* API Key + Copy Button */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/60 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="select-all tracking-wider font-mono">
                            {item.key}
                          </span>
                          <button
                            onClick={() => handleCopyKey(item)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors shrink-0"
                            title="Copy API Key"
                            aria-label="Copy API Key"
                          >
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                isCopied ? "text-emerald-500 font-bold" : ""
                              }`}
                            >
                              {isCopied ? "check" : "content_copy"}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Status (Pause / Resume Button) */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                            isKeyActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 dark:hover:bg-emerald-950/70"
                              : "bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 dark:hover:bg-amber-950/70"
                          } ${isUpdating ? "opacity-50 cursor-wait" : ""}`}
                          title={isKeyActive ? "Click to Pause key" : "Click to Resume key"}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isKeyActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                          <span>{isKeyActive ? "Active" : "Paused"}</span>
                          <span className="material-symbols-outlined text-[14px] ml-0.5">
                            {isKeyActive ? "pause" : "play_arrow"}
                          </span>
                        </button>
                      </td>

                      {/* Actions (Delete Button) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800/50"
                          title="Delete API Key"
                          aria-label="Delete API Key"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          title="Delete API Key"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to permanently delete the API key for{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {deleteTarget.userName || deleteTarget.name}
              </strong>
              ? Any clients using this key will immediately be denied access.
            </p>

            {deleteError && (
              <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                {isDeleting ? "Deleting..." : "Delete Key"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Key Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isCreating) {
              setIsCreateModalOpen(false);
              setCreateError(null);
            }
          }}
          title="Generate New API Key"
        >
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                User Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
                placeholder="e.g. Hasan Ali"
                required
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                User ID <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="e.g. user_101 (defaults to formatted name)"
                className="w-full text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Key Label / Purpose <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={keyNameInput}
                onChange={(e) => setKeyNameInput(e.target.value)}
                placeholder="e.g. Production API Key"
                className="w-full text-sm"
              />
            </div>

            {createError && (
              <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <Button
                variant="secondary"
                disabled={isCreating}
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isCreating}>
                {isCreating ? "Generating..." : "Generate Key"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Newly Created Key Modal */}
      {newlyCreatedKey && (
        <Modal
          isOpen={true}
          onClose={() => setNewlyCreatedKey(null)}
          title="API Key Generated Successfully"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Your new key for{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {newlyCreatedKey.userName}
              </strong>{" "}
              (UID: <span className="font-mono text-xs">{newlyCreatedKey.userId}</span>) is ready:
            </p>

            <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <input
                type="text"
                readOnly
                value={newlyCreatedKey.key}
                className="flex-1 bg-transparent font-mono text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none select-all"
              />
              <Button
                variant="secondary"
                onClick={() => copy(newlyCreatedKey.key, "newly_created")}
                className="shrink-0 flex items-center gap-1.5 text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied === "newly_created" ? "check" : "content_copy"}
                </span>
                {copied === "newly_created" ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400">
              Make sure to copy your API key now. You will still be able to copy it from the table.
            </p>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setNewlyCreatedKey(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
