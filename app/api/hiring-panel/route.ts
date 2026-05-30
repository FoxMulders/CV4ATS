import { NextResponse } from 'next/server'
import { z } from 'zod'

import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import { buildSessionResult, runHiringPanelReview } from '@/lib/ai/hiring-panel'
import {
  aiGenerationResultSchema,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { assertGeminiConfigured } from '@/lib/ai/gemini'
import { auditCoverLetterCompliance } from '@/lib/resume/cover-letter-compliance'

export const runtime = 'nodejs'
export const maxDuration = 120

const hiringPanelRequestSchema = z.object({
  jobDescription: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
  sourceResumeText: z.string().min(1).max(MAX_RESUME_TEXT_LENGTH),
  draft: aiGenerationResultSchema,
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

    const { jobDescription, sourceResumeText, draft, achievementSupplement } = parsed.data

    const review = await runHiringPanelReview(jobDescription, sourceResumeText, draft)

    if (!review) {
      return NextResponse.json(
        {
          hiringPanel: {
            unanimousApproval: false,
            aggregateScore: 0,
            revisionRounds: 0,
            managers: [],
            finalVerdict:
              'Hiring panel review could not be completed. Try again in a moment or turn off browser AI to run the full server generation path.',
            revisionRecommendations: [],
            reviewFailed: true,
          },
        },
        { status: 200 }
      )
    }

    let coverLetter = draft.coverLetter
    const violations = auditCoverLetterCompliance(coverLetter)
    if (violations.length > 0) {
      try {
        coverLetter = await repairCoverLetterCompliance(
          coverLetter,
          violations,
          sourceResumeText,
          jobDescription,
          achievementSupplement,
          review
        )
      } catch (error) {
        console.error('Cover letter repair during panel review skipped:', error)
      }
    }

    const hiringPanel = buildSessionResult(review, 0)
    const rawKeywordScore = draft.keywordReport.matchScore
    let keywordReport = draft.keywordReport
    if (hiringPanel && !hiringPanel.reviewFailed && !hiringPanel.unanimousApproval) {
      keywordReport = {
        ...keywordReport,
        matchScore: Math.min(keywordReport.matchScore, hiringPanel.aggregateScore),
      }
    }

    return NextResponse.json({
      hiringPanel,
      coverLetter: coverLetter !== draft.coverLetter ? coverLetter : undefined,
      keywordReport,
      rawKeywordScore,
    })
  } catch (error) {
    console.error('Hiring panel error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Hiring panel review failed.') },
      { status: 500 }
    )
  }
}
