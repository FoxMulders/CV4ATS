import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { unwrapAiError } from '@/lib/ai/errors'
import { createGeminiModel, geminiProviderOptions } from '@/lib/ai/gemini'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import {
  buildVerifySkillSystemPrompt,
  buildVerifySkillUserPrompt,
} from '@/lib/ai/verify-skill-prompts'
import {
  verifySkillResultSchema,
  type VerifySkillResult,
} from '@/lib/ai/verify-skill-schemas'

/** Rapid verification model. Override with VERIFY_SKILL_MODEL_ID (e.g. gemini-flash-latest). */
export const VERIFY_SKILL_MODEL_ID =
  process.env.VERIFY_SKILL_MODEL_ID?.trim() || 'gemini-flash-latest'

const STRUCTURED_OUTPUT = Output.object({
  schema: verifySkillResultSchema,
  name: 'VerifySkillResult',
  description: 'Pass/Fail skill verification with feedback and optional revised bullet.',
})

function tryRecoverVerifySkillOutput(error: unknown): VerifySkillResult | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined

  try {
    return verifySkillResultSchema.parse(parseJsonFromModelText(text))
  } catch {
    return undefined
  }
}

export async function verifySkillWithAi(input: {
  skillName: string
  originalBullet: string
  userExplanation: string
}): Promise<VerifySkillResult> {
  const model = createGeminiModel(VERIFY_SKILL_MODEL_ID)

  const response = await generateText({
    model,
    system: buildVerifySkillSystemPrompt(input.skillName, input.originalBullet),
    prompt: buildVerifySkillUserPrompt(input.userExplanation),
    temperature: 0.1,
    maxOutputTokens: 1024,
    maxRetries: AI_STREAM_MAX_RETRIES,
    output: STRUCTURED_OUTPUT,
    providerOptions: geminiProviderOptions(),
  })

  return verifySkillResultSchema.parse(response.output)
}

export async function verifySkillWithAiSafe(input: {
  skillName: string
  originalBullet: string
  userExplanation: string
}): Promise<VerifySkillResult> {
  try {
    return await verifySkillWithAi(input)
  } catch (error) {
    const recovered = tryRecoverVerifySkillOutput(error)
    if (recovered) return recovered

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Skill verification failed unexpectedly.')
  }
}
