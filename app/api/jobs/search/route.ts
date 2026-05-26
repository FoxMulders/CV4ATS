import { NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { searchJobs } from '@/lib/jobs/search'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const searchQuerySchema = z.object({
  query: z.string().optional().default(''),
  location: z.string().optional().default('Edmonton'),
})

export async function GET(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('search', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  const { searchParams } = new URL(request.url)
  const parsed = searchQuerySchema.safeParse({
    query: searchParams.get('query') ?? undefined,
    location: searchParams.get('location') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 })
  }

  const result = await searchJobs(parsed.data.query, parsed.data.location)
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('search', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = searchQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search parameters.' }, { status: 400 })
    }

    const result = await searchJobs(parsed.data.query, parsed.data.location)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Job search failed.' }, { status: 500 })
  }
}
