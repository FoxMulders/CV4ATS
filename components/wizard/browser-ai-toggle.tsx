'use client'

import { Cpu, ExternalLink, RefreshCw } from 'lucide-react'

import type { BrowserAiStatus } from '@/lib/ai/browser/chrome-language-model'
import { CHROME_NANO_SETUP_STEPS } from '@/lib/ai/browser/chrome-setup'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BrowserAiToggleProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  status: BrowserAiStatus | null
  onRefreshStatus?: () => void
  className?: string
}

function ChromeNanoSetupSteps() {
  return (
    <ol className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">One-time Chrome setup (sites cannot enable flags for you)</p>
      {CHROME_NANO_SETUP_STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{step.title}</p>
            <p className="mt-0.5">{step.detail}</p>
            {'href' in step && step.href ? (
              <a
                href={step.href}
                className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {step.linkLabel}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function BrowserAiToggle({
  enabled,
  onEnabledChange,
  status,
  onRefreshStatus,
  className,
}: BrowserAiToggleProps) {
  const ready = status?.supported === true && status.ready
  const showSetup = enabled && status?.supported === false && status.needsFlagSetup

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
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              Default on
            </span>
            {ready ? (
              <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Nano ready
              </span>
            ) : enabled ? (
              <span className="rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">
                Nano setup needed
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status?.message ??
              'Runs on your device — no server rate limits. On by default; turn off only if you need the 10-manager hiring panel.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshStatus ? (
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={onRefreshStatus}>
              <RefreshCw className="size-3.5" />
              <span className="sr-only">Refresh Nano status</span>
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

      {showSetup ? <ChromeNanoSetupSteps /> : null}

      {enabled && status?.supported === true && status.availability === 'downloadable' ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          Click <span className="font-medium text-foreground">Generate tailored resume</span> once to
          start the Gemini Nano download (~1–2 GB). After that, polish runs fully on your device.
        </p>
      ) : null}
    </div>
  )
}
