/**
 * db/resellerUsers.ts — reseller multi-tenant user roster + BYOK key tracking
 * + User API Keys issuance & management for the dedicated "Users" dashboard tab.
 *
 * Supports issuing scoped API keys with token budgets, model allowlists,
 * expiration, and rate limits for individual users (UID, Name, Email/Phone).
 */

import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";
import { createApiKey, updateApiKeyPermissions } from "./apiKeys";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export interface UserModelUsage {
  model: string;
  tokensUsed: number;
  requests: number;
  lastUsedAt: string | null;
}

export interface ResellerUser {
  id: string;
  email: string;
  name: string | null;
  planTier: string;
  tokenBudget: number | null;
  tokensUsed: number;
  rpmLimit: number | null;
  isBanned: boolean;
  modelQuotas?: Record<string, number>;
  keysCount: number;
  modelUsage?: UserModelUsage[];
  createdAt: string;
  updatedAt: string;
}

export interface UserByokKey {
  id: number;
  userId: string;
  providerId: string;
  maskedKey: string;
  isPaused: boolean;
  lastUsedAt: string | null;
  requests: number;
  tokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedUserByokKey {
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

export interface ResellerUserKey {
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

/**
 * Ensure the reseller_user_keys table exists.
 */
export function ensureResellerUserKeysTable(): void {
  const db = getDbInstance();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reseller_users (
        id           TEXT PRIMARY KEY,
        email        TEXT NOT NULL,
        name         TEXT,
        plan_tier    TEXT NOT NULL DEFAULT 'free',
        token_budget INTEGER,
        tokens_used  INTEGER NOT NULL DEFAULT 0,
        rpm_limit    INTEGER,
        is_banned    INTEGER NOT NULL DEFAULT 0,
        model_quotas TEXT DEFAULT '{}',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reseller_users_email ON reseller_users(email);
      CREATE INDEX IF NOT EXISTS idx_reseller_users_plan ON reseller_users(plan_tier);

      CREATE TABLE IF NOT EXISTS reseller_user_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_email TEXT NOT NULL,
        plan_tier TEXT DEFAULT 'free',
        api_key TEXT NOT NULL UNIQUE,
        api_key_id TEXT,
        allowed_models TEXT DEFAULT '[]',
        token_budget INTEGER,
        tokens_used INTEGER DEFAULT 0,
        rpm_limit INTEGER,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reseller_user_keys_user_id ON reseller_user_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_reseller_user_keys_api_key ON reseller_user_keys(api_key);

      CREATE TABLE IF NOT EXISTS user_model_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        requests INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, model)
      );
      CREATE INDEX IF NOT EXISTS idx_user_model_usage_uid ON user_model_usage(user_id);
    `);

    try {
      db.exec("ALTER TABLE reseller_users ADD COLUMN is_banned INTEGER DEFAULT 0;");
    } catch {}
    try {
      db.exec("ALTER TABLE reseller_users ADD COLUMN model_quotas TEXT DEFAULT '{}';");
    } catch {}
  } catch (err) {
    console.warn("[resellerUsers] ensureResellerUserKeysTable failed:", err);
  }
}

/**
 * Get all issued reseller user keys (row # 1, 2, 3...).
 */
export function getResellerUserKeys(): ResellerUserKey[] {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT * FROM reseller_user_keys ORDER BY id ASC")
    .all() as Array<{
      id: number;
      user_id: string;
      user_name: string | null;
      user_email: string;
      plan_tier: string;
      api_key: string;
      api_key_id: string | null;
      allowed_models: string;
      token_budget: number | null;
      tokens_used: number;
      rpm_limit: number | null;
      expires_at: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map((r) => {
    let allowedModels: string[] = [];
    try {
      allowedModels = JSON.parse(r.allowed_models || "[]");
    } catch {}
    return {
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      planTier: r.plan_tier,
      apiKey: r.api_key,
      apiKeyId: r.api_key_id,
      allowedModels,
      tokenBudget: r.token_budget,
      tokensUsed: r.tokens_used,
      rpmLimit: r.rpm_limit,
      expiresAt: r.expires_at,
      isActive: r.is_active === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

/**
 * Issue a new API key for a user with specific models and limits.
 */
export async function createResellerUserKey(params: {
  userId: string;
  userName?: string | null;
  userEmail: string;
  planTier?: string;
  allowedModels?: string[];
  tokenBudget?: number | null;
  rpmLimit?: number | null;
  expiresAt?: string | null;
}): Promise<ResellerUserKey> {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const now = new Date().toISOString();
  backupDbFile("pre-write");

  const userId = params.userId.trim();
  const userName = params.userName?.trim() || userId;
  const userEmail = params.userEmail.trim();
  const planTier = params.planTier?.trim() || "free";
  const allowedModels = Array.isArray(params.allowedModels) ? params.allowedModels : [];
  const tokenBudget =
    typeof params.tokenBudget === "number" && params.tokenBudget > 0 ? params.tokenBudget : null;
  const rpmLimit =
    typeof params.rpmLimit === "number" && params.rpmLimit > 0 ? params.rpmLimit : null;
  const expiresAt = params.expiresAt || null;

  // 1. Create a native CheapRoute API key so requests work natively in all routes
  const machineId = await getConsistentMachineId();
  const keyName = `${userName} (${planTier})`;

  let allComboNames = new Set<string>();
  try {
    const { getCombos } = await import("./combos");
    const combos = await getCombos();
    allComboNames = new Set((combos || []).map((c: any) => String(c.name || "")));
  } catch {}

  const comboList = allowedModels.filter((m) => allComboNames.has(m));
  const modelList = allowedModels.filter((m) => !allComboNames.has(m));

  const apiKeyRecord = await createApiKey(keyName, machineId, ["self:usage"], {
    modelAccessMode: allowedModels.length > 0 ? "restricted" : "all",
    allowedModels: modelList,
    allowedCombos: comboList.length > 0 ? comboList : undefined,
    expiresAt,
  });

  if (rpmLimit) {
    await updateApiKeyPermissions(apiKeyRecord.id, {
      maxRequestsPerMinute: rpmLimit,
    });
  }

  // 2. Insert into reseller_user_keys
  const stmt = db.prepare(`
    INSERT INTO reseller_user_keys (
      user_id, user_name, user_email, plan_tier, api_key, api_key_id,
      allowed_models, token_budget, tokens_used, rpm_limit, expires_at,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
  `);

  const info = stmt.run(
    userId,
    userName,
    userEmail,
    planTier,
    apiKeyRecord.key,
    apiKeyRecord.id,
    JSON.stringify(allowedModels),
    tokenBudget,
    rpmLimit,
    expiresAt,
    now,
    now
  );

  // 3. Upsert into reseller_users for roster tracking
  upsertResellerUser({
    id: userId,
    email: userEmail,
    name: userName,
    planTier,
    tokenBudget,
    rpmLimit,
  });

  return {
    id: Number(info.lastInsertRowid),
    userId,
    userName,
    userEmail,
    planTier,
    apiKey: apiKeyRecord.key,
    apiKeyId: apiKeyRecord.id,
    allowedModels,
    tokenBudget,
    tokensUsed: 0,
    rpmLimit,
    expiresAt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Delete / revoke a user's API key.
 */
export async function deleteResellerUserKey(id: number): Promise<boolean> {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  backupDbFile("pre-write");

  const row = db
    .prepare("SELECT * FROM reseller_user_keys WHERE id = ?")
    .get(id) as { api_key_id?: string } | undefined;

  if (row?.api_key_id) {
    try {
      const { deleteApiKey } = await import("./apiKeys");
      await deleteApiKey(row.api_key_id);
    } catch (e) {
      console.warn("[resellerUsers] deleteApiKey failed:", e);
    }
  }

  const res = db.prepare("DELETE FROM reseller_user_keys WHERE id = ?").run(id);
  return res.changes > 0;
}

/**
 * Get active combos and active curated models for the model picker.
 */
export async function getAvailableModelsAndCombos() {
  const db = getDbInstance();

  // 1. Get active combos
  let activeCombos: Array<{ id: string; name: string; strategy?: string; description?: string }> =
    [];
  try {
    const { getCombos } = await import("./combos");
    const combos = await getCombos();
    activeCombos = (combos || [])
      .filter((c: any) => c.isActive !== false && c.isHidden !== true)
      .map((c: any) => ({
        id: String(c.name || ""),
        name: String(c.displayName || c.name || ""),
        strategy: typeof c.strategy === "string" ? c.strategy : undefined,
        description: typeof c.description === "string" ? c.description : undefined,
      }));
  } catch (err) {
    console.error("[resellerUsers] Failed to fetch combos:", err);
  }

  // 2. Get active curated models from provider_model_customizations
  let activeModels: Array<{ id: string; name: string; providerId: string }> = [];
  try {
    const rows = db
      .prepare(
        "SELECT provider_id, original_model_id, custom_name, custom_alias FROM provider_model_customizations WHERE is_active = 1"
      )
      .all() as Array<{
      provider_id: string;
      original_model_id: string;
      custom_name: string | null;
      custom_alias: string | null;
    }>;

    activeModels = rows.map((r) => ({
      id: r.custom_alias || r.original_model_id,
      name: r.custom_name || r.custom_alias || r.original_model_id,
      providerId: r.provider_id,
    }));
  } catch (err) {
    console.error("[resellerUsers] Failed to fetch curated models:", err);
  }

  return { combos: activeCombos, models: activeModels };
}

/**
 * Get all reseller users (the Users tab roster).
 */
export function getResellerUsers(): ResellerUser[] {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const rows = db
    .prepare(
      `SELECT 
        u.*,
        COALESCE(k.keys_count, 0) as keys_count
      FROM reseller_users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as keys_count
        FROM reseller_user_keys
        GROUP BY user_id
      ) k ON u.id = k.user_id
      ORDER BY u.created_at DESC`
    )
    .all() as Array<UserRowShape & { keys_count?: number }>;

  const usageRows = db.prepare(`SELECT * FROM user_model_usage`).all() as Array<{
    user_id: string;
    model: string;
    tokens_used: number;
    requests: number;
    last_used_at: string | null;
  }>;

  const usageMap = new Map<string, UserModelUsage[]>();
  for (const u of usageRows) {
    if (!usageMap.has(u.user_id)) {
      usageMap.set(u.user_id, []);
    }
    usageMap.get(u.user_id)!.push({
      model: u.model,
      tokensUsed: u.tokens_used,
      requests: u.requests,
      lastUsedAt: u.last_used_at,
    });
  }

  return rows.map((r) => {
    const user = fromUserRow(r);
    user.modelUsage = usageMap.get(r.id) || [];
    return user;
  });
}

export function getResellerUser(id: string): ResellerUser | undefined {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const row = db
    .prepare(
      `SELECT 
        u.*,
        COALESCE(k.keys_count, 0) as keys_count
      FROM reseller_users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as keys_count
        FROM reseller_user_keys
        GROUP BY user_id
      ) k ON u.id = k.user_id
      WHERE u.id = ?`
    )
    .get(id) as (UserRowShape & { keys_count?: number }) | undefined;

  if (!row) return undefined;

  const usageRows = db.prepare(`SELECT * FROM user_model_usage WHERE user_id = ?`).all(id) as Array<{
    user_id: string;
    model: string;
    tokens_used: number;
    requests: number;
    last_used_at: string | null;
  }>;

  const user = fromUserRow(row);
  user.modelUsage = usageRows.map((u) => ({
    model: u.model,
    tokensUsed: u.tokens_used,
    requests: u.requests,
    lastUsedAt: u.last_used_at,
  }));
  return user;
}

/**
 * Create or update a reseller user (upsert from reseller sync).
 */
export function upsertResellerUser(params: {
  id: string;
  email: string;
  name?: string | null;
  planTier?: string;
  tokenBudget?: number | null;
  tokensUsed?: number;
  rpmLimit?: number | null;
  isBanned?: boolean;
  modelQuotas?: Record<string, number>;
}): ResellerUser {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const now = new Date().toISOString();

  backupDbFile("pre-write");

  const existing = getResellerUser(params.id);
  const planTier = params.planTier ?? existing?.planTier ?? "free";
  const tokenBudget = params.tokenBudget !== undefined ? params.tokenBudget : (existing?.tokenBudget ?? null);
  const tokensUsed = params.tokensUsed ?? existing?.tokensUsed ?? 0;
  const rpmLimit = params.rpmLimit !== undefined ? params.rpmLimit : (existing?.rpmLimit ?? null);
  const isBanned = params.isBanned !== undefined ? (params.isBanned ? 1 : 0) : (existing?.isBanned ? 1 : 0);
  const name = params.name ?? existing?.name ?? null;
  const modelQuotas = params.modelQuotas
    ? JSON.stringify(params.modelQuotas)
    : existing?.modelQuotas
    ? JSON.stringify(existing.modelQuotas)
    : "{}";

  if (existing) {
    db.prepare(
      `UPDATE reseller_users SET email = ?, name = ?, plan_tier = ?, token_budget = ?,
         tokens_used = ?, rpm_limit = ?, is_banned = ?, model_quotas = ?, updated_at = ?
       WHERE id = ?`
    ).run(params.email, name, planTier, tokenBudget, tokensUsed, rpmLimit, isBanned, modelQuotas, now, params.id);
  } else {
    db.prepare(
      `INSERT INTO reseller_users (id, email, name, plan_tier, token_budget, tokens_used, rpm_limit, is_banned, model_quotas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(params.id, params.email, name, planTier, tokenBudget, tokensUsed, rpmLimit, isBanned, modelQuotas, now, now);
  }

  return getResellerUser(params.id)!;
}

/**
 * Update user quota & plan (e.g. user buys an upgrade or admin edits in GUI).
 */
export function updateUserQuota(params: {
  userId: string;
  plan?: string;
  tokenBudget?: number | null;
  rpmLimit?: number | null;
  modelQuotas?: Record<string, number>;
  resetUsage?: boolean;
}): ResellerUser {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  backupDbFile("pre-write");
  const now = new Date().toISOString();

  const user = getResellerUser(params.userId);
  if (!user) {
    throw new Error(`User not found: ${params.userId}`);
  }

  const planTier = params.plan ?? user.planTier;
  const tokenBudget = params.tokenBudget !== undefined ? params.tokenBudget : user.tokenBudget;
  const rpmLimit = params.rpmLimit !== undefined ? params.rpmLimit : user.rpmLimit;
  const tokensUsed = params.resetUsage ? 0 : user.tokensUsed;
  const modelQuotas = params.modelQuotas
    ? JSON.stringify(params.modelQuotas)
    : user.modelQuotas
    ? JSON.stringify(user.modelQuotas)
    : "{}";

  db.prepare(
    `UPDATE reseller_users 
     SET plan_tier = ?, token_budget = ?, rpm_limit = ?, tokens_used = ?, model_quotas = ?, updated_at = ?
     WHERE id = ?`
  ).run(planTier, tokenBudget, rpmLimit, tokensUsed, modelQuotas, now, params.userId);

  // Sync to keys
  db.prepare(
    `UPDATE reseller_user_keys
     SET plan_tier = ?, token_budget = ?, rpm_limit = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(planTier, tokenBudget, rpmLimit, now, params.userId);

  if (params.resetUsage) {
    db.prepare("DELETE FROM user_model_usage WHERE user_id = ?").run(params.userId);
  }

  return getResellerUser(params.userId)!;
}

/**
 * Toggle user Ban status (0 = Active, 1 = Banned).
 */
export function setUserBanStatus(userId: string, isBanned: boolean): void {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  backupDbFile("pre-write");
  const val = isBanned ? 1 : 0;
  db.prepare("UPDATE reseller_users SET is_banned = ?, updated_at = datetime('now') WHERE id = ?").run(val, userId);
  db.prepare("UPDATE reseller_user_keys SET is_active = ?, updated_at = datetime('now') WHERE user_id = ?").run(isBanned ? 0 : 1, userId);
}

/**
 * Record model-specific and user-level token usage.
 */
export function recordUserModelUsage(userId: string, model: string, tokens: number): void {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE reseller_users
     SET tokens_used = tokens_used + ?, updated_at = ?
     WHERE id = ?`
  ).run(tokens, now, userId);

  db.prepare(
    `INSERT INTO user_model_usage (user_id, model, tokens_used, requests, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(user_id, model) DO UPDATE SET
       tokens_used = tokens_used + excluded.tokens_used,
       requests = requests + 1,
       last_used_at = excluded.last_used_at,
       updated_at = excluded.updated_at`
  ).run(userId, model, tokens, now, now, now);
}

/**
 * Get all BYOK keys attached to a user (masked).
 */
export function getUserByokKeys(userId: string): UserByokKey[] {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT * FROM user_byok_keys WHERE user_id = ? ORDER BY provider_id ASC")
    .all(userId) as ByokRowShape[];
  return rows.map(fromByokRow);
}

export function isUserByokPaused(userId: string, providerId: string): boolean {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT is_paused FROM user_byok_keys WHERE user_id = ? AND provider_id = ? LIMIT 1")
    .get(userId, providerId) as { is_paused: number } | undefined;
  return !!row && row.is_paused === 1;
}

export function upsertUserByokKey(params: {
  userId: string;
  providerId: string;
  maskedKey: string;
  userName?: string | null;
  userEmail?: string | null;
}): UserByokKey {
  const db = getDbInstance();
  const now = new Date().toISOString();
  backupDbFile("pre-write");

  if (params.userEmail || params.userName) {
    upsertResellerUser({
      id: params.userId,
      email: params.userEmail || `${params.userId}@reseller.user`,
      name: params.userName || params.userId,
    });
  }

  const existing = db
    .prepare("SELECT id FROM user_byok_keys WHERE user_id = ? AND provider_id = ?")
    .get(params.userId, params.providerId) as { id: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE user_byok_keys SET masked_key = ?, updated_at = ? WHERE id = ?`).run(
      params.maskedKey,
      now,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO user_byok_keys (user_id, provider_id, masked_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(params.userId, params.providerId, params.maskedKey, now, now);
  }

  return getUserByokKeyById(params.userId, params.providerId)!;
}

function getUserByokKeyById(userId: string, providerId: string): UserByokKey | undefined {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT * FROM user_byok_keys WHERE user_id = ? AND provider_id = ? LIMIT 1")
    .get(userId, providerId) as ByokRowShape | undefined;
  return row ? fromByokRow(row) : undefined;
}

/**
 * Get all user BYOK keys across all users joined with user details.
 */
export function getAllUserByokKeys(): EnrichedUserByokKey[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      `SELECT
        b.id,
        b.user_id,
        COALESCE(u.name, k.user_name) as user_name,
        COALESCE(u.email, k.user_email) as user_email,
        b.provider_id,
        b.masked_key,
        b.is_paused,
        b.last_used_at,
        b.requests,
        b.tokens,
        b.created_at,
        b.updated_at
      FROM user_byok_keys b
      LEFT JOIN reseller_users u ON b.user_id = u.id
      LEFT JOIN (
        SELECT user_id, user_name, user_email
        FROM reseller_user_keys
        GROUP BY user_id
      ) k ON b.user_id = k.user_id
      ORDER BY b.created_at DESC`
    )
    .all() as Array<{
      id: number;
      user_id: string;
      user_name: string | null;
      user_email: string | null;
      provider_id: string;
      masked_key: string;
      is_paused: number;
      last_used_at: string | null;
      requests: number;
      tokens: number;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    providerId: r.provider_id,
    maskedKey: r.masked_key,
    isPaused: r.is_paused === 1,
    lastUsedAt: r.last_used_at,
    requests: r.requests,
    tokens: r.tokens,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function setUserByokPaused(userId: string, providerId: string, paused: boolean): void {
  const db = getDbInstance();
  backupDbFile("pre-write");
  db.prepare(
    "UPDATE user_byok_keys SET is_paused = ?, updated_at = ? WHERE user_id = ? AND provider_id = ?"
  ).run(paused ? 1 : 0, new Date().toISOString(), userId, providerId);
}

export function deleteUserByokKey(userId: string, providerId: string): boolean {
  const db = getDbInstance();
  backupDbFile("pre-write");
  const info = db
    .prepare("DELETE FROM user_byok_keys WHERE user_id = ? AND provider_id = ?")
    .run(userId, providerId);
  return info.changes > 0;
}

export function deleteUserByokKeyById(id: number): boolean {
  const db = getDbInstance();
  backupDbFile("pre-write");
  const info = db.prepare("DELETE FROM user_byok_keys WHERE id = ?").run(id);
  return info.changes > 0;
}

export async function deleteResellerUser(userId: string): Promise<boolean> {
  ensureResellerUserKeysTable();
  const db = getDbInstance();
  backupDbFile("pre-write");

  const userKeys = db
    .prepare("SELECT api_key_id FROM reseller_user_keys WHERE user_id = ?")
    .all(userId) as Array<{ api_key_id?: string }>;

  for (const k of userKeys) {
    if (k.api_key_id) {
      try {
        const { deleteApiKey } = await import("./apiKeys");
        await deleteApiKey(k.api_key_id);
      } catch (e) {
        console.warn("[resellerUsers] deleteApiKey failed:", e);
      }
    }
  }

  db.prepare("DELETE FROM reseller_user_keys WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_byok_keys WHERE user_id = ?").run(userId);
  const info = db.prepare("DELETE FROM reseller_users WHERE id = ?").run(userId);
  return info.changes > 0;
}

export function incrementUserByokUsage(userId: string, providerId: string, tokens: number): void {
  const db = getDbInstance();
  db.prepare(
    `UPDATE user_byok_keys
       SET requests = requests + 1, tokens = tokens + ?, last_used_at = ?, updated_at = ?
     WHERE user_id = ? AND provider_id = ?`
  ).run(tokens, new Date().toISOString(), new Date().toISOString(), userId, providerId);
}

type UserRowShape = {
  id: string;
  email: string;
  name: string | null;
  plan_tier: string;
  token_budget: number | null;
  tokens_used: number;
  rpm_limit: number | null;
  is_banned?: number;
  model_quotas?: string;
  keys_count?: number;
  created_at: string;
  updated_at: string;
};

type ByokRowShape = {
  id: number;
  user_id: string;
  provider_id: string;
  masked_key: string;
  is_paused: number;
  last_used_at: string | null;
  requests: number;
  tokens: number;
  created_at: string;
  updated_at: string;
};

function fromUserRow(row: UserRowShape): ResellerUser {
  let modelQuotas: Record<string, number> = {};
  try {
    modelQuotas = JSON.parse(row.model_quotas || "{}");
  } catch {}

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    planTier: row.plan_tier,
    tokenBudget: row.token_budget,
    tokensUsed: row.tokens_used,
    rpmLimit: row.rpm_limit,
    isBanned: row.is_banned === 1,
    modelQuotas,
    keysCount: Number(row.keys_count || 0),
    modelUsage: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromByokRow(row: ByokRowShape): UserByokKey {
  return {
    id: row.id,
    userId: row.user_id,
    providerId: row.provider_id,
    maskedKey: row.masked_key,
    isPaused: row.is_paused === 1,
    lastUsedAt: row.last_used_at,
    requests: row.requests,
    tokens: row.tokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
