import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { AiGenerationResult } from '@/lib/ai/schemas'

export type HiringPanelReviewRequest = {
  jobDescription: string
  sourceResumeText: string
  draft: AiGenerationResult
  achievementSupplement?: string
}

export type HiringPanelReviewResponse = {
  hiringPanel: HiringPanelSessionResult
  coverLetter?: string
  keywordReport?: AiGenerationResult['keywordReport']
  rawKeywordScore?: number
}

export async function requestHiringPanelReview(
  payload: HiringPanelReviewRequest
): Promise<HiringPanelReviewResponse> {
  const response = await fetch('/api/hiring-panel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      draft: normalizeGenerationDraftForApi(payload.draft),
    }),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Hiring panel review failed'))
  }

  return response.json() as Promise<HiringPanelReviewResponse>
}
