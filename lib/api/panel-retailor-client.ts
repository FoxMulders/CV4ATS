import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import type { PanelRevisionDelta } from '@/lib/ai/generation-integrity'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { AiGenerationResult } from '@/lib/ai/schemas'

export type PanelRetailorResult = {
  tailoredResume: AiGenerationResult['tailoredResume']
  coverLetter: string
  keywordReport: AiGenerationResult['keywordReport']
  hiringPanel: HiringPanelSessionResult | null
  rawKeywordScore?: number
  validationDelta?: PanelRevisionDelta
}

export async function requestPanelRetailor(input: {
  jobDescription: string
  sourceResumeText: string
  draft: Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter' | 'keywordReport'>
  panel: HiringPanelSessionResult
}): Promise<PanelRetailorResult> {
  const response = await fetch('/api/panel-retailor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Failed to de-escalate and re-tailor'))
  }

  return (await response.json()) as PanelRetailorResult
}
