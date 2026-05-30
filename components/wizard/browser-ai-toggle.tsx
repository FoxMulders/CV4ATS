'use client'

import { Cpu, RefreshCw } from 'lucide-react'

import type { BrowserAiStatus } from '@/lib/ai/browser/chrome-language-model'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BrowserAiToggleProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  status: BrowserAiStatus | null
  onRefreshStatus?: () => void
  className?: string
}

export function BrowserAiToggle({
  enabled,
  onEnabledChange,
  status,
  onRefreshStatus,
  className,
}: BrowserAiToggleProps) {
  const ready = status?.supported === true && status.ready

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-3 text-sm',
        enabled
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-border/70 bg-muted/20',
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Cpu className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Free unlimited browser AI</p>
            {ready ? (
              <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Nano ready
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status?.message ??
              'Runs on your device — no server rate limits. Requires Chrome desktop with Gemini Nano enabled.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshStatus ? (
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={onRefreshStatus}>
              <RefreshCw className="size-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={enabled ? 'default' : 'outline'}
            className="h-8"
            onClick={() => onEnabledChange(!enabled)}
          >
            {enabled ? 'On' : 'Off'}
          </Button>
        </div>
      </div>
    </div>
  )
}
