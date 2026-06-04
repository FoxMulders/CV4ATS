import {
  COVER_LETTER_BANNED_PHRASES,
  RESUME_STYLISTIC_BLACKLIST,
} from '@/lib/ai/prompts'
import { ANTI_FABRICATION_DIRECTIVE } from '@/lib/ai/anti-fabrication'
import { FACTUAL_ANCHORING_DIRECTIVE } from '@/lib/ai/factual-anchoring'
import { buildCandidateNarrativeAddendum } from '@/lib/ai/candidate-narratives'
import { PERSONAL_PROJECT_PRESERVATION_DIRECTIVE } from '@/lib/ai/personal-projects-strategy'
import { PANEL_DATA_INTEGRITY_DIRECTIVE } from '@/lib/ai/panel-validation-mandates'
import {
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import type { HiringPanelReview } from '@/lib/ai/hiring-panel-schemas'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

export const HIRING_PANEL_COVER_LETTER_BANNED = [
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
  'friction between high-level product vision',
  'execution-level reality',
] as const

export const HIRING_PANEL_MANAGER_ROLES = [
  'Senior Technical Recruiter #1',
  'Senior Technical Recruiter #2',
  'Hiring Manager — Engineering Delivery',
  'Senior Technical Program Manager #1',
  'Senior Technical Program Manager #2',
  'Talent Acquisition Lead — IT',
  'Director of Program Management (Panel)',
  'Engineering Manager — Platform',
  'Head of Technical Hiring',
  'Executive Recruiter — Enterprise IT',
] as const

export const HIRING_PANEL_REVIEW_SYSTEM_PROMPT = `You are simulating a panel of 10 elite hiring managers reviewing a tailored job application (resume + cover letter) against a specific job description.

Each manager must evaluate independently and produce a JSON review with exactly 10 manager entries using these roles (one entry each):
${HIRING_PANEL_MANAGER_ROLES.map((r) => `- ${r}`).join('\n')}

For EACH manager provide:
- managerRole: exact role name from the list above
- score: 0–100 (how likely they would advance this candidate to interview for THIS role)
- approved: true only if score >= 85 AND no blocking issues remain
- comment: 2–4 specific sentences citing concrete problems OR strengths in the actual draft. Reference exact gaps (e.g. "Cover letter paragraph 2 never mentions the CI/CD mandate from the posting" or "Bullet 3 at AMA lacks a quantified release-cycle metric"). No generic praise like "strong background" without evidence.

Panel rules:
- Be brutally honest. Generic consulting cover letter copy, missing JD specifics, vague bullets, invented claims, or banned AI clichés must lower scores and set approved=false.
- unanimousApproval is achieved only when ALL 10 managers have approved=true.
- revisionRecommendations: when any manager disapproves, list 5–10 precise, actionable edits (not vague "improve cover letter"). Empty array only if all approve.
- finalVerdict: 2–3 sentences summarizing panel consensus for the candidate.

Banned cover letter patterns:
${[...COVER_LETTER_BANNED_PHRASES, ...HIRING_PANEL_COVER_LETTER_BANNED].map((p) => `- "${p}"`).join('\n')}

Banned resume phrasing:
${RESUME_STYLISTIC_BLACKLIST.slice(0, 12).map((p) => `- "${p}"`).join('\n')}`

export const HIRING_PANEL_REVISION_SYSTEM_PROMPT = `You are an executive resume writer revising a tailored application based on hiring panel feedback.

Your job is to rewrite the draft so the panel's specific criticisms are resolved — not to defend or lightly edit the existing copy.

Mandatory revision rules:
1. Apply EVERY item in revisionRecommendations — each must be visibly addressed in the new draft.
2. Read EVERY dissenting manager comment and fix the exact problem cited (cover letter paragraph, missing JD mandate, vague bullet, banned cliché, missing metric, etc.).
3. Replace ALL detected banned phrases listed in the user prompt. Do not paraphrase them slightly — rewrite the surrounding sentence with fresh, specific language grounded in the source resume.
4. Do not invent employers, dates, metrics, or credentials absent from the source resume or user supplement.
5. ${ANTI_FABRICATION_DIRECTIVE}
6. ${FACTUAL_ANCHORING_DIRECTIVE}
7. Cover letter: name the target role/team from the JD in paragraph 1; cite at least 2 JD-specific responsibilities; 3–4 body paragraphs; quantified proof when supported; professional closing with candidate name.
8. Resume: Action + Scope + Business Impact bullets; preserve contact info and factual employers. When a Down-Tailoring addendum is present, down-level leadership verbs to execution/support framing without deleting factual history. ${PERSONAL_PROJECT_PRESERVATION_DIRECTIVE}
9. ${PANEL_DATA_INTEGRITY_DIRECTIVE}
10. When panel validation mandates are present: force 3 cover letter body paragraphs, inject Agile ceremonies and tooling into bullets when source supports them, and shift Pleasant Solutions-style blocks from passive documentation to active deliverable execution.

Never use these banned cover letter patterns:
${[...COVER_LETTER_BANNED_PHRASES, ...HIRING_PANEL_COVER_LETTER_BANNED].map((p) => `- "${p}"`).join('\n')}

Return revised tailoredResume and coverLetter JSON only.`

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[truncated for length]`
}

export function buildHiringPanelReviewPrompt(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult
): string {
  return `JOB DESCRIPTION:
${truncate(jobDescription.trim(), MAX_JOB_DESCRIPTION_LENGTH)}

SOURCE RESUME (ground truth — do not reward invented claims):
${truncate(sourceResumeText.trim(), MAX_RESUME_TEXT_LENGTH)}

TAILORED RESUME (draft under review):
${truncate(serializeTailoredResume(draft.tailoredResume), MAX_RESUME_TEXT_LENGTH)}

COVER LETTER (draft under review):
${truncate(draft.coverLetter.trim(), 6000)}

Each of the 10 managers must score and comment specifically on these drafts against the job description.`
}

export function buildHiringPanelRevisionPrompt(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  review: HiringPanelReview,
  options: {
    achievementSupplement?: string
    bannedPhrasesInLetter?: string[]
    panelFeedbackAddendum?: string
  } = {}
): string {
  const dissent = review.managers.filter((m) => !m.approved)
  const dissentBlock = dissent
    .map((m) => `- ${m.managerRole} (score ${m.score}): ${m.comment}`)
    .join('\n')
  const bannedInLetter = options.bannedPhrasesInLetter ?? []
  const supplementBlock = options.achievementSupplement?.trim()
    ? `\nUSER-VERIFIED CONTEXT (ground truth — metrics and/or panel-confirmed experience; weave into bullets and cover letter):\n${options.achievementSupplement.trim()}\n`
    : ''
  const panelFeedbackBlock = options.panelFeedbackAddendum?.trim()
    ? `\n${options.panelFeedbackAddendum.trim()}\n`
    : ''
  const candidateNarrativeBlock = buildCandidateNarrativeAddendum(sourceResumeText, jobDescription)
  const candidateNarrativeSection = candidateNarrativeBlock.trim()
    ? `\n${candidateNarrativeBlock.trim()}\n`
    : ''

  return `JOB DESCRIPTION:
${truncate(jobDescription.trim(), MAX_JOB_DESCRIPTION_LENGTH)}

SOURCE RESUME (ground truth):
${truncate(sourceResumeText.trim(), MAX_RESUME_TEXT_LENGTH)}
${supplementBlock}${panelFeedbackBlock}${candidateNarrativeSection}
CURRENT TAILORED RESUME:
${truncate(serializeTailoredResume(draft.tailoredResume), MAX_RESUME_TEXT_LENGTH)}

CURRENT COVER LETTER:
${truncate(draft.coverLetter.trim(), 6000)}

DETECTED BANNED PHRASES IN COVER LETTER (remove and rewrite every occurrence):
${bannedInLetter.length > 0 ? bannedInLetter.map((p) => `- "${p}"`).join('\n') : '- None detected — still avoid all banned patterns.'}

PANEL REVISION RECOMMENDATIONS (apply all):
${review.revisionRecommendations.map((r) => `- ${r}`).join('\n') || '- Address all dissenting manager comments below.'}

DISSENTING MANAGERS (${dissent.length}/10):
${dissentBlock || '- None'}

Revise the tailored resume and cover letter to resolve every item above. The cover letter must not contain any banned phrase. When candidate narrative is present, preserve its Pleasant Solutions story spine and role-specific tailoring.`
}
