/**
 * db/resellerUsers.ts — reseller multi-tenant user roster + BYOK key tracking
 * for the dedicated "Users" dashboard tab.
 *
 * The real BYOK key material lives in the reseller frontend DB; CheapRouter only
 * stores a masked reference + a pause toggle (stateless pass-through design,
 * see the execution spec §7).
 */

import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";

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

/**
 * Get all reseller users (the Users tab roster).
 */
export function getResellerUsers(): ResellerUser[] {
  const db = getDbInstance();
  const rows = db.prepare(
    "SELECT * FROM reseller_users ORDER BY created_at DESC"
  ).all() as UserRowShape[];
  return rows.map(fromUserRow);
}

export function getResellerUser(id: string): ResellerUser | undefined {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT * FROM reseller_users WHERE id = ?")
    .get(id) as UserRowShape | undefined;
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
    .prepare(
      "SELECT * FROM user_byok_keys WHERE user_id = ? ORDER BY provider_id ASC"
    )
    .all(userId) as ByokRowShape[];
  return rows.map(fromByokRow);
}

/**
 * Whether any BYOK key for this user is currently paused (used by the passthrough
 * gate when routing a request).
 */
export function isUserByokPaused(userId: string, providerId: string): boolean {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT is_paused FROM user_byok_keys WHERE user_id = ? AND provider_id = ? LIMIT 1"
    )
    .get(userId, providerId) as { is_paused: number } | undefined;
  return !!row && row.is_paused === 1;
}

/**
 * Register a pass-through BYOK key reference for a user. `maskedKey` is the
 * operator/reseller-provided truncated form shown in the dashboard; the real
 * key arrives per-request via headers.
 */
export function upsertUserByokKey(params: {
  userId: string;
  providerId: string;
  maskedKey: string;
}): UserByokKey {
  const db = getDbInstance();
  const now = new Date().toISOString();
  backupDbFile("pre-write");

  const existing = db.prepare(
    "SELECT id FROM user_byok_keys WHERE user_id = ? AND provider_id = ?"
  ).get(params.userId, params.providerId) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE user_byok_keys SET masked_key = ?, updated_at = ? WHERE id = ?`
    ).run(params.maskedKey, now, existing.id);
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
    .prepare(
      "SELECT * FROM user_byok_keys WHERE user_id = ? AND provider_id = ? LIMIT 1"
    )
    .get(userId, providerId) as ByokRowShape | undefined;
  return row ? fromByokRow(row) : undefined;
}

/**
 * Pause / resume a user's BYOK key. Paused keys are rejected at the pass-through
 * gate so no upstream traffic is sent.
 */
export function setUserByokPaused(
  userId: string,
  providerId: string,
  paused: boolean
): void {
  const db = getDbInstance();
  backupDbFile("pre-write");
  db.prepare(
    "UPDATE user_byok_keys SET is_paused = ?, updated_at = ? WHERE user_id = ? AND provider_id = ?"
  ).run(paused ? 1 : 0, new Date().toISOString(), userId, providerId);
}

/**
 * Delete (revoke) a user's BYOK key reference.
 */
export function deleteUserByokKey(userId: string, providerId: string): boolean {
  const db = getDbInstance();
  backupDbFile("pre-write");
  const info = db
    .prepare("DELETE FROM user_byok_keys WHERE user_id = ? AND provider_id = ?")
    .run(userId, providerId);
  return info.changes > 0;
}

/**
 * Increment per-key usage counters (requests + tokens) — called from the
 * passthrough telemetry path.
 */
export function incrementUserByokUsage(
  userId: string,
  providerId: string,
  tokens: number
): void {
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
