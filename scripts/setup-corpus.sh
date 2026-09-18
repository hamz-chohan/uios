#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Content Library - Vertex AI RAG Engine corpus setup (optional upgrade).
#
# The app runs fully WITHOUT this: retrieval defaults to deterministic local
# search over the real FDA text (src/lib/library/retrieve.ts), which is what
# the demo uses. Run this to stand up the managed corpus so the same Ground /
# Search flow runs through Vertex RAG Engine at production scale.
#
# Prereqs: gcloud authenticated to the project, and:
#   gcloud auth application-default login
# Run from an authenticated machine (NOT from the app sandbox).
# Idempotent-ish: safe to re-run; creating an existing processor/corpus errors
# harmlessly.
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-tds-ai-ml-ops}"
LOCATION="${LOCATION:-us-central1}"
BUCKET="${BUCKET:-gs://${PROJECT_ID}-docgen-library}"
CORPUS_NAME="${CORPUS_NAME:-docgen-content-library}"
PDF_DIR="$(cd "$(dirname "$0")/../src/data/library" && pwd)"

echo "▶ Project: ${PROJECT_ID} · Location: ${LOCATION}"

echo "▶ 1/6 Enable APIs"
gcloud services enable \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  storage.googleapis.com \
  --project "${PROJECT_ID}"

echo "▶ 2/6 GCS bucket + upload the two FDA PDFs"
gcloud storage buckets create "${BUCKET}" --project "${PROJECT_ID}" --location "${LOCATION}" 2>/dev/null || true
gcloud storage cp "${PDF_DIR}/fda-biosimilar-labeling-guidance.pdf" "${BUCKET}/"
gcloud storage cp "${PDF_DIR}/fda-nda-213895-quality-review.pdf" "${BUCKET}/"

echo "▶ 3/6 Document AI - Layout Parser processor (us)"
# Layout parser extracts tables/lists as structure, not flattened text.
PROCESSOR_JSON=$(curl -s -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://us-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/us/processors" \
  -d '{"type":"LAYOUT_PARSER_PROCESSOR","displayName":"docgen-layout-parser"}')
echo "  ${PROCESSOR_JSON}"
PROCESSOR_ID=$(echo "${PROCESSOR_JSON}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('name','').split('/')[-1])" 2>/dev/null || true)
echo "  processor id: ${PROCESSOR_ID:-<check output above>}"

echo "▶ 4/6 Create the RAG corpus (with layout parser + chunking 1024/256)"
# Uses the RAG Engine API. Adjust ragEmbeddingModel if your project standard differs.
curl -s -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora" \
  -d "{\"displayName\":\"${CORPUS_NAME}\"}"
echo
echo "  → note the returned ragCorpus resource name for RAG_CORPUS below."

echo "▶ 5/6 Import the PDFs into the corpus"
echo "  In the console (RAG Engine → your corpus → Import files), choose:"
echo "    source: ${BUCKET}"
echo "    layout parser: docgen-layout-parser (us) · chunk size 1024 · overlap 256"
echo "  (Import is async; wait for it to finish before querying.)"

echo "▶ 6/6 Grant the Cloud Run runtime SA the Vertex user role"
# Cloud Run's default runtime SA is the project's compute SA unless overridden.
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format 'value(projectNumber)')
RUNTIME_SA="${RUNTIME_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role "roles/aiplatform.user" >/dev/null

cat <<EOF

✅ Done (pending the async import).

To switch the app onto RAG Engine, set these on the Cloud Run service:
  LIBRARY_RETRIEVER=rag
  RAG_CORPUS=<the ragCorpus resource name from step 4>
  GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
  VERTEX_LOCATION=${LOCATION}

Verify one query returns page-bearing chunks BEFORE promising page citations:
  curl -X POST -H "Authorization: Bearer \$(gcloud auth print-access-token)" \\
    -H "Content-Type: application/json" \\
    "https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}:retrieveContexts" \\
    -d '{"vertexRagStore":{"ragResources":[{"ragCorpus":"<RAG_CORPUS>"}]},"query":{"text":"leachables storage conditions","similarityTopK":5}}'

Leave LIBRARY_RETRIEVER unset to keep the demo on deterministic local retrieval
(the safe default). The app falls back to local automatically on any RAG error.
EOF
