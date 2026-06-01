'use client'

import { AlertTriangle, CheckCircle2, Users, XCircle } from 'lucide-react'

import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HiringPanelReviewPanelProps {
  panel: HiringPanelSessionResult
  onAddMetrics?: () => void
  onVerifyExperience?: () => void
  hasExperienceGaps?: boolean
}

export function HiringPanelReviewPanel({
  panel,
  onAddMetrics,
  onVerifyExperience,
  hasExperienceGaps = false,
}: HiringPanelReviewPanelProps) {
  if (panel.reviewFailed) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Hiring panel review unavailable</p>
            <p className="mt-1">{panel.failureReason ?? panel.finalVerdict}</p>
            {panel.managers.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Partial manager feedback ({panel.managers.length}) was recovered before the review failed.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const approvedCount = panel.managers.filter((m) => m.approved).length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="size-4 text-brand-gold" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Interview readiness</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Final assessment
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{panel.finalVerdict}</p>
        {!panel.unanimousApproval ? (
          <p className="mt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            When managers flag missing tool evidence (e.g. Jenkins CI/CD) or banned cover letter
            phrasing, use Verify flagged experience below to confirm what you actually used — the
            AI will rewrite bullets and the letter from your answers.
          </p>
        ) : null}
        {!panel.unanimousApproval && onVerifyExperience ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onVerifyExperience}
          >
            {hasExperienceGaps ? 'Verify flagged experience' : 'Confirm experience & improve draft'}
          </Button>
        ) : null}
      </div>

      {panel.revisionRecommendations.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            Action items before you apply
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-foreground">
            {panel.revisionRecommendations.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-700 dark:text-amber-300" aria-hidden="true">
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {onAddMetrics ? (
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={onAddMetrics}
            >
              Add missing metrics and regenerate
            </button>
          ) : null}
        </div>
      ) : null}

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
