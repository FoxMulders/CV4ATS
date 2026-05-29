import { NextResponse } from 'next/server'
import { z } from 'zod'

import { assertGeminiConfigured } from '@/lib/ai/gemini'
import { MAX_JOB_DESCRIPTION_LENGTH, MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import {
  createHiringPanelNdjsonStream,
  hiringPanelStreamResponse,
  runStreamedHiringPanel,
} from '@/lib/api/hiring-panel-stream'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const hiringPanelRequestSchema = z.object({
  jobDescription: z.string().min(1),
  resumeText: z.string().min(1),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('hiring-panel', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    assertGeminiConfigured()

    const body = await request.json()
    const parsed = hiringPanelRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { jobDescription, resumeText } = parsed.data

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'Job description is too long.' }, { status: 400 })
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Resume text is too long.' }, { status: 400 })
    }

    const stream = createHiringPanelNdjsonStream((emit) =>
      runStreamedHiringPanel(emit, jobDescription.trim(), resumeText.trim())
    )

    return hiringPanelStreamResponse(stream)
  } catch (error) {
    console.error('Hiring panel error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to run Elite Hiring Manager Panel.') },
      { status: 500 }
    )
  }
}
