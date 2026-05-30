import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
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
  type TailoredResume,
} from '@/lib/ai/schemas'
import { applyStructuralPreservation } from '@/lib/ai/preserve-and-enrich'
import {
  auditCoverLetterCompliance,
  findCoverLetterBannedPhrases,
} from '@/lib/resume/cover-letter-compliance'

export const HIRING_PANEL_MODEL_ID =
  process.env.HIRING_PANEL_MODEL_ID?.trim() || GEMINI_MODEL_ID

export const MAX_HIRING_PANEL_REVISION_ROUNDS = 4

export type HiringPanelRunOptions = {
  achievementSupplement?: string
  /** Structured resume from the client — preferred preservation source over text re-parse. */
  currentResume?: TailoredResume
}

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

async function enforceCoverLetterCompliance(
  draft: AiGenerationResult,
  jobDescription: string,
  sourceResumeText: string,
  panelReview: HiringPanelReview | null,
  achievementSupplement?: string
): Promise<AiGenerationResult> {
  let coverLetter = draft.coverLetter
  let violations = auditCoverLetterCompliance(coverLetter)

  for (let pass = 0; pass < 2 && violations.length > 0; pass += 1) {
    coverLetter = await repairCoverLetterCompliance(
      coverLetter,
      violations,
      sourceResumeText,
      jobDescription,
      achievementSupplement,
      panelReview
    )
    violations = auditCoverLetterCompliance(coverLetter)
  }

  return { ...draft, coverLetter }
}

export async function runHiringPanelReview(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult
): Promise<HiringPanelReview | null> {
  const model = createGeminiModel(HIRING_PANEL_MODEL_ID)
  const prompt = buildHiringPanelReviewPrompt(jobDescription, sourceResumeText, draft)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateText({
        model,
        system: HIRING_PANEL_REVIEW_SYSTEM_PROMPT,
        prompt,
        temperature: attempt === 0 ? 0.3 : 0.2,
        maxOutputTokens: AI_GENERATION_MAX_TOKENS,
        maxRetries: AI_STREAM_MAX_RETRIES,
        output: REVIEW_OUTPUT,
        providerOptions: geminiProviderOptions(),
      })
      return hiringPanelReviewSchema.parse(response.output)
    } catch (error) {
      const recovered = tryRecoverReview(error)
      if (recovered) return recovered
      if (attempt === 0) continue
      console.error('Hiring panel review failed:', error)
      return null
    }
  }

  return null
}

export async function runHiringPanelRevision(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  review: HiringPanelReview,
  options: HiringPanelRunOptions = {}
): Promise<Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | null> {
  const model = createGeminiModel(HIRING_PANEL_MODEL_ID)
  const prompt = buildHiringPanelRevisionPrompt(
    jobDescription,
    sourceResumeText,
    draft,
    review,
    {
      ...options,
      bannedPhrasesInLetter: findCoverLetterBannedPhrases(draft.coverLetter),
    }
  )

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateText({
        model,
        system: HIRING_PANEL_REVISION_SYSTEM_PROMPT,
        prompt,
        temperature: attempt === 0 ? 0.35 : 0.25,
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

      try {
        const response = await generateText({
          model,
          system: `${HIRING_PANEL_REVISION_SYSTEM_PROMPT}\n\nReturn JSON with tailoredResume and coverLetter keys only.`,
          prompt: `${prompt}\n\nRespond with valid JSON only.`,
          temperature: 0.25,
          maxOutputTokens: AI_GENERATION_MAX_TOKENS,
          maxRetries: AI_STREAM_MAX_RETRIES,
          providerOptions: geminiProviderOptions(),
        })
        const parsed = parseJsonFromModelText(response.text) as Record<string, unknown>
        return {
          tailoredResume: tailoredResumeSchema.parse(parsed.tailoredResume),
          coverLetter: String(parsed.coverLetter ?? '').trim(),
        }
      } catch {
        // fall through
      }

      if (attempt === 0) continue
      console.error('Hiring panel revision failed:', error)
      return null
    }
  }

  return null
}

function aggregateScore(managers: HiringPanelReview['managers']): number {
  if (managers.length === 0) return 0
  return Math.round(managers.reduce((sum, m) => sum + m.score, 0) / managers.length)
}

export function buildSessionResult(
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
    revisionRecommendations: review.revisionRecommendations,
  }
}

function needsAnotherRevisionRound(
  review: HiringPanelReview,
  coverLetter: string,
  revisionRounds: number
): boolean {
  if (revisionRounds >= MAX_HIRING_PANEL_REVISION_ROUNDS) return false

  const unanimous = review.managers.every((m) => m.approved)
  const bannedRemaining = findCoverLetterBannedPhrases(coverLetter).length > 0
  const hasActionItems = review.revisionRecommendations.length > 0

  return bannedRemaining || hasActionItems || !unanimous
}

function preserveDraft(
  draft: AiGenerationResult,
  sourceResumeText: string,
  jobDescription: string,
  currentResume?: TailoredResume
): AiGenerationResult {
  return applyStructuralPreservation(currentResume ?? sourceResumeText, draft, {
    jobDescription,
    missingKeywords: draft.keywordReport?.missingKeywords,
  })
}

export async function runHiringPanelWithRevisions(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  onProgress?: (label: string) => void | Promise<void>,
  options: HiringPanelRunOptions = {}
): Promise<{ aiResult: AiGenerationResult; panel: HiringPanelSessionResult | null }> {
  let current: AiGenerationResult = draft
  let revisionRounds = 0
  let lastReview: HiringPanelReview | null = null

  while (true) {
    await onProgress?.(
      revisionRounds === 0
        ? 'Hiring panel review…'
        : `Hiring panel review (round ${revisionRounds + 1})…`
    )

    const review = await runHiringPanelReview(jobDescription, sourceResumeText, current)
    if (!review) {
      return {
        aiResult: current,
        panel: lastReview
          ? buildSessionResult(lastReview, revisionRounds)
          : {
              unanimousApproval: false,
              aggregateScore: 0,
              revisionRounds: 0,
              managers: [],
              finalVerdict:
                'Hiring panel review could not be completed. Regenerate to retry manager feedback.',
              revisionRecommendations: [],
              reviewFailed: true,
            },
      }
    }

    lastReview = review

    if (!needsAnotherRevisionRound(review, current.coverLetter, revisionRounds)) {
      current = preserveDraft(
        await enforceCoverLetterCompliance(
          current,
          jobDescription,
          sourceResumeText,
          review,
          options.achievementSupplement
        ),
        sourceResumeText,
        jobDescription,
        options.currentResume
      )
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    await onProgress?.('Applying all panel improvement suggestions…')

    const revision = await runHiringPanelRevision(
      jobDescription,
      sourceResumeText,
      current,
      review,
      options
    )

    if (!revision?.coverLetter.trim()) {
      current = preserveDraft(
        await enforceCoverLetterCompliance(
          current,
          jobDescription,
          sourceResumeText,
          review,
          options.achievementSupplement
        ),
        sourceResumeText,
        jobDescription,
        options.currentResume
      )
      return {
        aiResult: current,
        panel: buildSessionResult(review, revisionRounds),
      }
    }

    current = preserveDraft(
      {
        ...current,
        tailoredResume: revision.tailoredResume,
        coverLetter: revision.coverLetter,
      },
      sourceResumeText,
      jobDescription,
      options.currentResume
    )

    await onProgress?.('Re-running hiring panel after applying suggestions…')

    current = preserveDraft(
      await enforceCoverLetterCompliance(
        current,
        jobDescription,
        sourceResumeText,
        review,
        options.achievementSupplement
      ),
      sourceResumeText,
      jobDescription,
      options.currentResume
    )

    revisionRounds += 1
  }
}
