'use client'

import { Loader2, Users } from 'lucide-react'

import { HiringPanelProgress } from '@/components/hiring-panel/hiring-panel-progress'
import { HiringPanelResults } from '@/components/hiring-panel/hiring-panel-results'
import { Button } from '@/components/ui/button'
import type { HiringPanelResult } from '@/lib/ai/hiring-panel-schemas'

interface HiringPanelStepProps {
  onRun: () => void
  isLoading: boolean
  loadingStep: number
  loadingLabel?: string | null
  disabled: boolean
  result: HiringPanelResult | null
}

export function HiringPanelStep({
  onRun,
  isLoading,
  loadingStep,
  loadingLabel,
  disabled,
  result,
}: HiringPanelStepProps) {
  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Elite Hiring Manager Panel</p>
        <p className="text-xs text-muted-foreground">
          Simulate 10 senior recruiters critiquing your resume against the job description, then
          receive rewritten bullets and a cover letter hook.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-brand-gold/40 sm:w-auto"
        onClick={onRun}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Running panel…
          </>
        ) : (
          <>
            <Users />
            Run Elite Hiring Manager Panel
          </>
        )}
      </Button>

      {isLoading ? (
        <HiringPanelProgress loadingStep={loadingStep} activeLabel={loadingLabel} />
      ) : null}

      {result && !isLoading ? <HiringPanelResults result={result} /> : null}
    </div>
  )
}
