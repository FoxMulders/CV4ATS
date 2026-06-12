import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

/**
 * Free-tier Gemini model for cv2ats.
 * `gemini-1.5-flash` is no longer served on v1beta for many AI Studio keys;
 * `gemini-flash-latest` is the current fast default. Override via GEMINI_MODEL_ID.
 */
export const GEMINI_MODEL_ID =
  process.env.GEMINI_MODEL_ID?.trim() || 'gemini-flash-latest'

/**
 * Cloud model for hiring panel review (structured JSON + multi-manager reasoning).
 * Defaults to gemini-2.5-flash — gemini-2.5-pro often has free_tier limit: 0 on AI Studio keys.
 * Override via HIRING_PANEL_MODEL_ID.
 */
export const HIRING_PANEL_GEMINI_MODEL_ID =
  process.env.HIRING_PANEL_MODEL_ID?.trim() || 'gemini-2.5-flash'

/** Ordered fallbacks — free-tier Flash models first, Pro last. */
export function hiringPanelModelCandidates(): string[] {
  const configured = process.env.HIRING_PANEL_MODEL_ID?.trim()
  const candidates = [
    configured,
    HIRING_PANEL_GEMINI_MODEL_ID,
    GEMINI_MODEL_ID,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
  ].filter((id): id is string => Boolean(id?.trim()))

  return [...new Set(candidates)]
}

/**
 * Reads the Gemini key from Vercel / local env.
 * Supports both GEMINI_API_KEY (preferred) and GOOGLE_GENERATIVE_AI_API_KEY.
 */
export function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    undefined
  )
}

export function assertGeminiConfigured(): void {
  if (!getGeminiApiKey()) {
    throw new Error(
      'GEMINI_API_KEY is not configured. In Vercel → cv2ats project → Settings → Environment Variables, add GEMINI_API_KEY from Google AI Studio, then redeploy.'
    )
  }
}

/**
 * Creates a Gemini model bound to GEMINI_API_KEY:
 *   const model = createGeminiModel()
 * Equivalent to: createGoogleGenerativeAI({ apiKey }).(GEMINI_MODEL_ID)
 */
export function createGeminiModel(modelId: string = GEMINI_MODEL_ID): LanguageModel {
  if (modelId.includes('/')) {
    throw new Error(
      `Model "${modelId}" is a Vercel AI Gateway id. Use GEMINI_MODEL_ID=gemini-flash-latest with GEMINI_API_KEY from Google AI Studio instead of AI_GATEWAY_API_KEY.`
    )
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing. Set it in Vercel environment variables or .env.local.'
    )
  }

  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelId)
}

export function geminiProviderOptions() {
  return {
    google: {
      // Maps to Gemini responseMimeType + responseSchema via the AI SDK.
      structuredOutputs: true,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  } as const
}
