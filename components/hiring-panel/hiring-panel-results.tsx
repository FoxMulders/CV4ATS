'use client'

import type { HiringPanelResult } from '@/lib/ai/hiring-panel-schemas'
import { Badge } from '@/components/ui/badge'

interface HiringPanelResultsProps {
  result: HiringPanelResult
}

export function HiringPanelResults({ result }: HiringPanelResultsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Panel&apos;s Critiques
          </h3>
          <Badge variant="secondary">{result.critiquesSummary.length} themes</Badge>
        </div>
        <ul className="space-y-2">
          {result.critiquesSummary.map((critique) => (
            <li
              key={critique}
              className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm leading-relaxed text-foreground"
            >
              {critique}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            WOW-Factor Rewritten Resume Bullets
          </h3>
          <Badge className="bg-primary/90">{result.rewrittenBullets.length} bullets</Badge>
        </div>
        <ul className="list-disc space-y-2 pl-5">
          {result.rewrittenBullets.map((bullet) => (
            <li key={bullet} className="text-sm leading-relaxed text-foreground">
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading text-base font-semibold text-foreground">Cover Letter Hook</h3>
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
          {result.coverLetterHook}
        </p>
      </div>
    </div>
  )
}
