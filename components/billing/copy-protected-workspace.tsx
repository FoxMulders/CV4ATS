'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyProtectedWorkspaceProps {
  locked: boolean
  children: ReactNode
  onUnlockRequest?: () => void
  className?: string
}

export function CopyProtectedWorkspace({
  locked,
  children,
  onUnlockRequest,
  className,
}: CopyProtectedWorkspaceProps) {
  return (
    <div
      className={cn('copy-protected-workspace', locked && 'copy-protected-workspace--locked', className)}
      onContextMenu={locked ? (event) => event.preventDefault() : undefined}
      onCopy={locked ? (event) => event.preventDefault() : undefined}
      onCut={locked ? (event) => event.preventDefault() : undefined}
      onDragStart={locked ? (event) => event.preventDefault() : undefined}
    >
      <div
        className={cn(
          'copy-protected-workspace__content',
          locked && 'copy-protected-workspace__content--blurred'
        )}
        aria-hidden={locked}
      >
        {children}
      </div>

      {locked ? (
        <div className="copy-protected-workspace__overlay">
          <div className="copy-protected-workspace__overlay-card">
            <p className="text-sm font-medium text-foreground">24-Hour Job Pass required</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock full access for this role to remove blur, enable copy, and download unlimited
              PDF/DOCX exports for 24 hours.
            </p>
            {onUnlockRequest ? (
              <Button type="button" size="sm" className="mt-3" onClick={onUnlockRequest}>
                Unlock 24-Hour Job Pass — $4.99 CAD
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
