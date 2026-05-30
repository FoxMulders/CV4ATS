import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import type { VerifySkillResult } from '@/lib/ai/verify-skill-schemas'

export async function requestVerifySkill(input: {
  skillName: string
  originalBullet: string
  userExplanation: string
}): Promise<VerifySkillResult> {
  const response = await fetch('/api/verify-skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Skill verification failed'))
  }

  return (await response.json()) as VerifySkillResult
}
