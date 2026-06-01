'use client'

import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { SystemDebugProvider } from '@/qa/components/SystemDebugProvider'
import { SystemDebugDock } from '@/qa/components/SystemDebugDock'
import { SiteFooter } from '@/components/layout/site-footer'
import { WORKSPACE_MAIN_CLASS } from '@/components/workspace/split-workspace-layout'

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
        <div className={WORKSPACE_MAIN_CLASS}>
          {children}
        </div>
        <SystemDebugDock />
      </SystemDebugProvider>
    )
  }

  return (
    <SystemDebugProvider>
      <div className="app-shell app-shell--scrollable min-h-dvh">
        <div className="app-shell-main">{children}</div>
        <SiteFooter />
      </div>
    </SystemDebugProvider>
  )
}
