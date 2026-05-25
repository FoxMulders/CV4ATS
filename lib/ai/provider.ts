import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

import {
  assertGeminiConfigured,
  createGeminiModel,
  GEMINI_MODEL_ID,
  getGeminiApiKey,
  geminiProviderOptions,
} from '@/lib/ai/gemini'

export {
  assertGeminiConfigured,
  createGeminiModel,
  GEMINI_MODEL_ID,
  getGeminiApiKey,
  geminiProviderOptions,
}

export type FreeAiProvider = 'google' | 'groq'

export const AI_GENERATION_MAX_TOKENS = 8192
export const AI_GENERATION_TEMPERATURE = 0.3
export const AI_REFINEMENT_TEMPERATURE = 0.3

/** @deprecated Use geminiProviderOptions */
export const googleProviderOptions = geminiProviderOptions

export interface ResolvedAiModel {
  model: LanguageModel
  provider: FreeAiProvider
  modelId: string
}

/**
 * Resolves Gemini first (GEMINI_API_KEY), then optional Groq fallback.
 */
export function resolveFreeAiModel(): ResolvedAiModel {
  if (getGeminiApiKey()) {
    return {
      model: createGeminiModel(),
      provider: 'google',
      modelId: GEMINI_MODEL_ID,
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    const modelId = process.env.GROQ_MODEL?.trim() || 'llama-3.1-70b-versatile'
    return { model: groq(modelId), provider: 'groq', modelId }
  }

  throw new Error(
    'No AI provider configured. Set GEMINI_API_KEY in Vercel (recommended) or GROQ_API_KEY in .env.local.'
  )
}

export function describeConfiguredProvider(): string {
  if (getGeminiApiKey()) {
    return `Google Gemini (${GEMINI_MODEL_ID})`
  }
  if (process.env.GROQ_API_KEY?.trim()) {
    return `Groq (${process.env.GROQ_MODEL?.trim() || 'llama-3.1-70b-versatile'})`
  }
  return 'none (local fallback only)'
}
