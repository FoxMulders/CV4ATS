'use client'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { handlePasteScrollToTop } from '@/components/wizard/paste-scroll'
import { MAX_JOB_DESCRIPTION_LENGTH } from '@/lib/ai/schemas'

interface JobDescriptionStepProps {
  value: string
  onChange: (value: string) => void
}

export function JobDescriptionStep({ value, onChange }: JobDescriptionStepProps) {
  const atLimit = value.length >= MAX_JOB_DESCRIPTION_LENGTH

  return (
    <div className="space-y-2">
      <Label htmlFor="job-description">Job description</Label>
      <Textarea
        id="job-description"
        placeholder="Paste the full job description here..."
        value={value}
        onChange={(event) =>
          onChange(event.target.value.slice(0, MAX_JOB_DESCRIPTION_LENGTH))
        }
        onPaste={handlePasteScrollToTop}
        rows={12}
        className="min-h-[200px] resize-y"
      />
      <p
        className={cn(
          'text-xs',
          atLimit ? 'font-medium text-destructive' : 'text-muted-foreground'
        )}
      >
        {value.length.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters
        {atLimit ? ' · Character limit reached' : ''}
      </p>
    </div>
  )
}
