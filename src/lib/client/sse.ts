"use client";

// Shared SSE plumbing for POST endpoints that stream event frames
// (generate + expand). EventSource can't POST, so callers fetch and hand the
// Response here.

// POSTs JSON and returns the Response, throwing the server's { error } message
// (or a status fallback) on a non-2xx - the caller then streams the body.
export async function postSse(url: string, body: unknown): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed && typeof parsed.error === "string") message = parsed.error;
    } catch {
      // non-JSON error body - keep the status message
    }
    throw new Error(message);
  }
  return res;
}

// Reads an SSE response body to completion, invoking onFrame per parsed frame.
// Malformed frames are skipped rather than killing the stream.
export async function readSseStream(
  res: Response,
  onFrame: (event: string, data: unknown) => void
): Promise<void> {
  if (!res.body) throw new Error("Response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    }
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (frame.trim()) parseFrame(frame, onFrame);
    }
    if (done) break;
  }
}

function parseFrame(
  frame: string,
  onFrame: (event: string, data: unknown) => void
): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }
  onFrame(event, data);
}
