import { APICallError } from 'ai'

const RATE_LIMIT_PATTERN = /\b429\b|too many requests|rate limit|quota|resource exhausted/i

export function isRateLimitOrQuotaError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    return error.statusCode === 429 || error.statusCode === 503
  }

  if (error instanceof Error) {
    return RATE_LIMIT_PATTERN.test(error.message)
  }

  return false
}

export function isAiProviderUnavailable(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    return error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 402
  }

  if (error instanceof Error) {
    return /api key|unauthorized|forbidden|invalid.*key/i.test(error.message)
  }

  return false
}

export function shouldUseLocalFallback(error: unknown): boolean {
  if (isRateLimitOrQuotaError(error) || isAiProviderUnavailable(error)) {
    return true
  }

  if (error instanceof Error) {
    return /GEMINI_API_KEY is not configured|Gemini rate limit|unparseable response/i.test(
      error.message
    )
  }

  return false
}
