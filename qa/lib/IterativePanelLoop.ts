/**
 * Purpose: Closed-loop hiring panel orchestration — feeds manager critiques back into revision prompts
 * until unanimous approval, banned-phrase cleanup, or max rounds.
 * Upstream dependencies: `@/lib/ai/hiring-panel` review/revision generators, cover-letter compliance,
 * and draft normalization for API-safe payloads.
 */

import type { HiringPanelReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import {
  buildFailedPanelSession,
  buildSessionResult,
  enforceCoverLetterComplianceForPanel,
  runHiringPanelReview,
  runHiringPanelRevision,
  type HiringPanelRunOptions,
} from '@/lib/ai/hiring-panel'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { findCoverLetterBannedPhrases } from '@/lib/resume/cover-letter-compliance'

export const MAX_HIRING_PANEL_REVISION_ROUNDS = 4

export type HiringPanelWithRevisionsResult = {
  aiResult: AiGenerationResult
  panel: HiringPanelSessionResult | null
}

export type HiringPanelProgressCallback = (label: string) => void | Promise<void>

function needsAnotherRevisionRound(
  review: HiringPanelReview,
  coverLetter: string,
  revisionRounds: number
): boolean {
  if (revisionRounds >= MAX_HIRING_PANEL_REVISION_ROUNDS) return false

  const unanimous = review.managers.every((manager) => manager.approved)
  const bannedRemaining = findCoverLetterBannedPhrases(coverLetter).length > 0
  const hasActionItems = review.revisionRecommendations.length > 0

  return bannedRemaining || hasActionItems || !unanimous
}

function preserveDraft(draft: AiGenerationResult, sourceResumeText: string): AiGenerationResult {
  return normalizeGenerationDraftForApi(draft, sourceResumeText)
}

export async function runHiringPanelWithRevisions(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  onProgress?: HiringPanelProgressCallback,
  options: HiringPanelRunOptions = {}
): Promise<HiringPanelWithRevisionsResult> {
  let current: AiGenerationResult = draft
  let revisionRounds = 0
  let lastReview: HiringPanelReview | null = null

  while (true) {
    await onProgress?.(
      revisionRounds === 0
        ? 'Hiring panel review…'
        : `Hiring panel review (round ${revisionRounds + 1})…`
    )

    const { review, partialCritiques, failureReason } = await runHiringPanelReview(
      jobDescription,
      sourceResumeText,
      current
    )

    if (!review) {
      return {
        aiResult: current,
        panel:
          lastReview != null
            ? buildSessionResult(lastReview, revisionRounds)
            : buildFailedPanelSession(
                failureReason ??
                  'Hiring panel review could not be completed. Regenerate to retry manager feedback.',
                partialCritiques
              ),
      }
    }

    lastReview = review

    if (!needsAnotherRevisionRound(review, current.coverLetter, revisionRounds)) {
      current = preserveDraft(
        await enforceCoverLetterComplianceForPanel(
          current,
          jobDescription,
          sourceResumeText,
          review,
          options.achievementSupplement
        ),
        sourceResumeText
      )
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    await onProgress?.('Applying all panel improvement suggestions…')

    const revision = await runHiringPanelRevision(
      jobDescription,
      sourceResumeText,
      current,
      review,
      options
    )

    if (!revision?.coverLetter.trim()) {
      current = preserveDraft(
        await enforceCoverLetterComplianceForPanel(
          current,
          jobDescription,
          sourceResumeText,
          review,
          options.achievementSupplement
        ),
        sourceResumeText
      )
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    current = preserveDraft(
      {
        ...current,
        tailoredResume: revision.tailoredResume,
        coverLetter: revision.coverLetter,
      },
      sourceResumeText
    )

    await onProgress?.('Re-running hiring panel after applying suggestions…')

    current = preserveDraft(
      await enforceCoverLetterComplianceForPanel(
        current,
        jobDescription,
        sourceResumeText,
        review,
        options.achievementSupplement
      ),
      sourceResumeText
    )

    revisionRounds += 1
  }
}
