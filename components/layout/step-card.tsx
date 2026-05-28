import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StepCardProps {
  step: number
  title: string
  description: string
  children: ReactNode
  className?: string
  id?: string
  /** Stretch card to fill grid row height (symmetric workspace columns). */
  fillHeight?: boolean
}

export function StepCard({
  step,
  title,
  description,
  children,
  className,
  id,
  fillHeight = false,
}: StepCardProps) {
  return (
    <Card
      id={id}
      className={cn(
        'border-border/80 shadow-sm transition-shadow hover:shadow-md',
        fillHeight && 'flex h-full flex-col',
        className
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {step}
          </span>
          <div className="space-y-1">
            <CardTitle className="font-heading text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(fillHeight && 'flex min-h-0 flex-1 flex-col')}>
        {children}
      </CardContent>
    </Card>
  )
}
