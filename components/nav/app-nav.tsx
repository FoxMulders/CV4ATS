import Link from 'next/link'

import { cn } from '@/lib/utils'

interface AppNavProps {
  current: 'tailor' | 'jobs'
}

export function AppNav({ current }: AppNavProps) {
  return (
    <nav className="flex gap-1 rounded-lg border bg-muted/50 p-1">
      <Link
        href="/"
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          current === 'tailor'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Tailor resume
      </Link>
      <Link
        href="/jobs"
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          current === 'jobs'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Edmonton job search
      </Link>
    </nav>
  )
}
