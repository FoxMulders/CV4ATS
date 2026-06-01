'use client'

/**
 * Purpose: Global debug log buffer and append/clear API for QA instrumentation.
 * Upstream dependencies: localStorage (saved resume), window viewport dimensions,
 * Chrome Language Model probe (`inspectBrowserAi`), AI token config from `@/lib/ai/provider`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { inspectBrowserAi } from '@/lib/ai/browser/chrome-language-model'
import { AI_GENERATION_MAX_TOKENS } from '@/lib/ai/provider'
import { describeResumePayloadStats } from '@/lib/debug/resume-payload-stats'
import { loadSavedResume, SAVED_RESUME_STORAGE_KEY } from '@/lib/resume/saved-resume'

export type SystemDebugContextValue = {
  logs: string[]
  appendLog: (message: string) => void
  clearLogs: () => void
}

const SystemDebugContext = createContext<SystemDebugContextValue | null>(null)

function formatLogLine(message: string): string {
  return `[${new Date().toISOString()}] ${message}`
}

export function SystemDebugProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<string[]>([])
  const initializedRef = useRef(false)

  const appendLog = useCallback((message: string) => {
    setLogs((previous) => [...previous, formatLogLine(message)])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    appendLog('LOG: System debug console initialized on page load')
    appendLog(`LOG: Timestamp baseline ${new Date().toISOString()}`)
    appendLog(`LOG: User agent ${navigator.userAgent}`)
    appendLog(`LOG: Viewport ${window.innerWidth}x${window.innerHeight}`)

    try {
      const hasStoredResume = Boolean(window.localStorage.getItem(SAVED_RESUME_STORAGE_KEY)?.trim())
      appendLog(
        `LOG: Local storage state ${hasStoredResume ? 'loaded (saved resume present)' : 'loaded (no saved resume)'}`
      )
    } catch {
      appendLog('LOG: Local storage state unavailable')
    }

    appendLog(`LOG: Server max_output_tokens configured ${AI_GENERATION_MAX_TOKENS}`)

    const savedResume = loadSavedResume()
    if (savedResume.trim()) {
      appendLog(`LOG: ${describeResumePayloadStats(savedResume)}`)
    } else {
      appendLog('LOG: Parsed 0 Work Experience blocks, 0 initial bullets detected (empty resume field)')
    }

    void inspectBrowserAi().then((status) => {
      if (status.supported && status.ready) {
        appendLog('LOG: Gemini Nano: Ready')
      } else if (status.supported) {
        appendLog(`LOG: Gemini Nano: ${status.availability} — ${status.message}`)
      } else {
        appendLog(`LOG: Gemini Nano: Not available — ${status.message}`)
      }
    })
  }, [appendLog])

  const value = useMemo(
    () => ({
      logs,
      appendLog,
      clearLogs,
    }),
    [logs, appendLog, clearLogs]
  )

  return <SystemDebugContext.Provider value={value}>{children}</SystemDebugContext.Provider>
}

export function useSystemDebugLog(): SystemDebugContextValue {
  const context = useContext(SystemDebugContext)
  if (!context) {
    throw new Error('useSystemDebugLog must be used within SystemDebugProvider')
  }
  return context
}

/** Safe hook for components that may render outside the provider (returns no-op). */
export function useSystemDebugLogOptional(): SystemDebugContextValue {
  const context = useContext(SystemDebugContext)
  const noop = useCallback(() => {}, [])

  return useMemo(
    () =>
      context ?? {
        logs: [],
        appendLog: noop,
        clearLogs: noop,
      },
    [context, noop]
  )
}
