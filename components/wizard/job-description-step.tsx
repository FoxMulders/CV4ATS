'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MAX_JOB_DESCRIPTION_LENGTH } from '@/lib/ai/schemas'

interface JobDescriptionStepProps {
  value: string
  onChange: (value: string) => void
}

export function JobDescriptionStep({ value, onChange }: JobDescriptionStepProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="job-description">Job description</Label>
      <Textarea
        id="job-description"
        placeholder="Paste the full job description here..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        className="min-h-[200px] resize-y"
      />
      <p className="text-xs text-muted-foreground">
        {value.length.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters
      </p>
    </div>
  )
}
