'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Viewport math — literal calcs on elements, not CSS-variable chains. */
export const WORKSPACE_DOCK_PX = 40
export const WORKSPACE_HEADER_CLASS = 'h-[3.25rem] min-h-[3.25rem] max-h-[3.25rem] shrink-0'
export const WORKSPACE_MAIN_CLASS = 'h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] overflow-hidden'
export const WORKSPACE_SPLIT_CLASS =
  'grid h-[calc(100dvh-3.25rem-40px)] max-h-[calc(100dvh-3.25rem-40px)] min-h-0 w-full grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  showRightPane?: boolean
  className?: string
}

export function SplitWorkspaceLayout({
  leftPane,
  rightPane,
  showRightPane = true,
  className,
}: SplitWorkspaceLayoutProps) {
  return (
    <div
      id="tailor-workspace"
      className={cn(WORKSPACE_SPLIT_CLASS, !showRightPane && 'grid-cols-1', className)}
    >
      <aside
        aria-label="Resume editor controls"
        className="min-h-0 overflow-y-auto overscroll-contain border-b border-border/80 bg-muted/20 lg:h-full lg:max-h-full lg:border-b-0 lg:border-r"
      >
        <div className="space-y-3 p-4 sm:p-5">{leftPane}</div>
      </aside>

      {showRightPane ? (
        <section
          aria-label="Live resume preview"
          className="flex min-h-0 flex-col overflow-hidden bg-muted/40 lg:h-full lg:max-h-full"
        >
          {rightPane}
        </section>
      ) : null}
    </div>
  )
}
