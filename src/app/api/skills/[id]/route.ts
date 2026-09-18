import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  const skill = store.skills.get(id);
  if (!skill) {
    return NextResponse.json({ error: `Unknown skill: ${id}` }, { status: 404 });
  }
  return NextResponse.json({ skill });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  if (!store.skills.has(id)) {
    return NextResponse.json({ error: `Unknown skill: ${id}` }, { status: 404 });
  }
  store.skills.delete(id);
  return NextResponse.json({ ok: true });
}
