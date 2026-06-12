'use client'

/**
 * Purpose: Fixed viewport-bottom debug dock wrapper (40px) decoupled from workspace scroll flow.
 * Upstream dependencies: `SystemDebugConsole` (dock variant), `--debug-dock-height` CSS variable.
 */

import { PAGE_CONTAINER_WIDE_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'
import { SystemDebugConsole } from '@/qa/components/SystemDebugConsole'

export function SystemDebugDock() {
  return (
    <div className="system-debug-dock">
      <div className={cn(PAGE_CONTAINER_WIDE_CLASS, 'system-debug-dock__inner pointer-events-auto')}>
        <SystemDebugConsole variant="dock" />
      </div>
    </div>
  )
}
