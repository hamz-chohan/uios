import { ensureReady } from "@/lib/seed";
import { getAsset, readAssetPdf } from "@/lib/library/assets";

export const runtime = "nodejs";

// Serve an asset's PDF inline (open in the browser's viewer).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  await ensureReady();
  const { assetId } = await params;
  const asset = getAsset(assetId);
  if (!asset) {
    return Response.json({ error: `Unknown asset: ${assetId}` }, { status: 404 });
  }
  const pdf = readAssetPdf(asset);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${asset.id}.pdf"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
