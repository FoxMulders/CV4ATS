import type { KeywordReport } from '@/lib/ai/schemas'
import type { ScorePassEvent } from '@/lib/api/progress-stream'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

export const TARGET_ATS_SCORE = 85
export const MAX_GENERATION_PASSES = 3
export const EDGE_MAX_GENERATION_PASSES = 1

export function getMaxGenerationPasses(): number {
  return process.env.NEXT_RUNTIME === 'edge' ? EDGE_MAX_GENERATION_PASSES : MAX_GENERATION_PASSES
}

export function formatScorePassLine(event: ScorePassEvent): string {
  const delta = event.scoreAfter - event.scoreBefore
  const deltaText = delta >= 0 ? `+${delta}` : `${delta}`
  const injected =
    event.injectedCount && event.injectedCount > 0
      ? ` · ${event.injectedCount} keyword${event.injectedCount === 1 ? '' : 's'} woven in`
      : ''

  return `${event.phase}: ${event.scoreBefore}% → ${event.scoreAfter}% (${deltaText} pts)${injected}`
}

export function sanitizeKeywordReport(report: KeywordReport): KeywordReport {
  const matchedKeywords = sanitizeKeywordList(report.matchedKeywords)
  const missingKeywords = sanitizeKeywordList(report.missingKeywords)

  return {
    ...report,
    matchedKeywords,
    missingKeywords,
    suggestions: report.suggestions.filter((suggestion) => {
      const lower = suggestion.toLowerCase()
      return !lower.includes('interview') && !lower.includes('apply online')
    }),
  }
}

export function refinementProgressLabel(pass: number, score: number): string {
  return `Refining resume (pass ${pass}) — currently ${score}%…`
}
