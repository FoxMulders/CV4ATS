import type { KeywordReport } from '@/lib/ai/schemas'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'

/** Caps keyword-only ATS when the hiring panel scores lower. */
export function applyPanelReadinessToKeywordReport(
  report: KeywordReport,
  panel: HiringPanelSessionResult | null | undefined,
  rawKeywordScore: number
): KeywordReport {
  if (!panel || panel.reviewFailed || panel.unanimousApproval) {
    return report
  }

  const cappedScore = Math.min(report.matchScore, panel.aggregateScore)
  if (cappedScore >= report.matchScore) {
    return report
  }

  return {
    ...report,
    matchScore: cappedScore,
    suggestions: [
      `Keyword-only ATS was ${rawKeywordScore}%, but the hiring panel scored this package ${panel.aggregateScore}%. Fix the issues below — keyword density alone does not mean interview-ready.`,
      ...report.suggestions,
    ].slice(0, 6),
  }
}
