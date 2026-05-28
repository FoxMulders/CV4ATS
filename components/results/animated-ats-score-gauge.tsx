'use client'

import { Loader2 } from 'lucide-react'

import { BaselineVarianceBadge } from '@/components/results/baseline-variance-badge'
import { useAnimatedNumber } from '@/hooks/use-animated-number'
import { cn } from '@/lib/utils'

interface AnimatedAtsScoreGaugeProps {
  score: number
  baselineScore?: number
  label?: string
  isUpdating?: boolean
  size?: 'compact' | 'hero'
  className?: string
}

function scoreTone(score: number): string {
  if (score >= 88) return 'text-primary'
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function barTone(score: number): string {
  if (score >= 88) return 'bg-primary'
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

export function AnimatedAtsScoreGauge({
  score,
  baselineScore,
  label = 'ATS match score',
  isUpdating = false,
  size = 'hero',
  className,
}: AnimatedAtsScoreGaugeProps) {
  const animatedScore = useAnimatedNumber(score, isUpdating ? 400 : 650)
  const isCompact = size === 'compact'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          {label ? (
            <p
              className={cn(
                'font-medium text-muted-foreground',
                isCompact ? 'text-xs uppercase tracking-wide' : 'text-sm'
              )}
            >
              {label}
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-2">
            <p
              className={cn(
                'font-bold tabular-nums transition-colors duration-500',
                scoreTone(animatedScore),
                isCompact ? 'text-2xl' : 'text-4xl'
              )}
            >
              {animatedScore}%
            </p>
            {isUpdating ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {baselineScore != null ? (
          <BaselineVarianceBadge
            currentScore={score}
            baselineScore={baselineScore}
            size={isCompact ? 'sm' : 'md'}
          />
        ) : null}
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-700 ease-out',
            barTone(animatedScore)
          )}
          style={{ width: `${Math.min(100, Math.max(0, animatedScore))}%` }}
        />
      </div>
    </div>
  )
}
