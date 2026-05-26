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
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Before — your original
          </h3>
          <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {originalText}
          </pre>
        </section>

        <section className="rounded-lg border border-amber-200/80 bg-amber-50/20 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-amber-900">
            After — tailored (click highlights to revert)
          </h3>
          <ResumeChangeHighlight
            originalText={originalText}
            resume={resume}
            onResumeChange={onResumeChange}
            jobDescription={jobDescription}
            embedded
          />
        </section>
      </div>
    </div>
  )
}
