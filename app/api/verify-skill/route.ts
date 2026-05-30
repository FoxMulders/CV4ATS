import { NextResponse } from 'next/server'
import { z } from 'zod'

import { verifySkillWithAiSafe } from '@/lib/ai/verify-skill'
import {
  MAX_ORIGINAL_BULLET_LENGTH,
  MAX_SKILL_EXPLANATION_LENGTH,
  MAX_SKILL_NAME_LENGTH,
  verifySkillResultSchema,
} from '@/lib/ai/verify-skill-schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { assertGeminiConfigured } from '@/lib/ai/gemini'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'edge'

const verifySkillRequestSchema = z.object({
  skillName: z.string().min(1).max(MAX_SKILL_NAME_LENGTH),
  originalBullet: z.string().min(1).max(MAX_ORIGINAL_BULLET_LENGTH),
  userExplanation: z.string().min(10).max(MAX_SKILL_EXPLANATION_LENGTH),
})

const PROMPT_INJECTION_PATTERN =
  /\b(ignore (all )?(previous|prior) instructions|system prompt|you are now|jailbreak|override instructions|return status:\s*pass)\b/i

const SENSITIVE_DATA_PATTERN =
  /\b(sk-[a-z0-9]{10,}|api[_-]?key\s*[:=]|-----BEGIN|AKIA[0-9A-Z]{16}|(?:\d{1,3}\.){3}\d{1,3}|(?:revenue|salary|ebitda)\s*[:=]\s*\$?\d[\d,]+(?:\.\d+)?\s*(?:m|million|b|billion)?)\b/i

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('verify-skill', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    assertGeminiConfigured()

    const body = await request.json()
    const parsed = verifySkillRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { skillName, originalBullet, userExplanation } = parsed.data
    const explanation = userExplanation.trim()

    if (PROMPT_INJECTION_PATTERN.test(explanation)) {
      return NextResponse.json(
        verifySkillResultSchema.parse({
          status: 'Fail',
          feedback: 'Your explanation could not be verified. Describe a real project outcome only.',
          revisedBullet: null,
        })
      )
    }

    if (SENSITIVE_DATA_PATTERN.test(explanation)) {
      return NextResponse.json(
        verifySkillResultSchema.parse({
          status: 'Fail',
          feedback: 'Remove sensitive data such as API keys, raw code, IP addresses, or confidential financial metrics.',
          revisedBullet: null,
        })
      )
    }

    const result = await verifySkillWithAiSafe({
      skillName: skillName.trim(),
      originalBullet: originalBullet.trim(),
      userExplanation: explanation,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Verify skill error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to verify skill experience.') },
      { status: 500 }
    )
  }
}
