'use client'

import { Download, FileText, Loader2, Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { Button } from '@/components/ui/button'
import type { TailoredResume } from '@/lib/ai/schemas'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

interface DownloadActionsProps {
  resume: TailoredResume
  coverLetter: string
  premiumAccessToken?: string | null
  jobDescriptionHash?: string
  isPremiumUnlocked?: boolean
  passExpiryLabel?: string | null
  onCheckoutRequest?: () => void
  /** Compact inline buttons for the preview pane banner. */
  variant?: 'default' | 'banner'
}

async function downloadFile(
  url: string,
  body: unknown,
  filename: string,
  premiumAccessToken?: string | null,
  jobDescriptionHash?: string
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(premiumAccessToken ? { 'x-premium-access-token': premiumAccessToken } : {}),
      ...(jobDescriptionHash ? { 'x-job-description-hash': jobDescriptionHash } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await parseApiErrorResponse(response, 'Download failed'))
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
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

export function DownloadActions({
  resume,
  coverLetter,
  premiumAccessToken,
  jobDescriptionHash,
  isPremiumUnlocked = true,
  passExpiryLabel,
  onCheckoutRequest,
  variant = 'default',
}: DownloadActionsProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const baseName = safeName(resume.contact.name)

  async function handleDownload(
    key: string,
    url: string,
    body: unknown,
    filename: string
  ) {
    if (!isPremiumUnlocked) {
      onCheckoutRequest?.()
      return
    }

    setDownloading(key)
    try {
      await downloadFile(url, body, filename, premiumAccessToken, jobDescriptionHash)
      toast.success(`Downloaded ${filename}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  function handleTextDownload(key: string, filename: string, content: string) {
    if (!isPremiumUnlocked) {
      onCheckoutRequest?.()
      return
    }

    setDownloading(key)
    try {
      downloadTextFile(filename, content)
      toast.success(`Downloaded ${filename}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  if (variant === 'banner') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={isPremiumUnlocked ? 'default' : 'outline'}
          disabled={!!downloading}
          onClick={() =>
            handleDownload('pdf', '/api/export/pdf', resume, `${baseName}-resume.pdf`)
          }
        >
          {downloading === 'pdf' ? <Loader2 className="animate-spin" /> : isPremiumUnlocked ? <Download /> : <Lock />}
          PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!!downloading}
          onClick={() =>
            handleDownload('docx', '/api/export/docx', resume, `${baseName}-resume.docx`)
          }
        >
          {downloading === 'docx' ? <Loader2 className="animate-spin" /> : <FileText />}
          DOCX
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!!downloading}
          onClick={() =>
            handleTextDownload('txt', `${baseName}-resume.txt`, serializeTailoredResume(resume))
          }
        >
          {downloading === 'txt' ? <Loader2 className="animate-spin" /> : <FileText />}
          TXT
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!isPremiumUnlocked ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
          Your score and resume preview are free. Purchase a 24-Hour Job Pass to download PDF/DOCX
          exports and re-download after edits.
        </p>
      ) : passExpiryLabel ? (
        <p className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 text-sm text-foreground">
          24-Hour Job Pass active until {passExpiryLabel}. Unlimited edits and re-downloads for this
          job description.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          variant={isPremiumUnlocked ? 'outline' : 'default'}
          disabled={!!downloading}
          onClick={() =>
            handleDownload('pdf', '/api/export/pdf', resume, `${baseName}-resume.pdf`)
          }
        >
          {downloading === 'pdf' ? (
            <Loader2 className="animate-spin" />
          ) : isPremiumUnlocked ? (
            <Download />
          ) : (
            <Lock />
          )}
          {isPremiumUnlocked ? 'Download resume PDF' : 'Unlock 24-Hour Job Pass — $4.99'}
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
            handleTextDownload('txt', `${baseName}-resume.txt`, serializeTailoredResume(resume))
          }
        >
          {downloading === 'txt' ? <Loader2 className="animate-spin" /> : <FileText />}
          Download resume TXT
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
    </div>
  )
}

export async function triggerPremiumDownloads(
  resume: TailoredResume,
  coverLetter: string,
  premiumAccessToken?: string | null,
  jobDescriptionHash?: string
) {
  const baseName = safeName(resume.contact.name)
  await downloadFile('/api/export/pdf', resume, `${baseName}-resume.pdf`, premiumAccessToken, jobDescriptionHash)
  await downloadFile(
    '/api/export/cover-letter/pdf',
    { coverLetter },
    `${baseName}-cover-letter.pdf`,
    premiumAccessToken,
    jobDescriptionHash
  )
}
