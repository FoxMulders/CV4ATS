import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
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

  const response = await fetch('/api/hiring-panel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobDescription: payload.jobDescription,
      sourceResumeText: payload.sourceResumeText,
      achievementSupplement: payload.achievementSupplement,
      draft: normalizedDraft,
    }),
  })

  let data: HiringPanelReviewResponse & HiringPanelApiErrorBody

  try {
    data = (await response.json()) as HiringPanelReviewResponse & HiringPanelApiErrorBody
  } catch (parseError) {
    console.error('[Hiring Panel] Failed to parse API response JSON:', parseError)
    throw new Error(await parseApiErrorResponse(response, 'Hiring panel review failed'))
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
