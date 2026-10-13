export type ServerLifecyclePhase = "starting" | "ready" | "stopping";

declare global {
  var __cheaprouteServerLifecycle: ServerLifecyclePhase | undefined;
}

export function getServerLifecyclePhase(): ServerLifecyclePhase {
  return globalThis.__cheaprouteServerLifecycle ?? "starting";
}

export function markServerStarting(): void {
  globalThis.__cheaprouteServerLifecycle = "starting";
}

export function markServerReady(): void {
  if (getServerLifecyclePhase() !== "stopping") {
    globalThis.__cheaprouteServerLifecycle = "ready";
  }
}

export function markServerStopping(): void {
  globalThis.__cheaprouteServerLifecycle = "stopping";
}
