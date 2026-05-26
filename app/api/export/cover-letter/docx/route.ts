import { NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyExportAccess } from '@/lib/billing/premium-access'
import { rateLimitExceededResponse } from '@/lib/api/rate-limit-response'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { buildCoverLetterDocx } from '@/lib/resume/export-docx'

const coverLetterSchema = z.object({
  coverLetter: z.string().min(1),
})

export async function POST(request: Request) {
  const access = verifyExportAccess(request)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 402 })
  }

  const ip = getClientIp(request)
  const rateLimit = await checkRateLimit('export', ip)

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const body = await request.json()
    const parsed = coverLetterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cover letter data.' }, { status: 400 })
    }

    const buffer = await buildCoverLetterDocx(parsed.data.coverLetter)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="cover-letter.docx"',
      },
    })
  } catch (error) {
    console.error('Cover letter DOCX export error:', error)
    return NextResponse.json({ error: 'Failed to export cover letter DOCX.' }, { status: 500 })
  }
}
