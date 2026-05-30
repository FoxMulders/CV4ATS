import { generateText } from 'ai'

import { createGeminiModel, GEMINI_MODEL_ID, geminiProviderOptions } from '@/lib/ai/gemini'
import { COVER_LETTER_BANNED_PHRASES } from '@/lib/ai/prompts'
import { HIRING_PANEL_COVER_LETTER_BANNED } from '@/lib/ai/hiring-panel-prompts'
import { AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import type { CoverLetterViolation } from '@/lib/resume/cover-letter-compliance'
import type { HiringPanelReview } from '@/lib/ai/hiring-panel-schemas'

export const COVER_LETTER_REPAIR_MODEL_ID =
  process.env.COVER_LETTER_REPAIR_MODEL_ID?.trim() || GEMINI_MODEL_ID

const REPAIR_SYSTEM = `You rewrite cover letters to fix compliance violations only.

Rules:
- Remove every banned phrase listed in the user prompt — replace with fresh, specific language.
- Include at least two quantified proof points when the source resume or user supplement supports them.
- Never invent employers, dates, metrics, or credentials absent from the source resume or user supplement.
- Preserve contact header, salutation, paragraph structure, and closing name.
- Return plain-text cover letter only — no JSON, no markdown fences.`

function buildRepairPrompt(
  coverLetter: string,
  violations: CoverLetterViolation[],
  sourceResumeText: string,
  jobDescription: string,
  achievementSupplement?: string,
  panelReview?: HiringPanelReview | null
): string {
  const banned = violations
    .filter((v) => v.type === 'banned-phrase')
    .map((v) => `- "${v.detail}"`)
    .join('\n')

  const supplementBlock = achievementSupplement?.trim()
    ? `\nUSER-PROVIDED METRICS (ground truth):\n${achievementSupplement.trim()}\n`
    : ''

  const panelBlock = panelReview
    ? `\nPANEL FEEDBACK TO RESOLVE WHILE REWRITING:
${panelReview.revisionRecommendations.map((r) => `- ${r}`).join('\n')}

DISSENTING MANAGER COMMENTS:
${panelReview.managers
  .filter((m) => !m.approved)
  .map((m) => `- ${m.managerRole}: ${m.comment}`)
  .join('\n')}
`
    : ''

  return `JOB DESCRIPTION (context only):
${jobDescription.slice(0, 4000)}

SOURCE RESUME (ground truth):
${sourceResumeText.slice(0, 8000)}
${supplementBlock}${panelBlock}
BANNED PHRASES TO REMOVE (strict — replace with fresh, specific language):
${banned || '- None listed — still avoid generic AI clichés.'}

ALL BANNED PATTERNS (never use):
${[...COVER_LETTER_BANNED_PHRASES, ...HIRING_PANEL_COVER_LETTER_BANNED]
  .slice(0, 20)
  .map((p) => `- "${p}"`)
  .join('\n')}

VIOLATIONS TO FIX:
${violations.map((v) => `- ${v.type}: ${v.detail}`).join('\n')}

CURRENT COVER LETTER:
${coverLetter}

Rewrite the cover letter to fix all violations. Output the full revised letter only.`
}

export async function repairCoverLetterCompliance(
  coverLetter: string,
  violations: CoverLetterViolation[],
  sourceResumeText: string,
  jobDescription: string,
  achievementSupplement?: string,
  panelReview?: HiringPanelReview | null
): Promise<string> {
  if (violations.length === 0) return coverLetter

  const model = createGeminiModel(COVER_LETTER_REPAIR_MODEL_ID)
  const response = await generateText({
    model,
    system: REPAIR_SYSTEM,
    prompt: buildRepairPrompt(
      coverLetter,
      violations,
      sourceResumeText,
      jobDescription,
      achievementSupplement,
      panelReview
    ),
    temperature: 0.25,
    maxOutputTokens: 2048,
    maxRetries: AI_STREAM_MAX_RETRIES,
    providerOptions: geminiProviderOptions(),
  })

  const repaired = response.text.trim()
  return repaired.length > 80 ? repaired : coverLetter
}
