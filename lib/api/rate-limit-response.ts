import { NextResponse } from 'next/server'

export function rateLimitExceededResponse(retryAfterSeconds?: number) {
  const retry = retryAfterSeconds ?? 3600
  return NextResponse.json(
    {
      error: 'Rate limit exceeded. Try again later.',
      retryAfterSeconds: retry,
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retry) },
    }
  )
}
