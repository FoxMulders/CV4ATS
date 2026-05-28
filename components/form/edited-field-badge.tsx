import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EditedFieldBadgeProps {
  className?: string
}

export function EditedFieldBadge({ className }: EditedFieldBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-300/80 bg-amber-50 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200',
        className
      )}
    >
      Edited
    </Badge>
  )
}
