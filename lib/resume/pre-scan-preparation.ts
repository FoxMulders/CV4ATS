import {
  auditKeywordTerm,
} from '@/lib/resume/keyword-audit'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import {
  buildSuggestedAddition,
  type SuggestedAddition,
} from '@/lib/resume/skill-snippets'
import {
  extrapolateTargetSkills,
  type TargetSkill,
} from '@/lib/resume/skill-extrapolation'
import { injectMissingSkills } from '@/lib/resume/skill-injection'

export type { SuggestedAddition } from '@/lib/resume/skill-snippets'

export interface PreScanResult {
  targetSkills: TargetSkill[]
  matchedSkills: TargetSkill[]
  missingSkills: TargetSkill[]
  suggestedAdditions: SuggestedAddition[]
  preparedResumeText: string
  autoInjectedSkills: string[]
  modifiedBulletCount: number
}

export interface PrepareResumeOptions {
  /** When true, contextually inject missing skills into experience bullets before scoring. */
  autoInject?: boolean
}

/**
 * Skill Extrapolation & Injection pipeline (Steps 1 + 2).
 * Runs before ATS scoring and LLM tailoring.
 */
export function runSkillExtrapolationAndInjection(
  resumeText: string,
  jobDescription: string,
  options: PrepareResumeOptions = {}
): PreScanResult {
  const { autoInject = true } = options

  const targetSkills = extrapolateTargetSkills(jobDescription).filter(
    (skill) => auditKeywordTerm(skill.term, resumeText).status !== 'purged'
  )

  const matchedSkills: TargetSkill[] = []
  const missingSkills: TargetSkill[] = []

  for (const skill of targetSkills) {
    if (keywordMatchesResume(resumeText, skill.term)) {
      matchedSkills.push(skill)
    } else {
      missingSkills.push(skill)
    }
  }

  const usedSnippets: string[] = []
  const suggestedAdditions = missingSkills.map((skill, index) => {
    const addition = buildSuggestedAddition(skill, {
      resumeText,
      jobDescription,
      siblingSnippets: usedSnippets,
      variationIndex: index,
    })
    usedSnippets.push(addition.snippet)
    return addition
  })

  let preparedResumeText = resumeText
  let autoInjectedSkills: string[] = []
  let modifiedBulletCount = 0

  if (autoInject && missingSkills.length > 0) {
    const injection = injectMissingSkills(resumeText, missingSkills)
    preparedResumeText = injection.text
    autoInjectedSkills = injection.injectedSkills
    modifiedBulletCount = injection.modifiedBulletCount
  }

  return {
    targetSkills,
    matchedSkills,
    missingSkills,
    suggestedAdditions,
    preparedResumeText,
    autoInjectedSkills,
    modifiedBulletCount,
  }
}

/** @deprecated Use runSkillExtrapolationAndInjection */
export function prepareResumeForScanning(
  resumeText: string,
  jobDescription: string,
  options: PrepareResumeOptions = {}
): PreScanResult {
  return runSkillExtrapolationAndInjection(resumeText, jobDescription, options)
}

export { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'
export { injectMissingSkills } from '@/lib/resume/skill-injection'
