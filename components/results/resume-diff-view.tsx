'use client'

import { ResumeChangeHighlight } from '@/components/results/resume-change-highlight'
import type { TailoredResume } from '@/lib/ai/schemas'

interface ResumeDiffViewProps {
  originalText: string
  resume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
  jobDescription?: string
}

export function ResumeDiffView({
  originalText,
  resume,
  onResumeChange,
  jobDescription,
}: ResumeDiffViewProps) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Each change shows your original text beside the tailored version. Click highlighted text to
        revert individual edits.
      </p>
      <ResumeChangeHighlight
        originalText={originalText}
        resume={resume}
        onResumeChange={onResumeChange}
        jobDescription={jobDescription}
        embedded
      />
    </div>
  )
}
