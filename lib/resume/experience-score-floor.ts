import { resumeShowsItExperience } from '@/lib/resume/resume-evidence-aliases'

export const BASELINE_EXPERIENCE_FLOOR = 78
export const TAILORED_EXPERIENCE_FLOOR_MIN = 85
export const TAILORED_EXPERIENCE_FLOOR_MAX = 88

const CORE_OPERATIONAL_DOMAINS = ['process', 'software', 'technology'] as const

function normalizeHaystack(resumeText: string): string {
  return resumeText.toLowerCase().replace(/\s+/g, ' ')
}

/** True when resume signals 30+ years in IT and majority core operational domains. */
export function qualifiesForSeniorItExperienceFloor(resumeText: string): boolean {
  const haystack = normalizeHaystack(resumeText)
  if (!haystack.trim()) return false

  const longTenure =
    /\b(?:30|35|40)(?:\+)?\s*(?:years?|yrs?)\b/i.test(haystack) ||
    /\b30\+/i.test(haystack) ||
    (() => {
      const match = haystack.match(/\b(\d{2,})\+?\s*(?:years?|yrs?)\b/i)
      return match ? Number.parseInt(match[1]!, 10) >= 30 : false
    })()

  if (!longTenure || !resumeShowsItExperience(resumeText)) return false

  const domainHits = CORE_OPERATIONAL_DOMAINS.filter((domain) =>
    new RegExp(`\\b${domain}\\b`, 'i').test(haystack)
  ).length

  return domainHits > CORE_OPERATIONAL_DOMAINS.length / 2
}

export function applyExperienceScoreFloor(
  displayScore: number,
  rawScore: number,
  resumeText: string,
  phase: 'baseline' | 'tailored'
): number {
  if (!qualifiesForSeniorItExperienceFloor(resumeText)) {
    return displayScore
  }

  if (phase === 'baseline') {
    return Math.max(displayScore, BASELINE_EXPERIENCE_FLOOR)
  }

  const tailoredFloor =
    rawScore >= 77
      ? TAILORED_EXPERIENCE_FLOOR_MAX
      : rawScore >= 55
        ? TAILORED_EXPERIENCE_FLOOR_MIN +
          ((Math.min(rawScore, 77) - 55) / 22) * (TAILORED_EXPERIENCE_FLOOR_MAX - TAILORED_EXPERIENCE_FLOOR_MIN)
        : TAILORED_EXPERIENCE_FLOOR_MIN

  return Math.max(displayScore, Math.round(tailoredFloor))
}
