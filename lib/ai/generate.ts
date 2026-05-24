import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

import { buildUserPrompt, SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { generationResultSchema, type GenerationResult } from '@/lib/ai/schemas'

function getModel() {
  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'

  if (process.env.AI_GATEWAY_API_KEY) {
    return process.env.AI_MODEL ?? 'openai/gpt-4o-mini'
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY environment variable.')
  }

  const openai = createOpenAI({ apiKey })
  return openai(modelId)
}

export async function generateTailoredResume(
  jobDescription: string,
  resumeText: string
): Promise<GenerationResult> {
  const { object } = await generateObject({
    model: getModel(),
    schema: generationResultSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(jobDescription, resumeText),
    temperature: 0.3,
  })

  return object
}
