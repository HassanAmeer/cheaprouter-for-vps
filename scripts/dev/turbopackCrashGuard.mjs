// Crash-guard for Turbopack dev panics (upstream turbo-tasks abort).
//
// Context: Turbopack's Rust core can abort the whole process mid-compile
// (e.g. `inner_of_upper_lost_follower ... Aborting.` in
// turbo-tasks-backend's aggregation_update.rs). An abort runs NO Node
// cleanup — SIGINT/SIGTERM handlers never fire — so the next `npm run dev`
// would boot straight back into the crashing bundler.
//
// This module implements a crash marker: the runner writes it once the dev
// server is listening and deletes it on clean shutdown. A marker left behind
// therefore means the previous run died uncleanly (panic / SIGKILL /
// double-Ctrl+C force-exit). When the marker is FRESH (< 10 min old) and the
// dead run used Turbopack, the runner auto-switches to webpack for this boot
// and purges the Turbopack cache (CHEAPROUTE_USE_TURBOPACK=0 keeps forcing
// webpack outright).
//
// Pure + side-effect-isolated (file path injectable) so it can be unit-tested
// without booting Next.

import fs from "node:fs";
import path from "node:path";

// Only a *recent* unclean exit triggers the fallback: a crash is almost
// always followed by an immediate restart, while a stale marker is more
// likely a force-killed session from long ago.
export const CRASH_MARKER_MAX_AGE_MS = 10 * 60 * 1000;

export function crashMarkerPath(
  distDir = process.env.NEXT_DIST_DIR || ".build/next",
  cwd = process.cwd()
) {
  const base = path.isAbsolute(distDir) ? distDir : path.join(cwd, distDir);
  return path.join(base, "turbopack.last-run.json");
}

/**
 * Read a crash marker. Returns `{ bundler, pid, startedAt }` or null when
 * absent/unreadable/malformed.
 */
export function readCrashMarker(file = crashMarkerPath()) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw && typeof raw === "object" && typeof raw.startedAt === "number") return raw;
    return null;
  } catch {
    return null;
  }
}

/** Record that a dev server with this bundler is now serving. */
export function writeCrashMarker(bundler, file = crashMarkerPath()) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ bundler, pid: process.pid, startedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Remove the marker (clean shutdown — no crash to remember). */
export function clearCrashMarker(file = crashMarkerPath()) {
  try {
    fs.rmSync(file, { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the marker describes a recent Turbopack run that never shut down
 * cleanly — the auto-fallback condition.
 */
export function isFreshTurbopackCrash(marker, now = Date.now()) {
  if (!marker || marker.bundler !== "turbopack") return false;
  if (typeof marker.startedAt !== "number") return false;
  return now - marker.startedAt >= 0 && now - marker.startedAt < CRASH_MARKER_MAX_AGE_MS;
}
