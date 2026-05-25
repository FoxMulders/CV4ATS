'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Experience } from '@/lib/ai/schemas'
import {
  createEmptyExperience,
  isExperienceComplete,
  normalizeExperience,
  parseBulletsFromText,
} from '@/lib/resume/experience-utils'
import { cn } from '@/lib/utils'

interface AddExperiencePanelProps {
  onAdd: (experience: Experience) => void
  className?: string
  variant?: 'inline' | 'card'
}

export function AddExperiencePanel({
  onAdd,
  className,
  variant = 'card',
}: AddExperiencePanelProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Experience>(createEmptyExperience())
  const [bulletsText, setBulletsText] = useState('')

  function resetForm() {
    setDraft(createEmptyExperience())
    setBulletsText('')
  }

  function handleSubmit() {
    const experience = normalizeExperience({
      ...draft,
      bullets: parseBulletsFromText(bulletsText),
    })

    if (!isExperienceComplete(experience)) {
      toast.error('Fill in title, company, dates, and at least one bullet.')
      return
    }

    onAdd(experience)
    resetForm()
    setOpen(false)
    toast.success(`Added ${experience.title} at ${experience.company}`)
  }

  const form = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="exp-title">Job title</Label>
        <Input
          id="exp-title"
          placeholder="Project Manager"
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-company">Company</Label>
        <Input
          id="exp-company"
          placeholder="Acme Corp"
          value={draft.company}
          onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-location">Location</Label>
        <Input
          id="exp-location"
          placeholder="Edmonton, AB"
          value={draft.location}
          onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-start">Start date</Label>
        <Input
          id="exp-start"
          placeholder="Jan 2022"
          value={draft.startDate}
          onChange={(event) =>
            setDraft((current) => ({ ...current, startDate: event.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp-end">End date</Label>
        <Input
          id="exp-end"
          placeholder="Present"
          value={draft.endDate}
          onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="exp-bullets">Bullet points (one per line)</Label>
        <Textarea
          id="exp-bullets"
          placeholder={'Led cross-functional delivery team\nManaged $2M project budget'}
          value={bulletsText}
          onChange={(event) => setBulletsText(event.target.value)}
          rows={5}
        />
      </div>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="button" onClick={handleSubmit}>
          Save experience
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetForm()
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-3', className)}>
        {!open ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus />
            Add experience
          </Button>
        ) : (
          form
        )}
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border/80 bg-muted/20 p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Add work experience</p>
          <p className="text-sm text-muted-foreground">
            Include a role that is missing from your current resume.
          </p>
        </div>
        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Plus />
            Add experience
          </Button>
        ) : null}
      </div>
      {open ? form : null}
    </div>
  )
}
