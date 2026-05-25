'use client'

import { formatScorePassLine } from '@/lib/api/generation-config'
import { GENERATION_PROGRESS_LABELS } from '@/lib/api/generation-progress-labels'
import type { ScorePassEvent } from '@/lib/api/progress-stream'

interface GenerationProgressProps {
  loadingStep: number
  activeLabel?: string | null
  scorePassLines?: string[]
  passHistory?: ScorePassEvent[]
  compact?: boolean
}

export function GenerationProgress({
  loadingStep,
  activeLabel,
  scorePassLines,
  passHistory,
  compact = false,
}: GenerationProgressProps) {
  const lines =
    scorePassLines ??
    (passHistory?.map((event) => formatScorePassLine(event)) ?? [])

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {GENERATION_PROGRESS_LABELS.map((step, index) => {
        const label =
          index === loadingStep && activeLabel?.trim() ? activeLabel : step

        return (
          <p
            key={step}
            className={
              compact
                ? index <= loadingStep
                  ? 'text-xs text-foreground'
                  : 'text-xs text-muted-foreground'
                : index <= loadingStep
                  ? 'text-sm text-foreground'
                  : 'text-sm text-muted-foreground'
            }
          >
            {index < loadingStep ? '✓' : index === loadingStep ? '→' : '○'} {label}
          </p>
        )
      })}

      {lines.length > 0 ? (
        <div
          className={
            compact
              ? 'mt-2 space-y-1 border-t border-border/60 pt-2'
              : 'mt-3 space-y-1.5 border-t border-border/80 pt-3'
          }
        >
          <p className={compact ? 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground' : 'text-xs font-medium uppercase tracking-wide text-muted-foreground'}>
            ATS score by pass
          </p>
          {lines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className={compact ? 'text-xs font-medium text-brand-gold' : 'text-sm font-medium text-brand-gold'}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { GENERATION_PROGRESS_LABELS }
