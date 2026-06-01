'use client'

import { SystemDebugConsole } from '@/components/layout/system-debug-console'

/** Fixed bottom overlay — 40px bar only; log stream pops upward without resizing the workspace. */
export function SystemDebugDock() {
  return (
    <div className="system-debug-dock">
      <div className="system-debug-dock__inner pointer-events-auto mx-auto max-w-6xl px-4 sm:px-6">
        <SystemDebugConsole variant="dock" />
      </div>
    </div>
  )
}
