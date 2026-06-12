'use client'

import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { MobilePreviewSheet } from './mobile-preview-sheet'

/** Shell above the fixed 40px debug dock. */
export const WORKSPACE_MAIN_CLASS = 'h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] overflow-hidden'

export const WORKSPACE_HEADER_CLASS = 'h-[3.25rem] min-h-[3.25rem] max-h-[3.25rem] shrink-0'

/** Body band below header — preview is absolute-filled on desktop; drawer on mobile. */
export const WORKSPACE_BODY_CLASS = 'relative min-h-0 flex-1 overflow-hidden'

interface SplitWorkspaceLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
  showRightPane?: boolean
  className?: string
}

/**
 * Desktop (lg+): left editor scrolls; right preview is pinned absolute full-height.
 * Mobile: editor fills the viewport; preview opens in a bottom sheet drawer.
 */
export function SplitWorkspaceLayout({
  leftPane,
  rightPane,
  showRightPane = true,
  className,
}: SplitWorkspaceLayoutProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div
      id="tailor-workspace"
      className={cn(WORKSPACE_BODY_CLASS, 'flex flex-col lg:block', className)}
    >
      <aside
        aria-label="Resume editor controls"
        className={cn(
          'relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain lg:h-full lg:flex-none',
          'border-b border-border/80 bg-muted/20',
          'lg:w-[min(46%,42rem)] lg:max-h-full lg:border-b-0 lg:border-r lg:shrink-0',
          'xl:w-[min(44%,44rem)]',
          '2xl:w-[min(42%,46rem)]'
        )}
      >
        <div className="flex flex-col gap-[var(--space-inline)] p-[var(--space-page-x)] pb-4">
          {leftPane}
        </div>
      </aside>

      {showRightPane ? (
        <>
          <section
            aria-label="Live resume preview"
            className={cn(
              'hidden flex-col overflow-hidden bg-muted/40 lg:flex',
              'lg:absolute lg:inset-y-0 lg:right-0 lg:left-[min(46%,42rem)] lg:border-l lg:border-border/80',
              'xl:left-[min(44%,44rem)]',
              '2xl:left-[min(42%,46rem)]'
            )}
          >
            {rightPane}
          </section>

          <MobilePreviewSheet open={previewOpen} onOpenChange={setPreviewOpen}>
            {rightPane}
          </MobilePreviewSheet>
        </>
      ) : null}
    </div>
  )
}
