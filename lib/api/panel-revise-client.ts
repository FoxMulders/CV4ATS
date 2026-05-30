import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { AiGenerationResult } from '@/lib/ai/schemas'

export type PanelReviseResult = {
  tailoredResume: AiGenerationResult['tailoredResume']
  coverLetter: string
  keywordReport: AiGenerationResult['keywordReport']
  hiringPanel: HiringPanelSessionResult | null
  rawKeywordScore?: number
}

export async function requestPanelRevise(input: {
  jobDescription: string
  sourceResumeText: string
  draft: Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter' | 'keywordReport'>
  panel: HiringPanelSessionResult
  experienceSupplement: string
  achievementSupplement?: string
}): Promise<PanelReviseResult> {
  const response = await fetch('/api/panel-revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Failed to apply panel experience'))
  }

  return (await response.json()) as PanelReviseResult
}
