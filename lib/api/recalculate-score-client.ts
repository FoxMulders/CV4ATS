import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'

export interface RecalculateScoreRequest {
  resume: TailoredResume
  jobDescription: string
  targetSkills?: string[]
}

export async function requestRecalculateScore(
  input: RecalculateScoreRequest
): Promise<KeywordReport> {
  const response = await fetch('/api/recalculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Failed to recalculate ATS score.'))
  }

  return (await response.json()) as KeywordReport
}
