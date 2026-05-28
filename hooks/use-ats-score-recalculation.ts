'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { recalculateAtsScore } from '@/lib/resume/recalculate-ats-score'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

export interface UseAtsScoreRecalculationOptions {
  autoRecalculate?: boolean
  resume: TailoredResume | null
  jobDescription: string
  sourceResumeText?: string | null
  baselineScore?: number
  seedScore?: number | null
  debounceMs?: number
  onReportUpdate: (report: KeywordReport) => void
}

export interface AtsScoreRecalculationState {
  recalculateNow: () => void
  isRecalculating: boolean
  isStale: boolean
  lastRecalculatedAt: number | null
  lastScoreDelta: number | null
}

export function useAtsScoreRecalculation({
  autoRecalculate = true,
  resume,
  jobDescription,
  sourceResumeText,
  baselineScore,
  seedScore = null,
  debounceMs = 900,
  onReportUpdate,
}: UseAtsScoreRecalculationOptions): AtsScoreRecalculationState {
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<number | null>(null)
  const [lastScoreDelta, setLastScoreDelta] = useState<number | null>(null)
  const lastReportScoreRef = useRef<number | null>(null)
  const debounceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (seedScore != null) {
      lastReportScoreRef.current = seedScore
      setLastScoreDelta(null)
    }
  }, [seedScore])

  const resumeFingerprint = useMemo(
    () => (resume ? serializeTailoredResume(resume) : ''),
    [resume]
  )

  const runRecalculation = useCallback(() => {
    if (!resume || !jobDescription.trim()) return

    setIsRecalculating(true)
    setIsStale(false)

    try {
      const nextReport = recalculateAtsScore({
        resume,
        jobDescription,
        sourceResumeText: sourceResumeText?.trim() || undefined,
        baselineScore,
        phase: 'tailored',
      })

      const previousScore = lastReportScoreRef.current
      if (previousScore != null) {
        setLastScoreDelta(nextReport.matchScore - previousScore)
      } else {
        setLastScoreDelta(null)
      }

      lastReportScoreRef.current = nextReport.matchScore
      onReportUpdate(nextReport)
      setLastRecalculatedAt(Date.now())
    } finally {
      setIsRecalculating(false)
    }
  }, [resume, jobDescription, sourceResumeText, baselineScore, onReportUpdate])

  const recalculateNow = useCallback(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    runRecalculation()
  }, [runRecalculation])

  useEffect(() => {
    if (!autoRecalculate || !resume || !jobDescription.trim()) {
      setIsStale(false)
      return
    }

    setIsStale(true)

    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      runRecalculation()
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [autoRecalculate, resumeFingerprint, jobDescription, debounceMs, runRecalculation, resume])

  return {
    recalculateNow,
    isRecalculating,
    isStale,
    lastRecalculatedAt,
    lastScoreDelta,
  }
}
