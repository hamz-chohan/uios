"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "uios-ai-open";

const Dots = () => (
  <svg className="ai-dots" viewBox="0 0 12 16" aria-hidden="true">
    {[2, 8, 14].map((cy) =>
      [3, 9].map((cx) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" fill="#6b38fb" />
      ))
    )}
  </svg>
);

const QUICK = [
  {
    title: "Summarize this document",
    detail: "Get a concise summary of the current document",
    prompt: "Summarize the current document.",
    icon: (
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9.5 14.2-.6 1.7-1.7.6 1.7.6.6 1.7.6-1.7 1.7-.6-1.7-.6Z" />
      </>
    ),
  },
  {
    title: "Find key information",
    detail: "Search for key information across this document.",
    prompt: "Find the key information in this document.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  {
    title: "Improve writing",
    detail: "Help me improve clarity, tone, and structure.",
    prompt: "Improve the writing for clarity, tone, and structure.",
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  },
  {
    title: "Generate content",
    detail: "Draft a new section or create content from scratch.",
    prompt: "Draft a new section from scratch.",
    icon: (
      <>
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        <path d="M5 3v4" />
        <path d="M3 5h4" />
        <path d="M19 17v4" />
        <path d="M17 19h4" />
      </>
    ),
  },
];

function reply(pathname: string): string {
  if (pathname.startsWith("/skills")) {
    return "In Skill Creator, describe the skill you want and I write the .md file - the sections, sources, and any mandatory language. Publish it and Document Creators can generate from it in DocGen.";
  }
  if (pathname.startsWith("/docgen")) {
    return "In DocGen, the published skill defines the sections. Generate a draft, then review each section - anything not grounded in the attached sources comes back as needs author. Verify before export.";
  }
  if (pathname.startsWith("/library")) {
    return "The library holds the governed sources. Search it and every passage comes back page-cited, so a claim in a document can be traced to its origin.";
  }
  return "I can help from this workspace. Open DocGen to generate or review a document, Skill Creator to author a skill, or the Library to search governed sources. Verify anything headed for a regulated output.";
}

type Msg = { role: "agent" | "user"; text: string };

export function AiDock() {
  const { persona } = useAuth();
  const pathname = usePathname();
  // AuthGate holds back the whole app until the session is read, so this only
  // ever mounts on the client - safe to seed straight from sessionStorage.
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(STORAGE_KEY) === "1"
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [time] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function toggle(next: boolean) {
    setOpen(next);
    sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setDraft("");
    const answer = reply(pathname);
    window.setTimeout(
      () => setMessages((prev) => [...prev, { role: "agent", text: answer }]),
      450
    );
  }

  const firstName = persona?.name.split(" ")[0] ?? "there";

  return (
    <aside
      className={`ai-dock${open ? "" : " is-collapsed"}`}
      aria-label="AI Assistant"
    >
      <div className="ai-rail">
        <div className="ai-rail-head">
          <Dots />
        </div>
        <button
          type="button"
          className="ai-expand"
          aria-label="Expand AI Assistant"
          aria-expanded={open}
          onClick={() => toggle(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>

      <div className="ai-panel">
        <header className="ai-head">
          <Dots />
          <span className="ai-head-title">AI Assistant</span>
          <div className="ai-head-actions">
            <button
              type="button"
              className="ai-icon-btn"
              aria-label="Collapse AI Assistant"
              onClick={() => toggle(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="ai-body" ref={bodyRef}>
          <div>
            <div className="ai-msg">
              <div className="ai-av">
                <Dots />
              </div>
              <div className="ai-bubble">
                Hi {firstName}! I&rsquo;m your AI Assistant. I can help you
                analyze, summarize, and generate content from your workspace.
                What would you like to do today?
              </div>
            </div>
            {time && <div className="ai-time">{time}</div>}
          </div>

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "ai-msg ai-user" : "ai-msg"}
            >
              {m.role === "agent" && (
                <div className="ai-av">
                  <Dots />
                </div>
              )}
              <div className="ai-bubble">{m.text}</div>
            </div>
          ))}
        </div>

        <p className="ai-note">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          AI can make mistakes. Verify important information.
        </p>

        {messages.length === 0 && (
          <div className="ai-actions">
            {QUICK.map((q) => (
              <button
                key={q.title}
                type="button"
                className="ai-card"
                onClick={() => send(q.prompt)}
              >
                <span className="ai-card-ic">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {q.icon}
                  </svg>
                </span>
                <span>
                  <strong>{q.title}</strong>
                  <span>{q.detail}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <form
          className="ai-compose"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="ai-box">
            <label className="sr-only" htmlFor="aiInput">
              Message the assistant
            </label>
            <textarea
              id="aiInput"
              rows={2}
              placeholder="Ask anything about this document…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <div className="ai-box-bar">
              <button className="ai-send" type="submit" aria-label="Send">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3.5 12 21 4l-6.5 16-2-7-7.5-1Z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </aside>
  );
}
