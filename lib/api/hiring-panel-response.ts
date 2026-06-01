import type { HiringManagerReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { formatHiringPanelFailureReason, parseGeminiRetrySeconds } from '@/lib/ai/errors'
import type { AiGenerationResult } from '@/lib/ai/schemas'

export type HiringPanelApiErrorBody = {
  error: string
  failureReason?: string
  retryAfterSeconds?: number
  partialCritiques: HiringManagerReview[]
  hiringPanel?: HiringPanelSessionResult
  tailoredResume?: AiGenerationResult['tailoredResume']
  coverLetter?: string
  keywordReport?: AiGenerationResult['keywordReport']
  rawKeywordScore?: number
  incorporatedKeywords?: string[]
}

export function buildHiringPanelFailureResponse(
  reason: string,
  draft: AiGenerationResult,
  partialCritiques: HiringManagerReview[] = []
): HiringPanelApiErrorBody {
  const trimmedReason = reason.trim() || 'timeout or parsing failed'
  const failureReason = formatHiringPanelFailureReason(trimmedReason)
  const retryAfterSeconds = parseGeminiRetrySeconds(trimmedReason)

  return {
    error: 'timeout or parsing failed',
    failureReason,
    ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
    partialCritiques,
    hiringPanel: {
      unanimousApproval: false,
      aggregateScore: 0,
      revisionRounds: 0,
      managers: partialCritiques,
      finalVerdict: failureReason,
      revisionRecommendations: [],
      reviewFailed: true,
      failureReason,
    },
    tailoredResume: draft.tailoredResume,
    coverLetter: draft.coverLetter,
    keywordReport: draft.keywordReport,
    rawKeywordScore: draft.keywordReport?.matchScore,
    incorporatedKeywords: [],
  }
}
