"use client";

/**
 * Provider detail — Connections tab.
 *
 * The redesigned provider page showed the model table but no list of the
 * provider's credentials: you could connect and disconnect, but you could not
 * see, edit, retest or reorder a single connection. The per-connection row UI
 * already existed (`ConnectionRow`) — it was simply not rendered anywhere.
 *
 * This tab renders those rows with the actions the page can perform:
 * enable/disable, rate-limit protection, retest, edit, delete, reorder,
 * cooldown clear, token refresh and proxy toggles.
 */
import { useMemo } from "react";
import ConnectionRow, { type ConnectionRowConnection } from "./ConnectionRow";

export interface ConnectionsTabProps {
  connections: ConnectionRowConnection[];
  providerId: string;
  retestingId: string | null;
  cpaProviderEnabled: boolean;
  upstreamProxyMode?: "native" | "cliproxyapi" | "dario" | "fallback";
  upstreamProxyFallbackBackend?: "cliproxyapi" | "dario";
  onToggleActive: (id: string, isActive: boolean) => Promise<void> | void;
  onToggleRateLimit: (id: string, enabled: boolean) => Promise<void> | void;
  onRetest: (id: string) => Promise<void> | void;
  onEdit: (connection: ConnectionRowConnection) => void;
  onDelete: (id: string, name: string) => void;
  onMoveUp: (connection: ConnectionRowConnection) => void;
  onMoveDown: (connection: ConnectionRowConnection) => void;
  onRefreshToken?: (id: string) => Promise<void> | void;
  onToggleProxyEnabled?: (id: string, enabled: boolean) => Promise<void> | void;
  onTogglePerKeyProxyEnabled?: (id: string, enabled: boolean) => Promise<void> | void;
  onToggleCliproxyapiMode?: (id: string, enabled: boolean) => Promise<void> | void;
  onSetUpstreamProxyMode?: (
    mode: "native" | "cliproxyapi" | "dario" | "fallback",
    fallbackBackend?: "cliproxyapi" | "dario"
  ) => void;
  onAddConnection: () => void;
  onDisconnectAll?: () => void;
  isEmpty?: boolean;
}

export function ConnectionsTab(props: ConnectionsTabProps) {
  const {
    connections,
    providerId,
    retestingId,
    cpaProviderEnabled,
    upstreamProxyMode,
    upstreamProxyFallbackBackend,
    onToggleActive,
    onToggleRateLimit,
    onRetest,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onRefreshToken,
    onToggleProxyEnabled,
    onTogglePerKeyProxyEnabled,
    onToggleCliproxyapiMode,
    onSetUpstreamProxyMode,
    onAddConnection,
    onDisconnectAll,
  } = props;

  // Highest priority first — the same order the router picks connections in.
  const sorted = useMemo(
    () =>
      [...connections].sort((a, b) => {
        const pa = a.priority ?? 999;
        const pb = b.priority ?? 999;
        if (pa !== pb) return pa - pb;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      }),
    [connections]
  );

  if (sorted.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-14 px-4 border border-dashed border-border rounded-2xl bg-bg-surface/50 text-center"
        data-testid="connections-empty-state"
      >
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[28px]">link</span>
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-semibold text-text-main">No connections yet</h3>
          <p className="text-sm text-text-muted mt-1">
            Add an API key, OAuth account or local endpoint — this is what CheapRouter routes your
            requests through.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddConnection}
          className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[image:var(--grad-brand)] text-white text-sm font-medium hover:brightness-105 transition-all shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px]">add_link</span>
          <span>Add connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="connections-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-text-muted">link</span>
          <h2 className="text-xl font-semibold text-text-main">Connections</h2>
          <span className="px-2 py-0.5 rounded-full bg-bg-subtle border border-border text-xs font-semibold text-text-muted">
            {sorted.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onDisconnectAll && (
            <button
              type="button"
              onClick={onDisconnectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">link_off</span>
              <span>Disconnect all</span>
            </button>
          )}
          <button
            type="button"
            onClick={onAddConnection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[image:var(--grad-brand)] text-white text-xs font-semibold hover:brightness-105 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[14px]">add_link</span>
            <span>Add connection</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((conn, index) => (
          <ConnectionRow
            key={conn.id ?? `${conn.provider}-${index}`}
            connection={conn}
            isOAuth={conn.authType === "oauth"}
            isClaude={providerId === "claude"}
            isCodex={providerId === "codex" || providerId === "codex-app-server"}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            onMoveUp={() => onMoveUp(conn)}
            onMoveDown={() => onMoveDown(conn)}
            onToggleActive={(isActive) => onToggleActive(conn.id!, Boolean(isActive))}
            onToggleRateLimit={(enabled) => onToggleRateLimit(conn.id!, Boolean(enabled))}
            onRetest={() => onRetest(conn.id!)}
            isRetesting={retestingId === conn.id}
            onEdit={() => onEdit(conn)}
            onDelete={() => onDelete(conn.id!, conn.name ?? conn.displayName ?? conn.id!)}
            isCcCompatible={providerId.startsWith("anthropic-compatible-")}
            cliproxyapiEnabled={cpaProviderEnabled}
            onToggleCliproxyapiMode={
              onToggleCliproxyapiMode
                ? (enabled) => onToggleCliproxyapiMode(conn.id!, Boolean(enabled))
                : undefined
            }
            upstreamProxyMode={upstreamProxyMode}
            upstreamProxyFallbackBackend={upstreamProxyFallbackBackend}
            onSetUpstreamProxyMode={onSetUpstreamProxyMode}
            onToggleProxyEnabled={
              onToggleProxyEnabled
                ? (enabled) => onToggleProxyEnabled(conn.id!, Boolean(enabled))
                : undefined
            }
            onTogglePerKeyProxyEnabled={
              onTogglePerKeyProxyEnabled
                ? (enabled) => onTogglePerKeyProxyEnabled(conn.id!, Boolean(enabled))
                : undefined
            }
            onRefreshToken={onRefreshToken ? () => onRefreshToken(conn.id!) : undefined}
            onProxy={undefined}
            hasProxy={Boolean(conn.proxyEnabled)}
            proxyEnabled={conn.proxyEnabled}
            perKeyProxyEnabled={conn.perKeyProxyEnabled}
          />
        ))}
      </div>
    </div>
  );
}

export default ConnectionsTab;
