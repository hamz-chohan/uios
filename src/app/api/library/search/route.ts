import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { retrieveEvidence } from "@/lib/library/retrieve";

export const runtime = "nodejs";

// Ask the library: query → ranked evidence with page-accurate locators.
export async function POST(req: Request) {
  await ensureReady();
  const body = (await req.json().catch(() => null)) as {
    query?: string;
    assetIds?: string[];
    k?: number;
  } | null;
  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json(
      { error: 'Field "query" (non-empty string) is required' },
      { status: 400 }
    );
  }
  const evidence = await retrieveEvidence(query, {
    k: body?.k ?? 6,
    assetIds: body?.assetIds,
  });
  return NextResponse.json({ query, evidence });
}
