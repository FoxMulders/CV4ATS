'use client'

import { BarChart3, Loader2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AchievementGapQuestion } from '@/lib/resume/achievement-gap'

const MAX_ANSWER_LENGTH = 200

export interface AchievementIntakeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: AchievementGapQuestion[]
  onSubmit: (answers: Record<string, string>) => void
  isSubmitting?: boolean
}

export function AchievementIntakeModal({
  open,
  onOpenChange,
  questions,
  onSubmit,
  isSubmitting = false,
}: AchievementIntakeModalProps) {
  const titleId = useId()
  const [answers, setAnswers] = useState<Record<string, string>>({})

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setAnswers({})
    }
    onOpenChange(nextOpen)
  }

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? '').trim().length >= 8).length,
    [answers, questions]
  )

  if (!open || questions.length === 0) return null

  function handleSubmit() {
    onSubmit(answers)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border/80 bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <BarChart3 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-xl font-semibold leading-tight">
              Add metrics before we write your cover letter
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your resume has accomplishments without numbers. The AI cannot invent metrics — it
              needs your real outcomes to write quantified proof points and avoid generic filler
              that hiring panels reject.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.id}
              className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {question.context}
                </p>
                <p className="mt-1 text-sm text-foreground">{question.bulletPreview}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={question.id} className="text-sm">
                  {question.question}
                </Label>
                <Textarea
                  id={question.id}
                  value={answers[question.id] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: event.target.value.slice(0, MAX_ANSWER_LENGTH),
                    }))
                  }
                  rows={2}
                  maxLength={MAX_ANSWER_LENGTH}
                  disabled={isSubmitting}
                  placeholder="e.g., Cut release validation from 3 hours to 20 minutes; supported 12-person cross-functional squad"
                  className="text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting || answeredCount === 0}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              `Continue with ${answeredCount} metric${answeredCount === 1 ? '' : 's'}`
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
