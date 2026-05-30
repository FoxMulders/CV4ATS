'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  /** When false, hide the preview column and size the editor to its content. */
  showRightPane?: boolean
  className?: string
}

const WORKSPACE_SCROLL_MAX_CLASS = 'max-h-[calc(100svh-3.75rem)]'

/** Split workspace — full viewport when preview is active; content-height otherwise. */
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
        'grid overflow-hidden',
        showRightPane
          ? cn(
              'grid-cols-1 max-lg:grid-rows-[auto_auto] lg:h-full lg:min-h-0 lg:flex-1',
              'lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:grid-rows-1 lg:items-start lg:content-start'
            )
          : 'h-auto flex-none grid-cols-1 grid-rows-1',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className={cn(
          'flex flex-col overscroll-contain border-b border-border/80 bg-muted/20 lg:border-b-0 lg:border-r',
          showRightPane
            ? cn('min-h-0 overflow-y-auto', WORKSPACE_SCROLL_MAX_CLASS)
            : 'h-auto overflow-visible'
        )}
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className={cn(
            'flex min-h-0 flex-col overflow-hidden bg-muted/40',
            WORKSPACE_SCROLL_MAX_CLASS,
            'max-lg:shrink-0 lg:overflow-y-auto'
          )}
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
