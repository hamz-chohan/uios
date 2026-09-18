"use client";

import { useEffect, useState } from "react";
import { api, type Check } from "@/lib/client/api";

export function ChecksStrip({
  docId,
  refreshKey,
}: {
  docId: string;
  refreshKey: number;
}) {
  const [checks, setChecks] = useState<Check[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getChecks(docId)
      .then((c) => {
        if (alive) setChecks(c);
      })
      .catch(() => {
        if (alive) setChecks(null);
      });
    return () => {
      alive = false;
    };
  }, [docId, refreshKey]);

  if (!checks) return null;

  const passing = checks.filter((c) => c.pass).length;
  const failing = checks.filter((c) => !c.pass);
  return (
    <span title={failing.map((c) => c.detail).join(" · ") || undefined}>
      ·{" "}
      {failing.length === 0
        ? `${passing} checks passing`
        : `${passing}/${checks.length} checks passing`}
    </span>
  );
}
