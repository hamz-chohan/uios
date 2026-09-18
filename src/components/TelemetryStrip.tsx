"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export function TelemetryStrip() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api
        .telemetry()
        .then((t) => {
          if (alive) setCount(t.totalEvents);
        })
        .catch(() => {
          // keep the last known count on transient failures
        });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" aria-live="polite">
      <span className="dot-live" aria-hidden />
      <span>events captured · {count ?? "-"}</span>
    </span>
  );
}
