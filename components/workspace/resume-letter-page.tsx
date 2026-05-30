'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ResumeLetterPageProps {
  children?: ReactNode
  className?: string
  empty?: boolean
  emptyMessage?: string
}

/** Mimics a printable 8.5" × 11" document canvas inside the preview pane. */
export function ResumeLetterPage({
  children,
  className,
  empty = false,
  emptyMessage = 'Generate a tailored resume to see your live document preview here.',
}: ResumeLetterPageProps) {
  if (empty) {
    return (
      <div className={cn('flex h-full items-center justify-center p-6', className)}>
        <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex justify-center p-4 sm:p-6', className)}>
      <article
        className={cn(
          'w-full max-w-[8.5in] bg-white text-foreground shadow-lg',
          'border border-border/60 px-[0.65in] py-[0.6in] sm:px-[0.75in] sm:py-[0.7in]'
        )}
        aria-label="Resume document preview"
      >
        {children}
      </article>
    </div>
  )
}
