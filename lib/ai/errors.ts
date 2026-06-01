import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'

const RATE_LIMIT_PATTERN = /\b429\b|too many requests|rate limit|quota|resource exhausted/i

const VERCEL_GATEWAY_PATTERN =
  /free tier requests|AI_GATEWAY|AI Gateway|Upgrade to paid credits|vercel\.com\/d\?to=.*ai/i

export function isVercelAiGatewayError(error: unknown): boolean {
  if (error instanceof Error && VERCEL_GATEWAY_PATTERN.test(error.message)) {
    return true
  }

  if (RetryError.isInstance(error)) {
    return error.errors.some((entry) => isVercelAiGatewayError(entry))
  }

  return false
}

export function isRateLimitOrQuotaError(error: unknown): boolean {
  if (isVercelAiGatewayError(error)) {
    return true
  }

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

/** Gemini model id rejected by the API (deprecated or wrong API version). */
export function isGeminiModelNotFoundError(error: unknown): boolean {
  const root = unwrapAiError(error)
  const message =
    root instanceof Error
      ? root.message
      : error instanceof Error
        ? error.message
        : String(root ?? error ?? '')

  return /is not found for API version|not supported for generateContent|models\/gemini/i.test(message)
}

/** Unwrap RetryError / Error.cause so fallback logic sees the root provider failure. */
export function unwrapAiError(error: unknown): unknown {
  if (RetryError.isInstance(error)) {
    return error.lastError ?? error.errors[error.errors.length - 1] ?? error
  }

  if (error instanceof Error && error.cause) {
    return error.cause
  }

  return error
}

export function shouldUseLocalFallback(error: unknown): boolean {
  const root = unwrapAiError(error)

  if (
    isRateLimitOrQuotaError(root) ||
    isRateLimitOrQuotaError(error) ||
    isAiProviderUnavailable(root) ||
    isAiProviderUnavailable(error)
  ) {
    return true
  }

  if (NoObjectGeneratedError.isInstance(root) || NoObjectGeneratedError.isInstance(error)) {
    return true
  }

  if (error instanceof Error) {
    return /GEMINI_API_KEY is not configured|Gemini rate limit|Groq rate limit|unparseable response|Vercel AI Gateway/i.test(
      error.message
    )
  }

  return false
}

export function formatDirectProviderSetupError(): string {
  return (
    'Use a free direct API key — not Vercel AI Gateway. In Vercel → ATS4CV → Environment Variables: remove AI_GATEWAY_API_KEY, add GEMINI_API_KEY from https://aistudio.google.com/apikey, then redeploy.'
  )
}
