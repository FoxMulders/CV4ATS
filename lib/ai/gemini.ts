import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

/**
 * Free-tier Gemini model for ATS4CV.
 * `gemini-1.5-flash` is no longer served on v1beta for many AI Studio keys;
 * `gemini-flash-latest` is the current fast default. Override via GEMINI_MODEL_ID.
 */
export const GEMINI_MODEL_ID =
  process.env.GEMINI_MODEL_ID?.trim() || 'gemini-flash-latest'

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
      'GEMINI_API_KEY is not configured. In Vercel → ATS4CV project → Settings → Environment Variables, add GEMINI_API_KEY from Google AI Studio, then redeploy.'
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
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  } as const
}
