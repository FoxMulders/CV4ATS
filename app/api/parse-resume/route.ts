import { NextResponse } from 'next/server'

import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { MAX_FILE_SIZE_BYTES } from '@/lib/ai/schemas'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { parseResumeFile, ResumeParseError } from '@/lib/resume/parse-file'

/** Resume parsing (PDF/DOCX) can exceed the default 10s on large files. */
export const maxDuration = 30

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('parse', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'A resume file is required.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File must be 5 MB or smaller.' }, { status: 400 })
    }

    const text = await parseResumeFile(file)
    return NextResponse.json({ text })
  } catch (error) {
    if (error instanceof ResumeParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Parse resume error:', error)
    return NextResponse.json({ error: 'Failed to parse resume file.' }, { status: 500 })
  }
}
