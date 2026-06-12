import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  MAX_JOB_DESCRIPTION_LENGTH,
  tailoredResumeSchema,
} from '@/lib/ai/schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { computeIntersectionMatchScore } from '@/lib/resume/intersection-ats-score'

const recalculateRequestSchema = z.object({
  resume: tailoredResumeSchema,
  jobDescription: z.string().min(1),
  targetSkills: z.array(z.string().min(1)).optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('prescan', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = recalculateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { resume, jobDescription, targetSkills } = parsed.data

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'Job description is too long.' }, { status: 400 })
    }

    const keywordReport = computeIntersectionMatchScore({
      resume,
      jobDescription,
      targetSkills,
    })

    return NextResponse.json(keywordReport)
  } catch (error) {
    console.error('Recalculate score error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to recalculate ATS score.') },
      { status: 500 }
    )
  }
}
