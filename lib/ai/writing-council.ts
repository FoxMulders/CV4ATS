import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { unwrapAiError } from '@/lib/ai/errors'
import { createGeminiModel, GEMINI_MODEL_ID, geminiProviderOptions } from '@/lib/ai/gemini'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { AI_GENERATION_MAX_TOKENS, AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import {
  buildWritingCouncilUserPrompt,
  WRITING_COUNCIL_SYSTEM_PROMPT,
} from '@/lib/ai/writing-council-prompts'
import {
  writingCouncilResultSchema,
  type WritingCouncilResult,
} from '@/lib/ai/writing-council-schemas'

export const WRITING_COUNCIL_MODEL_ID =
  process.env.WRITING_COUNCIL_MODEL_ID?.trim() || GEMINI_MODEL_ID

const STRUCTURED_OUTPUT = Output.object({
  schema: writingCouncilResultSchema,
  name: 'WritingCouncilResult',
  description: 'Internally council-approved cover letter rewrite.',
})

function tryRecoverCouncilOutput(error: unknown): WritingCouncilResult | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined

  try {
    return writingCouncilResultSchema.parse(parseJsonFromModelText(text))
  } catch {
    return undefined
  }
}

/**
 * Internal writing council pass — critiques, plans, and rewrites a generic cover letter draft.
 * Failures return null so generation can fall back to the original draft.
 */
export async function runWritingCouncilPass(
  jobDescription: string,
  resumeText: string,
  draftCoverLetter: string
): Promise<WritingCouncilResult | null> {
  if (!draftCoverLetter.trim()) return null

  const model = createGeminiModel(WRITING_COUNCIL_MODEL_ID)
  const prompt = buildWritingCouncilUserPrompt(jobDescription, resumeText, draftCoverLetter)

  try {
    const response = await generateText({
      model,
      system: WRITING_COUNCIL_SYSTEM_PROMPT,
      prompt,
      temperature: 0.35,
      maxOutputTokens: AI_GENERATION_MAX_TOKENS,
      maxRetries: AI_STREAM_MAX_RETRIES,
      output: STRUCTURED_OUTPUT,
      providerOptions: geminiProviderOptions(),
    })

    return writingCouncilResultSchema.parse(response.output)
  } catch (error) {
    const recovered = tryRecoverCouncilOutput(error)
    if (recovered) return recovered

    console.error('Writing council pass failed:', error)
    return null
  }
}
