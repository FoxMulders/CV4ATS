import { NextResponse } from 'next/server'

import { generateTailoredResume } from '@/lib/ai/generate'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_TEXT_LENGTH,
} from '@/lib/ai/schemas'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { parseResumeFile, ResumeParseError } from '@/lib/resume/parse-file'

export const maxDuration = 60

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

      resumeText = await parseResumeFile(file)
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

    const result = await generateTailoredResume(jobDescription, resumeText)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Generate error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to generate tailored resume.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
