import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { getProviderConnections } from "@/lib/db/providers";
import { getProviderById, AI_PROVIDERS } from "@/shared/constants/providers";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import { getSyncedAvailableModelsByConnection } from "@/lib/db/models";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function formatProviderName(providerId: string, customName?: string): string {
  if (customName && customName.trim()) return customName.trim();
  const meta = getProviderById(providerId) || AI_PROVIDERS[providerId];
  if (meta?.name) return meta.name;
  return providerId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const showAll = url.searchParams.get("all") === "true";
    const origin = url.origin;

    const settings = await getSettings();
    const publishedList = Array.isArray(settings.publishedProviders)
      ? (settings.publishedProviders as string[])
      : [];

    const connections = await getProviderConnections();

    const { isProviderConnectionConnected } = await import(
      "@/shared/utils/providerConnectionStatus"
    );
    const { getAllCustomizations } = await import(
      "@/lib/db/providerModelCustomizations"
    );

    const customizations = getAllCustomizations();
    const inactiveModelKeys = new Set(
      customizations
        .filter((c) => c.isActive === false)
        .map((c) => `${c.providerId}::${c.originalModelId}`)
    );

    // Map unique providers
    const providerMap = new Map<
      string,
      {
        id: string;
        name: string;
        icon: string;
        status: string;
        hasConnection: boolean;
        connectionCount: number;
        models: Set<string>;
      }
    >();

    // 1. Process all existing connections
    for (const conn of connections) {
      const pid = typeof conn.provider === "string" ? conn.provider : "";
      if (!pid) continue;

      const isConnected = isProviderConnectionConnected(conn);

      if (!providerMap.has(pid)) {
        const name = formatProviderName(pid, typeof conn.name === "string" ? conn.name : undefined);
        providerMap.set(pid, {
          id: pid,
          name,
          icon: `/providers/${pid}.svg`,
          status: isConnected ? "connected" : String(conn.testStatus || "unavailable"),
          hasConnection: isConnected,
          connectionCount: 0,
          models: new Set<string>(),
        });
      }

      const entry = providerMap.get(pid)!;
      entry.connectionCount += 1;
      if (isConnected) {
        entry.hasConnection = true;
        entry.status = "connected";
      }

      // Only expose models for connected connections
      if (isConnected) {
        // Add static models that are not marked inactive
        const staticModels = PROVIDER_MODELS[pid as keyof typeof PROVIDER_MODELS];
        if (Array.isArray(staticModels)) {
          for (const m of staticModels) {
            if (typeof m === "string" && !inactiveModelKeys.has(`${pid}::${m}`)) {
              entry.models.add(m);
            }
          }
        }

        // Add synced models if available and not marked inactive
        try {
          if (typeof conn.id === "string") {
            const synced = await getSyncedAvailableModelsByConnection(conn.id);
            if (Array.isArray(synced)) {
              for (const sm of synced) {
                if (sm?.modelId && !inactiveModelKeys.has(`${pid}::${sm.modelId}`)) {
                  entry.models.add(sm.modelId);
                }
              }
            }
          }
        } catch {
          // ignore individual sync lookup failures
        }
      }
    }

    // 2. In showAll mode (for showcase management) or for any published providers:
    // scan public/providers/*.svg so even providers without an API key can be selected!
    try {
      const providersDir = path.join(process.cwd(), "public/providers");
      if (fs.existsSync(providersDir)) {
        const files = fs.readdirSync(providersDir);
        for (const file of files) {
          if (!file.endsWith(".svg")) continue;
          const pid = file.replace(/\.svg$/, "");

          // If showAll is true OR this provider was selected in publishedList
          if (showAll || publishedList.includes(pid)) {
            if (!providerMap.has(pid)) {
              const meta = getProviderById(pid) || AI_PROVIDERS[pid];
              const name = meta?.name || formatProviderName(pid);
              const models = new Set<string>();

              const staticModels = PROVIDER_MODELS[pid as keyof typeof PROVIDER_MODELS];
              if (Array.isArray(staticModels)) {
                for (const m of staticModels) {
                  if (typeof m === "string") models.add(m);
                }
              }

              providerMap.set(pid, {
                id: pid,
                name,
                icon: `/providers/${pid}.svg`,
                status: "available",
                hasConnection: false,
                connectionCount: 0,
                models,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not scan public/providers dir:", e);
    }

    const allProviders = Array.from(providerMap.values()).map((p) => {
      return {
        id: p.id,
        name: p.name,
        icon: p.icon,
        iconUrl: `${origin}${p.icon}`,
        status: p.status,
        hasConnection: p.hasConnection,
        connectionCount: p.connectionCount,
        modelsCount: p.models.size,
        models: Array.from(p.models).slice(0, 150),
        isPublished: publishedList.includes(p.id),
      };
    });

    // In normal public mode:
    // If publishedList has items, return only published ones.
    // Otherwise return connected providers (or all if none connected).
    const filtered = showAll
      ? allProviders
      : publishedList.length > 0
        ? allProviders.filter((p) => publishedList.includes(p.id))
        : allProviders.filter((p) => p.hasConnection).length > 0
          ? allProviders.filter((p) => p.hasConnection)
          : allProviders.slice(0, 10);

    return NextResponse.json(
      {
        success: true,
        count: filtered.length,
        totalAvailable: allProviders.length,
        totalConnected: allProviders.filter((p) => p.hasConnection).length,
        publishedCount: publishedList.length,
        providers: filtered,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("Failed to fetch public providers:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch public providers",
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}

const updatePublishedSchema = z.object({
  publishedProviders: z.array(z.string().max(100)),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = updatePublishedSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload: publishedProviders array required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await updateSettings({
      publishedProviders: result.data.publishedProviders,
    });

    return NextResponse.json(
      {
        success: true,
        publishedProviders: result.data.publishedProviders,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("Failed to update published providers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update published providers" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
