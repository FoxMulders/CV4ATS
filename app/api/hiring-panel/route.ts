import { NextResponse } from 'next/server'
import { z } from 'zod'

import { runHiringPanelWithRevisions } from '@/lib/ai/hiring-panel'
import { applyKeywordImprovementsToDraft } from '@/lib/api/apply-keyword-improvements'
import { applyPanelReadinessToKeywordReport } from '@/lib/api/panel-keyword-report'
import {
  aiGenerationResultSchema,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { assertGeminiConfigured } from '@/lib/ai/gemini'
import { buildAtsComparison, serializeTailoredResume } from '@/lib/resume/ats-score'
import { sanitizeKeywordReport } from '@/lib/api/generation-config'

export const runtime = 'nodejs'
export const maxDuration = 300

const hiringPanelRequestSchema = z.object({
  jobDescription: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
  sourceResumeText: z.string().min(1).max(MAX_RESUME_TEXT_LENGTH),
  draft: z.unknown(),
  achievementSupplement: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const { checkRateLimit, getClientIp } = await import('@/lib/rate-limit')
  const rateLimit = await checkRateLimit('hiring-panel', getClientIp(request) || ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    assertGeminiConfigured()

    const body = await request.json()
    const parsed = hiringPanelRequestSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Hiring panel request validation failed:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Invalid hiring panel request. Regenerate or turn off browser AI for the full server path.' },
        { status: 400 }
      )
    }

    const { jobDescription, sourceResumeText, achievementSupplement } = parsed.data

    let draft: AiGenerationResult
    try {
      draft = normalizeGenerationDraftForApi(
        parsed.data.draft as AiGenerationResult,
        sourceResumeText
      )
      aiGenerationResultSchema.parse(draft)
    } catch (normalizeError) {
      console.error('Hiring panel draft normalization failed:', normalizeError)
      return NextResponse.json(
        { error: 'Invalid hiring panel request. Regenerate or turn off browser AI for the full server path.' },
        { status: 400 }
      )
    }

    const keywordImproved = applyKeywordImprovementsToDraft(draft, jobDescription, sourceResumeText)
    draft = keywordImproved.aiResult

    const panelRun = await runHiringPanelWithRevisions(
      jobDescription,
      sourceResumeText,
      draft,
      undefined,
      { achievementSupplement: achievementSupplement || undefined }
    )

    if (!panelRun.panel || panelRun.panel.reviewFailed) {
      return NextResponse.json(
        {
          hiringPanel: panelRun.panel ?? {
            unanimousApproval: false,
            aggregateScore: 0,
            revisionRounds: 0,
            managers: [],
            finalVerdict:
              'Hiring panel review could not be completed. Try again in a moment or turn off browser AI to run the full server generation path.',
            revisionRecommendations: [],
            reviewFailed: true,
          },
          tailoredResume: panelRun.aiResult.tailoredResume,
          coverLetter: panelRun.aiResult.coverLetter,
          keywordReport: draft.keywordReport,
          rawKeywordScore: draft.keywordReport.matchScore,
        },
        { status: 200 }
      )
    }

    const comparison = buildAtsComparison(
      sourceResumeText,
      serializeTailoredResume(panelRun.aiResult.tailoredResume),
      jobDescription,
      sanitizeKeywordReport(panelRun.aiResult.keywordReport).suggestions,
      sourceResumeText,
      panelRun.aiResult.tailoredResume
    )

    const rawKeywordScore = comparison.keywordReport.matchScore
    const keywordReport = applyPanelReadinessToKeywordReport(
      sanitizeKeywordReport(comparison.keywordReport),
      panelRun.panel,
      rawKeywordScore
    )

    return NextResponse.json({
      hiringPanel: panelRun.panel,
      tailoredResume: panelRun.aiResult.tailoredResume,
      coverLetter: panelRun.aiResult.coverLetter,
      keywordReport,
      rawKeywordScore,
      incorporatedKeywords: keywordImproved.injectedSkills,
    })
  } catch (error) {
    console.error('Hiring panel error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Hiring panel review failed.') },
      { status: 500 }
    )
  }
}
