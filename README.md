# ATS4CV

Tailor your resume to any job description. Paste a job description and your resume (text or file upload), then get:

- An ATS-formatted tailored resume (PDF + DOCX)
- A keyword match report with suggestions
- A tailored cover letter (PDF + DOCX)

No accounts. Your resume is processed in memory and never stored.

## Prerequisites

- Node.js 20+
- A free AI provider key: `GEMINI_API_KEY` (recommended) or `GROQ_API_KEY`

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
| `GEMINI_API_KEY` | Google Gemini API key ([AI Studio](https://aistudio.google.com/apikey)) — **required for production** |
| `GEMINI_MODEL_ID` | Optional Gemini model (default: `gemini-flash-latest`) |
| `GROQ_API_KEY` | Optional Groq fallback when Gemini is rate-limited |
| `GROQ_MODEL` | Optional Groq model (default: `llama-3.1-70b-versatile`) |

**Do not use Vercel AI Gateway** (`AI_GATEWAY_API_KEY`) — its free tier is rate-limited. Remove it from Vercel environment variables and use `GEMINI_API_KEY` instead.

## Deploy to Vercel

```bash
npx vercel
```

Set `GEMINI_API_KEY` (or `GROQ_API_KEY`) in the Vercel project environment variables.

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
