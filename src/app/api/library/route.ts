import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { listAssets } from "@/lib/library/assets";

export const runtime = "nodejs";

// The Content Library registry - asset metadata only (no PDF bytes).
export async function GET() {
  await ensureReady();
  return NextResponse.json({
    assets: listAssets().map((a) => ({
      id: a.id,
      title: a.title,
      shortTitle: a.shortTitle,
      kind: a.kind,
      org: a.org,
      date: a.date,
      pages: a.pages,
      tags: a.tags,
      description: a.description,
    })),
  });
}
