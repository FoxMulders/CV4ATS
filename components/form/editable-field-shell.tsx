'use client'

import type { ReactNode } from 'react'

import { EditedFieldBadge } from '@/components/form/edited-field-badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface EditableFieldShellProps {
  label: string
  htmlFor?: string
  edited?: boolean
  children: ReactNode
  className?: string
}

export function EditableFieldShell({
  label,
  htmlFor,
  edited = false,
  children,
  className,
}: EditableFieldShellProps) {
  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border px-3 py-2 transition-colors',
        edited
          ? 'border-amber-300/70 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20'
          : 'border-border/70 bg-background/80',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        {edited ? <EditedFieldBadge /> : null}
      </div>
      {children}
    </div>
  )
}
