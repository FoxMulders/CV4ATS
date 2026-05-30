import { COVER_LETTER_BANNED_PHRASES } from '@/lib/ai/prompts'
import { HIRING_PANEL_COVER_LETTER_BANNED } from '@/lib/ai/hiring-panel-prompts'

export interface CoverLetterViolation {
  type: 'banned-phrase' | 'missing-metrics'
  detail: string
}

const ALL_BANNED_PHRASES = [...COVER_LETTER_BANNED_PHRASES, ...HIRING_PANEL_COVER_LETTER_BANNED]

/** Detects numbers, percentages, currency, and scale indicators in prose. */
export const QUANTIFIED_METRIC_PATTERN =
  /\b\d[\d,]*(?:\.\d+)?(?:%|\+|\s*(?:hours?|hrs|days?|weeks?|months?|years?|users?|teams?|people|projects?|releases?|tickets?|systems?|applications?|pipelines?))|\$\d[\d,]*|\d+\s*(?:million|billion|m\b|k\b)|\d+x\b/i

export function findCoverLetterBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase()
  return ALL_BANNED_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()))
}

export function coverLetterHasQuantifiedMetrics(text: string): boolean {
  const paragraphs = text.split(/\n\n+/).filter((block) => block.trim().length > 40)
  const body = paragraphs.length > 2 ? paragraphs.slice(1, -1).join('\n\n') : paragraphs.join('\n\n')
  return QUANTIFIED_METRIC_PATTERN.test(body)
}

export function auditCoverLetterCompliance(text: string): CoverLetterViolation[] {
  const violations: CoverLetterViolation[] = []

  for (const phrase of findCoverLetterBannedPhrases(text)) {
    violations.push({ type: 'banned-phrase', detail: phrase })
  }

  if (!coverLetterHasQuantifiedMetrics(text)) {
    violations.push({
      type: 'missing-metrics',
      detail: 'Cover letter body lacks quantified proof points.',
    })
  }

  return violations
}
