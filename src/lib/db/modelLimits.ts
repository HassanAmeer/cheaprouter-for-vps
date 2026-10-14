/**
 * db/modelLimits.ts — Model & Combo Quota & Rate Limit Policies.
 *
 * Persists token budget pools, RPM/TPM velocity throttles, and limit exhaustion
 * actions (fallback / custom error message) for individual models and combos.
 */

import { randomUUID } from "crypto";
import { getDbInstance } from "./core";

export type LimitTargetType = "model" | "combo";
export type LimitResetWindow = "lifetime" | "monthly" | "weekly" | "daily";
export type LimitExhaustionAction = "error" | "fallback";

export interface ModelLimitPolicy {
  id: string;
  targetType: LimitTargetType;
  targetId: string;
  targetName: string;
  providerId: string | null;
  capability: string;
  totalTokenPool: number;
  consumedTokens: number;
  remainingTokens: number;
  consumptionPercent: number;
  rpmLimit: number | null;
  tpmLimit: number | null;
  resetWindow: LimitResetWindow;
  onExhaustion: LimitExhaustionAction;
  fallbackTarget: string | null;
  customErrorMessage: string | null;
  isActive: boolean;
  status: "healthy" | "near_limit" | "exhausted" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface UpsertModelLimitInput {
  id?: string;
  targetType: LimitTargetType;
  targetId: string;
  targetName?: string;
  providerId?: string | null;
  capability?: string;
  totalTokenPool: number;
  rpmLimit?: number | null;
  tpmLimit?: number | null;
  resetWindow?: LimitResetWindow;
  onExhaustion?: LimitExhaustionAction;
  fallbackTarget?: string | null;
  customErrorMessage?: string | null;
  isActive?: boolean;
}

let _schemaChecked = false;

function ensureSchema(): void {
  if (_schemaChecked) return;
  const db = getDbInstance();
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_combo_limits (
      id                    TEXT PRIMARY KEY,
      target_type           TEXT NOT NULL CHECK (target_type IN ('model', 'combo')),
      target_id             TEXT NOT NULL,
      target_name           TEXT NOT NULL,
      provider_id           TEXT,
      capability            TEXT DEFAULT 'all',
      total_token_pool      INTEGER NOT NULL CHECK (total_token_pool > 0),
      consumed_tokens       INTEGER NOT NULL DEFAULT 0,
      rpm_limit             INTEGER,
      tpm_limit             INTEGER,
      reset_window          TEXT NOT NULL DEFAULT 'lifetime' CHECK (reset_window IN ('lifetime', 'monthly', 'weekly', 'daily')),
      on_exhaustion         TEXT NOT NULL DEFAULT 'error' CHECK (on_exhaustion IN ('error', 'fallback')),
      fallback_target       TEXT,
      custom_error_message  TEXT,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (target_type, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mcl_target ON model_combo_limits (target_type, target_id);
  `);
  _schemaChecked = true;
}

interface RawDbRow {
  id: string;
  target_type: string;
  target_id: string;
  target_name: string;
  provider_id: string | null;
  capability: string | null;
  total_token_pool: number;
  consumed_tokens: number;
  rpm_limit: number | null;
  tpm_limit: number | null;
  reset_window: string;
  on_exhaustion: string;
  fallback_target: string | null;
  custom_error_message: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRowToPolicy(row: RawDbRow): ModelLimitPolicy {
  const total = Number(row.total_token_pool) || 1;
  const consumed = Number(row.consumed_tokens) || 0;
  const remaining = Math.max(0, total - consumed);
  const percent = Math.min(100, Math.round((consumed / total) * 1000) / 10);
  const isActive = row.is_active === 1;

  let status: ModelLimitPolicy["status"] = "healthy";
  if (!isActive) {
    status = "paused";
  } else if (consumed >= total) {
    status = "exhausted";
  } else if (percent >= 85) {
    status = "near_limit";
  }

  return {
    id: row.id,
    targetType: row.target_type as LimitTargetType,
    targetId: row.target_id,
    targetName: row.target_name,
    providerId: row.provider_id,
    capability: row.capability || "all",
    totalTokenPool: total,
    consumedTokens: consumed,
    remainingTokens: remaining,
    consumptionPercent: percent,
    rpmLimit: row.rpm_limit != null ? Number(row.rpm_limit) : null,
    tpmLimit: row.tpm_limit != null ? Number(row.tpm_limit) : null,
    resetWindow: (row.reset_window as LimitResetWindow) || "lifetime",
    onExhaustion: (row.on_exhaustion as LimitExhaustionAction) || "error",
    fallbackTarget: row.fallback_target,
    customErrorMessage: row.custom_error_message,
    isActive,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listModelLimits(): ModelLimitPolicy[] {
  ensureSchema();
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT * FROM model_combo_limits ORDER BY updated_at DESC")
    .all() as RawDbRow[];
  return rows.map(mapRowToPolicy);
}

export function getModelLimit(id: string): ModelLimitPolicy | null {
  ensureSchema();
  const db = getDbInstance();
  const row = db
    .prepare("SELECT * FROM model_combo_limits WHERE id = ?")
    .get(id) as RawDbRow | undefined;
  return row ? mapRowToPolicy(row) : null;
}

export function getModelLimitByTarget(
  targetType: LimitTargetType,
  targetId: string
): ModelLimitPolicy | null {
  ensureSchema();
  const db = getDbInstance();
  const row = db
    .prepare("SELECT * FROM model_combo_limits WHERE target_type = ? AND target_id = ?")
    .get(targetType, targetId) as RawDbRow | undefined;
  return row ? mapRowToPolicy(row) : null;
}

export function upsertModelLimit(input: UpsertModelLimitInput): ModelLimitPolicy {
  ensureSchema();
  const db = getDbInstance();
  const existing = input.id
    ? getModelLimit(input.id)
    : getModelLimitByTarget(input.targetType, input.targetId);

  const id = existing?.id || input.id || randomUUID();
  const targetName = input.targetName || existing?.targetName || input.targetId;
  const providerId = input.providerId ?? existing?.providerId ?? null;
  const capability = input.capability ?? existing?.capability ?? "all";
  const totalPool = Math.max(1, Math.floor(input.totalTokenPool));
  const rpmLimit = input.rpmLimit !== undefined ? input.rpmLimit : (existing?.rpmLimit ?? null);
  const tpmLimit = input.tpmLimit !== undefined ? input.tpmLimit : (existing?.tpmLimit ?? null);
  const resetWindow = input.resetWindow || existing?.resetWindow || "lifetime";
  const onExhaustion = input.onExhaustion || existing?.onExhaustion || "error";
  const fallbackTarget = input.fallbackTarget !== undefined ? input.fallbackTarget : (existing?.fallbackTarget ?? null);
  const customErrorMessage = input.customErrorMessage !== undefined ? input.customErrorMessage : (existing?.customErrorMessage ?? null);
  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing?.isActive ? 1 : 1);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE model_combo_limits
      SET target_name = ?, provider_id = ?, capability = ?, total_token_pool = ?,
          rpm_limit = ?, tpm_limit = ?, reset_window = ?, on_exhaustion = ?,
          fallback_target = ?, custom_error_message = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      targetName,
      providerId,
      capability,
      totalPool,
      rpmLimit,
      tpmLimit,
      resetWindow,
      onExhaustion,
      fallbackTarget,
      customErrorMessage,
      isActive,
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO model_combo_limits (
        id, target_type, target_id, target_name, provider_id, capability,
        total_token_pool, consumed_tokens, rpm_limit, tpm_limit, reset_window,
        on_exhaustion, fallback_target, custom_error_message, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.targetType,
      input.targetId,
      targetName,
      providerId,
      capability,
      totalPool,
      rpmLimit,
      tpmLimit,
      resetWindow,
      onExhaustion,
      fallbackTarget,
      customErrorMessage,
      isActive,
      now,
      now
    );
  }

  const updated = getModelLimit(id);
  if (!updated) throw new Error("Failed to retrieve saved model limit policy");
  return updated;
}

export function recordTokenConsumption(
  targetType: LimitTargetType,
  targetId: string,
  tokens: number
): boolean {
  if (tokens <= 0) return false;
  ensureSchema();
  const db = getDbInstance();
  const result = db.prepare(`
    UPDATE model_combo_limits
    SET consumed_tokens = consumed_tokens + ?, updated_at = datetime('now')
    WHERE target_type = ? AND target_id = ? AND is_active = 1
  `).run(Math.floor(tokens), targetType, targetId);

  return result.changes > 0;
}

export function addTokensToPool(id: string, additionalTokens: number): ModelLimitPolicy | null {
  if (additionalTokens <= 0) return getModelLimit(id);
  ensureSchema();
  const db = getDbInstance();
  db.prepare(`
    UPDATE model_combo_limits
    SET total_token_pool = total_token_pool + ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(Math.floor(additionalTokens), id);

  return getModelLimit(id);
}

export function toggleModelLimitActive(id: string, isActive: boolean): boolean {
  ensureSchema();
  const db = getDbInstance();
  const result = db.prepare(`
    UPDATE model_combo_limits
    SET is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(isActive ? 1 : 0, id);

  return result.changes > 0;
}

export function deleteModelLimit(id: string): boolean {
  ensureSchema();
  const db = getDbInstance();
  const result = db.prepare("DELETE FROM model_combo_limits WHERE id = ?").run(id);
  return result.changes > 0;
}
