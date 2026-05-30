'use client'

import { useCallback, useEffect, useState } from 'react'

import { inspectBrowserAi, type BrowserAiStatus } from '@/lib/ai/browser/chrome-language-model'

const STORAGE_KEY = 'ats4cv-use-browser-ai'

export function useBrowserAiPreference() {
  const [useBrowserAi, setUseBrowserAiState] = useState(false)
  const [status, setStatus] = useState<BrowserAiStatus | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === '1') setUseBrowserAiState(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
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

  return { useBrowserAi, setUseBrowserAi, status, refreshStatus: () => void inspectBrowserAi().then(setStatus) }
}
