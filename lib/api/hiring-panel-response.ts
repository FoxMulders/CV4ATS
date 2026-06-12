import type { HiringManagerReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { buildHiringPanelRateLimitMessage, formatHiringPanelFailureReason, parseGeminiRetrySeconds } from '@/lib/ai/errors'
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
  const parsedRetry = parseGeminiRetrySeconds(trimmedReason)
  const isRateLimited = /quota exceeded|resource exhausted|rate limit|too many requests/i.test(trimmedReason)
  const retryAfterSeconds = parsedRetry ?? (isRateLimited ? 60 : undefined)
  const failureReason = formatHiringPanelFailureReason(trimmedReason)
  const resolvedFailureReason = isRateLimited
    ? buildHiringPanelRateLimitMessage(retryAfterSeconds ?? 60)
    : failureReason

  return {
    error: 'timeout or parsing failed',
    failureReason: resolvedFailureReason,
    ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
    partialCritiques,
    hiringPanel: {
      unanimousApproval: false,
      aggregateScore: 0,
      revisionRounds: 0,
      managers: partialCritiques,
      finalVerdict: resolvedFailureReason,
      revisionRecommendations: [],
      reviewFailed: true,
      failureReason: resolvedFailureReason,
    },
    tailoredResume: draft.tailoredResume,
    coverLetter: draft.coverLetter,
    keywordReport: draft.keywordReport,
    rawKeywordScore: draft.keywordReport?.matchScore,
    incorporatedKeywords: [],
  }
}
