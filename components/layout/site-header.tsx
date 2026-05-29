import { FileCheck2 } from 'lucide-react'
import Link from 'next/link'

import { AppNav } from '@/components/nav/app-nav'

interface SiteHeaderProps {
  current: 'tailor' | 'jobs'
  /** Slim header for full-viewport workspace layouts. */
  variant?: 'default' | 'compact'
}

export function SiteHeader({ current, variant = 'default' }: SiteHeaderProps) {
  const compact = variant === 'compact'

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div
        className={
          compact
            ? 'mx-auto flex max-w-none items-center justify-between gap-4 px-4 py-2.5 sm:px-5'
            : 'mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6'
        }
      >
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div
            className={
              compact
                ? 'flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm'
                : 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm'
            }
          >
            <FileCheck2 className={compact ? 'size-4' : 'size-5'} />
          </div>
          <div className="min-w-0">
            <p
              className={
                compact
                  ? 'font-heading truncate text-base font-semibold leading-tight tracking-tight text-foreground'
                  : 'font-heading truncate text-lg font-semibold leading-tight tracking-tight text-foreground'
              }
            >
              ATS4CV
            </p>
            {compact ? null : (
              <p className="truncate text-xs text-muted-foreground">Professional resume tailoring</p>
            )}
          </div>
        </Link>
        <AppNav current={current} />
      </div>
    </header>
  )
}
