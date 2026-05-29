'use client'

import { HIRING_PANEL_PROGRESS_LABELS } from '@/lib/api/hiring-panel-progress-labels'

interface HiringPanelProgressProps {
  loadingStep: number
  activeLabel?: string | null
}

export function HiringPanelProgress({ loadingStep, activeLabel }: HiringPanelProgressProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
        Elite Hiring Manager Panel
      </p>
      {HIRING_PANEL_PROGRESS_LABELS.map((step, index) => {
        const label =
          index === loadingStep && activeLabel?.trim() ? activeLabel : step
        const isDone = index < loadingStep
        const isActive = index === loadingStep

        return (
          <p
            key={step}
            className={
              isDone || isActive ? 'text-xs text-foreground' : 'text-xs text-muted-foreground'
            }
          >
            {isDone ? '✓' : isActive ? '→' : '○'} {label}
          </p>
        )
      })}
    </div>
  )
}
