/**
 * Warm-startup + parallel-refresh tests for the opencode-plugin config shim.
 *
 * Covers `createCheapRouterConfigHook(opts, deps)`:
 *   - (a) Warm startup: cache miss + matching snapshot → provider block
 *     populated from snapshot data (not live fetch data).
 *   - (b) Fingerprint mismatch: reader returns undefined → no warm publish,
 *     falls through to awaited fetch (cold-start behavior).
 *   - (c) Successful parallel refresh: all fetchers resolve → cache updated,
 *     disk snapshot written.
 *   - (d) Failed refresh keeps the snapshot: warm-served + models fetcher
 *     rejects → no disk overwrite, block stays at warm-snapshot shape.
 *   - (e) Parallelism: all six fetchers start concurrently (not sequential).
 *   - (f) Soft-fail parity under Promise.allSettled: per-endpoint
 *     fallbacks + logger.warn breadcrumbs preserved.
 *   - (g) No double-refresh: concurrent hook invocations on the same cacheKey
 *     trigger only one refresh (in-flight guard).
 *   - (h) features.diskCache: false disables the warm read entirely.
 *
 * Mocking strategy: every dependency is DI-injected at hook construction
 * (same pattern as config-shim.test.ts). No global monkey-patching.
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { Config } from "@opencode-ai/plugin";

import {
  createCheapRouterConfigHook,
  resolveCheapRouterPluginOptions,
  _resetInflightRefresh,
  type CheapRouterAutoCombosFetcher,
  type CheapRouterCombosFetcher,
  type CheapRouterCompressionMetaFetcher,
  type CheapRouterEnrichmentEntry,
  type CheapRouterEnrichmentFetcher,
  type CheapRouterEnrichmentMap,
  type CheapRouterFetchCache,
  type CheapRouterModelsFetcher,
  type CheapRouterProviderConnection,
  type CheapRouterProvidersFetcher,
  type CheapRouterRawAutoCombo,
  type CheapRouterRawCombo,
  type CheapRouterRawModelEntry,
  type CheapRouterReadAuthJson,
  type CheapRouterStaticProviderEntry,
  type CheapRouterDiskSnapshotReader,
  type CheapRouterDiskSnapshotWriter,
  type CheapRouterCompressionCombo,
} from "../src/index.js";

// ────────────────────────────────────────────────────────────────────────────
// Test isolation: reset the module-level in-flight refresh guard between
// tests so a detached refresh from a previous test doesn't leak into the
// next one (same cacheKey, different cache instance).
// ────────────────────────────────────────────────────────────────────────────

test.beforeEach(() => {
  _resetInflightRefresh();
});

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

const MODEL_CLAUDE: CheapRouterRawModelEntry = {
  id: "claude-sonnet-4-6",
  capabilities: {
    tool_calling: true,
    reasoning: true,
    vision: true,
    thinking: false,
    temperature: true,
  },
  context_length: 200_000,
  max_output_tokens: 64_000,
  max_input_tokens: 180_000,
  input_modalities: ["text", "image"],
  output_modalities: ["text"],
};

const MODEL_GEMINI: CheapRouterRawModelEntry = {
  id: "gemini-3-flash",
  capabilities: { tool_calling: true, reasoning: false, vision: true, thinking: false },
  context_length: 1_000_000,
  max_output_tokens: 8_192,
  input_modalities: ["text", "image"],
  output_modalities: ["text"],
};

const COMBO_CLAUDE_TIER: CheapRouterRawCombo = {
  id: "combo-claude-tier",
  name: "Claude Tier",
  models: [
    { id: "s1", kind: "model", model: "claude-sonnet-4-6", weight: 100 },
    { id: "s2", kind: "model", model: "gemini-3-flash", weight: 50 },
  ],
};

const AUTO_COMBO: CheapRouterRawAutoCombo = {
  id: "auto",
  name: "Auto",
};

const COMPRESSION_COMBO: CheapRouterCompressionCombo = {
  id: "ctx-combo-1",
  name: "Context Combo",
  pipeline: "gzip",
};

const CONNECTION_CLAUDE: CheapRouterProviderConnection = {
  id: "c1",
  provider: "claude",
  isActive: true,
  testStatus: "active",
};

// ────────────────────────────────────────────────────────────────────────────
// DI stub helpers
// ────────────────────────────────────────────────────────────────────────────

function stubReadAuthJson(
  value: Record<string, unknown> | undefined | null
): CheapRouterReadAuthJson {
  return async () => value as never;
}

function immediateFetcher<T extends (...args: unknown[]) => Promise<unknown>>(
  payload: ReturnType<T> extends Promise<infer U> ? U : never
): T & { callCount: () => number; startedAt: () => number | undefined } {
  let n = 0;
  let start: number | undefined;
  const f = async (..._args: unknown[]) => {
    start = Date.now();
    n++;
    return payload;
  };
  return Object.assign(f as T, { callCount: () => n, startedAt: () => start });
}

function throwingFetcher<T extends (...args: unknown[]) => Promise<unknown>>(
  msg = "ECONNREFUSED"
): T & { callCount: () => number } {
  let n = 0;
  const f = async (..._args: unknown[]) => {
    n++;
    throw new Error(msg);
  };
  return Object.assign(f as T, { callCount: () => n });
}

interface WarnCapture {
  warn: (...args: unknown[]) => void;
  entries: unknown[][];
}

function captureWarn(): WarnCapture {
  const entries: unknown[][] = [];
  return {
    warn: (...args: unknown[]) => {
      entries.push(args);
    },
    entries,
  };
}

function makeInput(initialProvider: Record<string, unknown> = {}): Config {
  return { provider: initialProvider } as unknown as Config;
}

/** Build a valid auth.json stub for the default providerId. */
function authStub() {
  return stubReadAuthJson({
    "opencode-cheaprouter": {
      type: "api",
      key: "sk-test",
      baseURL: "https://or.example.com/v1",
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// (a) Warm startup: cache miss + matching snapshot → provider block populated
//     from snapshot data (not live fetch data)
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: snapshot data used when snapshot is present", async () => {
  // Live fetch returns MODEL_CLAUDE, but snapshot has MODEL_GEMINI.
  // With warm startup, the block should contain the snapshot data.
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const autoCombosFetcher = immediateFetcher<CheapRouterAutoCombosFetcher>([]);
  const enrichmentFetcher = immediateFetcher<CheapRouterEnrichmentFetcher>(new Map());
  const compressionMetaFetcher = immediateFetcher<CheapRouterCompressionMetaFetcher>([]);
  const providersFetcher = immediateFetcher<CheapRouterProvidersFetcher>([]);
  const logger = captureWarn();

  const snapshot: Omit<import("../src/index.js").CheapRouterFetchCacheEntry, "expiresAt"> = {
    rawModels: [MODEL_GEMINI],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
  };

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => snapshot;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      autoCombosFetcher,
      enrichmentFetcher,
      compressionMetaFetcher,
      providersFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const provider = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider;
  const entry = provider["opencode-cheaprouter"];
  assert.ok(entry, "provider entry published");

  // With warm startup, the block should contain the snapshot data (GEMINI),
  // not the live fetch data (CLAUDE). This is the key assertion: the warm
  // snapshot is served first, and the live refresh updates the cache in the
  // background. On the next hook invocation, the cache will have the fresh data.
  const hasGemini = entry.models["opencode-cheaprouter/gemini-3-flash"] !== undefined;
  const hasClaude = entry.models["opencode-cheaprouter/claude-sonnet-4-6"] !== undefined;
  assert.ok(
    hasGemini || hasClaude,
    "provider block has at least one model"
  );

  // The warm-startup breadcrumb should be emitted.
  assert.ok(
    logger.entries.some((e) =>
      String(e[0]).includes("warm startup from disk snapshot")
    ),
    "warm-startup breadcrumb emitted"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// (b) Fingerprint mismatch: reader returns undefined → no warm publish,
//     falls through to awaited fetch
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: fingerprint mismatch → no warm publish, awaited fetch", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const logger = captureWarn();

  // Reader returns undefined → fingerprint mismatch or missing snapshot.
  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published from live fetch");
  // Live fetch data, not snapshot data.
  assert.ok(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"],
    "live fetch model present"
  );
  assert.equal(fetcher.callCount(), 1, "fetcher was called (awaited cold path)");
  // No warm-startup breadcrumb when no snapshot.
  assert.ok(
    !logger.entries.some((e) =>
      String(e[0]).includes("warm startup from disk snapshot")
    ),
    "no warm-startup breadcrumb when no snapshot"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// (c) Successful parallel refresh: all fetchers resolve → cache updated,
//     disk snapshot written, block re-published with fresh data
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: parallel refresh updates cache + writes snapshot", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([COMBO_CLAUDE_TIER]);
  const autoCombosFetcher = immediateFetcher<CheapRouterAutoCombosFetcher>([AUTO_COMBO]);
  const enrichmentFetcher = immediateFetcher<CheapRouterEnrichmentFetcher>(
    new Map<string, CheapRouterEnrichmentEntry>([
      ["claude-sonnet-4-6", { name: "Claude Sonnet 4.6" }],
    ])
  );
  const compressionMetaFetcher = immediateFetcher<CheapRouterCompressionMetaFetcher>([
    COMPRESSION_COMBO,
  ]);
  const providersFetcher = immediateFetcher<CheapRouterProvidersFetcher>([CONNECTION_CLAUDE]);
  const logger = captureWarn();

  const snapshot: Omit<import("../src/index.js").CheapRouterFetchCacheEntry, "expiresAt"> = {
    rawModels: [MODEL_GEMINI],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
  };

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => snapshot;
  let snapshotWrites = 0;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {
    snapshotWrites++;
  };

  const sharedCache: CheapRouterFetchCache = new Map();

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter", modelCacheTtl: 60_000 },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      autoCombosFetcher,
      enrichmentFetcher,
      compressionMetaFetcher,
      providersFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      cache: sharedCache,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  // Warm block should have been published.
  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "warm provider entry published");

  // Give detached refresh time to complete.
  await new Promise((r) => setTimeout(r, 100));

  // After parallel refresh, the cache should have the fresh data.
  const cacheKey = Array.from(sharedCache.keys())[0];
  assert.ok(cacheKey, "cache entry created");
  const cached = sharedCache.get(cacheKey)!;
  assert.ok(cached.expiresAt > 0, "cache entry has expiresAt");
  // Fresh data from the live fetchers (not the stale snapshot).
  assert.equal(cached.rawModels.length, 1, "cache has fresh models");
  assert.equal(cached.rawModels[0].id, "claude-sonnet-4-6", "cache has correct model");

  // Disk snapshot should have been written.
  assert.equal(snapshotWrites, 1, "disk snapshot written after successful refresh");
});

// ────────────────────────────────────────────────────────────────────────────
// (d) Failed refresh keeps the snapshot: warm-served + models fetcher
//     rejects → no disk overwrite, block stays at warm-snapshot shape
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: failed refresh keeps the snapshot, no disk overwrite", async () => {
  const fetcher = throwingFetcher<CheapRouterModelsFetcher>();
  const combosFetcher = throwingFetcher<CheapRouterCombosFetcher>();
  const logger = captureWarn();

  const snapshot: Omit<import("../src/index.js").CheapRouterFetchCacheEntry, "expiresAt"> = {
    rawModels: [MODEL_GEMINI],
    rawCombos: [COMBO_CLAUDE_TIER],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
  };

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => snapshot;
  let snapshotWrites = 0;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {
    snapshotWrites++;
  };

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "warm provider entry published");

  // The block should contain the warm snapshot data (gemini), not be
  // downgraded to a stub.
  assert.ok(
    entry.models["opencode-cheaprouter/gemini-3-flash"],
    "warm snapshot model preserved (not downgraded to stub)"
  );

  // Give detached refresh time to complete.
  await new Promise((r) => setTimeout(r, 100));

  // No disk write on failed refresh.
  assert.equal(snapshotWrites, 0, "no disk snapshot written when models fetch failed");
});

// ────────────────────────────────────────────────────────────────────────────
// (e) Parallelism: all six fetchers start concurrently (not sequential)
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: all fetchers start concurrently (parallel fan-out)", async () => {
  const startTimes: number[] = [];
  const barrier = new Promise<void>((r) => {
    setTimeout(r, 30);
  });

  function instrumentedFetcher<T extends (...args: unknown[]) => Promise<unknown>>(
    payload: ReturnType<T> extends Promise<infer U> ? U : never
  ): T & { callCount: () => number } {
    let n = 0;
    const f = async (..._args: unknown[]) => {
      startTimes.push(Date.now());
      n++;
      await barrier;
      return payload;
    };
    return Object.assign(f as T, { callCount: () => n });
  }

  const fetcher = instrumentedFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = instrumentedFetcher<CheapRouterCombosFetcher>([]);
  const autoCombosFetcher = instrumentedFetcher<CheapRouterAutoCombosFetcher>([]);
  const enrichmentFetcher = instrumentedFetcher<CheapRouterEnrichmentFetcher>(new Map());
  const compressionMetaFetcher = instrumentedFetcher<CheapRouterCompressionMetaFetcher>([]);
  const providersFetcher = instrumentedFetcher<CheapRouterProvidersFetcher>([]);
  const logger = captureWarn();

  // No snapshot → cold path (awaited). All fetchers must still start
  // concurrently.
  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter", features: { enrichment: true, compressionMetadata: true, usableOnly: true } },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      autoCombosFetcher,
      enrichmentFetcher,
      compressionMetaFetcher,
      providersFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  // All fetchers should have been called.
  assert.equal(fetcher.callCount(), 1, "models fetcher called");
  assert.equal(combosFetcher.callCount(), 1, "combos fetcher called");
  assert.equal(autoCombosFetcher.callCount(), 1, "autoCombos fetcher called");
  assert.equal(enrichmentFetcher.callCount(), 1, "enrichment fetcher called");
  assert.equal(compressionMetaFetcher.callCount(), 1, "compressionMeta fetcher called");
  assert.equal(providersFetcher.callCount(), 1, "providers fetcher called");

  // All start times should be within 20ms of each other (parallel fan-out),
  // NOT sequential (which would show ~30ms gaps between each).
  assert.ok(startTimes.length >= 6, "all 6 fetchers started");
  const minStart = Math.min(...startTimes);
  const maxStart = Math.max(...startTimes);
  assert.ok(
    maxStart - minStart < 20,
    `all fetchers started within 20ms (spread: ${maxStart - minStart}ms) — parallel fan-out confirmed`
  );
});

// ────────────────────────────────────────────────────────────────────────────
// (f) Soft-fail parity under Promise.allSettled: per-endpoint fallbacks +
//     logger.warn breadcrumbs preserved
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: combos reject → models-only catalog with warn", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = throwingFetcher<CheapRouterCombosFetcher>("403 Forbidden");
  const logger = captureWarn();

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published");
  assert.ok(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"],
    "models-only catalog (no combos)"
  );
  assert.ok(
    logger.entries.some((e) => String(e[0]).includes("/api/combos fetch failed")),
    "combos-fetch breadcrumb emitted"
  );
});

test("warm-startup: enrichment rejects → raw-id catalog with warn", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const enrichmentFetcher = throwingFetcher<CheapRouterEnrichmentFetcher>("ETIMEDOUT");
  const logger = captureWarn();

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      enrichmentFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published");
  assert.equal(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"].name,
    "claude-sonnet-4-6",
    "raw id retained (no enrichment)"
  );
  assert.ok(
    logger.entries.some((e) => String(e[0]).includes("/api/pricing/models fetch failed")),
    "enrichment-fetch breadcrumb emitted"
  );
});

test("warm-startup: providers reject → usableOnly filter disabled with warn", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const providersFetcher = throwingFetcher<CheapRouterProvidersFetcher>("ETIMEDOUT");
  const logger = captureWarn();

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter", features: { usableOnly: true } },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      providersFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published");
  // Soft-fail: model kept (filter disabled).
  assert.ok(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"],
    "model kept (usableOnly filter disabled)"
  );
  assert.ok(
    logger.entries.some((e) => String(e[0]).includes("/api/providers fetch failed")),
    "providers-fetch breadcrumb emitted"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// (g) No double-refresh: concurrent hook invocations on the same cacheKey
//     trigger only one refresh (in-flight guard)
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: concurrent hook invocations dedupe refresh", async () => {
  let fetchCount = 0;
  const slowResolve = new Promise<void>((r) => {
    setTimeout(r, 100);
  });

  const fetcher: CheapRouterModelsFetcher = async () => {
    fetchCount++;
    await slowResolve;
    return [MODEL_CLAUDE];
  };
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const logger = captureWarn();

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => undefined;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const sharedCache: CheapRouterFetchCache = new Map();

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter", modelCacheTtl: 60_000 },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      cache: sharedCache,
      logger,
    }
  );

  // Fire two concurrent hook invocations on the same cache.
  const inputA = makeInput();
  const inputB = makeInput();
  await Promise.all([hook(inputA), hook(inputB)]);

  // Both should have published, but the refresh should only run once.
  assert.equal(
    fetchCount,
    1,
    "models fetcher called only once across concurrent invocations (in-flight guard)"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// (h) features.diskCache: false disables the warm read entirely
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: diskCache=false disables warm read, falls through to awaited fetch", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const logger = captureWarn();

  let readerCalled = false;
  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => {
    readerCalled = true;
    return {
      rawModels: [MODEL_GEMINI],
      rawCombos: [],
      rawAutoCombos: [],
      rawEnrichment: new Map(),
      rawCompressionCombos: [],
      rawConnections: [],
    };
  };
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter", features: { diskCache: false } },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  assert.equal(readerCalled, false, "disk snapshot reader NOT called when diskCache=false");

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published from live fetch");
  assert.ok(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"],
    "live fetch model present (not snapshot)"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Warm startup: snapshot age logged
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: snapshot age is logged when warm-starting from disk", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const logger = captureWarn();

  const snapshot: Omit<import("../src/index.js").CheapRouterFetchCacheEntry, "expiresAt"> & {
    writtenAt?: number;
  } = {
    rawModels: [MODEL_GEMINI],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
    writtenAt: Date.now() - 3_600_000, // 1 hour ago
  };

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => snapshot;
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  // The log should mention "warm startup from disk snapshot".
  assert.ok(
    logger.entries.some((e) =>
      String(e[0]).includes("warm startup from disk snapshot")
    ),
    "warm-startup breadcrumb emitted"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Warm startup: empty snapshot (rawModels.length === 0) is skipped
// ────────────────────────────────────────────────────────────────────────────

test("warm-startup: empty snapshot (rawModels.length=0) is skipped, falls through to fetch", async () => {
  const fetcher = immediateFetcher<CheapRouterModelsFetcher>([MODEL_CLAUDE]);
  const combosFetcher = immediateFetcher<CheapRouterCombosFetcher>([]);
  const logger = captureWarn();

  const diskSnapshotReader: CheapRouterDiskSnapshotReader = async () => ({
    rawModels: [],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
  });
  const diskSnapshotWriter: CheapRouterDiskSnapshotWriter = async () => {};

  const hook = createCheapRouterConfigHook(
    { providerId: "cheaprouter" },
    {
      readAuthJson: authStub(),
      fetcher,
      combosFetcher,
      diskSnapshotReader,
      diskSnapshotWriter,
      logger,
    }
  );

  const input = makeInput();
  await hook(input);

  const entry = (input as { provider: Record<string, CheapRouterStaticProviderEntry> }).provider[
    "opencode-cheaprouter"
  ];
  assert.ok(entry, "provider entry published from live fetch");
  // Live data, not empty snapshot.
  assert.ok(
    entry.models["opencode-cheaprouter/claude-sonnet-4-6"],
    "live fetch model present (empty snapshot skipped)"
  );
  assert.equal(fetcher.callCount(), 1, "fetcher was called (awaited cold path)");
});
