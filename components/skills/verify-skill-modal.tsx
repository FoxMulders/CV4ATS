'use client'

import { Loader2, ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'

import type { VerifySkillResult } from '@/lib/ai/verify-skill-schemas'
import { MAX_SKILL_EXPLANATION_LENGTH } from '@/lib/ai/verify-skill-schemas'
import { requestVerifySkill } from '@/lib/api/verify-skill-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface VerifySkillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillName: string
  originalBullet: string
  onVerified?: (result: VerifySkillResult) => void
}

export function VerifySkillModal({
  open,
  onOpenChange,
  skillName,
  originalBullet,
  onVerified,
}: VerifySkillModalProps) {
  const titleId = useId()
  const [explanation, setExplanation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<VerifySkillResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setExplanation('')
      setResult(null)
      setError(null)
      setIsSubmitting(false)
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    const trimmed = explanation.trim()
    if (trimmed.length < 10) {
      setError('Provide at least 10 characters describing your project experience.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const verification = await requestVerifySkill({
        skillName,
        originalBullet,
        userExplanation: trimmed,
      })
      setResult(verification)
      if (verification.status === 'Pass') {
        onVerified?.(verification)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Verification failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-xl font-semibold leading-tight">
              Verify Your Experience: {skillName}
            </h2>
            <p className="mt-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              {originalBullet}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            ⚠️ Privacy Notice: Do not include confidential company data, proprietary code, API keys,
            or sensitive financial metrics.
          </p>

          <div className="space-y-1.5">
            <Textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value.slice(0, MAX_SKILL_EXPLANATION_LENGTH))}
              rows={4}
              maxLength={MAX_SKILL_EXPLANATION_LENGTH}
              disabled={isSubmitting}
              placeholder="Briefly describe the specific project where you used this skill and the outcome..."
              className="text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">
              {explanation.length}/{MAX_SKILL_EXPLANATION_LENGTH}
            </p>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {result ? (
            <div
              className={cn(
                'space-y-2 rounded-md border px-3 py-3 text-sm',
                result.status === 'Pass'
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100'
                  : 'border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100'
              )}
            >
              <p className="font-semibold">{result.status === 'Pass' ? 'Pass' : 'Fail'}</p>
              <p className="leading-relaxed">{result.feedback}</p>
              {result.status === 'Pass' && result.revisedBullet ? (
                <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Revised bullet
                  </p>
                  <p className="leading-relaxed text-foreground">{result.revisedBullet}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting || explanation.trim().length < 10}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for Verification'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
