import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/plans — Public plans list for pricing tables and checkout */
export async function GET() {
  try {
    const rows = getDb()
      .prepare("SELECT * FROM plans ORDER BY price ASC, token_budget ASC")
      .all() as Array<Record<string, unknown>>;
    return NextResponse.json({ plans: rows.map(rowToPlan) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load plans" },
      { status: 500 }
    );
  }
}
