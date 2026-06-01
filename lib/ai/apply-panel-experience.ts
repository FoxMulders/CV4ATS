import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import {
  buildSessionResult,
  runHiringPanelReview,
  runHiringPanelRevision,
  type HiringPanelRunOptions,
} from '@/lib/ai/hiring-panel'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import { auditCoverLetterCompliance } from '@/lib/resume/cover-letter-compliance'
import { mergeUserSupplements } from '@/lib/resume/panel-experience-gaps'

export type ApplyPanelExperienceInput = {
  jobDescription: string
  sourceResumeText: string
  draft: AiGenerationResult
  panel: HiringPanelSessionResult
  experienceSupplement: string
  achievementSupplement?: string
  onProgress?: (label: string) => void | Promise<void>
}

async function polishCoverLetter(
  draft: AiGenerationResult,
  jobDescription: string,
  sourceResumeText: string,
  supplement: string,
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
    supplement,
    panelReview
  )

  return { ...draft, coverLetter }
}

/** Lightweight panel follow-up: one revision + one re-review (avoids full multi-round loop timeouts). */
export async function applyPanelExperienceRevision(
  input: ApplyPanelExperienceInput
): Promise<{ aiResult: AiGenerationResult; panel: HiringPanelSessionResult | null }> {
  const supplement = mergeUserSupplements(input.achievementSupplement, input.experienceSupplement)
  const enrichedSource = `${input.sourceResumeText.trim()}\n\n${supplement}`
    .trim()
    .slice(0, MAX_RESUME_TEXT_LENGTH)

  const options: HiringPanelRunOptions = {
    achievementSupplement: supplement || undefined,
  }

  const review = {
    managers: input.panel.managers,
    revisionRecommendations: input.panel.revisionRecommendations,
    finalVerdict: input.panel.finalVerdict,
  }

  await input.onProgress?.('Rewriting with your verified experience…')

  const revision = await runHiringPanelRevision(
    input.jobDescription,
    enrichedSource,
    input.draft,
    review,
    options
  )

  if (!revision?.coverLetter.trim()) {
    return { aiResult: input.draft, panel: input.panel }
  }

  let aiResult: AiGenerationResult = {
    ...input.draft,
    tailoredResume: revision.tailoredResume,
    coverLetter: revision.coverLetter,
  }

  await input.onProgress?.('Polishing cover letter…')
  aiResult = await polishCoverLetter(
    aiResult,
    input.jobDescription,
    enrichedSource,
    supplement,
    input.panel
  )

  await input.onProgress?.('Re-running hiring panel review…')
  const newReviewResult = await runHiringPanelReview(input.jobDescription, enrichedSource, aiResult)

  return {
    aiResult,
    panel: newReviewResult.review
      ? buildSessionResult(newReviewResult.review, input.panel.revisionRounds + 1)
      : input.panel,
  }
}
