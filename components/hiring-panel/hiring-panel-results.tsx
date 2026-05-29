'use client'

import { MessageSquareQuote, Users } from 'lucide-react'

import type { HiringPanelResult } from '@/lib/ai/hiring-panel-schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface HiringPanelResultsProps {
  result: HiringPanelResult
  onApplyCoverLetter?: () => void
}

export function HiringPanelResults({ result, onApplyCoverLetter }: HiringPanelResultsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <Users className="size-4 text-brand-gold" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
            Panel verdict
          </p>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{result.panelVerdict}</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Back at the table — 10 critiques & reactions
          </h3>
          <Badge variant="secondary">10 managers</Badge>
        </div>
        <div className="space-y-3">
          {result.panelCritiques.map((entry, index) => (
            <article
              key={`${entry.managerRole}-${index}`}
              className="rounded-lg border border-border/70 bg-card px-3 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.managerRole}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                <span className="font-medium text-destructive/90">Critique: </span>
                {entry.critique}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <MessageSquareQuote className="size-3.5" aria-hidden="true" />
                  At the table:
                </span>{' '}
                {entry.tableReaction}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading text-sm font-semibold text-muted-foreground">
          Discussion themes
        </h3>
        <ul className="space-y-2">
          {result.critiquesSummary.map((critique) => (
            <li
              key={critique}
              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
            >
              {critique}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Rewritten resume bullets
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Panel-approved cover letter
          </h3>
          {onApplyCoverLetter ? (
            <Button type="button" size="sm" variant="outline" onClick={onApplyCoverLetter}>
              Use in cover letter editor
            </Button>
          ) : null}
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 font-sans text-sm leading-relaxed text-foreground">
          {result.coverLetter}
        </pre>
      </div>
    </div>
  )
}
