import { NextResponse } from 'next/server'

export function rateLimitExceededResponse(retryAfterSeconds?: number) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds ?? 3600) },
    }
  )
}
