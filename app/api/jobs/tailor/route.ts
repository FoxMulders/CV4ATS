import { NextResponse } from 'next/server'
import { z } from 'zod'

import { generateTailoredResume } from '@/lib/ai/generate'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { formatJobDescriptionForAi, jobListingSchema } from '@/lib/jobs/types'
import { parseResumeFile, ResumeParseError } from '@/lib/resume/parse-file'

export const maxDuration = 60

const tailorRequestSchema = z.object({
  job: jobListingSchema,
  resumeText: z.string().optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? 3600) },
      }
    )
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''

    let job: z.infer<typeof jobListingSchema>
    let resumeText = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const jobRaw = formData.get('job')
      resumeText = String(formData.get('resumeText') ?? '').trim()
      const file = formData.get('file')

      if (typeof jobRaw !== 'string') {
        return NextResponse.json({ error: 'Job listing is required.' }, { status: 400 })
      }

      const parsedJob = jobListingSchema.safeParse(JSON.parse(jobRaw))
      if (!parsedJob.success) {
        return NextResponse.json({ error: 'Invalid job listing.' }, { status: 400 })
      }
      job = parsedJob.data

      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })
        }
        resumeText = await parseResumeFile(file)
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

    const result = await generateTailoredResume(jobDescription, resumeText)

    return NextResponse.json({
      jobId: job.id,
      job,
      ...result,
    })
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Job tailor error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to tailor application for this job.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
