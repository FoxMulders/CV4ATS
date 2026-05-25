import { FileCheck2 } from 'lucide-react'
import Link from 'next/link'

import { AppNav } from '@/components/nav/app-nav'

interface SiteHeaderProps {
  current: 'tailor' | 'jobs'
}

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <FileCheck2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-heading truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
              ATS4CV
            </p>
            <p className="truncate text-xs text-muted-foreground">Professional resume tailoring</p>
          </div>
        </Link>
        <AppNav current={current} />
      </div>
    </header>
  )
}
