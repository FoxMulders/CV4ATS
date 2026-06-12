import Link from 'next/link'

import { Cv2atsLogo } from '@/components/brand/cv2ats-logo'
import { AppNav } from '@/components/nav/app-nav'
import { WORKSPACE_HEADER_CLASS } from '@/components/workspace/split-workspace-layout'
import { BRAND_TAGLINE } from '@/lib/brand'
import {
  PAGE_CONTAINER_CLASS,
  PAGE_CONTAINER_FLUID_CLASS,
} from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

interface SiteHeaderProps {
  current: 'tailor' | 'jobs'
  /** Slim header for full-viewport workspace layouts. */
  variant?: 'default' | 'compact'
}

export function SiteHeader({ current, variant = 'default' }: SiteHeaderProps) {
  const compact = variant === 'compact'

  return (
    <header className={cn('workspace-header z-50 border-b border-border/80 bg-background/95 shadow-[var(--shadow-ambient)] backdrop-blur supports-[backdrop-filter]:bg-background/80', compact && WORKSPACE_HEADER_CLASS)}>
      <div
        className={cn(
          'flex items-center justify-between gap-[var(--space-inline)]',
          compact
            ? cn(PAGE_CONTAINER_FLUID_CLASS, 'h-full')
            : cn(PAGE_CONTAINER_CLASS, 'py-[var(--space-inline)]')
        )}
      >
        <Link
          href="/"
          className="group flex min-h-12 min-w-12 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="cv2ats home — ATS resume builder"
        >
          <Cv2atsLogo variant="mark" size={compact ? 'sm' : 'md'} />
          <div className="min-w-0">
            <Cv2atsLogo variant="wordmark" size={compact ? 'sm' : 'md'} />
            {compact ? null : (
              <p className="truncate text-xs text-muted-foreground">{BRAND_TAGLINE}</p>
            )}
          </div>
        </Link>
        <AppNav current={current} />
      </div>
    </header>
  )
}
