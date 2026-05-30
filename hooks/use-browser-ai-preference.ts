'use client'

import { useCallback, useEffect, useState } from 'react'

import { inspectBrowserAi, type BrowserAiStatus } from '@/lib/ai/browser/chrome-language-model'

const STORAGE_KEY = 'ats4cv-use-browser-ai'

/** Browser AI is on by default — only explicit opt-out (stored "0") turns it off. */
function readBrowserAiPreference(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === '0') return false
    if (stored === '1') return true
    window.localStorage.setItem(STORAGE_KEY, '1')
    return true
  } catch {
    return true
  }
}

export function useBrowserAiPreference() {
  const [useBrowserAi, setUseBrowserAiState] = useState(true)
  const [status, setStatus] = useState<BrowserAiStatus | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setUseBrowserAiState(readBrowserAiPreference())
    setHydrated(true)
    void inspectBrowserAi().then(setStatus)
  }, [])

  const setUseBrowserAi = useCallback((value: boolean) => {
    setUseBrowserAiState(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  const refreshStatus = useCallback(() => {
    void inspectBrowserAi().then(setStatus)
  }, [])

  return {
    useBrowserAi: hydrated ? useBrowserAi : true,
    setUseBrowserAi,
    status,
    refreshStatus,
    hydrated,
  }
}
