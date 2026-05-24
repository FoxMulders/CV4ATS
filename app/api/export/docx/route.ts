import { NextResponse } from 'next/server'

import { tailoredResumeSchema } from '@/lib/ai/schemas'
import { buildResumeDocx } from '@/lib/resume/export-docx'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = tailoredResumeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 })
    }

    const buffer = await buildResumeDocx(parsed.data)
    const filename = `${sanitizeFilename(parsed.data.contact.name)}-resume.docx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('DOCX export error:', error)
    return NextResponse.json({ error: 'Failed to export DOCX.' }, { status: 500 })
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'
}
