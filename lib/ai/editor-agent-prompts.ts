import { CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE } from '@/lib/ai/context-constrained-tailoring'
import { AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE } from '@/lib/ai/authentic-resume-optimization-directive'
import type { HiringPanelReview } from '@/lib/ai/hiring-panel-schemas'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import {
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import type { PanelDraftIssue } from '@/lib/ai/panel-draft-audit'
import { summarizePanelDraftIssues } from '@/lib/ai/panel-draft-audit'
import { buildLockedTimelinePromptBlock } from '@/lib/resume/strict-resume-state'

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[truncated for length]`
}

export const EDITOR_AGENT_SYSTEM_PROMPT = `You are Editor Agent 3 in a multi-agent resume optimization pipeline.

Agent 1 produced an initial tailored draft. Agent 2 (Hiring Panel) audited it. Your job is to read the draft plus every flagged issue and panel criticism, then output a flawless corrected version that resolves 100% of flagged problems.

${CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE}

${AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE}

STRICT EDITING INSTRUCTIONS:
1. **PURGE BANNED PHRASES** — Remove every variation of "proven track record", "ready to align", "career focus has been on", "synergy", "spearheaded", and similar AI corporate fluff. Replace with active, direct assertions grounded in the candidate's real work.
2. **RECONCILE TIMELINE OVERLAPS** — Personal ventures (cv2ats.ca, PopUpHub, Tipsy Fox, etc.) belong in the projects array, not work experience. Use honest concurrent/project-based dating (e.g., endDate "Concurrent / Project-based") so they do not read as simultaneous full-time corporate jobs.
3. **REMOVE FAKE METRICS** — Strip generic AI percentages and dollar claims absent from the source resume or user supplement. Keep only verified metrics and qualitative technical scope.
4. **HUMAN COVER LETTER** — Open with how the candidate's real technical leadership answers the target employer's specific need (role title + domain from the job description). No "I am writing to express" or generic career-focus openers.

Return JSON with tailoredResume and coverLetter only. No placeholders, brackets, or editor notes.`

export function buildEditorAgentRevisionPrompt(input: {
  jobDescription: string
  sourceResumeText: string
  draft: AiGenerationResult
  review: HiringPanelReview
  flaggedIssues: PanelDraftIssue[]
  achievementSupplement?: string
}): string {
  const job = extractCleanJobContext(input.jobDescription)
  const lockedTimeline = buildLockedTimelinePromptBlock(input.sourceResumeText)
  const issueLines = summarizePanelDraftIssues(input.flaggedIssues)
  const dissent = input.review.managers.filter((manager) => !manager.approved)

  const supplementBlock = input.achievementSupplement?.trim()
    ? `\nUSER-VERIFIED METRICS (ground truth — may use verbatim):\n${input.achievementSupplement.trim()}\n`
    : ''

  return `CANDIDATE BASE PROFILE (immutable identity — do not rename or swap employers):
${truncate(input.sourceResumeText.trim(), 4000)}

TARGET JOB:
- Title: ${job.jobTitle}
- Company: ${job.companyName ?? 'the hiring company'}

${lockedTimeline.trim() ? `${lockedTimeline.trim()}\n` : ''}
JOB DESCRIPTION:
${truncate(input.jobDescription.trim(), MAX_JOB_DESCRIPTION_LENGTH)}
${supplementBlock}
CURRENT DRAFT — RESUME:
${truncate(serializeTailoredResume(input.draft.tailoredResume), MAX_RESUME_TEXT_LENGTH)}

CURRENT DRAFT — COVER LETTER:
${truncate(input.draft.coverLetter.trim(), 6000)}

FLAGGED ISSUES TO FIX (resolve every item):
${issueLines.length > 0 ? issueLines.map((line) => `- ${line}`).join('\n') : '- None from deterministic audit — still apply all panel recommendations below.'}

PANEL REVISION RECOMMENDATIONS:
${input.review.revisionRecommendations.map((item) => `- ${item}`).join('\n') || '- Address all dissenting manager comments.'}

DISSENTING MANAGERS (${dissent.length}/10):
${
  dissent.length > 0
    ? dissent.map((manager) => `- ${manager.managerRole} (${manager.score}%): ${manager.comment}`).join('\n')
    : '- None'
}

Produce the completely corrected tailoredResume and coverLetter JSON.`
}
