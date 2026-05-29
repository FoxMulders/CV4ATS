import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  streamText,
  type DeepPartial,
} from 'ai'

import {
  formatDirectProviderSetupError,
  isAiProviderUnavailable,
  isRateLimitOrQuotaError,
  isVercelAiGatewayError,
  shouldUseLocalFallback,
  unwrapAiError,
} from '@/lib/ai/errors'
import { GEMINI_MODEL_ID } from '@/lib/ai/gemini'
import {
  generateTailoredResumeLocally,
  refineTailoredResumeLocally,
} from '@/lib/ai/local-fallback'
import { normalizeAiGenerationOutput, parseJsonFromModelText } from '@/lib/ai/normalize-output'
import {
  buildRefinementPrompt,
  buildUserPrompt,
  SYSTEM_PROMPT,
  type UserPromptOptions,
} from '@/lib/ai/prompts'
import {
  AI_GENERATION_MAX_TOKENS,
  AI_GENERATION_TEMPERATURE,
  AI_REFINEMENT_TEMPERATURE,
  AI_STREAM_MAX_RETRIES,
  assertDirectAiProviderConfigured,
  buildFreeProviderChain,
  type ResolvedAiModel,
} from '@/lib/ai/provider'
import { aiGenerationResultSchema, type AiGenerationResult } from '@/lib/ai/schemas'

export type AiStreamCallbacks = {
  onPartial?: (partial: DeepPartial<AiGenerationResult>) => void | Promise<void>
}

const STRUCTURED_OUTPUT = Output.object({
  schema: aiGenerationResultSchema,
  name: 'TailoredApplication',
  description:
    'Structured ATS resume package with keywordReport, tailoredResume, and coverLetter. tailoredResume.summary and experience bullets must follow Resume Narrative Engine rules (hook-first summary, impact-first bullets). coverLetter must follow Cover Letter Generation Engine rules.',
})

function parseStructuredResult(raw: unknown): AiGenerationResult {
  return aiGenerationResultSchema.parse(normalizeAiGenerationOutput(raw))
}

function tryRecoverStructuredOutput(error: unknown): AiGenerationResult | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined

  if (!text?.trim()) {
    return undefined
  }

  try {
    return parseStructuredResult(parseJsonFromModelText(text))
  } catch {
    return undefined
  }
}

function asPartialResult(
  value: DeepPartial<AiGenerationResult> | undefined
): DeepPartial<AiGenerationResult> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value
}

function formatAiError(error: unknown, provider: ResolvedAiModel): string {
  const root = unwrapAiError(error)

  if (isVercelAiGatewayError(root) || isVercelAiGatewayError(error)) {
    return formatDirectProviderSetupError()
  }

  if (APICallError.isInstance(root)) {
    if (root.statusCode === 401 || root.statusCode === 403) {
      return provider.provider === 'google'
        ? 'Gemini rejected the API key. Verify GEMINI_API_KEY in Vercel matches your ATS4CV Google AI Studio key, then redeploy.'
        : 'Groq rejected the API key. Verify GROQ_API_KEY in Vercel, then redeploy.'
    }
    if (root.statusCode === 429) {
      return provider.provider === 'google'
        ? 'Gemini rate limit reached. Trying Groq or local keyword tailoring…'
        : 'Groq rate limit reached. Falling back to local keyword tailoring…'
    }
    if (root.statusCode === 404) {
      return `Model "${provider.modelId}" was not found. Set GEMINI_MODEL_ID=gemini-flash-latest in Vercel for Gemini keys.`
    }
    return `${provider.provider} API error (${root.statusCode}): ${root.message}`
  }

  if (NoObjectGeneratedError.isInstance(root)) {
    return `AI returned an unparseable response. Try a shorter resume. (${root.message})`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Resume generation failed unexpectedly.'
}

function shouldTryNextProvider(error: unknown): boolean {
  const root = unwrapAiError(error)
  return (
    isRateLimitOrQuotaError(root) ||
    isVercelAiGatewayError(root) ||
    isAiProviderUnavailable(root) ||
    NoObjectGeneratedError.isInstance(root)
  )
}

async function runStreamWithProvider(
  entry: ResolvedAiModel,
  prompt: string,
  temperature: number,
  callbacks: AiStreamCallbacks
): Promise<AiGenerationResult> {
  const stream = streamText({
    model: entry.model,
    system: SYSTEM_PROMPT,
    prompt,
    temperature,
    maxOutputTokens: AI_GENERATION_MAX_TOKENS,
    maxRetries: AI_STREAM_MAX_RETRIES,
    output: STRUCTURED_OUTPUT,
    providerOptions: entry.providerOptions,
  })

  for await (const partial of stream.partialOutputStream) {
    const preview = asPartialResult(partial)
    if (preview) {
      await callbacks.onPartial?.(preview)
    }
  }

  try {
    const raw = await stream.output
    return parseStructuredResult(raw)
  } catch (error) {
    const recovered = tryRecoverStructuredOutput(error)
    if (recovered) {
      return recovered
    }
    throw new Error(formatAiError(error, entry), { cause: error })
  }
}

async function streamStructuredGeneration(
  prompt: string,
  temperature: number,
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  assertDirectAiProviderConfigured()

  const chain = buildFreeProviderChain()
  let lastError: unknown

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index]!
    try {
      return await runStreamWithProvider(entry, prompt, temperature, callbacks)
    } catch (error) {
      lastError = error
      const hasNext = index < chain.length - 1
      if (hasNext && shouldTryNextProvider(error)) {
        continue
      }
      throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No AI provider available.')
}

export async function generateTailoredResume(
  jobDescription: string,
  resumeText: string,
  promptOptions: UserPromptOptions = {},
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  const prompt = buildUserPrompt(jobDescription, resumeText, promptOptions)

  try {
    return await streamStructuredGeneration(prompt, AI_GENERATION_TEMPERATURE, callbacks)
  } catch (error) {
    if (shouldUseLocalFallback(error)) {
      return generateTailoredResumeLocally(jobDescription, resumeText)
    }
    throw error
  }
}

export async function refineTailoredResume(
  jobDescription: string,
  sourceResumeText: string,
  currentScore: number,
  missingKeywords: string[],
  coreCompetencyChecklist?: string,
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  const prompt = buildRefinementPrompt(
    jobDescription,
    sourceResumeText,
    currentScore,
    missingKeywords,
    coreCompetencyChecklist
  )

  try {
    return await streamStructuredGeneration(prompt, AI_REFINEMENT_TEMPERATURE, callbacks)
  } catch (error) {
    if (shouldUseLocalFallback(error)) {
      return refineTailoredResumeLocally(
        jobDescription,
        sourceResumeText,
        currentScore,
        missingKeywords
      )
    }
    throw error
  }
}

export { GEMINI_MODEL_ID }
