import type { TailoredResume } from '@/lib/ai/schemas'
import { computeIntersectionMatchScore } from '@/lib/resume/intersection-ats-score'
import type { TargetSkill } from '@/lib/resume/skill-extrapolation'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  injectIntoTailoredResume,
  mergeTargetSkills,
  type TailoredResumeInjectionResult,
} from '@/lib/resume/tailored-resume-injection'
import { normalizeSkillArray } from '@/lib/resume/skill-array-normalize'

export interface ScoringIntegrationResult {
  resume: TailoredResume
  injectedSkills: string[]
  modifiedBulletCount: number
  matchScore: number
  missingKeywords: string[]
}

const MAX_INTEGRATION_ROUNDS = 4

function scoreTailoredResume(
  resume: TailoredResume,
  jobDescription: string,
  targetSkills?: string[] | TargetSkill[]
): KeywordReportSlice {
  const report = computeIntersectionMatchScore({
    resume,
    jobDescription,
    targetSkills,
  })

  return {
    matchScore: report.matchScore,
    missingKeywords: report.missingKeywords,
  }
}

interface KeywordReportSlice {
  matchScore: number
  missingKeywords: string[]
}

/**
 * Iteratively inject ATS scoring keywords until the match score plateaus or all terms are present.
 */
export function integrateScoringKeywordsUntilSaturation(
  resume: TailoredResume,
  jobDescription: string,
  seedSkills: TargetSkill[] = [],
  targetSkills?: string[] | TargetSkill[]
): ScoringIntegrationResult {
  let current = structuredClone(resume)
  const injectedSkills: string[] = []
  let modifiedBulletCount = 0
  let previousScore = -1

  for (let round = 0; round < MAX_INTEGRATION_ROUNDS; round += 1) {
    const { matchScore, missingKeywords: missingTerms } = scoreTailoredResume(
      current,
      jobDescription,
      targetSkills
    )

    if (missingTerms.length === 0 || matchScore === previousScore) {
      return finalize(current, injectedSkills, modifiedBulletCount, jobDescription, targetSkills)
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

  return finalize(current, injectedSkills, modifiedBulletCount, jobDescription, targetSkills)
}

function finalize(
  resume: TailoredResume,
  injectedSkills: string[],
  modifiedBulletCount: number,
  jobDescription: string,
  targetSkills?: string[] | TargetSkill[]
): ScoringIntegrationResult {
  const normalizedResume: TailoredResume = {
    ...resume,
    skills: normalizeSkillArray(resume.skills),
  }
  const { matchScore, missingKeywords } = scoreTailoredResume(
    normalizedResume,
    jobDescription,
    targetSkills
  )

  return {
    resume: normalizedResume,
    injectedSkills: normalizeSkillArray(injectedSkills),
    modifiedBulletCount,
    matchScore,
    missingKeywords,
  }
}

export function applyScoringIntegration(
  resume: TailoredResume,
  jobDescription: string,
  seedSkills: TargetSkill[] = [],
  targetSkills?: string[] | TargetSkill[]
): TailoredResumeInjectionResult & { matchScore: number } {
  const result = integrateScoringKeywordsUntilSaturation(
    resume,
    jobDescription,
    seedSkills,
    targetSkills
  )
  return {
    resume: result.resume,
    injectedSkills: result.injectedSkills,
    modifiedBulletCount: result.modifiedBulletCount,
    matchScore: result.matchScore,
  }
}
