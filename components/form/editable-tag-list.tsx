'use client'

import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'

import { EditedFieldBadge } from '@/components/form/edited-field-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isFieldEdited } from '@/lib/form/field-diff'

interface EditableTagListProps {
  label: string
  values: string[]
  baselineValues?: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyMessage?: string
  variant?: 'secondary' | 'outline' | 'default'
}

export function EditableTagList({
  label,
  values,
  baselineValues = values,
  onChange,
  placeholder = 'Add item…',
  emptyMessage = 'No items yet.',
  variant = 'secondary',
}: EditableTagListProps) {
  const [draft, setDraft] = useState('')
  const listEdited = isFieldEdited(values, baselineValues)

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    const exists = values.some((value) => value.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setDraft('')
      return
    }
    onChange([...values, trimmed])
    setDraft('')
  }

  function removeTag(index: number) {
    onChange(values.filter((_, itemIndex) => itemIndex !== index))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag(draft)
    }
  }

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-3 transition-colors',
        listEdited
          ? 'border-amber-300/70 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-950/20'
          : 'border-border/70 bg-background/80'
      )}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {listEdited ? <EditedFieldBadge /> : null}
      </div>

      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value, index) => {
            const itemEdited = isFieldEdited(value, baselineValues[index] ?? '')
            return (
              <Badge
                key={`${value}-${index}`}
                variant={variant}
                className={cn(
                  'gap-1 pr-1',
                  itemEdited && 'ring-1 ring-amber-400/70'
                )}
              >
                {value}
                {itemEdited && baselineValues[index] ? (
                  <span className="text-[10px] opacity-70">was: {baselineValues[index]}</span>
                ) : null}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-background/20"
                  aria-label={`Remove ${value}`}
                  onClick={() => removeTag(index)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-9"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => addTag(draft)}
          disabled={!draft.trim()}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
