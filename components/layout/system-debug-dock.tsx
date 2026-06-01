'use client'

import { SystemDebugConsole } from '@/components/layout/system-debug-console'

/** Fixed bottom overlay — does not participate in document flow or pane scroll. */
export function SystemDebugDock() {
  return (
    <div className="system-debug-dock pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <SystemDebugConsole variant="dock" />
      </div>
    </div>
  )
}
