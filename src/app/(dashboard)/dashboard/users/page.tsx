"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, Button, Badge, Collapsible, Loading, ShimmerPageLoader, Toggle } from "@/shared/components";
import { useTranslations } from "next-intl";

type ByokKey = {
  id: number;
  userId: string;
  providerId: string;
  maskedKey: string;
  isPaused: boolean;
  lastUsedAt: string | null;
  requests: number;
  tokens: number;
};

type ResellerUser = {
  id: string;
  email: string;
  name: string | null;
  planTier: string;
  tokenBudget: number | null;
  tokensUsed: number;
  rpmLimit: number | null;
  createdAt: string;
  updatedAt: string;
  byokKeys: ByokKey[];
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  pro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  premium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const Icon = ({ name, className }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className ?? ""}`.trim()}>{name}</span>
);

function planBadge(plan: string): string {
  return PLAN_COLORS[plan.toLowerCase()] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

function progressPercent(used: number, budget: number | null): number {
  if (!budget || budget <= 0) return 0;
  return Math.min(100, (used / budget) * 100);
}

export default function UsersPage() {
  const t = useTranslations("users");
  const [isMutating] = useTransition();
  const [users, setUsers] = useState<ResellerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    fetch(`/api/v1/reseller/users`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data?.users ?? []);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  };

  const mutate = () => load();

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return <ShimmerPageLoader variant="users" />;
  }

  if (loadError) {
    return (
      <Card className="m-6">
        <p className="p-4 text-sm text-red-400">{t("loadError")}</p>
      </Card>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-main">{t("title")}</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const userId = `seed_${Date.now()}`;
            await fetch("/api/v1/reseller/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: userId,
                email: `${userId}@example.com`,
                name: "Seed User",
                planTier: "free",
              }),
            });
            mutate();
          }}
          disabled={isMutating}
        >
          <Icon name="add" className="text-[18px]" />
          {t("addUser")}
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon name="groups_2" className="text-[48px] text-text-muted/30 mb-3" />
          <p className="text-text-muted">{t("empty")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard key={user.id} user={user} onMutate={mutate} disabled={isMutating} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  onMutate,
  disabled,
}: {
  user: ResellerUser;
  onMutate: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("users");
  const budget = user.tokenBudget;
  const pct = progressPercent(user.tokensUsed, budget);

  const handleTogglePause = (providerId: string, paused: boolean) => {
    const label = paused ? "Pause" : "Resume";
    const ok = confirm(`${label} BYOK key for ${providerId} (${user.email})?`);
    if (!ok) return;
    fetch("/api/v1/reseller/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pauseByok", userId: user.id, providerId, paused }),
    }).then(() => onMutate());
  };

  const trailing = (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Badge className={planBadge(user.planTier)}>{user.planTier}</Badge>
      {user.byokKeys.length > 0 && (
        <span className="text-xs text-text-muted/60">{user.byokKeys.length} BYOK</span>
      )}
      <Icon name="chevron_right" className="text-[16px] text-text-muted/40" />
    </div>
  );

  return (
    <Collapsible
      title={
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-full bg-surface-hover/50 border border-border">
            <Icon name="account_circle" className="text-[20px] text-text-muted" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-text-main">{user.name || user.email}</span>
            <span className="text-xs text-text-muted/70">{user.email}</span>
          </div>
        </div>
      }
      trailing={trailing}
      defaultOpen={false}
      variant="default"
      className="w-full"
    >
      <div className="mt-3 space-y-4">
        {/* Token usage */}
        <div>
          <div className="flex justify-between text-xs text-text-muted/70 mb-1">
            <span>
              {user.tokensUsed.toLocaleString()} /{" "}
              {budget ? budget.toLocaleString() : t("unlimited")}
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded bg-surface-hover/50 overflow-hidden">
            <div
              className="h-full rounded bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-text-muted/70">
            <span>
              {t("rpm")}: {user.rpmLimit ?? "—"}
            </span>
            <span>
              {t("joined")}:{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* BYOK keys */}
        {user.byokKeys.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text-muted/60 uppercase tracking-wider">
              {t("byokKeys")}
            </h3>
            {user.byokKeys.map((key) => (
              <ByokKeyRow
                key={key.id}
                byokKey={key}
                onTogglePause={handleTogglePause}
                disabled={disabled}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted/60">{t("noByokKeys")}</p>
        )}
      </div>
    </Collapsible>
  );
}

function ByokKeyRow({
  byokKey,
  onTogglePause,
  disabled,
}: {
  byokKey: ByokKey;
  onTogglePause: (providerId: string, paused: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-hover/30 px-3 py-2">
      <div className="flex items-center gap-3">
        <Icon name="key" className="text-[18px] text-text-muted/60" />
        <div className="flex flex-col">
          <span className="text-sm font-mono text-text-main">{byokKey.maskedKey}</span>
          <span className="text-xs text-text-muted/60">{byokKey.providerId}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted/60">
        <span>{byokKey.requests} req</span>
        <span>{byokKey.tokens} tok</span>
        <Toggle
          checked={!byokKey.isPaused}
          onChange={(checked) => onTogglePause(byokKey.providerId, !checked)}
          disabled={disabled}
          size="sm"
          label={byokKey.isPaused ? "Paused" : "Active"}
        />
      </div>
    </div>
  );
}
