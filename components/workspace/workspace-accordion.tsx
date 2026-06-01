'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface WorkspaceAccordionProps {
  id: string
  title: string
  description?: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
  className?: string
  /** Keep expanded content scroll-contained so accordions don't blow the viewport. */
  scrollableContent?: boolean
}

export function WorkspaceAccordion({
  id,
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
  scrollableContent = true,
}: WorkspaceAccordionProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        'group rounded-lg border border-border/80 bg-card shadow-sm',
        className
      )}
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <span
              aria-hidden="true"
              className="text-muted-foreground transition group-open:rotate-45"
            >
              +
            </span>
          </div>
        </div>
      </summary>
      <div
        className={cn(
          'border-t border-border/60 px-4 py-4',
          scrollableContent && 'max-h-[min(480px,52vh)] overflow-y-auto overscroll-contain'
        )}
      >
        {children}
      </div>
    </details>
  )
}
