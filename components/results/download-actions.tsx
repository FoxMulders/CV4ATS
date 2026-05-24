'use client'

import { Download, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { TailoredResume } from '@/lib/ai/schemas'

interface DownloadActionsProps {
  resume: TailoredResume
  coverLetter: string
}

async function downloadFile(url: string, body: unknown, filename: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Download failed')
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'
}

export function DownloadActions({ resume, coverLetter }: DownloadActionsProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const baseName = safeName(resume.contact.name)

  async function handleDownload(
    key: string,
    url: string,
    body: unknown,
    filename: string
  ) {
    setDownloading(key)
    try {
      await downloadFile(url, body, filename)
      toast.success(`Downloaded ${filename}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        disabled={!!downloading}
        onClick={() =>
          handleDownload('pdf', '/api/export/pdf', resume, `${baseName}-resume.pdf`)
        }
      >
        {downloading === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />}
        Download resume PDF
      </Button>

      <Button
        variant="outline"
        disabled={!!downloading}
        onClick={() =>
          handleDownload('docx', '/api/export/docx', resume, `${baseName}-resume.docx`)
        }
      >
        {downloading === 'docx' ? <Loader2 className="animate-spin" /> : <FileText />}
        Download resume DOCX
      </Button>

      <Button
        variant="outline"
        disabled={!!downloading}
        onClick={() =>
          handleDownload(
            'cover-pdf',
            '/api/export/cover-letter/pdf',
            { coverLetter },
            `${baseName}-cover-letter.pdf`
          )
        }
      >
        {downloading === 'cover-pdf' ? <Loader2 className="animate-spin" /> : <Download />}
        Download cover letter PDF
      </Button>

      <Button
        variant="outline"
        disabled={!!downloading}
        onClick={() =>
          handleDownload(
            'cover-docx',
            '/api/export/cover-letter/docx',
            { coverLetter },
            `${baseName}-cover-letter.docx`
          )
        }
      >
        {downloading === 'cover-docx' ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FileText />
        )}
        Download cover letter DOCX
      </Button>
    </div>
  )
}
