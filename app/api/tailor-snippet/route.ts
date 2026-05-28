import { NextResponse } from 'next/server'
import { z } from 'zod'

import { tailorSnippetWithAi } from '@/lib/ai/tailor-snippet'
import { MAX_JOB_DESCRIPTION_LENGTH, MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'edge'

const tailorSnippetSchema = z.object({
  jobDescription: z.string().min(1),
  resumeText: z.string().min(1),
  keyword: z.string().min(1),
  currentSnippet: z.string().min(1),
  otherSnippets: z.array(z.string()).optional(),
  variationIndex: z.number().int().min(0).optional(),
  previousVariations: z.array(z.string()).optional(),
  rephraseJobDescriptionMatch: z.boolean().optional(),
  matchedJobDescriptionPhrases: z.array(z.string()).optional(),
  originalBullet: z.string().optional(),
  targetRoleTitle: z.string().optional(),
  targetCompany: z.string().optional(),
  placementLabel: z.string().optional(),
  domainLabel: z.string().optional(),
  modificationType: z.enum(['inline-bullet', 'skills-section', 'summary']).optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('tailor', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = tailorSnippetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const {
      jobDescription,
      resumeText,
      keyword,
      currentSnippet,
      otherSnippets,
      variationIndex,
      previousVariations,
      rephraseJobDescriptionMatch,
      matchedJobDescriptionPhrases,
      originalBullet,
      targetRoleTitle,
      targetCompany,
      placementLabel,
      domainLabel,
      modificationType,
    } = parsed.data

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'Job description is too long.' }, { status: 400 })
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Resume text is too long.' }, { status: 400 })
    }

    const snippet = await tailorSnippetWithAi({
      jobDescription,
      resumeText,
      keyword,
      currentSnippet,
      otherSnippets,
      variationIndex,
      previousVariations,
      rephraseJobDescriptionMatch,
      matchedJobDescriptionPhrases,
      originalBullet,
      targetRoleTitle,
      targetCompany,
      placementLabel,
      domainLabel,
      modificationType,
    })

    return NextResponse.json({ snippet })
  } catch (error) {
    console.error('Tailor snippet error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to tailor snippet with AI.') },
      { status: 500 }
    )
  }
}
