import { NextResponse } from 'next/server'
import { z } from 'zod'

import { buildFailedPanelSession, runHiringPanelWithRevisions } from '@/lib/ai/hiring-panel'
import { applyKeywordImprovementsToDraft } from '@/lib/api/apply-keyword-improvements'
import { applyPanelReadinessToKeywordReport } from '@/lib/api/panel-keyword-report'
import {
  aiGenerationResultSchema,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import { ensureApiSafeGenerationResult } from '@/lib/api/ensure-api-safe-draft'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { buildHiringPanelFailureResponse } from '@/lib/api/hiring-panel-response'
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

function resolveDraft(
  rawDraft: unknown,
  sourceResumeText: string
): { draft: AiGenerationResult | null; failureReason?: string } {
  try {
    const normalized = normalizeGenerationDraftForApi(rawDraft as AiGenerationResult, sourceResumeText)
    return { draft: aiGenerationResultSchema.parse(normalized) }
  } catch (normalizeError) {
    console.warn('Hiring panel draft normalization failed, trying API-safe fallback:', normalizeError)
  }

  try {
    const safe = ensureApiSafeGenerationResult(rawDraft as AiGenerationResult, sourceResumeText)
    return { draft: aiGenerationResultSchema.parse(safe) }
  } catch (safeError) {
    const message = safeError instanceof Error ? safeError.message : 'Draft validation failed.'
    return { draft: null, failureReason: message }
  }
}

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

  let parsedBody: z.infer<typeof hiringPanelRequestSchema> | null = null

  try {
    assertGeminiConfigured()

    const body = await request.json()
    const parsed = hiringPanelRequestSchema.safeParse(body)
    parsedBody = parsed.success ? parsed.data : null

    if (!parsed.success) {
      console.error('Hiring panel request validation failed:', parsed.error.flatten())
      return NextResponse.json(
        buildHiringPanelFailureResponse(
          'Invalid hiring panel request payload.',
          {
            keywordReport: {
              matchScore: 0,
              matchedKeywords: [],
              missingKeywords: [],
              suggestions: [],
            },
            tailoredResume: {
              contact: {
                name: 'Candidate',
                email: '',
                phone: '',
                location: '',
                linkedin: '',
              },
              summary: 'Pending',
              skills: ['Program Management'],
              experience: [
                {
                  title: 'Consultant',
                  company: 'Independent',
                  location: '',
                  startDate: 'Recent',
                  endDate: 'Present',
                  bullets: ['Delivered measurable outcomes in this role.'],
                },
              ],
              projects: [],
              education: [],
              certifications: [],
            },
            coverLetter: 'Cover letter pending.',
          }
        ),
        { status: 200 }
      )
    }

    const { jobDescription, sourceResumeText, achievementSupplement } = parsed.data

    const resolved = resolveDraft(parsed.data.draft, sourceResumeText)
    if (!resolved.draft) {
      return NextResponse.json(
        buildHiringPanelFailureResponse(
          resolved.failureReason ?? 'Invalid hiring panel draft.',
          {
            keywordReport: {
              matchScore: 0,
              matchedKeywords: [],
              missingKeywords: [],
              suggestions: [],
            },
            tailoredResume: {
              contact: {
                name: 'Candidate',
                email: '',
                phone: '',
                location: '',
                linkedin: '',
              },
              summary: 'Pending',
              skills: ['Program Management'],
              experience: [
                {
                  title: 'Consultant',
                  company: 'Independent',
                  location: '',
                  startDate: 'Recent',
                  endDate: 'Present',
                  bullets: ['Delivered measurable outcomes in this role.'],
                },
              ],
              projects: [],
              education: [],
              certifications: [],
            },
            coverLetter: 'Cover letter pending.',
          }
        ),
        { status: 200 }
      )
    }

    let draft = resolved.draft

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
      const failureReason =
        panelRun.panel?.failureReason ??
        panelRun.panel?.finalVerdict ??
        'Hiring panel review could not be completed.'

      return NextResponse.json({
        ...buildHiringPanelFailureResponse(failureReason, panelRun.aiResult, panelRun.panel?.managers ?? []),
        hiringPanel: panelRun.panel ?? buildFailedPanelSession(failureReason),
        tailoredResume: panelRun.aiResult.tailoredResume,
        coverLetter: panelRun.aiResult.coverLetter,
        keywordReport: draft.keywordReport,
        rawKeywordScore: draft.keywordReport.matchScore,
      })
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
      partialCritiques: [],
    })
  } catch (error) {
    const failureReason = safeErrorMessage(error, 'Hiring panel review failed.')
    console.error('Hiring panel error:', error)

    const fallbackDraft: AiGenerationResult = {
      keywordReport: {
        matchScore: 0,
        matchedKeywords: [],
        missingKeywords: [],
        suggestions: [],
      },
      tailoredResume: {
        contact: {
          name: 'Candidate',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
        },
        summary: 'Pending',
        skills: ['Program Management'],
        experience: [
          {
            title: 'Consultant',
            company: 'Independent',
            location: '',
            startDate: 'Recent',
            endDate: 'Present',
            bullets: ['Delivered measurable outcomes in this role.'],
          },
        ],
        projects: [],
        education: [],
        certifications: [],
      },
      coverLetter: 'Cover letter pending.',
    }

    return NextResponse.json(
      buildHiringPanelFailureResponse(failureReason, fallbackDraft),
      { status: 200 }
    )
  }
}
