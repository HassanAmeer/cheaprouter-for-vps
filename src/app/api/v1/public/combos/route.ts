import { NextResponse } from "next/server";
import { getCombos } from "@/lib/db/combos";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  try {
    const allCombos = await getCombos();
    const combos = (allCombos || [])
      .filter((c) => c.isActive !== false && !c.isHidden && typeof c.name === "string" && c.name.length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        displayName: typeof c.displayName === "string" ? c.displayName : undefined,
        description: typeof c.description === "string" ? c.description : undefined,
        strategy: typeof c.strategy === "string" ? c.strategy : "priority",
        models: Array.isArray(c.models)
          ? c.models
              .map((m: unknown) => {
                if (typeof m === "string") return m;
                if (m && typeof m === "object") {
                  const rec = m as Record<string, unknown>;
                  return String(rec.model || rec.comboName || rec.target || "");
                }
                return "";
              })
              .filter(Boolean)
          : [],
        pricing: (c.pricing as {
          tier?: "free" | "paid";
          inputCost?: number;
          cacheCost?: number;
          outputCost?: number;
        }) || {
          tier: "free",
          inputCost: 0,
          cacheCost: 0,
          outputCost: 0,
        },
      }));

    return NextResponse.json(
      {
        success: true,
        count: combos.length,
        combos,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("Failed to fetch public combos:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch public combos",
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
