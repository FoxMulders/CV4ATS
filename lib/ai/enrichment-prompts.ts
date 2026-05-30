import { COVER_LETTER_BANNED_PHRASES } from '@/lib/ai/prompts'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'
import {
  lockSourceResumeStructure,
  serializeLockedExperienceForPrompt,
  type LockedResumeStructure,
} from '@/lib/resume/source-resume-structure'
import type { UserPromptOptions } from '@/lib/ai/prompts'

export type CleanJobContext = {
  jobTitle: string
  companyName: string | null
}

export { extractCleanJobContext } from '@/lib/resume/extract-job-title'

export const ENRICHMENT_SYSTEM_PROMPT = `You are an elite executive resume editor and copywriter. Your task is to ENRICH an existing resume — not rewrite the candidate's career from scratch.

## Structural truth (mandatory — zero data loss)
- You receive a LOCKED workExperience array parsed from the candidate's source resume.
- You MUST return the same number of work experience blocks, in the same order.
- For each block, company, title, and dates MUST match the locked source EXACTLY — character-for-character where possible.
- You are FORBIDDEN from: deleting employers, merging roles, inventing employers, changing company names, changing job titles, or changing date ranges.
- NEVER place the professional summary inside a work experience bullet. Summary and bullets are separate fields.

## Surgical keyword enrichment (human + ATS sweet spot)
- Preserve the candidate's original phrasing, voice, and bullet layout whenever possible.
- Selectively weave missing job-description tools/methodologies (e.g., Jira, Linear, release trains, GitHub workflows, cross-functional dependencies) INTO existing accomplishment bullets where truthful.
- Light-touch edits only: add a clause, tool name, or metric — do not replace entire bullets with generic AI copy unless the source bullet is empty.
- If a keyword cannot fit naturally in any bullet for that employer, add it to the skills array instead — never fabricate a fake achievement.

## Cover letter rules
- Write a completely custom, professional cover letter for the candidate applying to the clean job title at the clean company name provided in the user prompt.
- Do not copy and paste structural headers or markdown layout text from the Job Description into the body of the letter.
- Write as an elite executive copywriter pitching a high-value candidate.
- No bracketed placeholders. No template fragments. No "The [role] opening" malformed sentences.
- Banned phrases: ${COVER_LETTER_BANNED_PHRASES.slice(0, 12).map((p) => `"${p}"`).join(', ')}, and similar AI clichés.

## Output JSON (mandatory — exact keys)
Return ONLY valid JSON with these keys:
{
  "professionalSummary": "Hook-first tailored introduction — separate from work bullets",
  "skills": ["deduplicated", "keywords"],
  "workExperience": [
    {
      "company": "exact locked company",
      "title": "exact locked title",
      "dates": "exact locked dates string",
      "bullets": ["surgically enriched bullet 1", "bullet 2"]
    }
  ],
  "coverLetter": "complete plain-text letter with contact header, salutation, body, close"
}

Do not include markdown fences, commentary, or extra keys.`

export type EnrichmentPromptInput = {
  jobDescription: string
  sourceResumeText: string
  locked?: LockedResumeStructure
  jobContext?: CleanJobContext
  options?: UserPromptOptions
}

export function buildEnrichmentUserPrompt(input: EnrichmentPromptInput): string {
  const locked = input.locked ?? lockSourceResumeStructure(input.sourceResumeText)
  const jobContext = input.jobContext ?? extractCleanJobContext(input.jobDescription)
  const options = input.options ?? {}

  const checklistBlock = options.coreCompetencyChecklist?.trim()
    ? `\nCORE COMPETENCY CHECKLIST (weave truthfully — skills array if not bullet-fit):\n${options.coreCompetencyChecklist.trim()}\n`
    : ''

  const missingBlock =
    options.missingKeywords && options.missingKeywords.length > 0
      ? `\nMISSING KEYWORDS (integrate surgically or add to skills[]):\n${options.missingKeywords.join(', ')}\n`
      : ''

  const skillsBlock =
    options.targetSkills && options.targetSkills.length > 0
      ? `\nTARGET SKILLS:\n${options.targetSkills.join(', ')}\n`
      : ''

  const achievementBlock = options.achievementSupplement?.trim()
    ? `\nUSER ACHIEVEMENT SUPPLEMENT (ground truth for metrics):\n${options.achievementSupplement.trim()}\n`
    : ''

  return `CLEAN JOB CONTEXT (use these exact strings in the cover letter — do not parse from JD prose):
- jobTitle: "${jobContext.jobTitle}"
- companyName: "${jobContext.companyName ?? 'the hiring company'}"
- candidateName: "${locked.contact.name}"

LOCKED WORK EXPERIENCE (return unchanged company/title/dates; enrich bullets only):
${serializeLockedExperienceForPrompt(locked)}

LOCKED CONTACT:
${JSON.stringify(locked.contact, null, 2)}

SOURCE SUMMARY (ground truth — refine, do not replace with JD copy):
${locked.summary}

LOCKED SKILLS (start from these; dedupe and extend):
${JSON.stringify(locked.skills)}

JOB DESCRIPTION:
${input.jobDescription}
${checklistBlock}${missingBlock}${skillsBlock}${achievementBlock}
TASK:
1. Enrich — do not rewrite from scratch.
2. Return JSON matching the required schema exactly.
3. Cover letter: write for ${locked.contact.name} applying to ${jobContext.jobTitle} at ${jobContext.companyName ?? 'the company'}.`
}

export function buildEnrichmentRefinementPrompt(
  jobDescription: string,
  sourceResumeText: string,
  currentScore: number,
  missingKeywords: string[],
  coreCompetencyChecklist?: string,
  achievementSupplement?: string
): string {
  return buildEnrichmentUserPrompt({
    jobDescription,
    sourceResumeText,
    options: {
      missingKeywords,
      coreCompetencyChecklist,
      achievementSupplement,
    },
  }).concat(
    `\n\nREFINEMENT PASS: Current keyword score ${currentScore}%. Surgically enrich bullets and skills for: ${missingKeywords.join(', ')}. Preserve all locked employers, titles, and dates.`
  )
}
