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

/** Fills the entire preview column — paper canvas stretches edge to edge. */
export function WorkspacePreviewPlaceholder({
  isLoading = false,
  loadingStep = 0,
  loadingLabel,
  scorePassLines,
  className,
}: WorkspacePreviewPlaceholderProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col p-3 sm:p-4', className)}>
      <div className="flex shrink-0 items-start gap-3 pb-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card shadow-sm',
            isLoading && 'border-brand-gold/40'
          )}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-brand-gold" aria-hidden="true" />
          ) : (
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {isLoading ? 'Building your tailored resume' : 'Live document preview'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isLoading
              ? 'Streaming into the canvas below…'
              : 'Generate to preview your resume here.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mb-3 shrink-0 rounded-lg border border-border/80 bg-card/90 px-3 py-2">
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
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-white shadow-md dark:bg-card',
          isLoading && 'border-brand-gold/30'
        )}
      >
        <div className="shrink-0 border-b border-border/50 bg-muted/30 px-3 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            8.5″ × 11″ preview
          </p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          {isLoading
            ? 'Waiting for the first resume sections…'
            : 'Your tailored resume renders in this panel.'}
        </div>
      </div>
    </div>
  )
}
