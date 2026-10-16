import { NextResponse } from "next/server";
import { fetchPublicProviders } from "@/lib/cheaproute";

/** GET /api/catalog — CheapRouter live providers, proxied for the UI. */
export async function GET() {
  try {
    const catalog = await fetchPublicProviders();
    return NextResponse.json(catalog);
  } catch (err) {
    return NextResponse.json(
      { providers: [], combos: [], byokEnabled: null, error: err instanceof Error ? err.message : "Gateway unreachable" },
      { status: 502 }
    );
  }
}
