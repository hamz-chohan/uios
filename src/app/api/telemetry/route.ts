import { NextResponse } from "next/server";
import type { CorrectionType, Telemetry, UnitStatus } from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  await ensureReady();

  const eventsByType: Record<CorrectionType, number> = {
    FILL_PLACEHOLDER: 0,
    OVERRIDE_WRONG: 0,
    ACCEPT: 0,
    FLAG: 0,
  };
  for (const e of store.events) eventsByType[e.type]++;

  const unitsByStatus: Record<UnitStatus, number> = {
    PENDING: 0,
    FILLED_CITED: 0,
    NEEDS_AUTHOR: 0,
    NEEDS_VALIDATION: 0,
    OVERRIDDEN: 0,
    APPROVED: 0,
  };
  for (const u of store.units.values()) unitsByStatus[u.status]++;

  const telemetry: Telemetry = {
    eventsByType,
    unitsByStatus,
    totalEvents: store.events.length,
  };
  return NextResponse.json(telemetry);
}
