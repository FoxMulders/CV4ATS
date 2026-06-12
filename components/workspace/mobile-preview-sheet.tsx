'use client'

import { Eye, X } from 'lucide-react'
import { useCallback, useEffect, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MobilePreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  title?: string
}

export function MobilePreviewSheet({
  open,
  onOpenChange,
  children,
  title = 'Live preview',
}: MobilePreviewSheetProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  return (
    <>
      <Button
        type="button"
        size="sm"
        className={cn(
          'fixed bottom-[calc(var(--debug-dock-height)+1rem)] right-[var(--space-page-x)] z-40 gap-2 shadow-[var(--shadow-elevated)] lg:hidden',
          open && 'pointer-events-none opacity-0'
        )}
        onClick={() => onOpenChange(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Eye className="size-4" aria-hidden="true" />
        Preview
      </Button>

      <div
        className={cn(
          'fixed inset-0 z-50 flex flex-col justify-end lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        role="presentation"
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-foreground/25 backdrop-blur-[2px] transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0'
          )}
          aria-label="Close preview"
          onClick={close}
          tabIndex={open ? 0 : -1}
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            'relative flex max-h-[min(92dvh,calc(100dvh-var(--debug-dock-height)))] flex-col overflow-hidden rounded-t-[var(--radius-surface-lg)] border border-border/80 bg-background shadow-[var(--shadow-sheet)] transition-transform duration-300 ease-out',
            open ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-[var(--space-page-x)] py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label="Close preview"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </header>
          <div className="workspace-pane min-h-0 flex-1">{children}</div>
        </section>
      </div>
    </>
  )
}
