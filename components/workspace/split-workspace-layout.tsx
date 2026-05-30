'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  className?: string
}

/** Fixed viewport-height split workspace — 42/58 on desktop, stacked on mobile. */
export function SplitWorkspaceLayout({
  leftPane,
  rightPane,
  className,
}: SplitWorkspaceLayoutProps) {
  return (
    <div
      id="tailor-workspace"
      className={cn(
        'grid min-h-0 flex-1 grid-cols-1',
        'max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]',
        'lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:grid-rows-[minmax(0,1fr)]',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className="flex min-h-0 flex-col overflow-y-auto overscroll-contain border-b border-border/80 bg-muted/20 lg:h-full lg:border-b-0 lg:border-r"
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      <section
        aria-label="Live resume preview"
        className="flex min-h-0 flex-col overflow-hidden bg-muted/40 lg:h-full"
      >
        {rightPane}
      </section>
    </div>
  )
}
