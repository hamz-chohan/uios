import puppeteer from "puppeteer";
import { ensureReady } from "@/lib/seed";
import { store, unitsForDoc } from "@/lib/store";
import { orderUnits, renderDocumentHtml } from "@/lib/render/documentHtml";
import { renderDocumentDocx } from "@/lib/render/documentDocx";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  await ensureReady();
  const { id } = await ctx.params;

  const doc = store.docs.get(id);
  if (!doc) {
    return Response.json({ error: `document ${id} not found` }, { status: 404 });
  }
  const skill = store.skills.get(doc.skillId);
  if (!skill) {
    return Response.json(
      { error: `skill ${doc.skillId} not found for document ${id}` },
      { status: 404 }
    );
  }

  const units = orderUnits(unitsForDoc(doc.id), skill);
  const format = new URL(req.url).searchParams.get("format") ?? "pdf";

  if (format === "docx") {
    try {
      const buffer = await renderDocumentDocx({ doc, skill, units });
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": `attachment; filename="${doc.id}.docx"`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json(
        { error: `Word export failed: ${message}` },
        { status: 500 }
      );
    }
  }

  const html = renderDocumentHtml({ doc, skill, units });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    // The document HTML is fully self-contained (no network fetches), so
    // "load" is sufficient - and it's what this puppeteer version's types allow.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${doc.id}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `PDF export failed: ${message}` }, { status: 500 });
  } finally {
    await browser.close();
  }
}
