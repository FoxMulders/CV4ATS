import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

import { formatDirectProviderSetupError } from '@/lib/ai/errors'
import {
  createGeminiModel,
  GEMINI_MODEL_ID,
  getGeminiApiKey,
  geminiProviderOptions,
} from '@/lib/ai/gemini'

export {
  createGeminiModel,
  GEMINI_MODEL_ID,
  getGeminiApiKey,
  geminiProviderOptions,
}

export type FreeAiProvider = 'google' | 'groq'

export const AI_GENERATION_MAX_TOKENS = 12288
export const AI_GENERATION_TEMPERATURE = 0.3
export const AI_REFINEMENT_TEMPERATURE = 0.3

/** Never retry through Vercel AI Gateway — fail fast and fall back to Groq or local rules. */
export const AI_STREAM_MAX_RETRIES = 0

/** Direct Gemini hiring-panel calls may retry transient 429s (not routed through AI Gateway). */
export const HIRING_PANEL_MAX_RETRIES = 2

/** @deprecated Use geminiProviderOptions */
export const googleProviderOptions = geminiProviderOptions

export interface ResolvedAiModel {
  model: LanguageModel
  provider: FreeAiProvider
  modelId: string
  providerOptions?: ReturnType<typeof geminiProviderOptions>
}

function hasDirectGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

function hasVercelGatewayEnv(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.AI_GATEWAY_URL?.trim()
  )
}

/**
 * Direct free-tier providers only — Gemini (AI Studio) first, optional Groq second.
 * Vercel AI Gateway is intentionally excluded (rate-limited free tier).
 */
export function buildFreeProviderChain(): ResolvedAiModel[] {
  const chain: ResolvedAiModel[] = []

  if (getGeminiApiKey()) {
    chain.push({
      model: createGeminiModel(),
      provider: 'google',
      modelId: GEMINI_MODEL_ID,
      providerOptions: geminiProviderOptions(),
    })
  }

  if (hasDirectGroqKey()) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY!.trim() })
    const modelId = process.env.GROQ_MODEL?.trim() || 'llama-3.1-70b-versatile'
    chain.push({
      model: groq(modelId),
      provider: 'groq',
      modelId,
    })
  }

  return chain
}

export function assertDirectAiProviderConfigured(): void {
  if (buildFreeProviderChain().length > 0) {
    return
  }

  if (hasVercelGatewayEnv()) {
    throw new Error(formatDirectProviderSetupError())
  }

  throw new Error(
    'No direct AI provider configured. Set GEMINI_API_KEY in Vercel (recommended) or GROQ_API_KEY for a free-tier fallback.'
  )
}

/** @deprecated Use assertDirectAiProviderConfigured */
export function assertGeminiConfigured(): void {
  assertDirectAiProviderConfigured()
}

export function resolveFreeAiModel(): ResolvedAiModel {
  const chain = buildFreeProviderChain()
  if (chain.length === 0) {
    assertDirectAiProviderConfigured()
  }
  return chain[0]!
}

export function describeConfiguredProvider(): string {
  const chain = buildFreeProviderChain()
  if (chain.length === 0) {
    return hasVercelGatewayEnv() ? 'Vercel AI Gateway (unsupported)' : 'none (local fallback only)'
  }
  if (chain.length === 1) {
    const entry = chain[0]!
    return entry.provider === 'google'
      ? `Google Gemini (${entry.modelId})`
      : `Groq (${entry.modelId})`
  }
  return `${chain.map((entry) => `${entry.provider}:${entry.modelId}`).join(' → ')}`
}
