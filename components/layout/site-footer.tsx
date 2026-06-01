import Link from 'next/link'

import { ShieldCheck } from 'lucide-react'

import { SystemDebugConsole } from '@/components/layout/system-debug-console'

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-border/80 bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">ATS4CV</p>
            <p className="text-xs text-muted-foreground">
              ATS resume builder, cover letter generator, and keyword match scoring.
            </p>
          </div>
          <nav aria-label="Industry resume builders" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href="/tailor/project-manager" className="text-muted-foreground hover:text-foreground">
              Project manager
            </Link>
            <Link href="/tailor/software-engineer" className="text-muted-foreground hover:text-foreground">
              Software engineer
            </Link>
            <Link href="/tailor/nursing" className="text-muted-foreground hover:text-foreground">
              Nursing
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
          <span>Processed in memory · Never stored · No account required</span>
        </div>
        <SystemDebugConsole />
      </div>
    </footer>
  )
}
