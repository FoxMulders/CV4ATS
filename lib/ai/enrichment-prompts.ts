import { COVER_LETTER_BANNED_PHRASES } from '@/lib/ai/prompts'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'
import {
  extractAiEnrichmentInput,
  lockResumeState,
  serializeAiEnrichmentInputForPrompt,
  type StrictResumeState,
} from '@/lib/resume/strict-resume-state'
import type { UserPromptOptions } from '@/lib/ai/prompts'
import type { TailoredResume } from '@/lib/ai/schemas'

export type CleanJobContext = {
  jobTitle: string
  companyName: string | null
}

export { extractCleanJobContext } from '@/lib/resume/extract-job-title'

export const ENRICHMENT_SYSTEM_PROMPT = `You are an elite executive resume editor. Your task is to ENRICH skills and accomplishment bullets — not rewrite the candidate's career.

## Strict state preservation (mandatory)
- You receive ONLY the candidate's current skills[] and experienceBullets[] (blockKey + bullets).
- You do NOT receive employers, job titles, dates, education, or projects metadata — those are frozen server-side.
- Return the SAME number of experienceBullets entries, in the SAME order, with the SAME blockKey values.
- You may ONLY edit the strings inside bullets[] and skills[].
- NEVER invent new blockKeys. NEVER delete blocks. NEVER merge blocks.

## Surgical keyword enrichment
- Preserve original phrasing whenever possible.
- Weave missing job-description tools/methodologies into bullets where truthful.
- If a keyword cannot fit in any bullet, add it to skills[] instead.

## Cover letter
- Write a custom letter for the candidate applying to the clean job title at the clean company name provided.
- Do not copy job description headers or boilerplate into the letter body.
- Banned phrases: ${COVER_LETTER_BANNED_PHRASES.slice(0, 12).map((p) => `"${p}"`).join(', ')}, and similar clichés.

## Output JSON (exact keys)
{
  "skills": ["deduplicated", "keywords"],
  "experienceBullets": [
    { "blockKey": "exact-key-from-input", "bullets": ["enriched bullet 1", "bullet 2"] }
  ],
  "coverLetter": "complete plain-text letter"
}

Optional: "professionalSummary" — only if you can improve the hook without replacing ground truth.

Return ONLY valid JSON. No markdown fences.`

export type EnrichmentPromptInput = {
  jobDescription: string
  sourceResumeText: string
  currentResume?: TailoredResume
  locked?: StrictResumeState
  jobContext?: CleanJobContext
  options?: UserPromptOptions
}

export function buildEnrichmentUserPrompt(input: EnrichmentPromptInput): string {
  const locked =
    input.locked ??
    lockResumeState(input.currentResume ?? input.sourceResumeText)
  const aiInput = extractAiEnrichmentInput(locked)
  const jobContext = input.jobContext ?? extractCleanJobContext(input.jobDescription)
  const options = input.options ?? {}

  const checklistBlock = options.coreCompetencyChecklist?.trim()
    ? `\nCORE COMPETENCY CHECKLIST (skills[] if not bullet-fit):\n${options.coreCompetencyChecklist.trim()}\n`
    : ''

  const missingBlock =
    options.missingKeywords && options.missingKeywords.length > 0
      ? `\nMISSING KEYWORDS:\n${options.missingKeywords.join(', ')}\n`
      : ''

  const skillsBlock =
    options.targetSkills && options.targetSkills.length > 0
      ? `\nTARGET SKILLS:\n${options.targetSkills.join(', ')}\n`
      : ''

  const achievementBlock = options.achievementSupplement?.trim()
    ? `\nUSER ACHIEVEMENT SUPPLEMENT:\n${options.achievementSupplement.trim()}\n`
    : ''

  return `CLEAN JOB CONTEXT (cover letter only):
- jobTitle: "${jobContext.jobTitle}"
- companyName: "${jobContext.companyName ?? 'the hiring company'}"
- candidateName: "${locked.contact.name}"

ENRICHMENT INPUT (skills + bullets ONLY — return same blockKeys):
${serializeAiEnrichmentInputForPrompt(aiInput)}

GROUND-TRUTH SUMMARY (optional refine only):
${locked.summary}

JOB DESCRIPTION:
${input.jobDescription}
${checklistBlock}${missingBlock}${skillsBlock}${achievementBlock}
TASK: Enrich skills and experienceBullets only. Preserve every blockKey. Return JSON matching the schema.`
}

export function buildEnrichmentRefinementPrompt(
  jobDescription: string,
  sourceResumeText: string,
  currentScore: number,
  missingKeywords: string[],
  coreCompetencyChecklist?: string,
  achievementSupplement?: string,
  currentResume?: TailoredResume
): string {
  return buildEnrichmentUserPrompt({
    jobDescription,
    sourceResumeText,
    currentResume,
    options: {
      missingKeywords,
      coreCompetencyChecklist,
      achievementSupplement,
    },
  }).concat(
    `\n\nREFINEMENT PASS: Current keyword score ${currentScore}%. Enrich bullets/skills for: ${missingKeywords.join(', ')}. Same blockKeys, same count.`
  )
}
