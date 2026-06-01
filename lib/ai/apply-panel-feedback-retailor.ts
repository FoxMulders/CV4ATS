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
import { PANEL_PASS_2_LOADING_LABEL } from '@/lib/ai/generation-integrity'
import {
  applyPostRevisionIntegrity,
  computePanelRevisionDelta,
  type PanelRevisionDelta,
} from '@/lib/ai/generation-integrity'
import { applyGenerationHygiene } from '@/lib/ai/generation-hygiene'
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

export type ApplyPanelFeedbackRetailorResult = {
  aiResult: AiGenerationResult
  panel: HiringPanelSessionResult | null
  validationDelta: PanelRevisionDelta
}

/** Closed-loop re-tailor: ingest sanitized panel feedback, down-tailor when overqualified, re-review. */
export async function applyPanelFeedbackRetailor(
  input: ApplyPanelFeedbackRetailorInput
): Promise<ApplyPanelFeedbackRetailorResult> {
  const sourceResumeText = input.sourceResumeText.trim()
  const panelFeedbackAddendum = buildPanelFeedbackRetailorAddendum(
    input.panel,
    sourceResumeText,
    input.jobDescription
  )
  const sanitizedReview = buildSanitizedPanelReviewForRevision(input.panel, sourceResumeText)

  const options: HiringPanelRunOptions = {
    panelFeedbackAddendum,
  }

  await input.onProgress?.(PANEL_PASS_2_LOADING_LABEL)

  const revision = await runHiringPanelRevision(
    input.jobDescription,
    sourceResumeText,
    input.draft,
    sanitizedReview,
    options
  )

  if (!revision?.coverLetter.trim()) {
    return {
      aiResult: input.draft,
      panel: input.panel,
      validationDelta: computePanelRevisionDelta(input.draft, input.draft, sourceResumeText),
    }
  }

  let aiResult: AiGenerationResult = applyPostRevisionIntegrity(
    applyGenerationHygiene(
      {
        ...input.draft,
        tailoredResume: enforceSourceCertifications(revision.tailoredResume, sourceResumeText),
        coverLetter: revision.coverLetter,
      },
      sourceResumeText
    ),
    sourceResumeText
  )

  await input.onProgress?.('Polishing cover letter…')
  aiResult = await polishCoverLetter(aiResult, input.jobDescription, sourceResumeText, input.panel)
  aiResult = applyPostRevisionIntegrity(aiResult, sourceResumeText)

  const validationDelta = computePanelRevisionDelta(input.draft, aiResult, sourceResumeText)

  await input.onProgress?.('Re-running hiring panel review…')
  const newReviewResult = await runHiringPanelReview(input.jobDescription, sourceResumeText, aiResult)

  return {
    aiResult,
    panel: newReviewResult.review
      ? buildSessionResult(newReviewResult.review, input.panel.revisionRounds + 1)
      : input.panel,
    validationDelta,
  }
}
