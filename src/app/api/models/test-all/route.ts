/**
 * Batch model-test endpoint.
 *
 * Probes every requested model of a provider and returns one result per
 * model. The probes run with BOUNDED PARALLELISM (see `runModelBatchTest`),
 * so a batch of 40 models no longer costs 40 x latency.
 *
 * Two response modes:
 *
 *  - default: one JSON body `{ results: { [modelId]: entry } }` (unchanged
 *    contract for existing callers),
 *  - `stream: true`: NDJSON — one line per FINISHED model
 *    (`{"modelId":"…","entry":{…}}`) followed by a summary line
 *    (`{"done":true,…}`), so the dashboard can paint each model the moment it
 *    resolves instead of waiting for the whole batch.
 *
 * The batch still stops early when it sees a run of rate-limited results
 * (a 429 storm means the upstream is down) and web-session providers that ban
 * burst probes stay strictly sequential.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { runModelBatchTest, type BatchTestResultEntry } from "@/lib/api/modelBatchTest";
import { getSettings } from "@/lib/db/settings";
import { getProviderConnections } from "@/lib/db/providers";
import * as log from "@/sse/utils/logger";

export type { BatchTestResultEntry } from "@/lib/api/modelBatchTest";

const testAllSchema = z.object({
  providerId: z.string().min(1),
  modelIds: z.array(z.string().min(1)).min(1).max(100),
  connectionId: z.string().optional(),
  respectRateLimit: z.boolean().optional().default(true),
  autoHideFailed: z.boolean().optional().default(false),
  /** NDJSON streaming mode — one line per finished model. */
  stream: z.boolean().optional().default(false),
  /** Concurrent probes for this provider (clamped server-side). */
  concurrency: z.number().int().min(1).max(16).optional(),
});

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  const validation = testAllSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 });
  }
  const {
    providerId,
    modelIds,
    connectionId,
    respectRateLimit,
    autoHideFailed,
    stream,
    concurrency,
  } = validation.data;
  const providerConnections = await getProviderConnections({ provider: providerId });
  if (
    providerConnections.length > 0 &&
    providerConnections.every((connection) => connection.isActive === false)
  ) {
    return NextResponse.json(
      { error: { message: `Provider ${providerId} has no active connections` } },
      { status: 409 }
    );
  }

  // #6328 (follow-up to #6495): REMOVE — not just hide — paid Test-all dispatches
  // when hidePaidModels is on. Paid ids are skipped inside the run without
  // dispatching; the skip does NOT touch the consecutive-rate-limit halt
  // counter (skips are not upstream failures). Fail open on settings read.
  let hidePaid = false;
  try {
    const settings = await getSettings();
    hidePaid = settings?.hidePaidModels === true;
  } catch {}

  log.info(
    "MODEL_TEST_ALL",
    `Starting batch test for ${modelIds.length} model(s) on provider ${providerId}`,
    {
      providerId,
      modelCount: modelIds.length,
      hasConnection: Boolean(connectionId),
      respectRateLimit,
      autoHideFailed,
      stream,
      concurrency,
    }
  );

  if (stream) {
    const encoder = new TextEncoder();
    const streamResponse = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          } catch {
            // Client disconnected mid-stream — the batch keeps running, the
            // write is simply dropped.
          }
        };

        try {
          const outcome = await runModelBatchTest({
            providerId,
            modelIds,
            connectionId,
            respectRateLimit,
            autoHideFailed,
            hidePaidModels: hidePaid,
            ...(concurrency ? { concurrency } : {}),
            onResult: (modelId: string, entry: BatchTestResultEntry) => {
              send({ modelId, entry });
            },
          });

          send({
            done: true,
            tested: outcome.tested,
            stoppedEarly: outcome.stoppedEarly,
            ...(outcome.stopReason ? { stopReason: outcome.stopReason } : {}),
          });

          log.info(
            "MODEL_TEST_ALL",
            `Batch test complete: ${Object.keys(outcome.results).length}/${modelIds.length} model(s)`,
            {
              providerId,
              tested: Object.keys(outcome.results).length,
              total: modelIds.length,
              stoppedEarly: outcome.stoppedEarly,
            }
          );
        } catch (error: unknown) {
          log.error("MODEL_TEST_ALL", "Batch test failed", {
            providerId,
            error: error instanceof Error ? error.message : "unknown",
          });
          send({ done: true, error: "Batch test failed" });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(streamResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const outcome = await runModelBatchTest({
    providerId,
    modelIds,
    connectionId,
    respectRateLimit,
    autoHideFailed,
    hidePaidModels: hidePaid,
    ...(concurrency ? { concurrency } : {}),
  });

  log.info(
    "MODEL_TEST_ALL",
    `Batch test complete: ${Object.keys(outcome.results).length}/${modelIds.length} model(s)`,
    {
      providerId,
      tested: Object.keys(outcome.results).length,
      total: modelIds.length,
      stoppedEarly: outcome.stoppedEarly,
    }
  );

  return NextResponse.json({
    results: outcome.results,
    ...(outcome.stoppedEarly && outcome.stopReason
      ? { stoppedEarly: true, stopReason: outcome.stopReason }
      : {}),
  });
}
