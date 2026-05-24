import { NextResponse } from 'next/server'

import { tailoredResumeSchema } from '@/lib/ai/schemas'
import { buildResumePdf } from '@/lib/resume/export-pdf'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = tailoredResumeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 })
    }

    const buffer = await buildResumePdf(parsed.data)
    const filename = `${sanitizeFilename(parsed.data.contact.name)}-resume.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'Failed to export PDF.' }, { status: 500 })
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'
}
