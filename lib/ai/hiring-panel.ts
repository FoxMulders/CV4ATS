import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { unwrapAiError } from '@/lib/ai/errors'
import { createGeminiModel, GEMINI_MODEL_ID, geminiProviderOptions } from '@/lib/ai/gemini'
import {
  buildHiringPanelReviewPrompt,
  buildHiringPanelRevisionPrompt,
  HIRING_PANEL_REVISION_SYSTEM_PROMPT,
  HIRING_PANEL_REVIEW_SYSTEM_PROMPT,
} from '@/lib/ai/hiring-panel-prompts'
import {
  hiringPanelReviewSchema,
  type HiringPanelReview,
  type HiringPanelSessionResult,
} from '@/lib/ai/hiring-panel-schemas'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { AI_GENERATION_MAX_TOKENS, AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import {
  aiGenerationResultSchema,
  tailoredResumeSchema,
  type AiGenerationResult,
} from '@/lib/ai/schemas'

export const HIRING_PANEL_MODEL_ID =
  process.env.HIRING_PANEL_MODEL_ID?.trim() || GEMINI_MODEL_ID

export const MAX_HIRING_PANEL_REVISION_ROUNDS = 2

const REVIEW_OUTPUT = Output.object({
  schema: hiringPanelReviewSchema,
  name: 'HiringPanelReview',
  description: 'Ten hiring manager reviews with scores, approval flags, and revision recommendations.',
})

const REVISION_OUTPUT = Output.object({
  schema: aiGenerationResultSchema.pick({ tailoredResume: true, coverLetter: true }),
  name: 'HiringPanelRevision',
  description: 'Revised tailored resume and cover letter after panel feedback.',
})

function tryRecoverReview(error: unknown): HiringPanelReview | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined
  try {
    return hiringPanelReviewSchema.parse(parseJsonFromModelText(text))
  } catch {
    return undefined
  }
}

function tryRecoverRevision(
  error: unknown
): Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined
  try {
    const parsed = parseJsonFromModelText(text) as Record<string, unknown>
    return {
      tailoredResume: tailoredResumeSchema.parse(parsed.tailoredResume),
      coverLetter: String(parsed.coverLetter ?? ''),
    }
  } catch {
    return undefined
  }
}

export async function runHiringPanelReview(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult
): Promise<HiringPanelReview | null> {
  const model = createGeminiModel(HIRING_PANEL_MODEL_ID)
  const prompt = buildHiringPanelReviewPrompt(jobDescription, sourceResumeText, draft)

  try {
    const response = await generateText({
      model,
      system: HIRING_PANEL_REVIEW_SYSTEM_PROMPT,
      prompt,
      temperature: 0.3,
      maxOutputTokens: AI_GENERATION_MAX_TOKENS,
      maxRetries: AI_STREAM_MAX_RETRIES,
      output: REVIEW_OUTPUT,
      providerOptions: geminiProviderOptions(),
    })
    return hiringPanelReviewSchema.parse(response.output)
  } catch (error) {
    const recovered = tryRecoverReview(error)
    if (recovered) return recovered
    console.error('Hiring panel review failed:', error)
    return null
  }
}

export async function runHiringPanelRevision(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  review: HiringPanelReview
): Promise<Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | null> {
  const model = createGeminiModel(HIRING_PANEL_MODEL_ID)
  const prompt = buildHiringPanelRevisionPrompt(jobDescription, sourceResumeText, draft, review)

  try {
    const response = await generateText({
      model,
      system: HIRING_PANEL_REVISION_SYSTEM_PROMPT,
      prompt,
      temperature: 0.35,
      maxOutputTokens: AI_GENERATION_MAX_TOKENS,
      maxRetries: AI_STREAM_MAX_RETRIES,
      output: REVISION_OUTPUT,
      providerOptions: geminiProviderOptions(),
    })
    const revision = response.output as Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'>
    return {
      tailoredResume: tailoredResumeSchema.parse(revision.tailoredResume),
      coverLetter: String(revision.coverLetter).trim(),
    }
  } catch (error) {
    const recovered = tryRecoverRevision(error)
    if (recovered) return recovered
    console.error('Hiring panel revision failed:', error)
    return null
  }
}

function aggregateScore(managers: HiringPanelReview['managers']): number {
  if (managers.length === 0) return 0
  return Math.round(managers.reduce((sum, m) => sum + m.score, 0) / managers.length)
}

function buildSessionResult(
  review: HiringPanelReview,
  revisionRounds: number
): HiringPanelSessionResult {
  const unanimousApproval = review.managers.every((m) => m.approved)
  return {
    unanimousApproval,
    aggregateScore: aggregateScore(review.managers),
    revisionRounds,
    managers: review.managers,
    finalVerdict: review.finalVerdict,
  }
}

export async function runHiringPanelWithRevisions(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  onProgress?: (label: string) => void | Promise<void>
): Promise<{ aiResult: AiGenerationResult; panel: HiringPanelSessionResult | null }> {
  let current: AiGenerationResult = draft
  let revisionRounds = 0
  let lastReview: HiringPanelReview | null = null

  while (revisionRounds <= MAX_HIRING_PANEL_REVISION_ROUNDS) {
    await onProgress?.(
      revisionRounds === 0
        ? 'Hiring panel review…'
        : `Hiring panel review (round ${revisionRounds + 1})…`
    )

    const review = await runHiringPanelReview(jobDescription, sourceResumeText, current)
    if (!review) {
      return {
        aiResult: current,
        panel: lastReview ? buildSessionResult(lastReview, revisionRounds) : null,
      }
    }

    lastReview = review
    const unanimous = review.managers.every((m) => m.approved)

    if (unanimous || revisionRounds >= MAX_HIRING_PANEL_REVISION_ROUNDS) {
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    await onProgress?.('Applying hiring panel recommendations…')

    const revision = await runHiringPanelRevision(
      jobDescription,
      sourceResumeText,
      current,
      review
    )

    if (!revision?.coverLetter.trim()) {
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    current = {
      ...current,
      tailoredResume: revision.tailoredResume,
      coverLetter: revision.coverLetter,
    }
    revisionRounds += 1
  }

  return {
    aiResult: current,
    panel: lastReview ? buildSessionResult(lastReview, revisionRounds) : null,
  }
}
