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

export interface ResellerUser {
  id: string;
  email: string;
  name: string | null;
  planTier: string;
  tokenBudget: number | null;
  tokensUsed: number;
  rpmLimit: number | null;
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
    `);
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
  const db = getDbInstance();
  const rows = db.prepare("SELECT * FROM reseller_users ORDER BY created_at DESC").all() as UserRowShape[];
  return rows.map(fromUserRow);
}

export function getResellerUser(id: string): ResellerUser | undefined {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM reseller_users WHERE id = ?").get(id) as UserRowShape | undefined;
  return row ? fromUserRow(row) : undefined;
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
}): ResellerUser {
  const db = getDbInstance();
  const now = new Date().toISOString();

  backupDbFile("pre-write");

  const existing = getResellerUser(params.id);
  const planTier = params.planTier ?? existing?.planTier ?? "free";
  const tokenBudget = params.tokenBudget ?? existing?.tokenBudget ?? null;
  const tokensUsed = params.tokensUsed ?? existing?.tokensUsed ?? 0;
  const rpmLimit = params.rpmLimit ?? existing?.rpmLimit ?? null;
  const name = params.name ?? existing?.name ?? null;

  if (existing) {
    db.prepare(
      `UPDATE reseller_users SET email = ?, name = ?, plan_tier = ?, token_budget = ?,
         tokens_used = ?, rpm_limit = ?, updated_at = ?
       WHERE id = ?`
    ).run(params.email, name, planTier, tokenBudget, tokensUsed, rpmLimit, now, params.id);
  } else {
    db.prepare(
      `INSERT INTO reseller_users (id, email, name, plan_tier, token_budget, tokens_used, rpm_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(params.id, params.email, name, planTier, tokenBudget, tokensUsed, rpmLimit, now, now);
  }

  return getResellerUser(params.id)!;
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
}): UserByokKey {
  const db = getDbInstance();
  const now = new Date().toISOString();
  backupDbFile("pre-write");

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
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    planTier: row.plan_tier,
    tokenBudget: row.token_budget,
    tokensUsed: row.tokens_used,
    rpmLimit: row.rpm_limit,
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
