# UIOS Studio - Cloud Run
# Override the project: make deploy PROJECT_ID=your-gcp-project
PROJECT_ID ?= tds-ai-ml-ops
REGION ?= us-central1
SERVICE_NAME ?= uios-studio
PORT ?= 8080
# mock = no Vertex calls (default for a public demo)
# live = Vertex via the Cloud Run service account
MODEL_MODE ?= mock

install:
	npm install

dev:
	npm run dev

build:
	npm run build

# Cloud Build uses ./Dockerfile. max-instances 1 is required: skills and
# documents live in process memory and do not survive a second replica.
deploy:
	@echo "Deploying $(SERVICE_NAME) to Cloud Run ($(PROJECT_ID) / $(REGION), MODEL_MODE=$(MODEL_MODE))..."
	gcloud run deploy $(SERVICE_NAME) \
		--source . \
		--region $(REGION) \
		--project $(PROJECT_ID) \
		--memory "2Gi" \
		--cpu "2" \
		--min-instances 0 --max-instances 1 \
		--allow-unauthenticated \
		--set-env-vars "NODE_ENV=production,MODEL_MODE=$(MODEL_MODE),GOOGLE_CLOUD_PROJECT=$(PROJECT_ID),VERTEX_LOCATION=global" \
		--labels "app=uios-studio" \
		--port=$(PORT)

url:
	@gcloud run services describe $(SERVICE_NAME) \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--format 'value(status.url)'

logs:
	@gcloud run services logs read $(SERVICE_NAME) \
		--project $(PROJECT_ID) \
		--region $(REGION) \
		--limit 50
