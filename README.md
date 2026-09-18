# UIOS Content Studio

Skill Creator writes a portable `.md` skill. Publish it, and Document Creators generate from that file in DocGen. The skill defines the document: its sections, which sources feed each one, and any mandatory text.

Two skills ship in `src/data/skills/` and are published on boot so DocGen has something to generate from. Anything you author in Skill Creator joins them in the same registry.

Everything runs locally with the mock adapter. No database, no API key, no cloud account.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Pick a workspace role on the login page. The password is `demo`.

## Try it

1. Sign in as **Skill Creator**.
2. Go to Skill Creator, click New skill, describe the skill, review the generated `.md`, then Publish.
3. Sign out and sign in as **Document Creator** (or stay as **Administrator**, who can see both).
4. Go to DocGen, click New document, pick a published skill, click Generate, then review each section.

Sections that the attached sources cannot support come back red as `NEEDS_AUTHOR`. Use the Library's **Ground** action to resolve one against the bundled FDA sources with a page citation.

## Notes

- Skills and documents live in the Node process memory. Restarting the server drops in-session work; the two bundled skills are re-seeded on boot.
- PDF export uses Puppeteer, which downloads its own Chromium during `npm install`.
- Next.js 16 (App Router), React 19, Tailwind v4 and TypeScript. Route handlers under `src/app/api/` are the backend; there is no separate server.
