/**
 * Provider guide — model rows for the "Models & Limits" tab.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The Cupertino provider guide sheet used to ship a hand-written model list per
 * provider (ids, context windows, rpm, "free" claims). Those lists drifted: a
 * model id retired upstream still showed up, its context window was off by 16x
 * in places, and providers without a hand-written entry showed NOTHING at all
 * (the fallback read a `models` key that no provider definition ever had).
 *
 * Everything rendered here is now derived from the sources of truth that the
 * router itself uses:
 *
 *  - model ids / display names / context windows → the provider registry
 *    (`open-sse/config/providers/registry/*`, `defaultContextLength` per
 *    provider, `contextLength` per model) plus the static specs
 *    (`src/shared/constants/modelSpecs.ts`).
 *  - "is this model free?" → the shipped, evidence-backed free-tier catalog
 *    (`open-sse/config/freeModelCatalog.data.ts`) — the SAME catalog routing
 *    uses to decide whether a request may be sent without paying.
 *  - paid prices → the static per-provider pricing table
 *    (`src/shared/constants/pricing.ts`, $/1M tokens).
 *  - per-model rate limits → the published Gemini limits table
 *    (`open-sse/config/geminiRateLimits.json`).
 *
 * A hand-written row is only kept when its model id still exists in one of
 * those sources; otherwise it is dropped. That is the whole point: a row the
 * user can copy into a request must be a row the router can actually serve.
 *
 * Client-safe: no DB, no server-only imports — the sheet renders in the
 * browser.
 */

import { getModelsByProviderId } from "@cheaproute/open-sse/config/providerModels";
import { getRegistryEntry } from "@cheaproute/open-sse/config/providerRegistry";
import {
  FREE_MODEL_BUDGETS,
  grantsFreeAccess,
  type FreeModelBudget,
} from "@cheaproute/open-sse/config/freeModelCatalog";
import {
  MODEL_SPECS,
  getAuthoritativeContextWindow,
  getAuthoritativeProviderContextWindow,
} from "@/shared/constants/modelSpecs";
import { getPricingForModel } from "@/shared/constants/pricing";
import { KNOWN_MODEL_PRICING } from "@cheaproute/open-sse/services/providerCostData";
import { resolveProviderId } from "@/shared/constants/providers";
import geminiRateLimits from "@cheaproute/open-sse/config/geminiRateLimits.json";

/**
 * One model row as accepted as INPUT (hand-written guide rows): every field
 * except the id/name is optional, because a hand-written row may carry only a
 * subset of the facts.
 */
export interface GuideModelRowInput {
  id: string;
  name: string;
  /** Short badge: "100% Free", "Free (web session)", "Paid", … */
  pricing?: string;
  /** True when the model can be used without paying. */
  isFree?: boolean;
  /** e.g. "128k ctx" — omitted when no source knows the window. */
  contextWindow?: string;
  /** e.g. "30 RPM" — omitted when unknown. */
  rpm?: string;
  /** e.g. "24M tokens/mo" — omitted when unknown. */
  dailyQuota?: string;
  /** Free-text hint (price detail, quota regime, curated note). */
  notes?: string;
}

/** One model row as rendered by the guide sheet (the badge is always set). */
export interface GuideModelRow extends Omit<GuideModelRowInput, "pricing"> {
  pricing: string;
}

/**
 * How a provider's models are billed, which decides the badge:
 *  - `always-free` — keyless / local provider: every model is free.
 *  - `web-session` — browser-session provider: models ride the free web tier.
 *  - `free-tier` — provider publishes a free tier: a model with a known
 *    non-zero price is still billed, everything else is free-tier.
 *  - `standard` — API key / OAuth provider: the free catalog decides.
 */
export type GuidePricingMode = "always-free" | "web-session" | "free-tier" | "standard";

/** A model row as discovered on the operator's own instance (synced catalog). */
export interface LiveGuideModel {
  id: string;
  name?: string | null;
  contextWindow?: number | null;
  context_window?: number | null;
  context_length?: number | null;
  pricing?: { prompt?: number | string | null; completion?: number | string | null } | null;
  isFree?: boolean | null;
  free?: boolean | null;
}

export interface GuideModelRowOptions {
  providerId: string;
  /** Human name of the provider (used for placeholder rows). */
  providerName?: string;
  /** Hand-written rows from the provider guide — kept only for still-live ids. */
  curated?: GuideModelRowInput[];
  pricingMode?: GuidePricingMode;
  /** Models discovered on this instance (synced catalog) — richest source. */
  liveModels?: LiveGuideModel[];
  /** Max rows returned (free rows are always kept first). */
  limit?: number;
}

export interface GuideModelRowResult {
  rows: GuideModelRow[];
  /** Total number of models the provider exposes (before the `limit` cut). */
  total: number;
  /** How many of the returned rows are free. */
  freeCount: number;
}

const DEFAULT_ROW_LIMIT = 12;

/** Human label for each free-tier regime of the shipped free catalog. */
const FREE_REGIME_LABEL: Record<string, string> = {
  "recurring-daily": "Free tier · daily quota",
  "recurring-monthly": "Free tier · monthly quota",
  "recurring-credit": "Free credits · recurring top-up",
  "recurring-uncapped": "Free tier · no published cap",
  "one-time-initial": "Free credits · signup only",
  keyless: "Keyless · no account needed",
};

interface GeminiLimitRow {
  rpm?: number;
  rpd?: number;
  tpm?: number;
}

function geminiLimitsFor(modelId: string): GeminiLimitRow | undefined {
  const table = geminiRateLimits as unknown as Record<string, GeminiLimitRow | undefined>;
  return table?.[modelId];
}

/** 131072 → "128k ctx", 1048576 → "1M ctx". */
export function formatContextWindow(tokens: number | undefined | null): string | undefined {
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens <= 0) return undefined;
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(2))}M ctx`;
  }
  return `${Math.round(tokens / 1024)}k ctx`;
}

/** 24000000 → "24M". */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1e9) return `${Number((tokens / 1e9).toFixed(1))}B`;
  if (tokens >= 1e6) return `${Math.round(tokens / 1e6)}M`;
  if (tokens >= 1e3) return `${Math.round(tokens / 1e3)}K`;
  return String(tokens);
}

/**
 * Normalize a hand-written context window ("128k", "1M tokens", "65,536") to
 * the same format the catalog-derived windows use, so a row never mixes
 * "128k" and "128k ctx".
 */
export function normalizeCuratedWindow(value: string): string | undefined {
  const raw = value.trim();
  const millions = raw.match(/^([\d.]+)\s*m\b/i);
  if (millions) return formatContextWindow(Number(millions[1]) * 1_000_000);
  const thousands = raw.match(/^([\d.,]+)\s*k\b/i);
  if (thousands) {
    const parsed = Number(thousands[1].replace(/,/g, ""));
    if (Number.isFinite(parsed)) return formatContextWindow(parsed * 1024);
  }
  const plain = raw.replace(/,/g, "");
  if (/^\d+$/.test(plain)) return formatContextWindow(Number(plain));
  return raw || undefined;
}

/** "$2 in / $10 out per 1M tokens" — only for prices we actually know. */
function formatPriceNote(input: number, output: number): string {
  const money = (value: number) => (value >= 1 ? `$${value}` : `$${value.toFixed(2)}`);
  return `${money(input)} in / ${money(output)} out per 1M tokens`;
}

function readPrice(provider: string, modelId: string): { input: number; output: number } | null {
  for (const key of [provider, resolveProviderId(provider)]) {
    const pricing = getPricingForModel(key, modelId);
    if (!pricing) continue;
    const input = Number(pricing.input);
    const output = Number(pricing.output);
    if (Number.isFinite(input) && Number.isFinite(output)) return { input, output };
  }
  // Known per-model list prices (exact ids only — never the estimated fallback).
  const known = KNOWN_MODEL_PRICING[modelId.toLowerCase()];
  if (known && !known.isFree) {
    return { input: known.inputCostPer1M, output: known.outputCostPer1M };
  }
  return null;
}

function resolveContextWindow(
  providerId: string,
  modelId: string,
  modelContextLength: number | undefined,
  providerDefaultContext: number | undefined
): string | undefined {
  const candidates: Array<number | null | undefined> = [
    modelContextLength,
    providerDefaultContext,
    MODEL_SPECS[modelId]?.contextWindow,
    getAuthoritativeProviderContextWindow(providerId, modelId),
    getAuthoritativeContextWindow(modelId),
  ];
  for (const candidate of candidates) {
    const formatted = formatContextWindow(candidate ?? undefined);
    if (formatted) return formatted;
  }
  return undefined;
}

function freeQuotaLabel(entry: FreeModelBudget): string | undefined {
  if (entry.monthlyTokens > 0) return `${formatTokenCount(entry.monthlyTokens)} tokens/mo`;
  if (entry.freeType === "keyless" || entry.freeType === "recurring-uncapped") {
    return "No published cap";
  }
  if (entry.creditTokens > 0) return `${formatTokenCount(entry.creditTokens)} signup credits`;
  return undefined;
}

function liveContextWindow(model: LiveGuideModel): number | undefined {
  for (const value of [model.contextWindow, model.context_window, model.context_length]) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function liveIsFree(model: LiveGuideModel): boolean | undefined {
  if (model.isFree === true || model.free === true) return true;
  const prompt = model.pricing?.prompt;
  if (prompt !== undefined && prompt !== null) {
    const numeric = Number(prompt);
    if (Number.isFinite(numeric)) return numeric === 0;
  }
  return undefined;
}

/**
 * Build the model rows of a provider's guide from the live catalog sources.
 *
 * Ordering: free models first (they are what the sheet is opened for), then
 * paid ones; alphabetical inside each group so the list is stable.
 */
export function buildGuideModelRows(options: GuideModelRowOptions): GuideModelRowResult {
  const { providerId, curated = [], pricingMode = "standard", liveModels = [] } = options;
  const limit = options.limit ?? DEFAULT_ROW_LIMIT;
  const resolvedId = resolveProviderId(providerId);

  const registryModels =
    getModelsByProviderId(providerId).length > 0
      ? getModelsByProviderId(providerId)
      : getModelsByProviderId(resolvedId);
  const registryEntry = getRegistryEntry(providerId) ?? getRegistryEntry(resolvedId);
  const providerDefaultContext = registryEntry?.defaultContextLength;

  const modelById = new Map<string, (typeof registryModels)[number]>();
  const modelByBasename = new Map<string, (typeof registryModels)[number]>();
  for (const model of registryModels) {
    modelById.set(model.id, model);
    const basename = model.id.split("/").pop();
    if (basename && !modelByBasename.has(basename)) modelByBasename.set(basename, model);
  }

  const liveById = new Map<string, LiveGuideModel>();
  for (const model of liveModels) {
    if (model?.id) liveById.set(model.id, model);
  }

  const curatedById = new Map<string, GuideModelRowInput>();
  for (const row of curated) curatedById.set(row.id.toLowerCase(), row);

  const freeEntries = FREE_MODEL_BUDGETS.filter(
    (entry) =>
      grantsFreeAccess(entry.freeType) &&
      (entry.provider === providerId || entry.provider === resolvedId)
  );

  const rows: GuideModelRow[] = [];
  const seenIds = new Set<string>();

  const mergeCurated = (row: GuideModelRow) => {
    const match = curatedById.get(row.id.toLowerCase());
    if (!match) return;
    if (!row.rpm && match.rpm) row.rpm = match.rpm;
    if (!row.dailyQuota && match.dailyQuota) row.dailyQuota = match.dailyQuota;
    if (!row.notes && match.notes) row.notes = match.notes;
    // The curated window is a hand-written claim — used only when no catalog
    // source knows the window for a model that still exists.
    if (!row.contextWindow && match.contextWindow) {
      row.contextWindow = normalizeCuratedWindow(match.contextWindow);
    }
  };

  /** Context window: live discovery → registry → provider default → specs. */
  const contextFor = (modelId: string, modelContextLength?: number): string | undefined => {
    const live = liveById.get(modelId);
    const liveWindow = live ? liveContextWindow(live) : undefined;
    return resolveContextWindow(
      providerId,
      modelId,
      liveWindow ?? modelContextLength,
      providerDefaultContext
    );
  };

  // ── 1. Documented free models (shipped free-tier catalog) ────────────────
  for (const entry of freeEntries) {
    if (seenIds.has(entry.modelId)) continue;
    const model =
      modelById.get(entry.modelId) ?? modelByBasename.get(entry.modelId.split("/").pop()!);
    const limits = geminiLimitsFor(entry.modelId);
    const row: GuideModelRow = {
      id: entry.modelId,
      name: model?.name || liveById.get(entry.modelId)?.name || entry.displayName || entry.modelId,
      pricing: "100% Free",
      isFree: true,
      contextWindow: contextFor(entry.modelId, model?.contextLength),
      rpm:
        limits && typeof limits.rpm === "number" && limits.rpm > 0
          ? `${limits.rpm} RPM`
          : undefined,
      dailyQuota:
        limits && typeof limits.rpd === "number" && limits.rpd > 0
          ? `${limits.rpd} req/day`
          : freeQuotaLabel(entry),
      notes: FREE_REGIME_LABEL[entry.freeType] ?? "Free tier",
    };
    mergeCurated(row);
    rows.push(row);
    seenIds.add(entry.modelId);
  }

  // ── 2. Models discovered on this instance (richest source) ───────────────
  for (const live of liveById.values()) {
    if (seenIds.has(live.id)) continue;
    const model = modelById.get(live.id) ?? modelByBasename.get(live.id.split("/").pop()!);
    const price = readPrice(providerId, live.id);
    const liveFree = liveIsFree(live);
    const isZeroPriced = price !== null && price.input === 0 && price.output === 0;

    let pricing: string;
    let isFree: boolean;
    let notes: string | undefined;

    if (pricingMode === "always-free") {
      pricing = "100% Free";
      isFree = true;
    } else if (pricingMode === "web-session") {
      pricing = "Free (web session)";
      isFree = true;
    } else if (liveFree === true || isZeroPriced) {
      pricing = "100% Free";
      isFree = true;
    } else if (price) {
      pricing = "Paid";
      isFree = false;
      notes = formatPriceNote(price.input, price.output);
    } else if (pricingMode === "free-tier") {
      pricing = "Free tier";
      isFree = true;
    } else {
      pricing = "Paid";
      isFree = false;
    }

    const row: GuideModelRow = {
      id: live.id,
      name: live.name || model?.name || live.id,
      pricing,
      isFree,
      contextWindow: contextFor(live.id, model?.contextLength),
      notes,
    };
    mergeCurated(row);
    rows.push(row);
    seenIds.add(live.id);
  }

  // ── 3. Every other model the provider exposes ───────────────────────────
  for (const model of registryModels) {
    if (seenIds.has(model.id)) continue;
    const price = readPrice(providerId, model.id);
    const isZeroPriced = price !== null && price.input === 0 && price.output === 0;

    let pricing: string;
    let isFree: boolean;
    let notes: string | undefined;

    if (pricingMode === "always-free") {
      pricing = "100% Free";
      isFree = true;
    } else if (pricingMode === "web-session") {
      pricing = "Free (web session)";
      isFree = true;
    } else if (isZeroPriced) {
      pricing = "100% Free";
      isFree = true;
    } else if (price) {
      pricing = "Paid";
      isFree = false;
      notes = formatPriceNote(price.input, price.output);
    } else if (pricingMode === "free-tier") {
      pricing = "Free tier";
      isFree = true;
    } else {
      pricing = "Paid";
      isFree = false;
    }

    const row: GuideModelRow = {
      id: model.id,
      name: model.name || model.id,
      pricing,
      isFree,
      contextWindow: contextFor(model.id, model.contextLength),
      notes,
    };
    mergeCurated(row);
    rows.push(row);
    seenIds.add(model.id);
  }

  // ── 4. Curated rows for providers without a registry entry ──────────────
  // Only kept when the id is still known to the free catalog or the registry;
  // anything else is a retired model and must not be offered for copy+route.
  for (const row of curated) {
    if (seenIds.has(row.id)) continue;
    const knownFree = freeEntries.some((entry) => entry.modelId === row.id);
    const knownRegistry = modelById.has(row.id);
    if (!knownFree && !knownRegistry) continue;
    const merged: GuideModelRow = {
      ...row,
      pricing: row.pricing ?? "Paid",
      isFree: row.isFree ?? (row.pricing ?? "").toLowerCase().includes("free"),
    };
    rows.push(merged);
    seenIds.add(row.id);
  }

  rows.sort((a, b) => {
    const fa = a.isFree ? 0 : 1;
    const fb = b.isFree ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.name.localeCompare(b.name);
  });

  const freeCount = rows.filter((row) => row.isFree).length;
  const total = rows.length;

  return { rows: rows.slice(0, Math.max(limit, 0)), total, freeCount };
}
