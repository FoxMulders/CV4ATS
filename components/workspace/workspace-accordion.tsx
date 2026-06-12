'use client'

import type { ReactNode } from 'react'

import { SURFACE_CARD_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

interface WorkspaceAccordionProps {
  id: string
  title: string
  description?: string
  /** Semantic heading level for accordion title — defaults to h2. */
  headingLevel?: 2 | 3
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export function WorkspaceAccordion({
  id,
  title,
  description,
  headingLevel = 2,
  defaultOpen = false,
  badge,
  children,
  className,
}: WorkspaceAccordionProps) {
  const HeadingTag = headingLevel === 3 ? 'h3' : 'h2'

  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(SURFACE_CARD_CLASS, 'group', className)}
    >
      <summary className="cursor-pointer list-none px-[var(--space-inline)] py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex min-h-12 items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <HeadingTag className="text-base font-semibold text-foreground">{title}</HeadingTag>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
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
      <div className="border-t border-border/60 px-[var(--space-inline)] py-[var(--space-inline)]">
        {children}
      </div>
    </details>
  )
}
