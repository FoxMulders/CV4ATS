'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MAX_COVER_LETTER_CONTEXT_LENGTH } from '@/lib/ai/schemas'
import {
  WORKSPACE_COUNTER_AT_LIMIT_CLASS,
  WORKSPACE_COUNTER_CLASS,
  WORKSPACE_TEXTAREA_CLASS,
} from '@/lib/wizard/workspace-panel-styles'
import { cn } from '@/lib/utils'

interface CoverLetterContextFieldProps {
  value: string
  onChange: (value: string) => void
  fieldId?: string
}

export function CoverLetterContextField({
  value,
  onChange,
  fieldId = 'cover-letter-context',
}: CoverLetterContextFieldProps) {
  const atLimit = value.length >= MAX_COVER_LETTER_CONTEXT_LENGTH

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>Cover letter context</Label>
      <Textarea
        id={fieldId}
        placeholder="Optional: why this role, relocation, referral, side project to emphasize, tone preferences…"
        value={value}
        onChange={(event) =>
          onChange(event.target.value.slice(0, MAX_COVER_LETTER_CONTEXT_LENGTH))
        }
        rows={4}
        className={cn(WORKSPACE_TEXTAREA_CLASS, 'min-h-[120px] resize-y')}
      />
      <p className={atLimit ? WORKSPACE_COUNTER_AT_LIMIT_CLASS : WORKSPACE_COUNTER_CLASS}>
        {value.length.toLocaleString()} / {MAX_COVER_LETTER_CONTEXT_LENGTH.toLocaleString()}{' '}
        characters
        {atLimit ? ' · Character limit reached' : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        Ground truth for the AI only — not pasted into the exported letter. Use for motivations,
        connections, or emphasis the resume alone does not convey.
      </p>
    </div>
  )
}
