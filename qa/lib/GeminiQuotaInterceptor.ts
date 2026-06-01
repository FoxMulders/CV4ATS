/**
 * Purpose: Fetch response interceptor for Gemini 429/quota exceptions and retry-after parsing.
 * Upstream dependencies: `@/lib/ai/errors.parseGeminiRetrySeconds`, HTTP Response headers/body.
 */

import { parseGeminiRetrySeconds } from '@/lib/ai/errors'

const QUOTA_FAILURE_PATTERN =
  /quota exceeded for metric|resource exhausted|rate limit|too many requests/i

export class ApiRateLimitError extends Error {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number, message?: string) {
    super(
      message ??
        `Rate limit exceeded. Retry available in ${Math.max(1, retryAfterSeconds)} second${retryAfterSeconds === 1 ? '' : 's'}.`
    )
    this.name = 'ApiRateLimitError'
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
  }
}

export function isApiRateLimitError(error: unknown): error is ApiRateLimitError {
  return error instanceof ApiRateLimitError
}

export function readRetryAfterSeconds(response: Response, body?: unknown): number {
  const header = Number(response.headers.get('Retry-After') ?? '')
  if (Number.isFinite(header) && header > 0) {
    return Math.ceil(header)
  }

  if (body && typeof body === 'object' && body !== null && 'retryAfterSeconds' in body) {
    const fromBody = Number((body as { retryAfterSeconds?: number }).retryAfterSeconds)
    if (Number.isFinite(fromBody) && fromBody > 0) {
      return Math.ceil(fromBody)
    }
  }

  return 60
}

export type QuotaInterceptBody = {
  failureReason?: string
  error?: string
  retryAfterSeconds?: number
}

export function parseGeminiRetrySecondsFromBody(body: QuotaInterceptBody): number | undefined {
  const corpus = `${body.failureReason ?? ''} ${body.error ?? ''}`
  return parseGeminiRetrySeconds(corpus)
}

export function isQuotaFailureText(text: string): boolean {
  return QUOTA_FAILURE_PATTERN.test(text)
}

/**
 * Inspects a hiring-panel fetch response and throws `ApiRateLimitError` when quota/rate limits apply.
 * Returns parsed retry seconds when the response is OK but the body still signals quota exhaustion.
 */
export function interceptGeminiQuotaResponse(
  response: Response,
  body: QuotaInterceptBody
): { rateLimited: false } | { rateLimited: true; retryAfterSeconds: number; message?: string } {
  if (response.status === 429) {
    return {
      rateLimited: true,
      retryAfterSeconds: readRetryAfterSeconds(response, body),
      message: body.failureReason ?? body.error ?? 'Gemini API rate limit exceeded.',
    }
  }

  const failureText = `${body.failureReason ?? ''} ${body.error ?? ''}`
  if (isQuotaFailureText(failureText)) {
    return {
      rateLimited: true,
      retryAfterSeconds:
        parseGeminiRetrySecondsFromBody(body) ?? readRetryAfterSeconds(response, body),
      message: body.failureReason ?? body.error,
    }
  }

  return { rateLimited: false }
}

export function throwIfGeminiQuotaLimited(
  response: Response,
  body: QuotaInterceptBody
): void {
  const result = interceptGeminiQuotaResponse(response, body)
  if (result.rateLimited) {
    throw new ApiRateLimitError(result.retryAfterSeconds, result.message)
  }
}
