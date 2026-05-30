'use client'

import { HelpCircle, Loader2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PanelExperienceQuestion } from '@/lib/resume/panel-experience-gaps'

const MAX_ANSWER_LENGTH = 300

export interface PanelExperienceIntakeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: PanelExperienceQuestion[]
  onSubmit: (answers: Record<string, string>) => void
  isSubmitting?: boolean
}

export function PanelExperienceIntakeModal({
  open,
  onOpenChange,
  questions,
  onSubmit,
  isSubmitting = false,
}: PanelExperienceIntakeModalProps) {
  const titleId = useId()
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) setAnswers({})
  }, [open])

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? '').trim().length >= 10).length,
    [answers, questions]
  )

  if (!open || questions.length === 0) return null

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
            <HelpCircle className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-xl font-semibold leading-tight">
              Verify experience the panel couldn&apos;t find
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Managers flagged gaps between your skills list and work history. The AI cannot invent
              Jenkins, CI/CD, or other tools — confirm your real experience here and we will rewrite
              the resume and cover letter with that evidence.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.id}
              className="space-y-2 rounded-lg border border-amber-300/50 bg-amber-50/30 p-3 dark:border-amber-500/30 dark:bg-amber-500/5"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                  {question.skillOrTool} · {question.panelSource}
                </p>
                <p className="mt-1 text-sm italic text-muted-foreground">
                  &ldquo;{question.panelExcerpt}&rdquo;
                </p>
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
                  rows={3}
                  maxLength={MAX_ANSWER_LENGTH}
                  disabled={isSubmitting}
                  placeholder="e.g., At AMA I maintained Jenkins multibranch pipelines for .NET services — automated build, test, and deploy to AWS, cutting release validation from 3 hours to 20 minutes."
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
            onClick={() => onSubmit(answers)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Updating draft…
              </>
            ) : (
              `Apply ${answeredCount} verified experience${answeredCount === 1 ? '' : 's'}`
            )}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
