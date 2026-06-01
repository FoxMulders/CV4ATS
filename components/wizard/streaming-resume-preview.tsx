'use client'

import type { TailoredResume } from '@/lib/ai/schemas'
import { BRAND_NAME } from '@/lib/brand'
import { ResumePreview } from '@/components/results/resume-preview'

interface StreamingResumePreviewProps {
  resume: TailoredResume
}

export function StreamingResumePreview({ resume }: StreamingResumePreviewProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-gold">
        Live preview — updating as {BRAND_NAME} generates your resume
      </p>
      <div className="rounded-lg border border-brand-gold/30 bg-card/80 p-1 opacity-95">
        <ResumePreview resume={resume} />
      </div>
    </div>
  )
}
