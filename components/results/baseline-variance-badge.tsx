import { TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'

interface BaselineVarianceBadgeProps {
  currentScore: number
  baselineScore: number
  className?: string
  size?: 'sm' | 'md'
}

export function BaselineVarianceBadge({
  currentScore,
  baselineScore,
  className,
  size = 'md',
}: BaselineVarianceBadgeProps) {
  const variance = currentScore - baselineScore

  if (variance === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium text-muted-foreground',
          size === 'sm' ? 'text-xs' : 'text-sm',
          className
        )}
      >
        ±0% vs baseline
      </span>
    )
  }

  const positive = variance > 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tabular-nums',
        positive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      {positive ? <TrendingUp className="size-3.5 shrink-0" /> : <TrendingDown className="size-3.5 shrink-0" />}
      {positive ? '+' : ''}
      {variance}% vs baseline
    </span>
  )
}
