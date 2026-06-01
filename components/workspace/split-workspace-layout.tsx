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
 * Full-height split workspace: editor left (~45%), live preview right (~55%) on lg+.
 * Each column fills the viewport band between header and debug dock and scrolls independently.
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
        'workspace-split',
        !showRightPane && 'workspace-split--single',
        className
      )}
    >
      <aside
        aria-label="Resume editor controls"
        className="workspace-split__pane workspace-split__pane--editor h-full min-h-0 border-b border-border/80 bg-muted/20 lg:border-b-0 lg:border-r"
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className="workspace-split__pane workspace-split__pane--preview flex h-full min-h-0 flex-col bg-muted/40"
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
