'use client'

import { SystemDebugConsole } from '@/components/layout/system-debug-console'

/** Debug dock — in-flow on workspace routes; log stream pops upward as absolute overlay. */
export function SystemDebugDock() {
  return (
    <div className="system-debug-dock">
      <div className="system-debug-dock__inner pointer-events-auto mx-auto max-w-6xl px-4 sm:px-6">
        <SystemDebugConsole variant="dock" />
      </div>
    </div>
  )
}
