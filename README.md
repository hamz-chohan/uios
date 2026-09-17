# UIOS Content Studio

An AI-powered content generation and studio workspace built with Next.js 16, React 19, and Tailwind CSS v4.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`)
- **AI Integrations**: `@google/genai`, `@anthropic-ai/sdk`, `@anthropic-ai/vertex-sdk`
- **Document Processing**: `docx` (Word export), `marked` (Markdown), `gray-matter`, `puppeteer` (PDF export)
- **Validation**: `zod`

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 22.0.0
- **npm** >= 10.0.0

### 2. Installation & Setup
```bash
# Clone the repository
git clone git@github.com:hamz-chohan/uios.git
cd uios

# Install dependencies
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

- **Workspace Roles**: Administrator, Editor, Reviewer
- **Demo Password**: `demo`

---

## Environment Modes

Configuration is managed in `.env.local`:

- **Mock Mode (Default)**:
  ```env
  MODEL_MODE=mock
  ```
  Runs completely locally without requiring GCP credentials or API keys.

- **Live Mode (Vertex AI)**:
  ```env
  MODEL_MODE=live
  GOOGLE_CLOUD_PROJECT=your-gcp-project
  ```
  Authenticate with Google Cloud:
  ```bash
  gcloud auth application-default login
  ```