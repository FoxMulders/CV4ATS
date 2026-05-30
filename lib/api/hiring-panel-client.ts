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
  tailoredResume?: AiGenerationResult['tailoredResume']
  coverLetter?: string
  keywordReport?: AiGenerationResult['keywordReport']
  rawKeywordScore?: number
  incorporatedKeywords?: string[]
}

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

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Hiring panel review failed'))
  }

  return response.json() as Promise<HiringPanelReviewResponse>
}
