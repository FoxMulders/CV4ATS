import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import {
  buildSessionResult,
  runHiringPanelReview,
  runHiringPanelRevision,
  type HiringPanelRunOptions,
} from '@/lib/ai/hiring-panel'
import {
  buildPanelFeedbackRetailorAddendum,
  buildSanitizedPanelReviewForRevision,
} from '@/lib/ai/panel-feedback-retailor'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import { auditCoverLetterCompliance } from '@/lib/resume/cover-letter-compliance'
import { enforceSourceCertifications } from '@/lib/resume/certification-guard'

export type ApplyPanelFeedbackRetailorInput = {
  jobDescription: string
  sourceResumeText: string
  draft: AiGenerationResult
  panel: HiringPanelSessionResult
  onProgress?: (label: string) => void | Promise<void>
}

async function polishCoverLetter(
  draft: AiGenerationResult,
  jobDescription: string,
  sourceResumeText: string,
  panel: HiringPanelSessionResult
): Promise<AiGenerationResult> {
  const violations = auditCoverLetterCompliance(draft.coverLetter)
  if (violations.length === 0) return draft

  const panelReview =
    panel.managers.length === 10
      ? {
          managers: panel.managers,
          revisionRecommendations: panel.revisionRecommendations,
          finalVerdict: panel.finalVerdict,
        }
      : null

  const coverLetter = await repairCoverLetterCompliance(
    draft.coverLetter,
    violations,
    sourceResumeText,
    jobDescription,
    '',
    panelReview
  )

  return { ...draft, coverLetter }
}

/** Closed-loop re-tailor: ingest sanitized panel feedback, down-tailor when overqualified, re-review. */
export async function applyPanelFeedbackRetailor(
  input: ApplyPanelFeedbackRetailorInput
): Promise<{ aiResult: AiGenerationResult; panel: HiringPanelSessionResult | null }> {
  const sourceResumeText = input.sourceResumeText.trim()
  const panelFeedbackAddendum = buildPanelFeedbackRetailorAddendum(input.panel, sourceResumeText)
  const sanitizedReview = buildSanitizedPanelReviewForRevision(input.panel, sourceResumeText)

  const options: HiringPanelRunOptions = {
    panelFeedbackAddendum,
  }

  await input.onProgress?.('De-escalating tone and re-tailoring from panel feedback…')

  const revision = await runHiringPanelRevision(
    input.jobDescription,
    sourceResumeText,
    input.draft,
    sanitizedReview,
    options
  )

  if (!revision?.coverLetter.trim()) {
    return { aiResult: input.draft, panel: input.panel }
  }

  let aiResult: AiGenerationResult = {
    ...input.draft,
    tailoredResume: enforceSourceCertifications(revision.tailoredResume, sourceResumeText),
    coverLetter: revision.coverLetter,
  }

  await input.onProgress?.('Polishing cover letter…')
  aiResult = await polishCoverLetter(aiResult, input.jobDescription, sourceResumeText, input.panel)

  await input.onProgress?.('Re-running hiring panel review…')
  const newReviewResult = await runHiringPanelReview(input.jobDescription, sourceResumeText, aiResult)

  return {
    aiResult,
    panel: newReviewResult.review
      ? buildSessionResult(newReviewResult.review, input.panel.revisionRounds + 1)
      : input.panel,
  }
}
