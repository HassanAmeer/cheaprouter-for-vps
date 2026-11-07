import {
  getRawProviderConnections,
  updateProviderConnection,
} from "@/lib/db/providers";
import { getCachedSettings } from "@/lib/db/readCache";
import { updateSettings } from "@/lib/db/settings";

export interface AntigravityAccountItem {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  testStatus: string;
  rateLimitedUntil: string | null;
  lastError: string | null;
  lastErrorType: string | null;
  errorCode: number | null;
  priority: number;
  providerSpecificData: Record<string, unknown>;
}

export interface AntigravityPoolState {
  connections: AntigravityAccountItem[];
  activeConnectionId: string | null;
  autoSwitchOnLimit: boolean;
}

/** Check if auto-switch on 429/quota limit is enabled (defaults to true). */
export async function isAntigravityAutoSwitchEnabled(): Promise<boolean> {
  try {
    const settings = await getCachedSettings();
    if (typeof settings.antigravityAutoSwitchOnLimit === "boolean") {
      return settings.antigravityAutoSwitchOnLimit;
    }
    return true;
  } catch {
    return true;
  }
}

/** Update the auto-switch on limit setting */
export async function setAntigravityAutoSwitchEnabled(enabled: boolean): Promise<void> {
  await updateSettings({ antigravityAutoSwitchOnLimit: Boolean(enabled) });
}

/** Helper to check whether a connection is terminal (banned, expired, credits_exhausted) */
export function isTerminalStatus(status: unknown): boolean {
  const norm = String(status || "").trim().toLowerCase();
  return norm === "banned" || norm === "expired" || norm === "credits_exhausted";
}

/** Helper to check whether a connection is currently rate limited */
export function isRateLimited(rateLimitedUntil: unknown): boolean {
  if (!rateLimitedUntil) return false;
  const time = new Date(String(rateLimitedUntil)).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/** Get all attached Antigravity/AGY accounts */
export async function getAntigravityConnections(
  provider: string = "antigravity"
): Promise<AntigravityAccountItem[]> {
  const providersToSearch =
    provider === "antigravity" || provider === "agy" ? ["antigravity", "agy"] : [provider];

  const results: AntigravityAccountItem[] = [];
  for (const p of providersToSearch) {
    const raw = await getRawProviderConnections({ provider: p });
    for (const row of raw) {
      if (!row || !row.id) continue;
      results.push({
        id: String(row.id),
        name: String(row.name || "Antigravity CLI"),
        provider: String(row.provider || p),
        isActive: Boolean(row.isActive),
        testStatus: String(row.testStatus || "active"),
        rateLimitedUntil: row.rateLimitedUntil ? String(row.rateLimitedUntil) : null,
        lastError: row.lastError ? String(row.lastError) : null,
        lastErrorType: row.lastErrorType ? String(row.lastErrorType) : null,
        errorCode: typeof row.errorCode === "number" ? row.errorCode : null,
        priority: typeof row.priority === "number" ? row.priority : 1,
        providerSpecificData:
          row.providerSpecificData && typeof row.providerSpecificData === "object"
            ? (row.providerSpecificData as Record<string, unknown>)
            : {},
      });
    }
  }

  // Sort: active first, then highest priority, then by id
  results.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  return results;
}

/** Get overall Antigravity pool state */
export async function getAntigravityPoolState(
  provider: string = "antigravity"
): Promise<AntigravityPoolState> {
  const [connections, autoSwitchOnLimit] = await Promise.all([
    getAntigravityConnections(provider),
    isAntigravityAutoSwitchEnabled(),
  ]);

  const active = connections.find((c) => c.isActive);

  return {
    connections,
    activeConnectionId: active?.id ?? null,
    autoSwitchOnLimit,
  };
}

/**
 * Single-Active Resume:
 * Sets the target connection to isActive = true, and all other Antigravity connections to isActive = false.
 * Ensures at any time only ONE account handles requests.
 */
export async function resumeSingleAntigravityAccount(
  targetConnectionId: string,
  provider: string = "antigravity"
): Promise<{ success: boolean; activeConnectionId: string }> {
  const connections = await getAntigravityConnections(provider);
  const target = connections.find((c) => c.id === targetConnectionId);
  if (!target) {
    throw new Error(`Target Antigravity connection ${targetConnectionId} not found`);
  }

  // Activate target and clear any transient cooldown state
  await updateProviderConnection(targetConnectionId, {
    isActive: true,
    ...(isTerminalStatus(target.testStatus)
      ? {}
      : {
          testStatus: "active",
          rateLimitedUntil: null,
          lastError: null,
          lastErrorType: null,
          errorCode: null,
        }),
  });

  // Deactivate all others
  for (const conn of connections) {
    if (conn.id !== targetConnectionId && conn.isActive) {
      await updateProviderConnection(conn.id, {
        isActive: false,
      });
    }
  }

  return { success: true, activeConnectionId: targetConnectionId };
}

/**
 * Auto-Switch on Limit Exceeded (HTTP 429 / Quota exhausted):
 * Deactivates the failed account and immediately switches to the next eligible standby account in the pool.
 */
export async function autoSwitchAntigravityAccountOnLimit(
  failedConnectionId: string,
  provider: string = "antigravity"
): Promise<{
  switched: boolean;
  previousConnectionId: string;
  nextConnectionId?: string;
  nextConnectionName?: string;
  reason?: string;
}> {
  const enabled = await isAntigravityAutoSwitchEnabled();
  if (!enabled) {
    return {
      switched: false,
      previousConnectionId: failedConnectionId,
      reason: "auto_switch_disabled",
    };
  }

  const connections = await getAntigravityConnections(provider);

  // Guard against concurrent thundering-herd: if another healthy account has ALREADY been promoted
  const alreadyActive = connections.find(
    (conn) =>
      conn.isActive &&
      conn.id !== failedConnectionId &&
      !isTerminalStatus(conn.testStatus) &&
      !isRateLimited(conn.rateLimitedUntil)
  );

  if (alreadyActive) {
    // Ensure the failed account is marked inactive
    const failedConn = connections.find((c) => c.id === failedConnectionId);
    if (failedConn?.isActive) {
      await updateProviderConnection(failedConnectionId, { isActive: false });
    }
    return {
      switched: true,
      previousConnectionId: failedConnectionId,
      nextConnectionId: alreadyActive.id,
      nextConnectionName: alreadyActive.name,
    };
  }

  // Find candidate standby accounts
  const candidates = connections.filter((conn) => {
    if (conn.id === failedConnectionId) return false;
    if (isTerminalStatus(conn.testStatus)) return false;
    if (isRateLimited(conn.rateLimitedUntil)) return false;
    return true;
  });

  if (candidates.length === 0) {
    console.warn(
      `[Antigravity Pool] No eligible standby accounts available to switch to for failed account ${failedConnectionId.slice(0, 8)}`
    );
    return {
      switched: false,
      previousConnectionId: failedConnectionId,
      reason: "no_standby_available",
    };
  }

  // Pick the best candidate (first one according to priority sorting)
  const nextAccount = candidates[0];

  // Atomically promote next account and demote failed account
  await updateProviderConnection(failedConnectionId, {
    isActive: false,
  });

  await updateProviderConnection(nextAccount.id, {
    isActive: true,
  });

  console.info(
    `[Antigravity Pool] ⚡ Auto-switched active account from ${failedConnectionId.slice(0, 8)} to ${nextAccount.id.slice(0, 8)} (${nextAccount.name}) on limit exceeded`
  );

  return {
    switched: true,
    previousConnectionId: failedConnectionId,
    nextConnectionId: nextAccount.id,
    nextConnectionName: nextAccount.name,
  };
}
