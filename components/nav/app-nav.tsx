import Link from 'next/link'

import { cn } from '@/lib/utils'

interface AppNavProps {
  current: 'tailor' | 'jobs'
}

export function AppNav({ current }: AppNavProps) {
  return (
    <nav className="flex gap-1 rounded-[var(--radius-surface)] border border-border/80 bg-background/80 p-1 shadow-[var(--shadow-ambient)]">
      <Link
        href="/"
        className={cn(
          'app-nav-link rounded-md text-sm font-medium transition-colors',
          current === 'tailor'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        Tailor resume
      </Link>
      <Link
        href="/jobs"
        className={cn(
          'app-nav-link rounded-md text-sm font-medium transition-colors',
          current === 'jobs'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        Job search
      </Link>
    </nav>
  )
}
