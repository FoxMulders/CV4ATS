import { resumeSemanticallyMatchesSkill } from '@/lib/resume/semantic-keyword-match'
import { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'

/**
 * Fixed ATS scoring denominator — every extracted target skill stays in the array
 * even when unmatched or unmapped (contribution 0).
 */
export function getFixedScoringTargetTerms(jobDescription: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []

  for (const skill of extrapolateTargetSkills(jobDescription)) {
    const key = skill.term.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    terms.push(skill.term)
  }

  return terms
}

/** Keywords the ATS scorer evaluates — aligned with target skills panel count. */
export function getScoringKeywordTargets(jobDescription: string, _resumeText = ''): string[] {
  return getFixedScoringTargetTerms(jobDescription)
}

export function resumeMatchesScoringTarget(resumeText: string, term: string): boolean {
  return resumeSemanticallyMatchesSkill(resumeText, term)
}

export function getMissingScoringKeywords(
  resumeText: string,
  jobDescription: string
): string[] {
  return getScoringKeywordTargets(jobDescription, resumeText).filter(
    (term) => !resumeMatchesScoringTarget(resumeText, term)
  )
}
