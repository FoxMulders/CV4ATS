'use client'

import { Loader2, RefreshCw } from 'lucide-react'

import { AnimatedAtsScoreGauge } from '@/components/results/animated-ats-score-gauge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RecalculateScoreToolbarProps {
  onRecalculate: () => void
  isRecalculating?: boolean
  isStale?: boolean
  lastScoreDelta?: number | null
  matchScore?: number
  baselineScore?: number
  className?: string
}

export function RecalculateScoreToolbar({
  onRecalculate,
  isRecalculating = false,
  isStale = false,
  lastScoreDelta = null,
  matchScore = 0,
  baselineScore,
  className,
}: RecalculateScoreToolbarProps) {
  const stepDeltaLabel =
    lastScoreDelta == null
      ? null
      : lastScoreDelta > 0
        ? `+${lastScoreDelta} this pass`
        : lastScoreDelta < 0
          ? `${lastScoreDelta} this pass`
          : 'No change this pass'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <AnimatedAtsScoreGauge
          score={matchScore}
          baselineScore={baselineScore}
          isUpdating={isRecalculating}
          size="hero"
        />
        <p className="text-xs text-muted-foreground">
          Edits to skills, keywords, and experience metrics trigger an automatic recalculation
          against the job description.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {isStale && !isRecalculating ? (
            <Badge
              variant="outline"
              className="border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
            >
              Pending recalculation…
            </Badge>
          ) : null}
          {stepDeltaLabel && !isRecalculating ? (
            <Badge
              variant={
                lastScoreDelta! > 0 ? 'default' : lastScoreDelta! < 0 ? 'destructive' : 'outline'
              }
            >
              {stepDeltaLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="shrink-0 self-start sm:self-center"
        onClick={onRecalculate}
        disabled={isRecalculating}
      >
        {isRecalculating ? (
          <>
            <Loader2 className="animate-spin" />
            Recalculating…
          </>
        ) : (
          <>
            <RefreshCw />
            Recalculate score
          </>
        )}
      </Button>
    </div>
  )
}
