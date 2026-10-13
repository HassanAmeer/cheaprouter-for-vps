/** JobRegistry singleton - survives Next.js HMR via globalThis. */

import { JobRegistry } from "./registry";

declare global {
  var __cheaprouteJobRegistry: JobRegistry | undefined;
}

export function getJobRegistry(): JobRegistry {
  if (!globalThis.__cheaprouteJobRegistry) {
    globalThis.__cheaprouteJobRegistry = new JobRegistry();
  }
  return globalThis.__cheaprouteJobRegistry;
}

/** Test-only: drop the singleton so each test starts fresh. */
export function __resetJobRegistry(): void {
  globalThis.__cheaprouteJobRegistry = undefined;
}

export type { JobDefinition, JobRecord, HandlerResult, JobRun } from "./core";
