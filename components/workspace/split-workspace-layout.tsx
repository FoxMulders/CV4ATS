'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Shell above the fixed 40px debug dock. */
export const WORKSPACE_MAIN_CLASS = 'h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] overflow-hidden'

export const WORKSPACE_HEADER_CLASS = 'h-[3.25rem] min-h-[3.25rem] max-h-[3.25rem] shrink-0'

/** Body band below header — preview is absolute-filled; editor is content-height on the left. */
export const WORKSPACE_BODY_CLASS = 'relative min-h-0 flex-1 overflow-hidden'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  showRightPane?: boolean
  className?: string
}

/**
 * Desktop: left editor is only as tall as its content (scrolls if long).
 * Right preview is pinned absolute full-height — no dead column void.
 */
export function SplitWorkspaceLayout({
  leftPane,
  rightPane,
  showRightPane = true,
  className,
}: SplitWorkspaceLayoutProps) {
  return (
    <div id="tailor-workspace" className={cn(WORKSPACE_BODY_CLASS, className)}>
      <aside
        aria-label="Resume editor controls"
        className={cn(
          'relative z-10 w-full overflow-x-hidden overflow-y-auto overscroll-contain',
          'border-b border-border/80 bg-muted/20 pb-4',
          'lg:w-[45%] lg:max-h-full lg:border-b-0 lg:border-r'
        )}
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className={cn(
            'flex flex-col overflow-hidden bg-muted/40',
            'max-lg:min-h-[min(70dvh,640px)] max-lg:border-t',
            'lg:absolute lg:inset-y-0 lg:right-0 lg:w-[55%] lg:border-l lg:border-border/80'
          )}
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
