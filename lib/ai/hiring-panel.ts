import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { unwrapAiError } from '@/lib/ai/errors'
import { createGeminiModel, geminiProviderOptions } from '@/lib/ai/gemini'
import {
  buildHiringPanelUserPrompt,
  HIRING_PANEL_SYSTEM_PROMPT,
} from '@/lib/ai/hiring-panel-prompts'
import {
  hiringPanelResultSchema,
  type HiringPanelResult,
} from '@/lib/ai/hiring-panel-schemas'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { AI_GENERATION_MAX_TOKENS, AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'

/** Complex reasoning model for multi-step panel simulation. Override via HIRING_PANEL_MODEL_ID. */
export const HIRING_PANEL_MODEL_ID =
  process.env.HIRING_PANEL_MODEL_ID?.trim() || 'gemini-1.5-pro'

const STRUCTURED_OUTPUT = Output.object({
  schema: hiringPanelResultSchema,
  name: 'HiringPanelResult',
  description:
    'Elite hiring manager panel output with critiquesSummary, rewrittenBullets, and coverLetterHook.',
})

function tryRecoverHiringPanelOutput(error: unknown): HiringPanelResult | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined

  try {
    return hiringPanelResultSchema.parse(parseJsonFromModelText(text))
  } catch {
    return undefined
  }
}

export async function runHiringPanelSimulation(
  jobDescription: string,
  resumeText: string
): Promise<HiringPanelResult> {
  const model = createGeminiModel(HIRING_PANEL_MODEL_ID)
  const prompt = buildHiringPanelUserPrompt(jobDescription, resumeText)

  try {
    const response = await generateText({
      model,
      system: HIRING_PANEL_SYSTEM_PROMPT,
      prompt,
      temperature: 0.35,
      maxOutputTokens: AI_GENERATION_MAX_TOKENS,
      maxRetries: AI_STREAM_MAX_RETRIES,
      output: STRUCTURED_OUTPUT,
      providerOptions: geminiProviderOptions(),
    })

    return hiringPanelResultSchema.parse(response.output)
  } catch (error) {
    const recovered = tryRecoverHiringPanelOutput(error)
    if (recovered) return recovered

    const root = unwrapAiError(error)
    if (NoObjectGeneratedError.isInstance(root)) {
      throw new Error(
        'The hiring panel returned an unparseable response. Try a shorter resume or job description.'
      )
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Elite Hiring Manager Panel simulation failed unexpectedly.')
  }
}
