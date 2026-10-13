import type { SqliteAdapter } from "./adapters/types";

declare global {
  var __cheaprouteDb: SqliteAdapter | undefined;
}

/** Read the process-wide DB handle without initializing storage. */
export function getExistingDbInstance(): SqliteAdapter | null {
  return globalThis.__cheaprouteDb ?? null;
}

/** Replace the process-wide DB handle while preserving it across Next.js HMR. */
export function setDbInstance(db: SqliteAdapter | null): void {
  if (db) {
    globalThis.__cheaprouteDb = db;
  } else {
    delete globalThis.__cheaprouteDb;
  }
}
