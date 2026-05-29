'use client'

import { CheckCircle2, Users, XCircle } from 'lucide-react'

import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface HiringPanelReviewPanelProps {
  panel: HiringPanelSessionResult
}

export function HiringPanelReviewPanel({ panel }: HiringPanelReviewPanelProps) {
  const approvedCount = panel.managers.filter((m) => m.approved).length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="size-4 text-brand-gold" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Hiring panel score</p>
          <Badge className="bg-primary/90 tabular-nums">{panel.aggregateScore}%</Badge>
          {panel.unanimousApproval ? (
            <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Unanimous approval
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-400">
              {approvedCount}/10 approved
            </Badge>
          )}
          {panel.revisionRounds > 0 ? (
            <Badge variant="outline">{panel.revisionRounds} revision round(s)</Badge>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{panel.finalVerdict}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Manager scores & comments
        </p>
        {panel.managers.map((manager) => (
          <article
            key={manager.managerRole}
            className={cn(
              'rounded-lg border px-3 py-3',
              manager.approved
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-amber-500/40 bg-amber-500/5'
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{manager.managerRole}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {manager.score}%
                </span>
                {manager.approved ? (
                  <CheckCircle2 className="size-4 text-emerald-600" aria-label="Approved" />
                ) : (
                  <XCircle className="size-4 text-amber-600" aria-label="Not approved" />
                )}
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{manager.comment}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
