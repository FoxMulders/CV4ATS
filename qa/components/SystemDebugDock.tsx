'use client'

/**
 * Purpose: Fixed viewport-bottom debug dock wrapper (40px) decoupled from workspace scroll flow.
 * Upstream dependencies: `SystemDebugConsole` (dock variant), `--debug-dock-height` CSS variable.
 */

import { SystemDebugConsole } from '@/qa/components/SystemDebugConsole'

export function SystemDebugDock() {
  return (
    <div className="system-debug-dock">
      <div className="system-debug-dock__inner pointer-events-auto mx-auto max-w-6xl px-4 sm:px-6">
        <SystemDebugConsole variant="dock" />
      </div>
    </div>
  )
}
