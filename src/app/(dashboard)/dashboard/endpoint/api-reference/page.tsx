"use client";

import { useEffect, useMemo, useState } from "react";
import { useDisplayBaseUrl } from "@/shared/hooks";
import { matchesSearch } from "@/shared/utils/turkishText";
import ApiDocsIntegrationHub from "../components/ApiDocsIntegrationHub";

/* ─── Types (mirror /api/openapi/spec) ────────────────────────────── */
interface Endpoint {
  method: string;
  path: string;
  tags: string[];
  summary: string;
  description: string;
  security: boolean;
  parameters: any[];
  requestBody: boolean;
  exampleBody?: any;
  responses: string[];
  loopbackOnly?: boolean;
  alwaysProtected?: boolean;
  internal?: boolean;
}
interface CatalogData {
  info: { title?: string; version?: string; description?: string };
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string }[];
  endpoints: Endpoint[];
  schemas: string[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  PATCH: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  DELETE: "bg-red-500/15 text-red-500 border-red-500/30",
};

const methodColor = (m: string) =>
  METHOD_COLORS[m?.toUpperCase()] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";

const epKey = (ep: Endpoint) => `${ep.method?.toUpperCase()} ${ep.path}`;

function CodeBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
        {label}
      </div>
      <pre className="rounded-lg border border-border bg-surface/60 p-3 overflow-x-auto text-xs leading-relaxed text-text-main">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function ParamRow({ p }: { p: any }) {
  const name = p?.name ?? "—";
  const loc = p?.in ?? (p?.schema?.in ?? "");
  const required = p?.required ?? p?.schema?.required ?? false;
  const desc =
    p?.description ?? p?.schema?.description ?? p?.summary ?? "";
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-3 font-mono text-xs text-text-main align-top">{name}</td>
      <td className="py-2 pr-3 text-xs text-text-muted align-top">{loc}</td>
      <td className="py-2 pr-3 align-top">
        {required ? (
          <span className="text-[10px] font-semibold text-red-400">required</span>
        ) : (
          <span className="text-[10px] text-text-muted/60">optional</span>
        )}
      </td>
      <td className="py-2 text-xs text-text-muted align-top">{desc}</td>
    </tr>
  );
}

function EndpointDoc({ ep, baseUrl }: { ep: Endpoint; baseUrl: string }) {
  const example =
    ep.exampleBody !== undefined ? JSON.stringify(ep.exampleBody, null, 2) : null;

  return (
    <article className="space-y-6">
      <header>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className={`text-xs font-bold px-2 py-1 rounded border ${methodColor(ep.method)}`}>
            {ep.method?.toUpperCase()}
          </span>
          <span className="font-mono text-sm text-text-main break-all">{ep.path}</span>
          <span className="flex gap-1 ml-auto">
            {ep.security && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                AUTH
              </span>
            )}
            {ep.loopbackOnly && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/30">
                LOCAL
              </span>
            )}
            {ep.internal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 border border-gray-500/30">
                INTERNAL
              </span>
            )}
          </span>
        </div>
        <h1 className="text-xl font-bold text-text-main">{ep.summary}</h1>
        {ep.description && (
          <p className="text-sm text-text-muted mt-2 leading-relaxed whitespace-pre-wrap">
            {ep.description}
          </p>
        )}
      </header>

      {ep.parameters?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-main mb-2">Parameters</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface/60 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted p-2">Name</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted p-2">In</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted p-2">Required</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted p-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {ep.parameters.map((p, i) => (
                  <ParamRow key={i} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ep.requestBody && (
        <section>
          <h2 className="text-sm font-semibold text-text-main mb-2">Request body</h2>
          {example ? (
            <CodeBlock label="application/json">{example}</CodeBlock>
          ) : (
            <p className="text-xs text-text-muted">See the schema for this request.</p>
          )}
        </section>
      )}

      {ep.responses?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-main mb-2">Responses</h2>
          <div className="flex flex-wrap gap-2">
            {ep.responses.map((r, i) => (
              <span
                key={i}
                className="text-[11px] font-mono px-2 py-1 rounded bg-surface/60 border border-border text-text-muted"
              >
                {r}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-text-main mb-2">Try it</h2>
        <CodeBlock label="cURL">
          {`curl -X ${ep.method?.toUpperCase()} ${baseUrl}${ep.path}` +
            (ep.security ? ` \\\n  -H "Authorization: Bearer $CHEAPROUTE_API_KEY"` : "") +
            (example ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.exampleBody)}'` : "")}
        </CodeBlock>
      </section>
    </article>
  );
}

export default function ApiReferencePage() {
  const baseUrl = useDisplayBaseUrl();
  const [viewMode, setViewMode] = useState<"reseller" | "all">("reseller");
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/openapi/spec")
      .then((r) => r.json())
      .then((d: CatalogData) => {
        setCatalog(d);
        if (d?.endpoints?.length) setSelected(epKey(d.endpoints[0]));
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  // Group endpoints by their first tag (fallback "General").
  const groups = useMemo(() => {
    if (!catalog) return [] as Array<{ tag: string; description?: string; items: Endpoint[] }>;
    const map = new Map<string, Endpoint[]>();
    const order: string[] = [];
    for (const ep of catalog.endpoints) {
      const tag = ep.tags?.[0] ?? "General";
      if (!map.has(tag)) {
        map.set(tag, []);
        order.push(tag);
      }
      map.get(tag)!.push(ep);
    }
    const descByTag = new Map((catalog.tags ?? []).map((t) => [t.name, t.description]));
    return order.map((tag) => ({ tag, description: descByTag.get(tag), items: map.get(tag)! }));
  }, [catalog]);

  const filteredGroups = useMemo(() => {
    const query = filter.trim();
    if (!query) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (ep) =>
            matchesSearch(ep.path, query) ||
            matchesSearch(ep.method, query) ||
            matchesSearch(ep.summary, query)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter]);

  const current = useMemo(
    () => catalog?.endpoints.find((ep) => epKey(ep) === selected) ?? null,
    [catalog, selected]
  );

  const sidebar = (
    <nav className="space-y-4">
      {filteredGroups.map((g) => (
        <div key={g.tag}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 mb-1">
            {g.tag}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((ep) => {
              const active = epKey(ep) === selected;
              return (
                <li key={epKey(ep)}>
                  <button
                    onClick={() => {
                      setSelected(epKey(ep));
                      setMobileOpen(false);
                    }}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                      active
                        ? "bg-primary/10 text-text-main"
                        : "text-text-muted hover:bg-surface/50 hover:text-text-main"
                    }`}
                  >
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${methodColor(ep.method)}`}>
                      {ep.method?.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] truncate">{ep.path}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-text-main">API Documentation</h1>
          <p className="text-sm text-text-muted mt-1">
            Reseller website integration guides, CRUD endpoints, and AI proxy references.{" "}
            <span className="text-text-muted/70">Base URL: </span>
            <span className="font-mono text-text-main">{baseUrl}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-border self-start md:self-auto">
          <button
            onClick={() => setViewMode("reseller")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              viewMode === "reseller"
                ? "bg-action text-white shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Reseller Integration APIs (Recommended)
          </button>
          <button
            onClick={() => setViewMode("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              viewMode === "all"
                ? "bg-action text-white shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            All Raw Endpoints
          </button>
        </div>
      </div>

      {viewMode === "reseller" && <ApiDocsIntegrationHub />}

      {viewMode === "all" && (
        <>
          <p className="text-xs text-text-muted mb-4 rounded-md border border-border bg-surface/50 p-2">
            <span className="font-semibold text-text-main">Authentication:</span> pass your
            CheapRouter API key as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>{" "}
            (endpoints marked <span className="font-semibold">AUTH</span> require it).
          </p>

      {loading && (
        <div className="space-y-3">
          <div className="shimmer h-4 w-40 rounded" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer h-8 w-full rounded" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load the API spec: {error}
        </div>
      )}

      {!loading && !error && catalog && (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          {/* Sidebar (desktop) */}
          <aside className="hidden md:block">
            <input
              className="input mb-3"
              placeholder="Filter endpoints…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="rounded-lg border border-border bg-surface/40 p-2 max-h-[70vh] overflow-y-auto">
              {sidebar}
            </div>
          </aside>

          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden btn btn-outline"
            onClick={() => setMobileOpen((v) => !v)}
          >
            Endpoints ({catalog.endpoints.length})
          </button>
          {mobileOpen && (
            <div className="md:hidden rounded-lg border border-border bg-surface/40 p-2">
              <input
                className="input mb-3"
                placeholder="Filter endpoints…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {sidebar}
            </div>
          )}

          {/* Doc body */}
          <section className="rounded-xl border border-border bg-surface/30 p-4 md:p-6 min-h-[50vh]">
            {current ? (
              <EndpointDoc ep={current} baseUrl={baseUrl} />
            ) : (
              <p className="text-text-muted text-sm">Select an endpoint from the sidebar.</p>
            )}
          </section>
        </div>
      )}
        </>
      )}
    </div>
  );
}
