import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import { isGeminiModelNotFoundError, shouldFallbackToNextGeminiModel, unwrapAiError } from '@/lib/ai/errors'
import {
  createGeminiModel,
  geminiProviderOptions,
  HIRING_PANEL_GEMINI_MODEL_ID,
  hiringPanelModelCandidates,
} from '@/lib/ai/gemini'
import {
  buildHiringPanelReviewPrompt,
  buildHiringPanelRevisionPrompt,
  HIRING_PANEL_REVISION_SYSTEM_PROMPT,
  HIRING_PANEL_REVIEW_SYSTEM_PROMPT,
} from '@/lib/ai/hiring-panel-prompts'
import {
  hiringManagerReviewSchema,
  hiringPanelReviewSchema,
  type HiringManagerReview,
  type HiringPanelReview,
  type HiringPanelSessionResult,
} from '@/lib/ai/hiring-panel-schemas'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { parseJsonFromSanitizedText, stripMarkdownJsonFences } from '@/lib/ai/sanitize-json-response'
import { AI_GENERATION_MAX_TOKENS, AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import {
  aiGenerationResultSchema,
  tailoredResumeSchema,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import {
  auditCoverLetterCompliance,
  findCoverLetterBannedPhrases,
} from '@/lib/resume/cover-letter-compliance'

/** Cloud-only model for hiring panel — never routed to browser Nano / window.ai. */
export const HIRING_PANEL_CLOUD_MODEL_ID = HIRING_PANEL_GEMINI_MODEL_ID

export const HIRING_PANEL_MODEL_ID = HIRING_PANEL_CLOUD_MODEL_ID

type HiringPanelGenerateParams = Omit<Parameters<typeof generateText>[0], 'model'>

async function generateHiringPanelText(params: HiringPanelGenerateParams) {
  const candidates = hiringPanelModelCandidates()
  let lastError: unknown

  for (const modelId of candidates) {
    try {
      return await generateText({
        ...params,
        model: createGeminiModel(modelId),
      } as Parameters<typeof generateText>[0])
    } catch (error) {
      lastError = error
      if (shouldFallbackToNextGeminiModel(error)) {
        const reason = isGeminiModelNotFoundError(error) ? 'unavailable' : 'quota blocked on free tier'
        console.warn(`[Hiring Panel] Model "${modelId}" ${reason} — trying next fallback.`)
        continue
      }
      throw error
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'No supported Gemini model available for hiring panel review.'
  throw new Error(
    `${message} Set HIRING_PANEL_MODEL_ID=gemini-2.5-flash (or gemini-flash-latest) in Vercel and redeploy.`
  )
}

export const MAX_HIRING_PANEL_REVISION_ROUNDS = 4

export type HiringPanelRunOptions = {
  achievementSupplement?: string
  /** Sanitized closed-loop panel constraints (anti-fabrication, down-tailoring). */
  panelFeedbackAddendum?: string
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

function extractModelText(error: unknown): string | undefined {
  const root = unwrapAiError(error)
  if (NoObjectGeneratedError.isInstance(root) && root.text?.trim()) {
    return root.text
  }
  if (error instanceof Error && error.message.includes('{')) {
    return error.message
  }
  return undefined
}

function tryParsePartialManagers(text: string): HiringManagerReview[] {
  try {
    const parsed = parseJsonFromSanitizedText(stripMarkdownJsonFences(text)) as Record<
      string,
      unknown
    >
    const managers = parsed.managers
    if (!Array.isArray(managers)) return []
    return managers
      .map((entry) => {
        try {
          return hiringManagerReviewSchema.parse(entry)
        } catch {
          return null
        }
      })
      .filter((entry): entry is HiringManagerReview => entry != null)
  } catch {
    return []
  }
}

function tryRecoverReview(error: unknown): HiringPanelReview | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : extractModelText(error)
  if (!text?.trim()) return undefined

  const attempts = [text, stripMarkdownJsonFences(text)]
  for (const candidate of attempts) {
    try {
      return hiringPanelReviewSchema.parse(parseJsonFromModelText(candidate))
    } catch {
      try {
        return hiringPanelReviewSchema.parse(parseJsonFromSanitizedText(candidate))
      } catch {
        // try next candidate
      }
    }
  }

  return undefined
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
): Promise<{ review: HiringPanelReview | null; partialCritiques: HiringManagerReview[]; failureReason?: string }> {
  const prompt = buildHiringPanelReviewPrompt(jobDescription, sourceResumeText, draft)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateHiringPanelText({
        system: HIRING_PANEL_REVIEW_SYSTEM_PROMPT,
        prompt,
        temperature: attempt === 0 ? 0.3 : 0.2,
        maxOutputTokens: AI_GENERATION_MAX_TOKENS,
        maxRetries: AI_STREAM_MAX_RETRIES,
        output: REVIEW_OUTPUT,
        providerOptions: geminiProviderOptions(),
      })
      return { review: hiringPanelReviewSchema.parse(response.output), partialCritiques: [] }
    } catch (error) {
      const recovered = tryRecoverReview(error)
      if (recovered) {
        return { review: recovered, partialCritiques: [] }
      }

      const rawText = extractModelText(error)
      const partialCritiques = rawText ? tryParsePartialManagers(rawText) : []

      if (attempt === 0) continue

      const failureReason =
        error instanceof Error ? error.message : 'Hiring panel review parsing failed.'
      console.error('Hiring panel review failed:', error)
      return { review: null, partialCritiques, failureReason }
    }
  }

  return { review: null, partialCritiques: [], failureReason: 'Hiring panel review failed.' }
}

export async function runHiringPanelRevision(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  review: HiringPanelReview,
  options: HiringPanelRunOptions = {}
): Promise<Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | null> {
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
      const response = await generateHiringPanelText({
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
        const response = await generateHiringPanelText({
          system: `${HIRING_PANEL_REVISION_SYSTEM_PROMPT}\n\nReturn JSON with tailoredResume and coverLetter keys only.`,
          prompt: `${prompt}\n\nRespond with valid JSON only.`,
          temperature: 0.25,
          maxOutputTokens: AI_GENERATION_MAX_TOKENS,
          maxRetries: AI_STREAM_MAX_RETRIES,
          providerOptions: geminiProviderOptions(),
        })
        const parsed = parseJsonFromSanitizedText(stripMarkdownJsonFences(response.text)) as Record<
          string,
          unknown
        >
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
  sourceResumeText: string
): AiGenerationResult {
  return normalizeGenerationDraftForApi(draft, sourceResumeText)
}

export function buildFailedPanelSession(
  failureReason: string,
  partialCritiques: HiringManagerReview[] = []
): HiringPanelSessionResult {
  return {
    unanimousApproval: false,
    aggregateScore: 0,
    revisionRounds: 0,
    managers: partialCritiques,
    finalVerdict: failureReason,
    revisionRecommendations: [],
    reviewFailed: true,
    failureReason,
  }
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

    const { review, partialCritiques, failureReason } = await runHiringPanelReview(
      jobDescription,
      sourceResumeText,
      current
    )
    if (!review) {
      return {
        aiResult: current,
        panel:
          lastReview != null
            ? buildSessionResult(lastReview, revisionRounds)
            : buildFailedPanelSession(
                failureReason ??
                  'Hiring panel review could not be completed. Regenerate to retry manager feedback.',
                partialCritiques
              ),
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
        sourceResumeText
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
        sourceResumeText
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
      sourceResumeText
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
      sourceResumeText
    )

    revisionRounds += 1
  }
}
