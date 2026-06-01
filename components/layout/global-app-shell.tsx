'use client'

import type { ReactNode } from 'react'

import { SystemDebugProvider } from '@/components/debug/system-debug-provider'
import { SiteFooter } from '@/components/layout/site-footer'

export function GlobalAppShell({ children }: { children: ReactNode }) {
  return (
    <SystemDebugProvider>
      <div className="flex min-h-screen flex-col">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
      </div>
    </SystemDebugProvider>
  )
}
