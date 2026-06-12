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
  const candidates = [error, unwrapAiError(error)]

  for (const candidate of candidates) {
    if (isVercelAiGatewayError(candidate)) {
      return true
    }

    if (APICallError.isInstance(candidate)) {
      if (candidate.statusCode === 429 || candidate.statusCode === 503) {
        return true
      }
    }

    if (candidate instanceof Error && RATE_LIMIT_PATTERN.test(candidate.message)) {
      return true
    }
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

  return /is not found for API version|not supported for generateContent/i.test(message)
}

/**
 * Model-specific quota block (e.g. free tier limit: 0 for gemini-2.5-pro).
 * Try the next fallback model instead of failing the whole hiring panel.
 */
export function isGeminiModelQuotaBlockedError(error: unknown): boolean {
  const root = unwrapAiError(error)
  const message =
    root instanceof Error
      ? root.message
      : error instanceof Error
        ? error.message
        : String(root ?? error ?? '')

  return (
    /free_tier_.*limit:\s*0/i.test(message) ||
    (/quota exceeded|resource exhausted/i.test(message) && /limit:\s*0/i.test(message))
  )
}

/** Parse "Please retry in 42.5s" style messages from Gemini quota errors. */
export function parseGeminiRetrySeconds(message: string): number | undefined {
  const retryMatch = message.match(/retry in ([\d.]+)\s*s/i)
  if (retryMatch?.[1]) {
    const seconds = Number(retryMatch[1])
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds)
    }
  }

  const quotaMatch = message.match(/Quota exceeded for metric[^.]*?retry in ([\d.]+)\s*s/i)
  if (quotaMatch?.[1]) {
    const seconds = Number(quotaMatch[1])
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds)
    }
  }

  return undefined
}

/** Per-model RPM/RPD cap hit — try another Flash model before failing the panel. */
export function isGeminiModelRateLimitedError(error: unknown): boolean {
  const root = unwrapAiError(error)
  const message =
    root instanceof Error
      ? root.message
      : error instanceof Error
        ? error.message
        : String(root ?? error ?? '')

  return (
    /quota exceeded for metric/i.test(message) ||
    /resource exhausted/i.test(message) ||
    (/rate limit|too many requests/i.test(message) && /model:\s*gemini/i.test(message))
  )
}

export function shouldFallbackToNextGeminiModel(error: unknown): boolean {
  return (
    isGeminiModelNotFoundError(error) ||
    isGeminiModelQuotaBlockedError(error) ||
    isGeminiModelRateLimitedError(error)
  )
}

export function isHiringPanelRateLimitReason(reason: string): boolean {
  return RATE_LIMIT_PATTERN.test(reason) || /retry in \d+\s*s/i.test(reason)
}

/** User-facing copy when Gemini quota blocks the cloud hiring panel. */
export function buildHiringPanelRateLimitMessage(retryAfterSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds))
  return `Gemini API quota temporarily exceeded. Your tailored resume is still ready — retry the hiring panel in about ${seconds} second${seconds === 1 ? '' : 's'}.`
}

/** Short, user-facing hiring panel failure text (avoid raw API quota dumps). */
export function formatHiringPanelFailureReason(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed) return 'Hiring panel review could not be completed.'

  const clientRetryMatch = trimmed.match(/retry in (\d+)\s*s/i)
  if (/gemini rate limit/i.test(trimmed) && clientRetryMatch?.[1]) {
    return buildHiringPanelRateLimitMessage(Number(clientRetryMatch[1]))
  }

  if (/free_tier_.*limit:\s*0/i.test(trimmed) && /gemini-2\.5-pro/i.test(trimmed)) {
    return 'Gemini free tier does not include gemini-2.5-pro on this API key. cv2ats uses Flash models for the hiring panel instead — regenerate to retry.'
  }

  if (/quota exceeded|resource exhausted|free_tier|you exceeded your current quota/i.test(trimmed)) {
    const retrySeconds = parseGeminiRetrySeconds(trimmed)
    if (retrySeconds != null) {
      return buildHiringPanelRateLimitMessage(retrySeconds)
    }
    return buildHiringPanelRateLimitMessage(60)
  }

  if (isHiringPanelRateLimitReason(trimmed)) {
    return buildHiringPanelRateLimitMessage(60)
  }

  return trimmed.length > 320 ? `${trimmed.slice(0, 317)}…` : trimmed
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
    'Use a free direct API key — not Vercel AI Gateway. In Vercel → cv2ats → Environment Variables: remove AI_GATEWAY_API_KEY, add GEMINI_API_KEY from https://aistudio.google.com/apikey, then redeploy.'
  )
}
