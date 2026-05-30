import { NextResponse } from 'next/server'

import {
  MAX_FILE_SIZE_BYTES,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import { parseAnchoredModifications, parseCustomSnippets, parseSelectedKeywords } from '@/lib/api/parse-selected-keywords'
import { parseCurrentResumeJson } from '@/lib/resume/strict-resume-state'
import { createNdjsonStream, ndjsonStreamResponse } from '@/lib/api/progress-stream'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { runStreamedGeneration } from '@/lib/api/run-streamed-generation'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('generate', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const formData = await request.formData()
    const jobDescription = String(formData.get('jobDescription') ?? '').trim()
    const resumeTextInput = String(formData.get('resumeText') ?? '').trim()
    const file = formData.get('file')

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required.' }, { status: 400 })
    }

    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Job description must be under ${MAX_JOB_DESCRIPTION_LENGTH} characters.` },
        { status: 400 }
      )
    }

    let resumeText = resumeTextInput

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })
      }

      if (!resumeText) {
        return NextResponse.json(
          {
            error:
              'Resume file is still parsing. Wait for extraction to finish, or paste your resume text.',
          },
          { status: 400 }
        )
      }
    }

    if (!resumeText) {
      return NextResponse.json(
        { error: 'Provide a resume by pasting text or uploading a file.' },
        { status: 400 }
      )
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Resume text must be under ${MAX_RESUME_TEXT_LENGTH} characters.` },
        { status: 400 }
      )
    }

    const selectedKeywords = parseSelectedKeywords(formData.get('selectedKeywords'))
    const customSnippets = parseCustomSnippets(formData.get('customSnippets'))
    const anchoredModifications = parseAnchoredModifications(formData.get('anchoredModifications'))
    const achievementSupplement = String(formData.get('achievementSupplement') ?? '').trim()
    const currentResume = parseCurrentResumeJson(formData.get('currentResume'))

    const stream = createNdjsonStream((emit) =>
      runStreamedGeneration(emit, jobDescription, resumeText, {
        selectedKeywords,
        customSnippets,
        anchoredModifications,
        achievementSupplement: achievementSupplement || undefined,
        currentResume: currentResume ?? undefined,
      })
    )

    return ndjsonStreamResponse(stream)
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to generate tailored resume.') },
      { status: 500 }
    )
  }
}
