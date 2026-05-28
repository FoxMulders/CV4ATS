import { parseApiErrorResponse } from '@/lib/api/client-fetch'

export interface TailorSnippetRequest {
  jobDescription: string
  resumeText: string
  keyword: string
  currentSnippet: string
  otherSnippets?: string[]
  variationIndex?: number
  previousVariations?: string[]
  rephraseJobDescriptionMatch?: boolean
  matchedJobDescriptionPhrases?: string[]
  originalBullet?: string
  targetRoleTitle?: string
  targetCompany?: string
  placementLabel?: string
  domainLabel?: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}

export async function requestTailorSnippet(input: TailorSnippetRequest): Promise<string> {
  const response = await fetch('/api/tailor-snippet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Failed to tailor snippet with AI.'))
  }

  const data = (await response.json()) as { snippet?: string }
  if (!data.snippet?.trim()) {
    throw new Error('AI returned an empty snippet.')
  }

  return data.snippet.trim()
}
