'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  /** When false, hide the preview column on small screens and avoid empty split rows. */
  showRightPane?: boolean
  className?: string
}

/** Fixed viewport-height split workspace — 42/58 on desktop, stacked on mobile. */
export function SplitWorkspaceLayout({
  leftPane,
  rightPane,
  showRightPane = true,
  className,
}: SplitWorkspaceLayoutProps) {
  return (
    <div
      id="tailor-workspace"
      className={cn(
        'grid h-full min-h-0 flex-1 overflow-hidden',
        showRightPane
          ? 'grid-cols-1 max-lg:grid-rows-[auto_auto] lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:grid-rows-[minmax(0,1fr)]'
          : 'grid-cols-1 grid-rows-1',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className="flex min-h-0 flex-col overflow-y-auto overscroll-contain border-b border-border/80 bg-muted/20 lg:min-h-0 lg:border-b-0 lg:border-r"
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className="flex min-h-0 flex-col overflow-hidden bg-muted/40 lg:min-h-0"
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
