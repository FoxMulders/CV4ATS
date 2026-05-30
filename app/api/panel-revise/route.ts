import { NextResponse } from 'next/server'
import { z } from 'zod'

import { applyPanelExperienceRevision } from '@/lib/ai/apply-panel-experience'
import { hiringManagerReviewSchema } from '@/lib/ai/hiring-panel-schemas'
import {
  aiGenerationResultSchema,
  keywordReportSchema,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
  tailoredResumeSchema,
} from '@/lib/ai/schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { assertGeminiConfigured } from '@/lib/ai/gemini'
import { buildAtsComparison, serializeTailoredResume } from '@/lib/resume/ats-score'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const hiringPanelSessionSchema = z.object({
  unanimousApproval: z.boolean(),
  aggregateScore: z.number(),
  revisionRounds: z.number(),
  managers: z.array(hiringManagerReviewSchema),
  finalVerdict: z.string(),
  revisionRecommendations: z.array(z.string()),
  reviewFailed: z.boolean().optional(),
})

const panelReviseSchema = z.object({
  jobDescription: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
  sourceResumeText: z.string().min(1).max(MAX_RESUME_TEXT_LENGTH),
  draft: z.object({
    tailoredResume: tailoredResumeSchema,
    coverLetter: z.string().min(1),
    keywordReport: keywordReportSchema,
  }),
  panel: hiringPanelSessionSchema,
  experienceSupplement: z.string().min(10).max(4000),
  achievementSupplement: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('panel-revise', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    assertGeminiConfigured()

    const body = await request.json()
    const parsed = panelReviseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const {
      jobDescription,
      sourceResumeText,
      draft,
      panel,
      experienceSupplement,
      achievementSupplement,
    } = parsed.data

    const panelRun = await applyPanelExperienceRevision({
      jobDescription,
      sourceResumeText,
      draft: aiGenerationResultSchema.parse(draft),
      panel,
      experienceSupplement,
      achievementSupplement,
    })

    const comparison = buildAtsComparison(
      sourceResumeText,
      serializeTailoredResume(panelRun.aiResult.tailoredResume),
      jobDescription,
      undefined,
      sourceResumeText
    )

    const rawKeywordScore = comparison.keywordReport.matchScore
    let keywordReport = comparison.keywordReport
    if (panelRun.panel && !panelRun.panel.reviewFailed && !panelRun.panel.unanimousApproval) {
      keywordReport = {
        ...keywordReport,
        matchScore: Math.min(keywordReport.matchScore, panelRun.panel.aggregateScore),
      }
    }

    return NextResponse.json({
      tailoredResume: panelRun.aiResult.tailoredResume,
      coverLetter: panelRun.aiResult.coverLetter,
      keywordReport,
      hiringPanel: panelRun.panel,
      rawKeywordScore,
    })
  } catch (error) {
    console.error('Panel revise error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to update draft from panel feedback.') },
      { status: 500 }
    )
  }
}
