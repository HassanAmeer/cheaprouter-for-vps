"use client";

/**
 * Helper to manage Recently Visited / Opened Providers in localStorage
 */

const RECENT_PROVIDERS_KEY = "cheaproute_recent_providers";
const MAX_RECENT_PROVIDERS = 16;

export interface RecentProviderEntry {
  id: string;
  name?: string;
  timestamp: number;
}

export function getRecentProviderIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_PROVIDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item : item?.id))
        .filter(Boolean);
    }
  } catch (err) {
    console.warn("Failed to read recent providers from localStorage:", err);
  }
  return [];
}

export function addRecentProvider(providerId: string, name?: string): void {
  if (typeof window === "undefined" || !providerId) return;
  try {
    const existing = getRecentProviderIds();
    const filtered = existing.filter((id) => id !== providerId);
    const updated = [providerId, ...filtered].slice(0, MAX_RECENT_PROVIDERS);
    localStorage.setItem(RECENT_PROVIDERS_KEY, JSON.stringify(updated));
    // Dispatch custom event for cross-component re-renders
    window.dispatchEvent(
      new CustomEvent("cheaproute:recent_providers_updated", {
        detail: { providerId, name, recentIds: updated },
      })
    );
  } catch (err) {
    console.warn("Failed to save recent provider to localStorage:", err);
  }
}
