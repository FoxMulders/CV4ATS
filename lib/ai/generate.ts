import { APICallError, NoObjectGeneratedError, Output, streamText, type DeepPartial, type JSONValue } from 'ai'

import { shouldUseLocalFallback } from '@/lib/ai/errors'
import {
  createGeminiModel,
  geminiProviderOptions,
  GEMINI_MODEL_ID,
  getGeminiApiKey,
} from '@/lib/ai/gemini'
import {
  generateTailoredResumeLocally,
  refineTailoredResumeLocally,
} from '@/lib/ai/local-fallback'
import {
  normalizeAiGenerationOutput,
} from '@/lib/ai/normalize-output'
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
} from '@/lib/ai/provider'
import { aiGenerationResultSchema, type AiGenerationResult } from '@/lib/ai/schemas'

export type AiStreamCallbacks = {
  onPartial?: (partial: DeepPartial<AiGenerationResult>) => void | Promise<void>
}

function asPartialResult(value: JSONValue | undefined): DeepPartial<AiGenerationResult> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as DeepPartial<AiGenerationResult>
}

function formatGeminiError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return 'Gemini rejected the API key. Verify GEMINI_API_KEY in Vercel matches your ATS4CV Google AI Studio key, then redeploy.'
    }
    if (error.statusCode === 429) {
      return 'Gemini rate limit reached. Wait a minute and try again.'
    }
    if (error.statusCode === 404) {
      return `Gemini model "${GEMINI_MODEL_ID}" was not found. Set GEMINI_MODEL_ID=gemini-flash-latest in Vercel, or pick a model listed in Google AI Studio for your ATS4CV key.`
    }
    return `Gemini API error (${error.statusCode}): ${error.message}`
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return `Gemini returned an unparseable response. Try a shorter resume. (${error.message})`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Gemini generation failed unexpectedly.'
}

async function streamStructuredGeneration(
  prompt: string,
  temperature: number,
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  if (!getGeminiApiKey()) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in Vercel → Environment Variables for the ATS4CV project.'
    )
  }

  const model = createGeminiModel()

  const stream = streamText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    temperature,
    maxOutputTokens: AI_GENERATION_MAX_TOKENS,
    output: Output.json(),
    providerOptions: geminiProviderOptions(),
  })

  for await (const partial of stream.partialOutputStream) {
    const preview = asPartialResult(partial)
    if (preview) {
      await callbacks.onPartial?.(preview)
    }
  }

  try {
    const raw = await stream.output
    return aiGenerationResultSchema.parse(normalizeAiGenerationOutput(raw))
  } catch (error) {
    throw new Error(formatGeminiError(error), { cause: error })
  }
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
