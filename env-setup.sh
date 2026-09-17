#!/usr/bin/env bash
# UIOS Content Studio — env + install on a fresh machine.
# Run from inside repository or studio folder:
#   bash env-setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "package.json is missing."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required. Install from https://nodejs.org and retry."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node.js 22+ is required. This machine has $(node -v)."
  exit 1
fi

echo "Node $(node -v)  npm $(npm -v)"

# Mock mode needs no GCP credentials and no API key.
# Copy to .env.local if you want to change values; Next.js loads that file.
if [[ ! -f .env.local ]]; then
  cat > .env.local <<'EOF'
# UIOS Studio — local env (no secrets required for the mock demo)

# mock = no Vertex calls (default). live = Vertex via ADC.
MODEL_MODE=mock

# Only used when MODEL_MODE=live
# GOOGLE_CLOUD_PROJECT=your-gcp-project
# VERTEX_LOCATION=global
# GEMINI_MODEL=gemini-3.1-flash-lite
# CLAUDE_MODEL=claude-opus-4-8
# SKILL_EDIT_MODEL=gemini-3.1-flash-lite

# Optional: Vertex RAG Engine for Library Ground (local retrieval is the default)
# LIBRARY_RETRIEVER=rag
# RAG_CORPUS=projects/YOUR_PROJECT/locations/us-central1/ragCorpora/YOUR_ID

NEXT_TELEMETRY_DISABLED=1
EOF
  echo "Wrote .env.local (MODEL_MODE=mock)"
else
  echo ".env.local already exists — leaving it unchanged"
fi

echo "Installing npm packages…"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo
echo "Ready. Start the app with:"
echo "  npm run dev"
echo
echo "Then open http://localhost:3001"
echo "Sign in with a workspace role. Password: demo"
echo
echo "To use live Vertex later:"
echo "  1. Set MODEL_MODE=live and GOOGLE_CLOUD_PROJECT in .env.local"
echo "  2. gcloud auth application-default login"
echo "  3. Restart npm run dev"

