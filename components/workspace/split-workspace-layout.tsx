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
 * Split workspace: inputs left (45%), live document right (55%).
 * Each pane is the only vertical scroll container in its column.
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
        'grid h-full min-h-0 overflow-hidden',
        showRightPane
          ? 'grid-cols-1 max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,45vw)_minmax(0,55vw)] lg:grid-rows-1'
          : 'grid-cols-1 grid-rows-1',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className={cn(
          'flex min-h-0 flex-col overflow-hidden border-b border-border/80 bg-muted/20 lg:border-b-0 lg:border-r',
          showRightPane && 'max-lg:min-h-0'
        )}
      >
        <div className="workspace-pane min-h-0 flex-1 pb-14">
          <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
        </div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className="flex min-h-0 flex-col overflow-hidden bg-muted/40"
        >
          <div className="workspace-pane min-h-0 flex-1 pb-14">{rightPane}</div>
        </section>
      ) : null}
    </div>
  )
}
