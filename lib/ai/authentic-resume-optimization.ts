import type { TailoredResume } from '@/lib/ai/schemas'
import { QUANTIFIED_METRIC_PATTERN } from '@/lib/resume/quantified-metrics'
import {
  lockResumeState,
  strictStateToTailoredResume,
} from '@/lib/resume/strict-resume-state'

export { AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE } from '@/lib/ai/authentic-resume-optimization-directive'

export const AUTHENTIC_BANNED_PHRASES = [
  'proven track record',
  'proven track record of',
  'synergy',
  'synergies',
  'spearheaded',
  'dynamically',
  'best-in-class',
  'thought leader',
  'results-driven',
  'dynamic professional',
  'passionate about',
  'hit the ground running',
  'leverage my skills',
  'leveraging',
  'operating at the intersection of',
  'value-added',
  'self-starter',
  'team player',
  'detail-oriented',
] as const

const METRIC_CLAUSE_PATTERN =
  /,?\s*(?:improving|increasing|increasingly|reducing|cutting|boosting|accelerating|lowering|raising|growing|decreasing|enhancing|optimizing|streamlining)[^.]*?\bby\s+\d[\d,.%]*[^.]*/gi

const BY_METRIC_PATTERN = /,?\s*\bby\s+\d[\d,.]*(?:%|\s*(?:hours?|hrs|minutes?|mins|days?|weeks?|months?|years?|x))\b[^.]*/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeMetricToken(value: string): string {
  return value.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

function matchAllPattern(text: string, pattern: RegExp): RegExpMatchArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return [...text.matchAll(new RegExp(pattern.source, flags))]
}

function extractMetricTokens(text: string): string[] {
  const tokens = new Set<string>()

  for (const match of matchAllPattern(text, QUANTIFIED_METRIC_PATTERN)) {
    tokens.add(normalizeMetricToken(match[0]))
  }

  for (const match of text.matchAll(/\b\d[\d,]*(?:\.\d+)?%/g)) {
    tokens.add(normalizeMetricToken(match[0]))
  }

  for (const match of text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g)) {
    tokens.add(normalizeMetricToken(match[0]))
  }

  return [...tokens]
}

function metricIsGrounded(metric: string, groundTruthLower: string): boolean {
  const normalized = normalizeMetricToken(metric)
  if (!normalized) return true
  if (groundTruthLower.includes(normalized)) return true

  const digits = normalized.replace(/[^\d.]/g, '')
  if (digits && groundTruthLower.includes(digits)) return true

  return false
}

export function bulletContainsUngroundedMetric(text: string, groundTruth: string): boolean {
  const groundTruthLower = groundTruth.toLowerCase()
  const metrics = extractMetricTokens(text)
  if (metrics.length === 0) return false
  return metrics.some((metric) => !metricIsGrounded(metric, groundTruthLower))
}

export function stripBannedAuthenticPhrases(text: string): string {
  let result = text
  for (const phrase of AUTHENTIC_BANNED_PHRASES) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi'), '')
  }

  return result
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .trim()
}

function finalizeProse(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (trimmed.length > 24 && /[a-z0-9]$/i.test(trimmed) && !/[.!?)"']$/.test(trimmed)) {
    return `${trimmed}.`
  }
  return trimmed
}

export function stripFabricatedMetricClauses(text: string): string {
  let result = text
  result = result.replace(METRIC_CLAUSE_PATTERN, '')
  result = result.replace(BY_METRIC_PATTERN, '')
  result = result.replace(/\s{2,}/g, ' ').trim()
  return finalizeProse(result)
}

function sanitizeProse(
  text: string,
  groundTruth: string,
  originalText?: string
): string {
  let next = stripBannedAuthenticPhrases(text)

  if (bulletContainsUngroundedMetric(next, groundTruth)) {
    if (originalText && !bulletContainsUngroundedMetric(originalText, groundTruth)) {
      next = stripBannedAuthenticPhrases(originalText)
    } else {
      next = stripFabricatedMetricClauses(next)
    }
  }

  return finalizeProse(next)
}

export type AuthenticOptimizationOptions = {
  achievementSupplement?: string
}

/** Strip invented metrics and AI clichés while preserving grounded source facts. */
export function enforceAuthenticResumeOptimization(
  resume: TailoredResume,
  sourceResumeText: string,
  options: AuthenticOptimizationOptions = {}
): TailoredResume {
  const source = sourceResumeText.trim()
  if (!source) return resume

  const groundTruth = [source, options.achievementSupplement?.trim()]
    .filter(Boolean)
    .join('\n\n')

  const locked = strictStateToTailoredResume(lockResumeState(source))

  return {
    ...resume,
    summary: sanitizeProse(resume.summary, groundTruth, locked.summary),
    experience: (resume.experience ?? []).map((entry, index) => {
      const lockedEntry = locked.experience[index]
      return {
        ...entry,
        bullets: (entry.bullets ?? []).map((bullet, bulletIndex) =>
          sanitizeProse(bullet, groundTruth, lockedEntry?.bullets[bulletIndex])
        ),
      }
    }),
    projects: (resume.projects ?? []).map((entry, index) => {
      const lockedEntry = locked.projects?.[index]
      return {
        ...entry,
        bullets: (entry.bullets ?? []).map((bullet, bulletIndex) =>
          sanitizeProse(bullet, groundTruth, lockedEntry?.bullets[bulletIndex])
        ),
      }
    }),
  }
}
