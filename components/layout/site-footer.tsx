import Link from 'next/link'

import { ShieldCheck } from 'lucide-react'

import { Cv2atsLogo } from '@/components/brand/cv2ats-logo'
import { PAGE_CONTAINER_CLASS } from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-border/80 bg-muted/40">
      <div className={cn(PAGE_CONTAINER_CLASS, 'flex flex-col gap-[var(--space-section)] py-[var(--space-page-y)]')}>
        <div className="flex flex-col gap-[var(--space-inline)] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Cv2atsLogo variant="full" size="sm" />
            <p className="text-xs text-muted-foreground">
              ATS resume builder, cover letter generator, and keyword match scoring.
            </p>
          </div>
          <nav aria-label="Industry resume builders" className="flex flex-wrap gap-[var(--space-inline)] text-sm leading-relaxed">
            <Link
              href="/tailor/project-manager"
              className="app-nav-link inline-flex min-h-12 items-center text-muted-foreground hover:text-foreground"
            >
              Project manager
            </Link>
            <Link
              href="/tailor/software-engineer"
              className="app-nav-link inline-flex min-h-12 items-center text-muted-foreground hover:text-foreground"
            >
              Software engineer
            </Link>
            <Link
              href="/tailor/nursing"
              className="app-nav-link inline-flex min-h-12 items-center text-muted-foreground hover:text-foreground"
            >
              Nursing
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
          <span>Processed in memory · Never stored · No account required</span>
        </div>
      </div>
    </footer>
  )
}
