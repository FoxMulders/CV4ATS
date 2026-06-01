'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  /** When false, hide the preview column (mobile-only collapse). */
  showRightPane?: boolean
  className?: string
}

/**
 * Split workspace: inputs left (~45%), live document right (~55%) on lg+.
 * Left column sizes to content (no dead void). Right preview sticks and scrolls independently.
 */
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
        'grid w-full',
        showRightPane
          ? 'grid-cols-1 items-start lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]'
          : 'grid-cols-1',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className={cn(
          'border-b border-border/80 bg-muted/20 lg:border-b-0 lg:border-r',
          showRightPane && 'lg:min-h-0'
        )}
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className={cn(
            'bg-muted/40',
            'lg:sticky lg:top-0 lg:max-h-[calc(100dvh-2.75rem-var(--debug-dock-height,40px))]',
            'lg:overflow-y-auto lg:overscroll-contain'
          )}
        >
          <div className="workspace-pane lg:max-h-[calc(100dvh-2.75rem-var(--debug-dock-height,40px))]">
            {rightPane}
          </div>
        </section>
      ) : null}
    </div>
  )
}
