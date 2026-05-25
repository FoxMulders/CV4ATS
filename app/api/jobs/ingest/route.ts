import { NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { ingestJobFromUrl } from '@/lib/jobs/ingest-url'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const ingestRequestSchema = z.object({
  url: z.string().url(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('ingest', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = ingestRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid job URL is required.' }, { status: 400 })
    }

    const job = await ingestJobFromUrl(parsed.data.url)

    return NextResponse.json({
      job,
      bypassFilters: true,
      status: 'parsed',
    })
  } catch (error) {
    console.error('Job ingest error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to parse job from the shared link.') },
      { status: 422 }
    )
  }
}
