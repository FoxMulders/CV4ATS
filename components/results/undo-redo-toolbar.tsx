'use client'

import { Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useUndoRedoKeyboardShortcuts } from '@/hooks/use-undoable-resume'

interface UndoRedoToolbarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  enabled?: boolean
  className?: string
}

export function UndoRedoToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  enabled = true,
  className,
}: UndoRedoToolbarProps) {
  useUndoRedoKeyboardShortcuts(onUndo, onRedo, enabled && (canUndo || canRedo))

  if (!enabled) return null

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
      role="toolbar"
      aria-label="Resume edit history"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 />
        Undo
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 />
        Redo
      </Button>
      <span className="text-xs text-muted-foreground">
        {canUndo || canRedo ? 'Ctrl+Z · Ctrl+Shift+Z' : 'Edits can be undone here'}
      </span>
    </div>
  )
}
