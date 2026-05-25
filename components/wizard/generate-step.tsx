'use client'

import { Loader2, Sparkles } from 'lucide-react'

import type { TailoredResume } from '@/lib/ai/schemas'
import { Button } from '@/components/ui/button'
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
}: GenerateStepProps) {
  return (
    <div className="space-y-4">
      <Button
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
          {streamingResume ? <StreamingResumePreview resume={streamingResume} /> : null}
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
