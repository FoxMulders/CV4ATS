'use client'

import { FileText, Loader2 } from 'lucide-react'

import { GenerationProgress } from '@/components/wizard/generation-progress'
import { cn } from '@/lib/utils'

interface WorkspacePreviewPlaceholderProps {
  isLoading?: boolean
  loadingStep?: number
  loadingLabel?: string | null
  scorePassLines?: string[]
  className?: string
}

/** Fills the preview pane during idle or early generation — no dead viewport space. */
export function WorkspacePreviewPlaceholder({
  isLoading = false,
  loadingStep = 0,
  loadingLabel,
  scorePassLines,
  className,
}: WorkspacePreviewPlaceholderProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-6 p-6 sm:p-10',
        className
      )}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div
          className={cn(
            'mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm',
            isLoading && 'border-brand-gold/40'
          )}
        >
          {isLoading ? (
            <Loader2 className="size-7 animate-spin text-brand-gold" aria-hidden="true" />
          ) : (
            <FileText className="size-7 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <p className="font-heading text-lg font-semibold text-foreground">
          {isLoading ? 'Building your tailored resume' : 'Live document preview'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isLoading
            ? 'Your ATS-formatted resume streams here as generation runs. Controls stay on the left.'
            : 'Generate tailored materials to see your resume, cover letter exports, and match score here.'}
        </p>
      </div>

      {isLoading ? (
        <div className="w-full max-w-sm rounded-lg border border-border/80 bg-card/80 px-4 py-3 text-left shadow-sm">
          <GenerationProgress
            compact
            loadingStep={loadingStep}
            activeLabel={loadingLabel}
            scorePassLines={scorePassLines}
          />
        </div>
      ) : (
        <div className="w-full max-w-[8.5in] rounded-lg border border-dashed border-border/70 bg-white/50 px-6 py-16 text-center dark:bg-card/30">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            8.5″ × 11″ preview canvas
          </p>
        </div>
      )}
    </div>
  )
}
