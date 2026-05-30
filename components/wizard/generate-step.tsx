'use client'

import { Loader2, Sparkles } from 'lucide-react'

import type { TailoredResume } from '@/lib/ai/schemas'
import type { BrowserAiStatus } from '@/lib/ai/browser/chrome-language-model'
import { Button } from '@/components/ui/button'
import { GENERATE_ACTION_ID } from '@/lib/wizard/workspace-focus-guide'
import { BrowserAiToggle } from '@/components/wizard/browser-ai-toggle'
import { GenerationProgress } from '@/components/wizard/generation-progress'
import { StreamingResumePreview } from '@/components/wizard/streaming-resume-preview'

interface GenerateStepProps {
  onGenerate: () => void
  isLoading: boolean
  loadingStep: number
  loadingLabel?: string | null
  scorePassLines?: string[]
  streamingResume?: TailoredResume | null
  streamingCoverLetter?: string
  disabled: boolean
  /** Hide inline streaming preview (e.g. when preview lives in a split pane). */
  hideStreamingPreview?: boolean
  useBrowserAi?: boolean
  onUseBrowserAiChange?: (enabled: boolean) => void
  browserAiStatus?: BrowserAiStatus | null
  onRefreshBrowserAiStatus?: () => void
}

export function GenerateStep({
  onGenerate,
  isLoading,
  loadingStep,
  loadingLabel,
  scorePassLines,
  streamingResume,
  streamingCoverLetter,
  disabled,
  hideStreamingPreview = false,
  useBrowserAi = false,
  onUseBrowserAiChange,
  browserAiStatus = null,
  onRefreshBrowserAiStatus,
}: GenerateStepProps) {
  return (
    <div className="space-y-4">
      {onUseBrowserAiChange ? (
        <BrowserAiToggle
          enabled={useBrowserAi}
          onEnabledChange={onUseBrowserAiChange}
          status={browserAiStatus}
          onRefreshStatus={onRefreshBrowserAiStatus}
        />
      ) : null}

      <Button
        id={GENERATE_ACTION_ID}
        type="button"
        size="lg"
        className="w-full bg-primary shadow-sm sm:w-auto"
        onClick={onGenerate}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles />
            Generate tailored resume
          </>
        )}
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <GenerationProgress
            loadingStep={loadingStep}
            activeLabel={loadingLabel}
            scorePassLines={scorePassLines}
          />
          {streamingResume && !hideStreamingPreview ? (
            <StreamingResumePreview resume={streamingResume} />
          ) : null}
          {streamingCoverLetter ? (
            <p className="text-xs text-muted-foreground">
              Cover letter streaming… ({streamingCoverLetter.length.toLocaleString()} characters)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
