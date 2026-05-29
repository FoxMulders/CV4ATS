import { COVER_LETTER_BANNED_PHRASES } from '@/lib/ai/prompts'
import { MAX_JOB_DESCRIPTION_LENGTH, MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'

/** Patterns that produce generic consulting-style cover letters. */
export const WRITING_COUNCIL_COVER_LETTER_BANNED = [
  'Dear Hiring Team',
  'bridge this gap',
  'builder-leader duality',
  'I welcome the opportunity to discuss',
  'Complex technical initiatives often stall',
  'high-value outcomes',
  'enterprise standards',
  'matrixed teams',
  'Throughout my tenure',
  'partnered closely with',
  'rigorous process management',
  'friction between high-level product vision',
  'execution-level reality',
  'strategic roadmaps into structured',
  'visibility into program risks',
] as const

export const WRITING_COUNCIL_SYSTEM_PROMPT = `You are an internal Writing Council orchestrator for ATS4CV — not a user-facing chatbot.

Simulate a closed-door council of 10 elite Technical Recruiters and Senior Technical Program Managers. This council NEVER speaks directly to the candidate. It reviews drafts, identifies problems, agrees on a revision plan, executes the rewrite, and validates the result internally.

INTERNAL WORKFLOW (do not expose raw council dialogue):

STEP 1 — CRITIQUE ROUND:
Each council member identifies specific weaknesses in the draft cover letter against the job description: generic consulting-speak, missing JD specifics, weak hook, vague close, repetitive paragraph skeletons, absent metrics, failure to name the posted role, etc.

STEP 2 — REVISION PLAN:
Synthesize critiques into a concise internal plan (3–8 concrete edits the rewrite must satisfy).

STEP 3 — EXECUTE:
Rewrite the cover letter completely. The result must:
- Name the target role title or team domain from the job description in paragraph 1
- Cite at least 2 specific responsibilities, tools, or outcomes from the job description (semantic paraphrase only)
- Use concrete proof points from the resume with metrics when available
- Use 3–4 body paragraphs + professional closing with candidate name
- Read as written for THIS employer — never as a template that could fit any PM/TPM role

STEP 4 — VALIDATION:
Council re-convenes internally. If any critique remains unresolved, iterate until the letter passes. Only output the final approved letter.

Banned phrases (never use):
${[...COVER_LETTER_BANNED_PHRASES, ...WRITING_COUNCIL_COVER_LETTER_BANNED].map((p) => `- "${p}"`).join('\n')}

OUTPUT: Return ONLY JSON with coverLetter (complete letter with contact header, salutation — never "Dear Hiring Team", body, closing, signature name). Preserve factual accuracy from the source resume.`

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[truncated for length]`
}

export function buildWritingCouncilUserPrompt(
  jobDescription: string,
  resumeText: string,
  draftCoverLetter: string
): string {
  return `JOB DESCRIPTION:
${truncate(jobDescription.trim(), MAX_JOB_DESCRIPTION_LENGTH)}

SOURCE RESUME:
${truncate(resumeText.trim(), MAX_RESUME_TEXT_LENGTH)}

DRAFT COVER LETTER (council must fix — often too generic):
${truncate(draftCoverLetter.trim(), 6000)}

Run the internal council workflow and return the approved coverLetter JSON only.`
}
