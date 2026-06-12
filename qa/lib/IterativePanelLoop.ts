/**
 * Purpose: Closed-loop hiring panel orchestration — feeds manager critiques back into Editor Agent 3
 * for silent auto-correction until unanimous approval, banned-phrase cleanup, or max rounds.
 */

import type { HiringPanelReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { HIRING_PANEL_INTER_CALL_DELAY_MS, sleep } from '@/lib/ai/gemini-retry'
import {
  buildFailedPanelSession,
  buildSessionResult,
  enforceCoverLetterComplianceForPanel,
  runHiringPanelReview,
  type HiringPanelRunOptions,
} from '@/lib/ai/hiring-panel'
import {
  buildAutoCorrectionSummary,
  runEditorAgentCorrection,
} from '@/lib/ai/editor-agent'
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

function aggregateScore(review: HiringPanelReview): number {
  if (review.managers.length === 0) return 0
  return Math.round(review.managers.reduce((sum, manager) => sum + manager.score, 0) / review.managers.length)
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
  let initialAggregateScore: number | undefined
  const correctedIssues = new Set<string>()

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
            ? buildSessionResult(lastReview, revisionRounds, {
                initialAggregateScore,
                correctedIssues: [...correctedIssues],
                autoCorrectionSummary: buildAutoCorrectionSummary({
                  initialScore: initialAggregateScore ?? 0,
                  finalScore: aggregateScore(lastReview),
                  correctedIssues: [...correctedIssues],
                  revisionRounds,
                }),
              })
            : buildFailedPanelSession(
                failureReason ??
                  'Hiring panel review could not be completed. Regenerate to retry manager feedback.',
                partialCritiques
              ),
      }
    }

    if (initialAggregateScore == null) {
      initialAggregateScore = aggregateScore(review)
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

      const finalScore = aggregateScore(review)
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds, {
          initialAggregateScore,
          correctedIssues: [...correctedIssues],
          autoCorrectionSummary: buildAutoCorrectionSummary({
            initialScore: initialAggregateScore ?? finalScore,
            finalScore,
            correctedIssues: [...correctedIssues],
            revisionRounds,
          }),
        }),
      }
    }

    await onProgress?.('Editor Agent correcting draft from panel audit…')

    const editorResult = await runEditorAgentCorrection(
      jobDescription,
      sourceResumeText,
      current,
      review,
      { achievementSupplement: options.achievementSupplement }
    )

    for (const issue of editorResult.correctedIssueSummaries) {
      correctedIssues.add(issue)
    }

    if (!editorResult.draft.coverLetter.trim()) {
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
        panel: buildSessionResult(review, revisionRounds, {
          initialAggregateScore,
          correctedIssues: [...correctedIssues],
          autoCorrectionSummary: buildAutoCorrectionSummary({
            initialScore: initialAggregateScore ?? aggregateScore(review),
            finalScore: aggregateScore(review),
            correctedIssues: [...correctedIssues],
            revisionRounds,
          }),
        }),
      }
    }

    current = preserveDraft(editorResult.draft, sourceResumeText)

    await onProgress?.('Polishing cover letter after editor pass…')

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
    await sleep(HIRING_PANEL_INTER_CALL_DELAY_MS)
  }
}
