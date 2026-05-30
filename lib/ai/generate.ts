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
import { type AiGenerationResult } from '@/lib/ai/schemas'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { lockSourceResumeStructure } from '@/lib/resume/source-resume-structure'

export type AiStreamCallbacks = {
  onPartial?: (partial: DeepPartial<AiGenerationResult>) => void | Promise<void>
}

const ENRICHMENT_STRUCTURED_OUTPUT = Output.object({
  schema: enrichmentModelOutputSchema,
  name: 'EnrichedApplication',
  description:
    'Surgically enriched resume package: professionalSummary, skills, workExperience with locked company/title/dates, and coverLetter.',
})

type GenerationContext = {
  sourceResumeText: string
  jobDescription: string
  promptOptions: UserPromptOptions
}

function parseEnrichmentResult(raw: unknown): EnrichmentModelOutput {
  const normalized = normalizeAiGenerationOutput({
    professionalSummary:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).professionalSummary ??
          (raw as Record<string, unknown>).summary
        : undefined,
    skills:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).skills
        : undefined,
    workExperience:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? ((raw as Record<string, unknown>).workExperience ??
            (raw as Record<string, unknown>).experience)
        : undefined,
    coverLetter:
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).coverLetter
        : undefined,
  })

  if (
    normalized &&
    typeof normalized === 'object' &&
    !Array.isArray(normalized) &&
    (normalized as Record<string, unknown>).tailoredResume
  ) {
    const shaped = normalized as {
      tailoredResume: {
        summary: string
        skills: string[]
        experience: Array<{
          company: string
          title: string
          startDate: string
          endDate: string
          bullets: string[]
        }>
      }
      coverLetter: string
    }

    return enrichmentModelOutputSchema.parse({
      professionalSummary: shaped.tailoredResume.summary,
      skills: shaped.tailoredResume.skills,
      workExperience: shaped.tailoredResume.experience.map((entry) => ({
        company: entry.company,
        title: entry.title,
        dates: `${entry.startDate} – ${entry.endDate}`,
        bullets: entry.bullets,
      })),
      coverLetter: shaped.coverLetter,
    })
  }

  return enrichmentModelOutputSchema.parse(raw)
}

function finalizeEnrichmentResult(
  enrichment: EnrichmentModelOutput,
  context: GenerationContext
): AiGenerationResult {
  const locked = lockSourceResumeStructure(context.sourceResumeText)
  const draftPartial = enrichmentOutputToDraft(enrichment, locked)

  const serialized = [
    draftPartial.tailoredResume.summary,
    draftPartial.tailoredResume.skills.join(' '),
    ...draftPartial.tailoredResume.experience.flatMap((entry) => entry.bullets),
  ].join('\n')

  const keywordReport = scoreAtsCompliance(serialized, context.jobDescription)

  const draft: AiGenerationResult = {
    keywordReport,
    tailoredResume: draftPartial.tailoredResume,
    coverLetter: draftPartial.coverLetter,
  }

  return applyStructuralPreservation(context.sourceResumeText, draft, {
    jobDescription: context.jobDescription,
    missingKeywords: context.promptOptions.missingKeywords,
  })
}

function mapEnrichmentPartialToAiPartial(
  partial: DeepPartial<EnrichmentModelOutput>
): DeepPartial<AiGenerationResult> {
  return {
    coverLetter: partial.coverLetter,
    tailoredResume: {
      summary: partial.professionalSummary,
      skills: partial.skills,
      experience: partial.workExperience?.map((entry) => ({
        company: entry?.company,
        title: entry?.title,
        location: '',
        startDate: entry?.dates?.split(/\s*[-–—]\s*/)[0] ?? '',
        endDate: entry?.dates?.split(/\s*[-–—]\s*/)[1] ?? 'Present',
        bullets: entry?.bullets,
      })),
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
    return finalizeEnrichmentResult(parseEnrichmentResult(parseJsonFromModelText(text)), context)
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

  for await (const partial of stream.partialOutputStream) {
    if (partial && typeof partial === 'object' && !Array.isArray(partial)) {
      lastPartial = partial as DeepPartial<EnrichmentModelOutput>
      await callbacks.onPartial?.(mapEnrichmentPartialToAiPartial(lastPartial))
    }
  }

  try {
    const raw = await stream.output
    return finalizeEnrichmentResult(parseEnrichmentResult(raw), context)
  } catch (error) {
    const recovered = tryRecoverStructuredOutput(error, context)
    if (recovered) {
      return recovered
    }

    if (lastPartial?.professionalSummary && lastPartial?.coverLetter) {
      try {
        const merged = finalizeEnrichmentResult(
          parseEnrichmentResult({
            professionalSummary: lastPartial.professionalSummary ?? '',
            skills: lastPartial.skills ?? [],
            workExperience:
              lastPartial.workExperience?.map((entry) => ({
                company: entry?.company ?? '',
                title: entry?.title ?? '',
                dates: entry?.dates ?? '',
                bullets: entry?.bullets ?? ['Delivered measurable outcomes.'],
              })) ?? [],
            coverLetter: lastPartial.coverLetter ?? '',
          }),
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
        return finalizeEnrichmentResult(parseEnrichmentResult(parseJsonFromModelText(text)), context)
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
    jobDescription,
    promptOptions,
  }
  const prompt = buildEnrichmentUserPrompt({
    jobDescription,
    sourceResumeText: resumeText,
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
  callbacks: AiStreamCallbacks = {}
): Promise<AiGenerationResult> {
  const promptOptions: UserPromptOptions = {
    missingKeywords,
    coreCompetencyChecklist,
    achievementSupplement,
  }
  const context: GenerationContext = {
    sourceResumeText,
    jobDescription,
    promptOptions,
  }
  const prompt = buildEnrichmentRefinementPrompt(
    jobDescription,
    sourceResumeText,
    currentScore,
    missingKeywords,
    coreCompetencyChecklist,
    achievementSupplement
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
