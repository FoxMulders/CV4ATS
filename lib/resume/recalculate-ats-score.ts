import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import {
  computeIntersectionMatchScore,
  targetSkillsFromPreScan,
} from '@/lib/resume/intersection-ats-score'
import type { TargetSkill } from '@/lib/resume/skill-extrapolation'

export interface RecalculateAtsScoreInput {
  resume: TailoredResume
  jobDescription: string
  targetSkills?: string[] | TargetSkill[]
  /** @deprecated Baseline floor is not applied during intersection recalculation. */
  sourceResumeText?: string
  /** @deprecated Baseline floor is not applied during intersection recalculation. */
  baselineScore?: number
  /** @deprecated Phase is not used by intersection recalculation. */
  phase?: 'baseline' | 'tailored'
}

/**
 * Re-run strict target-skill intersection scoring against the static job description.
 * Score = (matched target skills / total target skills) * 100
 */
export function recalculateAtsScore(input: RecalculateAtsScoreInput): KeywordReport {
  const jobDescription = input.jobDescription.trim()
  const targetSkills =
    input.targetSkills && input.targetSkills.length > 0
      ? input.targetSkills
      : targetSkillsFromPreScan(null, jobDescription)

  if (!jobDescription || targetSkills.length === 0) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ['Add a job description with detectable target skills to calculate ATS alignment.'],
    }
  }

  return computeIntersectionMatchScore({
    resume: input.resume,
    jobDescription,
    targetSkills,
  })
}

export function recalculateAtsScoreFromText(
  resume: TailoredResume,
  jobDescription: string,
  options: Omit<RecalculateAtsScoreInput, 'resume' | 'jobDescription'> = {}
): KeywordReport {
  return recalculateAtsScore({
    resume,
    jobDescription,
    ...options,
  })
}
