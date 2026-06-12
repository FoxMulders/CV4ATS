'use client'

import { CloudCog } from 'lucide-react'
import { useId } from 'react'

import type { SkillWeavingStrategy } from '@/lib/resume/proprietary-skill-weaving'
import { Button } from '@/components/ui/button'

export interface ProprietarySkillWeavingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillName: string
  onChoose: (strategy: SkillWeavingStrategy) => void
}

export function ProprietarySkillWeavingModal({
  open,
  onOpenChange,
  skillName,
  onChoose,
}: ProprietarySkillWeavingModalProps) {
  const titleId = useId()

  if (!open) return null

  function handleChoose(strategy: SkillWeavingStrategy) {
    onChoose(strategy)
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
            <CloudCog className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-lg font-semibold leading-tight">
              How should we weave &ldquo;{skillName}&rdquo;?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Do you have cross-functional exposure to this platform, or would you prefer to
              emphasize your foundational cloud infrastructure skills instead?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" className="justify-start text-left" onClick={() => handleChoose('platform-exposure')}>
            I have cross-functional exposure to {skillName}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start text-left"
            onClick={() => handleChoose('foundational-pivot')}
          >
            Emphasize AWS, Azure, and custom automation platform skills instead
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
