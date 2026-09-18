"use client";

// SSE reader for POST /api/documents/[id]/generate. Framing/parsing lives in
// ./sse (shared with the expand call):
//
//   event: unit-start   data: {"sectionId":"..."}
//   event: delta        data: {"sectionId":"...","text":"..."}   (live section only)
//   event: unit         data: {<full Unit JSON>}
//   event: done         data: {"docId":"..."}

import { useCallback, useRef, useState } from "react";
import type { Unit } from "@/lib/types";
import { postSse, readSseStream } from "./sse";

export interface GenerateStreamArgs {
  docId: string;
  sectionIds: string[];
  liveSectionId?: string;
  regenerate?: boolean;
}

export interface GenerateStreamCallbacks {
  onUnitStart?: (sectionId: string) => void;
  onUnit?: (unit: Unit) => void;
  onDone?: (docId: string) => void;
  onError?: (message: string) => void;
}

export function useGenerateStream(callbacks: GenerateStreamCallbacks = {}) {
  // Keep the latest callbacks without re-creating `start`.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // Accumulated live text per sectionId; cleared when the final unit lands.
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);

  const start = useCallback(async (args: GenerateStreamArgs) => {
    setDone(false);
    setActive(true);
    setStreaming({});

    function handleFrame(event: string, data: unknown) {
      switch (event) {
        case "unit-start": {
          const { sectionId } = data as { sectionId: string };
          cbRef.current.onUnitStart?.(sectionId);
          break;
        }
        case "delta": {
          const { sectionId, text } = data as { sectionId: string; text: string };
          setStreaming((prev) => ({
            ...prev,
            [sectionId]: (prev[sectionId] ?? "") + text,
          }));
          break;
        }
        case "unit": {
          const unit = data as Unit;
          setStreaming((prev) => {
            if (!(unit.sectionId in prev)) return prev;
            const next = { ...prev };
            delete next[unit.sectionId];
            return next;
          });
          cbRef.current.onUnit?.(unit);
          break;
        }
        case "done": {
          setDone(true);
          cbRef.current.onDone?.((data as { docId: string }).docId);
          break;
        }
      }
    }

    try {
      const res = await postSse(
        `/api/documents/${encodeURIComponent(args.docId)}/generate`,
        {
          sectionIds: args.sectionIds,
          ...(args.liveSectionId ? { liveSectionId: args.liveSectionId } : {}),
          ...(args.regenerate ? { regenerate: true } : {}),
        }
      );
      await readSseStream(res, handleFrame);
    } catch (err) {
      cbRef.current.onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setActive(false);
    }
  }, []);

  return { start, streaming, active, done };
}
