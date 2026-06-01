'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { useSystemDebugLogOptional } from '@/components/debug/system-debug-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SystemDebugConsoleProps = {
  variant?: 'footer' | 'dock'
}

export function SystemDebugConsole({ variant = 'footer' }: SystemDebugConsoleProps) {
  const { logs, appendLog, clearLogs } = useSystemDebugLogOptional()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const logPanelRef = useRef<HTMLPreElement>(null)
  const isDock = variant === 'dock'

  useEffect(() => {
    if (!expanded || !logPanelRef.current) return
    logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight
  }, [expanded, logs])

  const copyLogs = useCallback(async () => {
    if (logs.length === 0) {
      toast.message('No debug logs to copy yet.')
      return
    }

    try {
      await navigator.clipboard.writeText(logs.join('\n'))
      setCopied(true)
      toast.success('Debug logs copied to clipboard')
      appendLog('LOG: User copied debug logs to clipboard')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy debug logs — check browser clipboard permissions.')
    }
  }, [appendLog, logs])

  const logPanel = (
    <pre
      ref={logPanelRef}
      className={cn(
        'system-debug-console__log',
        isDock && 'system-debug-console__log--dock'
      )}
      aria-label="System debug log output"
      aria-live="polite"
    >
      {logs.length > 0 ? logs.join('\n') : 'Waiting for system events…'}
    </pre>
  )

  return (
    <div
      className={cn(
        'system-debug-console',
        isDock ? 'system-debug-console--dock' : 'system-debug-console--footer',
        variant === 'footer' && 'border-t border-border/60 pt-4'
      )}
    >
      {isDock && expanded ? (
        <div
          id="system-debug-console-panel"
          className="system-debug-console__popover"
          role="region"
          aria-label="System debug log stream"
        >
          {logPanel}
        </div>
      ) : null}

      <div className="system-debug-console__bar">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="inline-flex h-full min-w-0 flex-1 items-center gap-2 text-xs font-semibold tracking-wide text-foreground hover:text-brand-gold"
          aria-expanded={expanded}
          aria-controls="system-debug-console-panel"
        >
          <span aria-hidden="true">🛠️</span>
          <span className="truncate">[ System Debug Console ]</span>
          {expanded ? (
            <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{logs.length} entries</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              clearLogs()
              appendLog('LOG: Debug log buffer cleared by user.')
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void copyLogs()}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy Debug Logs
          </Button>
        </div>
      </div>

      {!isDock ? (
        <div
          id="system-debug-console-panel"
          className={cn(
            'system-debug-console__inline-panel',
            expanded ? 'system-debug-console__inline-panel--open' : 'system-debug-console__inline-panel--closed'
          )}
          hidden={!expanded}
          role="region"
          aria-label="System debug log stream"
        >
          {logPanel}
        </div>
      ) : null}
    </div>
  )
}
