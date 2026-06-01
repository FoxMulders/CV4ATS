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

/** Top-aligned preview canvas that expands to fill the pane — no centered void. */
export function WorkspacePreviewPlaceholder({
  isLoading = false,
  loadingStep = 0,
  loadingLabel,
  scorePassLines,
  className,
}: WorkspacePreviewPlaceholderProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col p-4 sm:p-5', className)}>
      <div className="flex shrink-0 items-start gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card shadow-sm',
            isLoading && 'border-brand-gold/40'
          )}
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-brand-gold" aria-hidden="true" />
          ) : (
            <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="font-heading text-base font-semibold text-foreground">
            {isLoading ? 'Building your tailored resume' : 'Live document preview'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isLoading
              ? 'Your resume streams here during generation.'
              : 'Generate tailored materials to preview your resume and exports here.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 shrink-0 rounded-lg border border-border/80 bg-card/80 px-4 py-3">
          <GenerationProgress
            compact
            loadingStep={loadingStep}
            activeLabel={loadingLabel}
            scorePassLines={scorePassLines}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-border/70 bg-white shadow-sm dark:bg-card',
          isLoading && 'border-brand-gold/25'
        )}
      >
        <div className="shrink-0 border-b border-border/60 px-4 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            8.5″ × 11″ preview canvas
          </p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {isLoading
              ? 'Waiting for the first resume sections…'
              : 'Your tailored resume page will render in this canvas.'}
          </p>
        </div>
      </div>
    </div>
  )
}
