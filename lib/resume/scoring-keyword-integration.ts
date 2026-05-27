import { filterAuditedKeywordTerms } from '@/lib/resume/keyword-audit'
import type { TailoredResume } from '@/lib/ai/schemas'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import { computeWeightedMatchScore } from '@/lib/resume/weighted-ats-scoring'
import {
  getMissingScoringKeywords,
  getScoringKeywordTargets,
} from '@/lib/resume/scoring-keyword-targets'
import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  injectIntoTailoredResume,
  mergeTargetSkills,
  type TailoredResumeInjectionResult,
} from '@/lib/resume/tailored-resume-injection'

export interface ScoringIntegrationResult {
  resume: TailoredResume
  injectedSkills: string[]
  modifiedBulletCount: number
  matchScore: number
  missingKeywords: string[]
}

const MAX_INTEGRATION_ROUNDS = 4

/**
 * Iteratively inject ATS scoring keywords until the match score plateaus or all terms are present.
 */
export function integrateScoringKeywordsUntilSaturation(
  resume: TailoredResume,
  jobDescription: string,
  seedSkills: TargetSkill[] = []
): ScoringIntegrationResult {
  let current = structuredClone(resume)
  const injectedSkills: string[] = []
  let modifiedBulletCount = 0
  let previousScore = -1

  for (let round = 0; round < MAX_INTEGRATION_ROUNDS; round += 1) {
    const serialized = serializeTailoredResume(current)
    const missingTerms = filterAuditedKeywordTerms(
      getMissingScoringKeywords(serialized, jobDescription),
      serialized
    )
    const matchScore = computeMatchScore(serialized, jobDescription)

    if (missingTerms.length === 0 || matchScore === previousScore) {
      return finalize(current, injectedSkills, modifiedBulletCount, jobDescription)
    }

    previousScore = matchScore

    const missingSkills = mergeTargetSkills(
      seedSkills.filter((skill) => missingTerms.includes(skill.term)),
      keywordsToTargetSkills(missingTerms)
    )

    const injection = injectIntoTailoredResume(current, missingSkills)
    current = injection.resume
    injectedSkills.push(...injection.injectedSkills)
    modifiedBulletCount += injection.modifiedBulletCount

    if (injection.injectedSkills.length === 0) {
      break
    }
  }

  return finalize(current, injectedSkills, modifiedBulletCount, jobDescription)
}

function computeMatchScore(resumeText: string, jobDescription: string): number {
  return computeWeightedMatchScore(resumeText, jobDescription).matchScore
}

function finalize(
  resume: TailoredResume,
  injectedSkills: string[],
  modifiedBulletCount: number,
  jobDescription: string
): ScoringIntegrationResult {
  const serialized = serializeTailoredResume(resume)
  const missingKeywords = getMissingScoringKeywords(serialized, jobDescription)

  return {
    resume,
    injectedSkills: [...new Set(injectedSkills)],
    modifiedBulletCount,
    matchScore: computeMatchScore(serialized, jobDescription),
    missingKeywords,
  }
}

export function applyScoringIntegration(
  resume: TailoredResume,
  jobDescription: string,
  seedSkills: TargetSkill[] = []
): TailoredResumeInjectionResult & { matchScore: number } {
  const result = integrateScoringKeywordsUntilSaturation(resume, jobDescription, seedSkills)
  return {
    resume: result.resume,
    injectedSkills: result.injectedSkills,
    modifiedBulletCount: result.modifiedBulletCount,
    matchScore: result.matchScore,
  }
}
