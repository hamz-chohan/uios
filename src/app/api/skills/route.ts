import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { skillFromPrompt } from "@/lib/skillFromPrompt";
import { parseSkill } from "@/lib/skill";
import { putSkill, store } from "@/lib/store";
import type { SkillStatus } from "@/lib/types";

export const runtime = "nodejs";

function summary(s: ReturnType<typeof store.skills.get>) {
  if (!s) return null;
  return {
    id: s.id,
    version: s.version,
    title: s.title,
    status: s.status ?? "published",
    sectionCount: s.sections.length,
  };
}

export async function GET(req: Request) {
  await ensureReady();
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";
  const skills = [...store.skills.values()]
    .filter((s) => all || (s.status ?? "published") === "published")
    .map((s) => summary(s));
  return NextResponse.json({ skills });
}

export async function POST(req: Request) {
  await ensureReady();
  const body = (await req.json().catch(() => null)) as {
    prompt?: string;
    raw?: string;
    publish?: boolean;
    id?: string;
  } | null;

  if (body?.id && typeof body.publish === "boolean") {
    const current = store.skills.get(body.id);
    if (!current) {
      return NextResponse.json(
        { error: `Unknown skill: ${body.id}` },
        { status: 404 }
      );
    }
    const skill = {
      ...current,
      status: (body.publish ? "published" : "draft") as SkillStatus,
    };
    putSkill(skill);
    return NextResponse.json({ skill });
  }

  if (body?.prompt && typeof body.prompt === "string") {
    try {
      const skill = await skillFromPrompt(body.prompt.trim(), body.id);
      putSkill(skill);
      return NextResponse.json({ skill }, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not write a skill from that prompt.",
        },
        { status: 502 }
      );
    }
  }

  if (body?.raw && typeof body.raw === "string") {
    const parsed = parseSkill(body.raw);
    if (parsed.sections.length === 0) {
      return NextResponse.json(
        { error: "Skill markdown parsed to zero sections." },
        { status: 400 }
      );
    }
    const skill = {
      ...parsed,
      status: (body.publish ? "published" : "draft") as SkillStatus,
    };
    putSkill(skill);
    return NextResponse.json({ skill }, { status: 201 });
  }

  return NextResponse.json(
    { error: "Required: prompt, raw, or id+publish" },
    { status: 400 }
  );
}
