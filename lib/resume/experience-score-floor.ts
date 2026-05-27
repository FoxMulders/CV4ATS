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

export function computeTailoredExperienceFloor(rawScore: number): number {
  if (rawScore >= 77) return TAILORED_EXPERIENCE_FLOOR_MAX
  if (rawScore >= 55) {
    return Math.round(
      TAILORED_EXPERIENCE_FLOOR_MIN +
        ((Math.min(rawScore, 77) - 55) / 22) * (TAILORED_EXPERIENCE_FLOOR_MAX - TAILORED_EXPERIENCE_FLOOR_MIN)
    )
  }
  return TAILORED_EXPERIENCE_FLOOR_MIN
}

export function applyExperienceScoreFloor(
  displayScore: number,
  rawScore: number,
  resumeText: string,
  phase: 'baseline' | 'tailored',
  options: { sourceResumeText?: string; baselineScore?: number } = {}
): number {
  const qualificationText = options.sourceResumeText?.trim() || resumeText
  if (!qualifiesForSeniorItExperienceFloor(qualificationText)) {
    return displayScore
  }

  if (phase === 'baseline') {
    return Math.max(displayScore, BASELINE_EXPERIENCE_FLOOR)
  }

  const tailoredFloor = computeTailoredExperienceFloor(rawScore)
  const baselineFloor = options.baselineScore ?? BASELINE_EXPERIENCE_FLOOR

  return Math.max(displayScore, tailoredFloor, baselineFloor)
}
