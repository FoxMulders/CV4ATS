import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import {
  isRateLimitOrQuotaError,
  unwrapAiError,
} from '@/lib/ai/errors'
import { generateTextWithGeminiFallback } from '@/lib/ai/gemini-retry'
import {
  geminiProviderOptions,
  HIRING_PANEL_GEMINI_MODEL_ID,
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
import { AI_GENERATION_MAX_TOKENS, HIRING_PANEL_MAX_RETRIES } from '@/lib/ai/provider'
import {
  aiGenerationResultSchema,
  tailoredResumeSchema,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import {
  auditCoverLetterCompliance,
  findCoverLetterBannedPhrases,
} from '@/lib/resume/cover-letter-compliance'

/** Cloud-only model for hiring panel — never routed to browser Nano / window.ai. */
export const HIRING_PANEL_CLOUD_MODEL_ID = HIRING_PANEL_GEMINI_MODEL_ID

export const HIRING_PANEL_MODEL_ID = HIRING_PANEL_CLOUD_MODEL_ID

type HiringPanelGenerateParams = Omit<Parameters<typeof generateText>[0], 'model'>

async function generateHiringPanelText(params: HiringPanelGenerateParams) {
  return generateTextWithGeminiFallback(
    {
      ...params,
      maxRetries: HIRING_PANEL_MAX_RETRIES,
    },
    { label: 'Hiring Panel' }
  )
}

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

export async function enforceCoverLetterComplianceForPanel(
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
        maxRetries: HIRING_PANEL_MAX_RETRIES,
        output: REVIEW_OUTPUT,
        providerOptions: geminiProviderOptions(),
      })
      return { review: hiringPanelReviewSchema.parse(response.output), partialCritiques: [] }
    } catch (error) {
      if (isRateLimitOrQuotaError(error)) {
        throw error
      }

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
        maxRetries: HIRING_PANEL_MAX_RETRIES,
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
          maxRetries: HIRING_PANEL_MAX_RETRIES,
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
  revisionRounds: number,
  extras: Partial<
    Pick<
      HiringPanelSessionResult,
      'initialAggregateScore' | 'autoCorrectionSummary' | 'correctedIssues'
    >
  > = {}
): HiringPanelSessionResult {
  const unanimousApproval = review.managers.every((m) => m.approved)
  return {
    unanimousApproval,
    aggregateScore: aggregateScore(review.managers),
    revisionRounds,
    managers: review.managers,
    finalVerdict: review.finalVerdict,
    revisionRecommendations: review.revisionRecommendations,
    ...extras,
  }
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

