'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CoverLetterPreviewProps {
  value: string
  onChange: (value: string) => void
  fieldId?: string
}

export function CoverLetterPreview({ value, onChange, fieldId = 'cover-letter' }: CoverLetterPreviewProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>Cover letter</Label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={18}
        className="min-h-[360px] resize-y font-serif leading-relaxed"
      />
      <p className="text-xs text-muted-foreground">
        Edit the cover letter before downloading if needed.
      </p>
    </div>
  )
}
