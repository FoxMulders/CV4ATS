'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import {
  WORKSPACE_VIEWPORT_BODY_CLASS,
  WORKSPACE_VIEWPORT_SHELL_CLASS,
} from '@/lib/wizard/workspace-panel-styles'

interface WorkspaceEditorViewportProps {
  children: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  'aria-label'?: string
}

/**
 * Matched editing shell for Job Description and Resume panels —
 * same border and padding; no inner scroll (parent pane scrolls).
 */
export function WorkspaceEditorViewport({
  children,
  footer,
  className,
  bodyClassName,
  'aria-label': ariaLabel,
}: WorkspaceEditorViewportProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className={cn(WORKSPACE_VIEWPORT_SHELL_CLASS, 'flex flex-col')}
        aria-label={ariaLabel}
      >
        <div className={cn(WORKSPACE_VIEWPORT_BODY_CLASS, bodyClassName)}>{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border/60 bg-background/80">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
