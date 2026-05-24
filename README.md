# ATS Resume Builder

Tailor your resume to any job description. Paste a job description and your resume (text or file upload), then get:

- An ATS-formatted tailored resume (PDF + DOCX)
- A keyword match report with suggestions
- A tailored cover letter (PDF + DOCX)

No accounts. Your resume is processed in memory and never stored.

## Prerequisites

- Node.js 20+
- An AI provider key: `AI_GATEWAY_API_KEY` (recommended on Vercel) or `OPENAI_API_KEY`

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key (recommended) |
| `OPENAI_API_KEY` | Direct OpenAI fallback if not using Gateway |
| `AI_MODEL` | Optional model override (default: `gpt-4o-mini` / `openai/gpt-4o-mini`) |

## Deploy to Vercel

```bash
npx vercel
```

Set `AI_GATEWAY_API_KEY` (or `OPENAI_API_KEY`) in the Vercel project environment variables.

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/generate` | POST | Multipart form: `jobDescription`, `resumeText` or `file` |
| `/api/export/pdf` | POST | JSON `TailoredResume` → PDF download |
| `/api/export/docx` | POST | JSON `TailoredResume` → DOCX download |
| `/api/export/cover-letter/pdf` | POST | JSON `{ coverLetter }` → PDF |
| `/api/jobs/search` | GET/POST | Search Edmonton PM jobs (`?query=project manager&location=Edmonton`) |
| `/api/jobs/tailor` | POST | Multipart: `job` (JSON), `resumeText` or `file` → tailored application |

## Pages

| URL | Purpose |
|-----|---------|
| `/` | Manual job description + resume tailoring |
| `/jobs` | Edmonton project management job search with per-job tailoring, scores, and apply links |
