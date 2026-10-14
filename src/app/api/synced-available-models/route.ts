import { getAllSyncedAvailableModels } from "@/lib/db/models";
import { enrichCursorCatalog, getActiveSyncedCatalog } from "@/lib/db/models/activeSyncedCatalog";
import { isAuthenticated } from "@/shared/utils/apiAuth";

/**
 * GET /api/synced-available-models?provider=<id>
 * List synced available models for a provider (or all providers).
 */
export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json(
        { error: { message: "Authentication required", type: "invalid_api_key" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (provider) {
      // The dashboard merges operator-owned custom rows separately. Do not let
      // legacy imports act as evidence that a model still exists upstream.
      let catalog = await getActiveSyncedCatalog(provider, false);
      if (!catalog.models || catalog.models.length === 0) {
        try {
          const { getProviderNodes, getProviderNodeById } = await import("@/lib/db/providers");
          const node = (await getProviderNodeById(provider)) || (await getProviderNodes()).find((n: any) => n.id === provider || n.prefix === provider);
          if (node) {
            const alternateId = node.id === provider ? (node.prefix ? String(node.prefix) : null) : (node.id ? String(node.id) : null);
            if (alternateId) {
              const altCatalog = await getActiveSyncedCatalog(alternateId, false);
              if (altCatalog.models && altCatalog.models.length > 0) {
                catalog = altCatalog;
              }
            }
          }
        } catch {
          // ignore
        }
      }
      return Response.json({
        ...catalog,
        models: enrichCursorCatalog(provider, catalog.models),
      });
    }

    const allModels = await getAllSyncedAvailableModels();
    return Response.json(allModels);
  } catch {
    return Response.json(
      { error: { message: "Failed to fetch synced available models", type: "server_error" } },
      { status: 500 }
    );
  }
}
