/**
 * Client-side helper for testing many models at once.
 *
 * The dashboard used to fire one HTTP request PER MODEL (serial, or in
 * chunks of 3) and wait for each to come back before the next one started.
 * With 30s timeouts that meant a 40-model batch could take many minutes of
 * pure waiting.
 *
 * This helper sends ONE request per provider (up to 100 models per request)
 * and consumes the NDJSON stream the endpoint emits, so every model is
 * painted the moment its probe resolves. Providers themselves are probed in
 * parallel too (bounded by `groupConcurrency`), because different providers
 * have independent rate limits.
 *
 * Server-side the probes of one provider also run in parallel (bounded by
 * the endpoint's own concurrency limit), so a single provider's models no
 * longer wait for each other either.
 */

/** One model's probe result, as returned by `/api/models/test-all`. */
export interface ModelTestEntry {
  status?: "ok" | "error" | "slow";
  rateLimited?: boolean;
  isTimeout?: boolean;
  isTransient?: boolean;
  isQuota?: boolean;
  skipped?: boolean;
  error?: string;
  responseText?: string;
  latencyMs?: number;
  statusCode?: number;
  hidden?: boolean;
}

/** A set of models that belong to one provider (tested in one request). */
export interface ModelTestGroup {
  providerId: string;
  connectionId?: string;
  modelIds: string[];
  autoHideFailed?: boolean;
}

export interface ParallelModelTestOptions {
  groups: ModelTestGroup[];
  /** Called for every finished model — paint it here. */
  onResult: (args: {
    providerId: string;
    modelId: string;
    entry: ModelTestEntry;
  }) => void | Promise<void>;
  /** Progress callback (finished count so far). */
  onProgress?: (done: number, total: number) => void;
  /** How many providers are probed at the same time (default 2). */
  groupConcurrency?: number;
  /** Server-side probes per provider (default: the endpoint's own default). */
  concurrency?: number;
}

export interface ParallelModelTestSummary {
  ok: number;
  error: number;
  total: number;
}

/** The endpoint accepts at most 100 model ids per request. */
const MAX_MODELS_PER_REQUEST = 100;
/** How many providers are probed at the same time by default. */
export const DEFAULT_GROUP_CONCURRENCY = 2;

function chunkModelIds(modelIds: string[]): string[][] {
  if (modelIds.length <= MAX_MODELS_PER_REQUEST) return [modelIds];
  const chunks: string[][] = [];
  for (let i = 0; i < modelIds.length; i += MAX_MODELS_PER_REQUEST) {
    chunks.push(modelIds.slice(i, i + MAX_MODELS_PER_REQUEST));
  }
  return chunks;
}

function isOkEntry(entry: ModelTestEntry | undefined): boolean {
  return entry?.status === "ok";
}

/** Parse one NDJSON line; returns null for blanks. */
function parseStreamLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Test every model of every group, several at a time.
 *
 * Returns the ok/error tally. Per-model decisions (auto-hide, quota badge)
 * stay with the caller through `onResult`.
 */
export async function runParallelModelTests(
  options: ParallelModelTestOptions
): Promise<ParallelModelTestSummary> {
  const { groups, onResult, onProgress } = options;
  const groupConcurrency = Math.max(1, options.groupConcurrency ?? DEFAULT_GROUP_CONCURRENCY);
  const total = groups.reduce((sum, group) => sum + group.modelIds.length, 0);

  let done = 0;
  let ok = 0;
  let error = 0;

  const report = async (providerId: string, modelId: string, entry: ModelTestEntry) => {
    if (isOkEntry(entry)) ok++;
    else error++;
    done += 1;
    await onResult({ providerId, modelId, entry });
    onProgress?.(done, total);
  };

  const runGroup = async (group: ModelTestGroup) => {
    for (const chunk of chunkModelIds(group.modelIds)) {
      let response: Response;
      try {
        response = await fetch("/api/models/test-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: group.providerId,
            connectionId: group.connectionId,
            modelIds: chunk,
            stream: true,
            ...(group.autoHideFailed !== undefined ? { autoHideFailed: group.autoHideFailed } : {}),
            ...(options.concurrency ? { concurrency: options.concurrency } : {}),
          }),
        });
      } catch {
        for (const modelId of chunk) {
          await report(group.providerId, modelId, {
            status: "error",
            error: "Network error testing model",
          });
        }
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("x-ndjson")) {
        // Fallback: a non-streaming response (older server / error body).
        let entries: Record<string, ModelTestEntry> = {};
        try {
          const body = await response.json();
          entries = (body?.results ?? {}) as Record<string, ModelTestEntry>;
        } catch {
          entries = {};
        }
        for (const modelId of chunk) {
          await report(
            group.providerId,
            modelId,
            entries[modelId] ?? { status: "error", error: "Model test failed" }
          );
        }
        continue;
      }

      if (!response.body) {
        for (const modelId of chunk) {
          await report(group.providerId, modelId, {
            status: "error",
            error: "Model test failed",
          });
        }
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        for (;;) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");
            const parsed = parseStreamLine(line);
            if (!parsed) continue;
            if (parsed.done === true) continue;
            const modelId = typeof parsed.modelId === "string" ? parsed.modelId : null;
            if (!modelId) continue;
            const entry = (parsed.entry ?? {}) as ModelTestEntry;
            await report(group.providerId, modelId, entry);
          }
        }
        const tail = parseStreamLine(buffer);
        if (tail && typeof tail.modelId === "string" && tail.done !== true) {
          await report(group.providerId, tail.modelId, (tail.entry ?? {}) as ModelTestEntry);
        }
      } catch {
        // Stream broke — models without a result are reported as failures by
        // the caller's final tally only if the server sent nothing for them.
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    }
  };

  let groupCursor = 0;
  const groupWorker = async () => {
    for (;;) {
      const index = groupCursor++;
      if (index >= groups.length) return;
      await runGroup(groups[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(groupConcurrency, groups.length || 1)) }, () =>
      groupWorker()
    )
  );

  return { ok, error, total };
}
