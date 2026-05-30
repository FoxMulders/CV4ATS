import { NextResponse } from 'next/server'
import { z } from 'zod'

import { MAX_JOB_DESCRIPTION_LENGTH, MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { runSkillExtrapolationAndInjection } from '@/lib/resume/pre-scan-preparation'

const preScanRequestSchema = z.object({
  jobDescription: z.string().min(1),
  resumeText: z.string().min(1),
  autoInject: z.boolean().optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('prescan', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = preScanRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { jobDescription, resumeText, autoInject = false } = parsed.data

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'Job description is too long.' }, { status: 400 })
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Resume text is too long.' }, { status: 400 })
    }

    const preScan = runSkillExtrapolationAndInjection(resumeText, jobDescription, { autoInject })

    return NextResponse.json(preScan)
  } catch (error) {
    console.error('Pre-scan error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to analyze target skills.') },
      { status: 500 }
    )
  }
}
