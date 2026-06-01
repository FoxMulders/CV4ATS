import { parseGeminiRetrySeconds } from '@/lib/ai/errors'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { ApiRateLimitError, readRetryAfterSeconds } from '@/lib/api/rate-limit-error'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { ensureApiSafeGenerationResult } from '@/lib/api/ensure-api-safe-draft'
import type { HiringManagerReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import type { HiringPanelApiErrorBody } from '@/lib/api/hiring-panel-response'

export type HiringPanelReviewRequest = {
  jobDescription: string
  sourceResumeText: string
  draft: AiGenerationResult
  achievementSupplement?: string
}

export type HiringPanelReviewResponse = {
  hiringPanel: HiringPanelSessionResult
  tailoredResume?: AiGenerationResult['tailoredResume']
  coverLetter?: string
  keywordReport?: AiGenerationResult['keywordReport']
  rawKeywordScore?: number
  incorporatedKeywords?: string[]
  error?: string
  failureReason?: string
  partialCritiques?: HiringManagerReview[]
}

/**
 * Always calls the cloud `/api/hiring-panel` route — never window.ai or Gemini Nano.
 */
export async function requestHiringPanelReview(
  payload: HiringPanelReviewRequest
): Promise<HiringPanelReviewResponse> {
  const normalizedDraft = normalizeGenerationDraftForApi(payload.draft, payload.sourceResumeText)
  let safeDraft: AiGenerationResult

  try {
    safeDraft = ensureApiSafeGenerationResult(
      normalizedDraft,
      payload.sourceResumeText,
      payload.jobDescription
    )
  } catch (error) {
    console.error('[Hiring Panel] Draft failed API-safe normalization:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Tailored resume could not be validated for hiring panel review.'
    )
  }

  const response = await fetch('/api/hiring-panel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobDescription: payload.jobDescription,
      sourceResumeText: payload.sourceResumeText,
      achievementSupplement: payload.achievementSupplement,
      draft: safeDraft,
    }),
  })

  let data: HiringPanelReviewResponse & HiringPanelApiErrorBody

  try {
    data = (await response.json()) as HiringPanelReviewResponse & HiringPanelApiErrorBody
  } catch (parseError) {
    console.error('[Hiring Panel] Failed to parse API response JSON:', parseError)
    if (response.status === 429) {
      throw new ApiRateLimitError(readRetryAfterSeconds(response))
    }
    throw new Error(await parseApiErrorResponse(response, 'Hiring panel review failed'))
  }

  if (response.status === 429) {
    throw new ApiRateLimitError(
      readRetryAfterSeconds(response, data),
      data.failureReason ?? data.error ?? 'Gemini API rate limit exceeded.'
    )
  }

  const failureText = `${data.failureReason ?? ''} ${data.error ?? ''}`
  if (/quota exceeded for metric|resource exhausted|rate limit|too many requests/i.test(failureText)) {
    throw new ApiRateLimitError(
      parseGeminiRetrySecondsFromBody(data) ?? readRetryAfterSeconds(response, data),
      data.failureReason ?? data.error
    )
  }

  if (data.error || data.failureReason) {
    console.error('[Hiring Panel] Review failed:', data.failureReason ?? data.error, {
      partialCritiques: data.partialCritiques ?? [],
      httpStatus: response.status,
      reviewFailed: data.hiringPanel?.reviewFailed,
    })
  }

  if (!response.ok && !data.hiringPanel) {
    throw new Error(data.failureReason ?? data.error ?? (await parseApiErrorResponse(response, 'Hiring panel review failed')))
  }

  if (!data.hiringPanel) {
    throw new Error(data.failureReason ?? data.error ?? 'Hiring panel returned no review data.')
  }

  return {
    hiringPanel: data.hiringPanel,
    tailoredResume: data.tailoredResume,
    coverLetter: data.coverLetter,
    keywordReport: data.keywordReport,
    rawKeywordScore: data.rawKeywordScore,
    incorporatedKeywords: data.incorporatedKeywords,
    error: data.error,
    failureReason: data.failureReason,
    partialCritiques: data.partialCritiques,
  }
}

function parseGeminiRetrySecondsFromBody(body: HiringPanelApiErrorBody): number | undefined {
  const corpus = `${body.failureReason ?? ''} ${body.error ?? ''}`
  return parseGeminiRetrySeconds(corpus)
}
