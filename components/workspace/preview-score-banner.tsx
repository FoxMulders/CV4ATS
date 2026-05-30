'use client'

import { TrendingUp } from 'lucide-react'

import { DownloadActions } from '@/components/results/download-actions'
import { AnimatedAtsScoreGauge } from '@/components/results/animated-ats-score-gauge'
import { BaselineVarianceBadge } from '@/components/results/baseline-variance-badge'
import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { cn } from '@/lib/utils'

interface PreviewScoreBannerProps {
  before?: KeywordReport | null
  after?: KeywordReport | null
  tailoredBaselineScore?: number
  isAfterUpdating?: boolean
  hiringPanel?: HiringPanelSessionResult | null
  rawKeywordScore?: number | null
  resume?: TailoredResume | null
  coverLetter?: string
  premiumAccessToken?: string | null
  jobDescriptionHash?: string
  isPremiumUnlocked?: boolean
  passExpiryLabel?: string | null
  onCheckoutRequest?: () => void
  className?: string
}

export function PreviewScoreBanner({
  before,
  after,
  tailoredBaselineScore,
  isAfterUpdating = false,
  hiringPanel,
  rawKeywordScore,
  resume,
  coverLetter = '',
  premiumAccessToken,
  jobDescriptionHash,
  isPremiumUnlocked = true,
  passExpiryLabel,
  onCheckoutRequest,
  className,
}: PreviewScoreBannerProps) {
  const hasScore = Boolean(after)
  const lift =
    before && after ? after.matchScore - before.matchScore : after ? after.matchScore : 0
  const liveBaseline = tailoredBaselineScore ?? before?.matchScore ?? after?.matchScore
  const showPanelScore =
    hiringPanel && !hiringPanel.reviewFailed && hiringPanel.managers.length > 0
  const keywordOnlyHigher =
    showPanelScore &&
    rawKeywordScore != null &&
    rawKeywordScore > after!.matchScore + 5 &&
    !hiringPanel!.unanimousApproval

  return (
    <div
      className={cn(
        'shrink-0 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90',
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {hasScore && after ? (
            <>
              <AnimatedAtsScoreGauge
                score={after.matchScore}
                label={showPanelScore && !hiringPanel!.unanimousApproval ? 'Readiness' : 'ATS match'}
                size="compact"
                isUpdating={isAfterUpdating}
                baselineScore={liveBaseline}
              />
              {showPanelScore ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">Panel </span>
                  <span className="font-semibold tabular-nums">{hiringPanel!.aggregateScore}%</span>
                  {keywordOnlyHigher ? (
                    <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                      (keywords alone: {rawKeywordScore}%)
                    </span>
                  ) : null}
                </div>
              ) : null}
              {before ? (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="size-4 text-brand-gold" aria-hidden="true" />
                  <span className="text-muted-foreground">Tailoring lift</span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      lift >= 0 ? 'text-emerald-600' : 'text-destructive'
                    )}
                  >
                    {lift >= 0 ? '+' : ''}
                    {lift}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({before.matchScore}% → {after.matchScore}%)
                  </span>
                </div>
              ) : null}
              {liveBaseline != null && after ? (
                <BaselineVarianceBadge
                  currentScore={after.matchScore}
                  baselineScore={liveBaseline}
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              ATS match score appears here after generation.
            </p>
          )}
        </div>

        {resume ? (
          <DownloadActions
            variant="banner"
            resume={resume}
            coverLetter={coverLetter}
            premiumAccessToken={premiumAccessToken}
            jobDescriptionHash={jobDescriptionHash}
            isPremiumUnlocked={isPremiumUnlocked}
            passExpiryLabel={passExpiryLabel}
            onCheckoutRequest={onCheckoutRequest}
          />
        ) : null}
      </div>
    </div>
  )
}
