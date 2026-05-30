import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  streamText,
  type DeepPartial,
} from 'ai'

import {
  ENRICHMENT_SYSTEM_PROMPT,
  buildEnrichmentRefinementPrompt,
  buildEnrichmentUserPrompt,
} from '@/lib/ai/enrichment-prompts'
import {
  enrichmentModelOutputSchema,
  type EnrichmentModelOutput,
} from '@/lib/ai/enrichment-schemas'
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
  applyStructuralPreservation,
  enrichmentOutputToDraft,
} from '@/lib/ai/preserve-and-enrich'
import type { UserPromptOptions } from '@/lib/ai/prompts'
import {
  AI_GENERATION_MAX_TOKENS,
  AI_GENERATION_TEMPERATURE,
  AI_REFINEMENT_TEMPERATURE,
  AI_STREAM_MAX_RETRIES,
  assertDirectAiProviderConfigured,
  buildFreeProviderChain,
  type ResolvedAiModel,
} from '@/lib/ai/provider'
import { type AiGenerationResult, type TailoredResume } from '@/lib/ai/schemas'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { allFrozenBlocks, lockResumeState } from '@/lib/resume/strict-resume-state'

export type AiStreamCallbacks = {
  onPartial?: (partial: DeepPartial<AiGenerationResult>) => void | Promise<void>
}

const ENRICHMENT_STRUCTURED_OUTPUT = Output.object({
  schema: enrichmentModelOutputSchema,
  name: 'EnrichedApplication',
  description:
    'Surgically enriched skills and experienceBullets (blockKey + bullets only) plus coverLetter.',
})

type GenerationContext = {
  sourceResumeText: string
  currentResume?: TailoredResume
  jobDescription: string
  promptOptions: UserPromptOptions
}

function legacyWorkExperienceToBullets(
  workExperience: Array<{ company?: string; title?: string; bullets?: string[] }>,
  locked: ReturnType<typeof lockResumeState>
): EnrichmentModelOutput['experienceBullets'] {
  return allFrozenBlocks(locked).map((block, index) => {
    const legacy =
      workExperience.find(
        (entry) =>
          entry.company?.toLowerCase().includes(block.company.toLowerCase().slice(0, 6)) ||
          entry.title?.toLowerCase() === block.title.toLowerCase()
      ) ?? workExperience[index]

    return {
      blockKey: block.blockKey,
      bullets: legacy?.bullets?.length ? legacy.bullets : block.bullets,
    }
  })
}

function parseEnrichmentResult(
  raw: unknown,
  locked: ReturnType<typeof lockResumeState>
): EnrichmentModelOutput {
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

  if (Array.isArray(record.experienceBullets)) {
    return enrichmentModelOutputSchema.parse({
      skills: record.skills,
      experienceBullets: record.experienceBullets,
      professionalSummary: record.professionalSummary ?? record.summary,
      coverLetter: record.coverLetter,
    })
  }

  const legacyExperience = (record.workExperience ?? record.experience) as
    | Array<{ company?: string; title?: string; bullets?: string[] }>
    | undefined

  if (legacyExperience?.length) {
    return enrichmentModelOutputSchema.parse({
      skills: record.skills ?? [],
      experienceBullets: legacyWorkExperienceToBullets(legacyExperience, locked),
      professionalSummary: record.professionalSummary ?? record.summary,
      coverLetter: record.coverLetter,
    })
  }

  return enrichmentModelOutputSchema.parse(raw)
}

function resolveLockedState(context: GenerationContext) {
  return lockResumeState(context.currentResume ?? context.sourceResumeText)
}

function finalizeEnrichmentResult(
  enrichment: EnrichmentModelOutput,
  context: GenerationContext
): AiGenerationResult {
  const locked = resolveLockedState(context)
  const draftPartial = enrichmentOutputToDraft(enrichment, locked)

  const serialized = [
    draftPartial.tailoredResume.summary,
    draftPartial.tailoredResume.skills.join(' '),
    ...draftPartial.tailoredResume.experience.flatMap((entry) => entry.bullets),
    ...(draftPartial.tailoredResume.projects ?? []).flatMap((entry) => entry.bullets),
  ].join('\n')

  const keywordReport = scoreAtsCompliance(serialized, context.jobDescription)

  const draft: AiGenerationResult = {
    keywordReport,
    tailoredResume: draftPartial.tailoredResume,
    coverLetter: draftPartial.coverLetter,
  }

  return applyStructuralPreservation(context.currentResume ?? context.sourceResumeText, draft, {
    jobDescription: context.jobDescription,
    missingKeywords: context.promptOptions.missingKeywords,
  })
}

function mapEnrichmentPartialToAiPartial(
  partial: DeepPartial<EnrichmentModelOutput>,
  locked: ReturnType<typeof lockResumeState>
): DeepPartial<AiGenerationResult> {
  const blocks = allFrozenBlocks(locked)
  return {
    coverLetter: partial.coverLetter,
    tailoredResume: {
      summary: partial.professionalSummary,
      skills: partial.skills,
      experience: partial.experienceBullets?.map((entry, index) => {
        const frozen = blocks[index]
        return {
          company: frozen?.company,
          title: frozen?.title,
          location: frozen?.location ?? '',
          startDate: frozen?.startDate ?? '',
          endDate: frozen?.endDate ?? 'Present',
          bullets: entry?.bullets,
        }
      }),
      projects: [],
    },
  }
}

function tryRecoverStructuredOutput(
  error: unknown,
  context: GenerationContext
): AiGenerationResult | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined

  if (!text?.trim()) {
    return undefined
  }

  try {
    return finalizeEnrichmentResult(
      parseEnrichmentResult(parseJsonFromModelText(text), resolveLockedState(context)),
      context
    )
  } catch {
    return undefined
  }
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
    return `AI returned an empty or unparseable response. Try a shorter resume/job description, or regenerate in a moment. (${root.message})`
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
  context: GenerationContext,
  callbacks: AiStreamCallbacks
): Promise<AiGenerationResult> {
  const stream = streamText({
    model: entry.model,
    system: ENRICHMENT_SYSTEM_PROMPT,
    prompt,
    temperature,
    maxOutputTokens: AI_GENERATION_MAX_TOKENS,
    maxRetries: AI_STREAM_MAX_RETRIES,
    output: ENRICHMENT_STRUCTURED_OUTPUT,
    providerOptions: entry.providerOptions,
  })

  let lastPartial: DeepPartial<EnrichmentModelOutput> | undefined
  const locked = resolveLockedState(context)

  for await (const partial of stream.partialOutputStream) {
    if (partial && typeof partial === 'object' && !Array.isArray(partial)) {
      lastPartial = partial as DeepPartial<EnrichmentModelOutput>
      await callbacks.onPartial?.(mapEnrichmentPartialToAiPartial(lastPartial, locked))
    }
  }

  try {
    const raw = await stream.output
    return finalizeEnrichmentResult(parseEnrichmentResult(raw, locked), context)
  } catch (error) {
    const recovered = tryRecoverStructuredOutput(error, context)
    if (recovered) {
      return recovered
    }

    if (lastPartial?.coverLetter && (lastPartial.skills || lastPartial.experienceBullets)) {
      try {
        const merged = finalizeEnrichmentResult(
          parseEnrichmentResult(
            {
              skills: lastPartial.skills ?? [],
              experienceBullets:
                lastPartial.experienceBullets?.map((entry, index) => ({
                  blockKey: entry?.blockKey ?? locked.workExperience[index]?.blockKey ?? `block-${index}`,
                  bullets: entry?.bullets ?? ['Delivered measurable outcomes.'],
                })) ?? [],
              professionalSummary: lastPartial.professionalSummary,
              coverLetter: lastPartial.coverLetter ?? '',
            },
            locked
          ),
          context
        )
        return merged
      } catch {
        // fall through to raw text recovery
      }
    }

    try {
      const text = await stream.text
      if (text?.trim()) {
        return finalizeEnrichmentResult(
          parseEnrichmentResult(parseJsonFromModelText(text), locked),
          context
        )
      }
    } catch {
      // fall through
    }

    throw new Error(formatAiError(error, entry), { cause: error })
  }
}

async function streamStructuredGeneration(
  prompt: string,
  temperature: number,
  context: GenerationContext,
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  assertDirectAiProviderConfigured()

  const chain = buildFreeProviderChain()
  let lastError: unknown

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index]!
    try {
      return await runStreamWithProvider(entry, prompt, temperature, context, callbacks)
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
  const context: GenerationContext = {
    sourceResumeText: resumeText,
    currentResume: promptOptions.currentResume,
    jobDescription,
    promptOptions,
  }
  const prompt = buildEnrichmentUserPrompt({
    jobDescription,
    sourceResumeText: resumeText,
    currentResume: promptOptions.currentResume,
    options: promptOptions,
  })

  try {
    return await streamStructuredGeneration(prompt, AI_GENERATION_TEMPERATURE, context, callbacks)
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
  achievementSupplement?: string,
  callbacks: AiStreamCallbacks = {},
  currentResume?: TailoredResume
): Promise<AiGenerationResult> {
  const promptOptions: UserPromptOptions = {
    missingKeywords,
    coreCompetencyChecklist,
    achievementSupplement,
    currentResume,
  }
  const context: GenerationContext = {
    sourceResumeText,
    currentResume,
    jobDescription,
    promptOptions,
  }
  const prompt = buildEnrichmentRefinementPrompt(
    jobDescription,
    sourceResumeText,
    currentScore,
    missingKeywords,
    coreCompetencyChecklist,
    achievementSupplement,
    promptOptions.currentResume
  )

  try {
    return await streamStructuredGeneration(prompt, AI_REFINEMENT_TEMPERATURE, context, callbacks)
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
