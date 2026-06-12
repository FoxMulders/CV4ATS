'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { requestRecalculateScore } from '@/lib/api/recalculate-score-client'
import { buildTailoredResumeScoringFingerprint } from '@/lib/resume/intersection-ats-score'
import { recalculateAtsScore } from '@/lib/resume/recalculate-ats-score'

const DEFAULT_DEBOUNCE_MS = 400

export interface UseAtsScoreRecalculationOptions {
  autoRecalculate?: boolean
  resume: TailoredResume | null
  jobDescription: string
  targetSkills?: string[]
  /** @deprecated Unused by intersection recalculation. */
  sourceResumeText?: string | null
  /** @deprecated Unused by intersection recalculation. */
  baselineScore?: number
  seedScore?: number | null
  debounceMs?: number
  onReportUpdate: (report: KeywordReport) => void
}

export interface AtsScoreRecalculationState {
  recalculateNow: (resumeOverride?: TailoredResume) => void
  invalidateScoreCache: () => void
  isRecalculating: boolean
  isStale: boolean
  lastRecalculatedAt: number | null
  lastScoreDelta: number | null
}

function buildRecalculationFingerprint(
  resume: TailoredResume,
  targetSkillsFingerprint: string
): string {
  return `${buildTailoredResumeScoringFingerprint(resume)}\x00${targetSkillsFingerprint}`
}

export function useAtsScoreRecalculation({
  autoRecalculate = true,
  resume,
  jobDescription,
  targetSkills = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onReportUpdate,
  seedScore = null,
}: UseAtsScoreRecalculationOptions): AtsScoreRecalculationState {
  const [isFetching, setIsFetching] = useState(false)
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<number | null>(null)
  const [lastScoreDelta, setLastScoreDelta] = useState<number | null>(null)
  const [lastRecalculatedFingerprint, setLastRecalculatedFingerprint] = useState('')
  const lastReportScoreRef = useRef<number | null>(null)
  const generationSeedRef = useRef<number | null>(null)
  const debounceTimerRef = useRef<number | null>(null)
  const resumeRef = useRef(resume)
  const targetSkillsRef = useRef(targetSkills)

  useEffect(() => {
    resumeRef.current = resume
    targetSkillsRef.current = targetSkills
  }, [resume, targetSkills])

  const scoringSummary = resume?.summary ?? ''
  const scoringSkillsKey = useMemo(
    () => JSON.stringify(resume?.skills ?? []),
    [resume?.skills]
  )
  const scoringBulletsKey = useMemo(
    () =>
      JSON.stringify(resume?.experience.map((role) => role.bullets) ?? []),
    [resume?.experience]
  )

  const scoringContentFingerprint = useMemo(
    () => (resume ? buildTailoredResumeScoringFingerprint(resume) : ''),
    [resume, scoringSummary, scoringSkillsKey, scoringBulletsKey]
  )

  const targetSkillsFingerprint = useMemo(
    () => targetSkills.map((skill) => skill.trim().toLowerCase()).join('|'),
    [targetSkills]
  )

  const recalculationDepsFingerprint = useMemo(
    () =>
      resume
        ? buildRecalculationFingerprint(resume, targetSkillsFingerprint)
        : '',
    [resume, scoringContentFingerprint, targetSkillsFingerprint]
  )

  useEffect(() => {
    if (seedScore == null || !resume) return
    if (generationSeedRef.current === seedScore) return

    generationSeedRef.current = seedScore
    lastReportScoreRef.current = seedScore
    setLastScoreDelta(null)
    setLastRecalculatedFingerprint(
      buildRecalculationFingerprint(resume, targetSkillsFingerprint)
    )
  }, [seedScore, resume, targetSkillsFingerprint])

  const canRecalculate = Boolean(autoRecalculate && resume && jobDescription.trim())
  const isStale =
    canRecalculate && recalculationDepsFingerprint !== lastRecalculatedFingerprint

  const runRecalculation = useCallback(
    async (resumeOverride?: TailoredResume) => {
      const activeResume = resumeOverride ?? resumeRef.current
      const activeTargetSkills = targetSkillsRef.current
      const activeJobDescription = jobDescription.trim()
      const activeTargetSkillsFingerprint = activeTargetSkills
        .map((skill) => skill.trim().toLowerCase())
        .join('|')

      if (!activeResume || !activeJobDescription) return

      setIsFetching(true)

      try {
        let nextReport: KeywordReport

        try {
          nextReport = await requestRecalculateScore({
            resume: activeResume,
            jobDescription: activeJobDescription,
            targetSkills: activeTargetSkills.length > 0 ? activeTargetSkills : undefined,
          })
        } catch {
          nextReport = recalculateAtsScore({
            resume: activeResume,
            jobDescription: activeJobDescription,
            targetSkills: activeTargetSkills,
          })
        }

        const previousScore = lastReportScoreRef.current
        if (previousScore != null) {
          setLastScoreDelta(nextReport.matchScore - previousScore)
        } else {
          setLastScoreDelta(null)
        }

        lastReportScoreRef.current = nextReport.matchScore
        onReportUpdate(nextReport)
        setLastRecalculatedAt(Date.now())
        setLastRecalculatedFingerprint(
          buildRecalculationFingerprint(activeResume, activeTargetSkillsFingerprint)
        )
      } finally {
        setIsFetching(false)
      }
    },
    [jobDescription, onReportUpdate]
  )

  const invalidateScoreCache = useCallback(() => {
    setLastRecalculatedFingerprint('')
  }, [])

  const recalculateNow = useCallback(
    (resumeOverride?: TailoredResume) => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      void runRecalculation(resumeOverride)
    },
    [runRecalculation]
  )

  useEffect(() => {
    if (!canRecalculate) return

    if (recalculationDepsFingerprint === lastRecalculatedFingerprint) return

    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null

      void (async () => {
        await runRecalculation()
      })()
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [
    canRecalculate,
    recalculationDepsFingerprint,
    lastRecalculatedFingerprint,
    debounceMs,
    runRecalculation,
  ])

  return {
    recalculateNow,
    invalidateScoreCache,
    isRecalculating: canRecalculate && (isFetching || isStale),
    isStale,
    lastRecalculatedAt,
    lastScoreDelta,
  }
}
