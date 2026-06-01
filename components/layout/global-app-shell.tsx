'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { SystemDebugProvider } from '@/components/debug/system-debug-provider'
import { SystemDebugDock } from '@/components/layout/system-debug-dock'
import { SiteFooter } from '@/components/layout/site-footer'
import { cn } from '@/lib/utils'

function isWorkspaceRoute(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/tailor/')
}

export function GlobalAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const workspaceMode = isWorkspaceRoute(pathname ?? '/')

  useEffect(() => {
    document.documentElement.classList.toggle('app-viewport-lock', workspaceMode)
    document.body.classList.toggle('app-viewport-lock', workspaceMode)
    return () => {
      document.documentElement.classList.remove('app-viewport-lock')
      document.body.classList.remove('app-viewport-lock')
    }
  }, [workspaceMode])

  return (
    <SystemDebugProvider>
      <div
        className={cn(
          'app-shell',
          workspaceMode ? 'app-shell--workspace' : 'app-shell--scrollable'
        )}
      >
        <div className="app-shell-main">{children}</div>
        {workspaceMode ? <SystemDebugDock /> : <SiteFooter />}
      </div>
    </SystemDebugProvider>
  )
}
