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
 * Viewport-bound split: editor scrolls from the top-left; preview fills the right column edge-to-edge.
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
        className="workspace-split__pane workspace-split__pane--editor border-b border-border/80 bg-muted/20 lg:border-b-0 lg:border-r"
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className="workspace-split__pane workspace-split__pane--preview bg-muted/40"
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
