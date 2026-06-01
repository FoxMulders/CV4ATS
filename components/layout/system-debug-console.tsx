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
  const { logs, appendLog } = useSystemDebugLogOptional()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const logPanelRef = useRef<HTMLPreElement>(null)

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

  return (
    <div className={cn(variant === 'footer' && 'border-t border-border/60 pt-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground hover:text-brand-gold"
          aria-expanded={expanded}
          aria-controls="system-debug-console-panel"
        >
          <span aria-hidden="true">🛠️</span>
          <span>[ System Debug Console ]</span>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{logs.length} entries</span>
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

      <div
        id="system-debug-console-panel"
        className={cn(
          'overflow-hidden transition-[max-height,opacity] duration-200',
          expanded ? 'mt-2 opacity-100' : 'max-h-0 opacity-0'
        )}
        hidden={!expanded}
      >
        <pre
          ref={logPanelRef}
          className="max-h-[min(150px,28vh)] overflow-y-auto rounded-md border border-emerald-900/40 bg-[#1a1a1a] p-3 font-mono text-[11px] leading-relaxed text-[#00ff00] shadow-inner"
          aria-label="System debug log output"
          aria-live="polite"
        >
          {logs.length > 0 ? logs.join('\n') : 'Waiting for system events…'}
        </pre>
      </div>
    </div>
  )
}
