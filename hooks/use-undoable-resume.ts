'use client'

import { useCallback, useEffect, useState } from 'react'

import type { TailoredResume } from '@/lib/ai/schemas'

const MAX_HISTORY = 50

interface UndoableResumeState {
  present: TailoredResume | null
  past: TailoredResume[]
  future: TailoredResume[]
}

function cloneResume(resume: TailoredResume): TailoredResume {
  return structuredClone(resume)
}

function resumesEqual(left: TailoredResume, right: TailoredResume): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export interface UseUndoableResumeResult {
  resume: TailoredResume | null
  /** Record a user edit on the undo stack. */
  pushResume: (resume: TailoredResume) => void
  /** Update the current resume without affecting undo history (streaming previews). */
  replaceResume: (resume: TailoredResume | null) => void
  /** Replace the current resume and clear undo/redo history. */
  resetResume: (resume: TailoredResume | null) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useUndoableResume(initial: TailoredResume | null = null): UseUndoableResumeResult {
  const [state, setState] = useState<UndoableResumeState>({
    present: initial ? cloneResume(initial) : null,
    past: [],
    future: [],
  })

  const resetResume = useCallback((resume: TailoredResume | null) => {
    setState({
      present: resume ? cloneResume(resume) : null,
      past: [],
      future: [],
    })
  }, [])

  const replaceResume = useCallback((resume: TailoredResume | null) => {
    setState((previous) => ({
      ...previous,
      present: resume ? cloneResume(resume) : null,
    }))
  }, [])

  const pushResume = useCallback((resume: TailoredResume) => {
    setState((previous) => {
      if (previous.present && resumesEqual(previous.present, resume)) {
        return previous
      }

      const past = previous.present
        ? [...previous.past.slice(-(MAX_HISTORY - 1)), cloneResume(previous.present)]
        : previous.past

      return {
        present: cloneResume(resume),
        past,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState((previous) => {
      if (previous.past.length === 0 || !previous.present) return previous

      const prior = previous.past[previous.past.length - 1]!
      return {
        present: cloneResume(prior),
        past: previous.past.slice(0, -1),
        future: [cloneResume(previous.present), ...previous.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((previous) => {
      if (previous.future.length === 0 || !previous.present) return previous

      const next = previous.future[0]!
      return {
        present: cloneResume(next),
        past: [...previous.past, cloneResume(previous.present)],
        future: previous.future.slice(1),
      }
    })
  }, [])

  return {
    resume: state.present,
    pushResume,
    replaceResume,
    resetResume,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}

/** Bind Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) for undo/redo. */
export function useUndoRedoKeyboardShortcuts(
  undo: () => void,
  redo: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      const mod = event.metaKey || event.ctrlKey
      if (!mod) return

      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, redo, undo])
}
