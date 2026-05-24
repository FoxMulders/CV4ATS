'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

const LOADING_STEPS = [
  'Analyzing job description…',
  'Tailoring resume…',
  'Building keyword report…',
  'Drafting cover letter…',
]

interface GenerateStepProps {
  onGenerate: () => void
  isLoading: boolean
  loadingStep: number
  disabled: boolean
}

export function GenerateStep({
  onGenerate,
  isLoading,
  loadingStep,
  disabled,
}: GenerateStepProps) {
  return (
    <div className="space-y-4">
      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
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
        <div className="space-y-2">
          {LOADING_STEPS.map((step, index) => (
            <p
              key={step}
              className={
                index <= loadingStep
                  ? 'text-sm text-foreground'
                  : 'text-sm text-muted-foreground'
              }
            >
              {index < loadingStep ? '✓' : index === loadingStep ? '→' : '○'} {step}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { LOADING_STEPS }
