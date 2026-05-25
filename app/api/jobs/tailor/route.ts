import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  MAX_FILE_SIZE_BYTES,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import { parseCustomSnippets, parseSelectedKeywords } from '@/lib/api/parse-selected-keywords'
import { createNdjsonStream, ndjsonStreamResponse } from '@/lib/api/progress-stream'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { runStreamedGeneration } from '@/lib/api/run-streamed-generation'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { formatJobDescriptionForAi, jobListingSchema } from '@/lib/jobs/types'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'edge'

const tailorRequestSchema = z.object({
  job: jobListingSchema,
  resumeText: z.string().optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('tailor', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''

    let job: z.infer<typeof jobListingSchema>
    let resumeText = ''
    let selectedKeywords: string[] = []
    let customSnippets: string[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const jobRaw = formData.get('job')
      resumeText = String(formData.get('resumeText') ?? '').trim()
      selectedKeywords = parseSelectedKeywords(formData.get('selectedKeywords'))
      customSnippets = parseCustomSnippets(formData.get('customSnippets'))
      const file = formData.get('file')

      if (typeof jobRaw !== 'string') {
        return NextResponse.json({ error: 'Job listing is required.' }, { status: 400 })
      }

      let parsedJobRaw: unknown
      try {
        parsedJobRaw = JSON.parse(jobRaw)
      } catch {
        return NextResponse.json({ error: 'Invalid job listing.' }, { status: 400 })
      }

      const parsedJob = jobListingSchema.safeParse(parsedJobRaw)
      if (!parsedJob.success) {
        return NextResponse.json({ error: 'Invalid job listing.' }, { status: 400 })
      }
      job = parsedJob.data

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
    } else {
      const body = await request.json()
      const parsed = tailorRequestSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
      }
      job = parsed.data.job
      resumeText = parsed.data.resumeText?.trim() ?? ''
    }

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required.' }, { status: 400 })
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Resume text must be under ${MAX_RESUME_TEXT_LENGTH} characters.` },
        { status: 400 }
      )
    }

    const jobDescription = formatJobDescriptionForAi(job)
    if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'Job description is too long.' }, { status: 400 })
    }

    const stream = createNdjsonStream((emit) =>
      runStreamedGeneration(emit, jobDescription, resumeText, {
        selectedKeywords,
        customSnippets,
      }, (result) => ({
        ...result,
        jobId: job.id,
        job,
      }))
    )

    return ndjsonStreamResponse(stream)
  } catch (error) {
    console.error('Job tailor error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to tailor application for this job.') },
      { status: 500 }
    )
  }
}
