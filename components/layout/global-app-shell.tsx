'use client'

import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { SystemDebugProvider } from '@/components/debug/system-debug-provider'
import { SystemDebugDock } from '@/components/layout/system-debug-dock'
import { SiteFooter } from '@/components/layout/site-footer'

function isWorkspaceRoute(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/tailor/')
}

function lockWorkspaceViewport(active: boolean) {
  document.documentElement.classList.toggle('app-viewport-lock', active)
  document.body.classList.toggle('app-viewport-lock', active)
}

export function GlobalAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const workspaceMode = isWorkspaceRoute(pathname ?? '/')

  useLayoutEffect(() => {
    lockWorkspaceViewport(workspaceMode)
    return () => lockWorkspaceViewport(false)
  }, [workspaceMode])

  useEffect(() => {
    lockWorkspaceViewport(workspaceMode)
  }, [workspaceMode])

  if (workspaceMode) {
    return (
      <SystemDebugProvider>
        <div className="app-shell app-shell--workspace">
          <div className="app-shell-main">{children}</div>
        </div>
        <SystemDebugDock />
      </SystemDebugProvider>
    )
  }

  return (
    <SystemDebugProvider>
      <div className="app-shell app-shell--scrollable">
        <div className="app-shell-main">{children}</div>
        <SiteFooter />
      </div>
    </SystemDebugProvider>
  )
}
