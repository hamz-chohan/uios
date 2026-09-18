# UIOS Content Studio

Skill Creator writes a portable `.md` skill. Publish it, and Document Creators generate from that file in DocGen. The skill defines the document - its sections, which sources feed each one, and any mandatory text.

Two skills ship in `src/data/skills/` and are published on boot so DocGen has something to generate from. Anything you author in Skill Creator joins them in the same registry.

No database, no API key. DocGen and Skill Creator both use the mock adapter unless `MODEL_MODE=live` is set with GCP ADC. Live is optional - it is not required to write a skill from a prompt or to generate a document.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4, TypeScript throughout. Route handlers under `src/app/api/` are the backend; there is no separate server. State lives in `src/lib/store.ts` (in-memory). PDF export uses Puppeteer with system Chromium.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Pick a workspace role on `/login` (password `demo`, stored in `sessionStorage`).

## Demo path

1. Sign in as **Skill Creator**.
2. Skill Creator → New skill → describe the skill → review the generated `.md` → Publish.
3. Sign out, sign in as **Document Creator** (or stay as **Administrator**, who can see both).
4. DocGen → New document → pick a published skill → Generate → review each section.

Sections that the attached sources cannot support come back red as `NEEDS_AUTHOR`. Use the Library's **Ground** action to resolve one against the governed FDA sources with a page citation.

## What resets

Skills and documents live in the Node process memory. A server restart drops in-session work; the two bundled skills are re-seeded on boot.

## Deploy (Google Cloud Run)

Because state is in-process, deploy **one instance**. A second replica would serve a different registry.

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT

cd uios-studio
make deploy PROJECT_ID=YOUR_GCP_PROJECT
make url    PROJECT_ID=YOUR_GCP_PROJECT
```

That builds the `Dockerfile` in Cloud Build and deploys `uios-studio` to `us-central1` with `MODEL_MODE=mock` (no Vertex calls). Open the printed URL and sign in with a workspace role.

For live Vertex on the Cloud Run service account:

```bash
make deploy PROJECT_ID=YOUR_GCP_PROJECT MODEL_MODE=live
```

The runtime service account needs **Vertex AI User**. Cloud Run supplies ADC; do not bake an API key into the image.

`--max-instances 1` is required for the reason above. `--min-instances 0` keeps idle cost at zero; raise it in the `Makefile` if you need a warm demo.

If the public URL returns 403, the service is deployed but not public. Granting `allUsers` the `roles/run.invoker` role needs Owner or Cloud Run Admin - an Editor cannot do it.

## Optional: Vertex RAG Engine

`scripts/setup-corpus.sh` stands up a managed corpus over the two FDA PDFs. Retrieval defaults to deterministic local search over the extracted text and falls back to it on any RAG error, so this is an upgrade, not a prerequisite.
