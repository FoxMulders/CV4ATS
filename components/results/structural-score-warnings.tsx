'use client'

import { cn } from '@/lib/utils'

interface StructuralScoreWarningsProps {
  warnings?: string[]
  className?: string
}

export function StructuralScoreWarnings({ warnings, className }: StructuralScoreWarningsProps) {
  if (!warnings?.length) return null

  return (
    <div className={cn('space-y-1', className)}>
      {warnings.map((warning) => (
        <p
          key={warning}
          className="text-sm font-medium text-amber-800 dark:text-amber-300"
          role="alert"
        >
          {warning}
        </p>
      ))}
    </div>
  )
}
