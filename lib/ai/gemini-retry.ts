import { generateText } from 'ai'

import {
  isRateLimitOrQuotaError,
  parseGeminiRetrySeconds,
  shouldFallbackToNextGeminiModel,
  unwrapAiError,
} from '@/lib/ai/errors'
import { createGeminiModel, hiringPanelModelCandidates } from '@/lib/ai/gemini'

export const HIRING_PANEL_GEMINI_MAX_RETRIES = 2
export const HIRING_PANEL_RATE_LIMIT_BACKOFF_ATTEMPTS = 3
export const HIRING_PANEL_INTER_CALL_DELAY_MS = 1200

type GenerateTextParams = Omit<Parameters<typeof generateText>[0], 'model'>

function errorMessage(error: unknown): string {
  const root = unwrapAiError(error)
  if (root instanceof Error) return root.message
  if (error instanceof Error) return error.message
  return String(root ?? error ?? '')
}

export function parseRetrySecondsFromError(error: unknown, fallbackSeconds = 60): number {
  const seconds = parseGeminiRetrySeconds(errorMessage(error))
  if (seconds != null && seconds > 0) return seconds
  return fallbackSeconds
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs generateText across hiring-panel Gemini fallbacks, waiting out quota windows
 * before giving up.
 */
export async function generateTextWithGeminiFallback(
  params: GenerateTextParams,
  options: { label?: string; maxRateLimitBackoffAttempts?: number } = {}
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const label = options.label ?? 'Gemini'
  const maxBackoffAttempts = options.maxRateLimitBackoffAttempts ?? HIRING_PANEL_RATE_LIMIT_BACKOFF_ATTEMPTS
  const candidates = hiringPanelModelCandidates()
  let lastError: unknown

  for (let backoffAttempt = 0; backoffAttempt < maxBackoffAttempts; backoffAttempt += 1) {
    let sawRateLimit = false

    for (const modelId of candidates) {
      try {
        return await generateText({
          ...params,
          model: createGeminiModel(modelId),
        } as Parameters<typeof generateText>[0])
      } catch (error) {
        lastError = error

        if (shouldFallbackToNextGeminiModel(error)) {
          sawRateLimit = sawRateLimit || isRateLimitOrQuotaError(error)
          console.warn(
            `[${label}] Model "${modelId}" unavailable or rate limited — trying next fallback.`
          )
          continue
        }

        throw error
      }
    }

    if (!sawRateLimit || backoffAttempt >= maxBackoffAttempts - 1) {
      break
    }

    const waitSeconds = parseRetrySecondsFromError(lastError)
    console.warn(
      `[${label}] All Gemini fallbacks rate limited — waiting ${waitSeconds}s before retry ${backoffAttempt + 2}/${maxBackoffAttempts}.`
    )
    await sleep(waitSeconds * 1000)
  }

  const message = errorMessage(lastError)
  throw new Error(
    message.trim() ||
      'No supported Gemini model available. Set HIRING_PANEL_MODEL_ID=gemini-2.5-flash in Vercel and redeploy.'
  )
}
