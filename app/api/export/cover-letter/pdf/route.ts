import { NextResponse } from 'next/server'
import { z } from 'zod'

import { buildCoverLetterPdf } from '@/lib/resume/export-pdf'

const coverLetterSchema = z.object({
  coverLetter: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = coverLetterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cover letter data.' }, { status: 400 })
    }

    const buffer = await buildCoverLetterPdf(parsed.data.coverLetter)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cover-letter.pdf"',
      },
    })
  } catch (error) {
    console.error('Cover letter PDF export error:', error)
    return NextResponse.json({ error: 'Failed to export cover letter PDF.' }, { status: 500 })
  }
}
