import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { injectMissingSkills, type SkillInjectionResult } from '@/lib/resume/skill-injection'

/** Force-inject user-selected missing keywords into resume bullets before scoring. */
export function injectSelectedKeywords(
  resumeText: string,
  keywords: string[]
): SkillInjectionResult {
  if (keywords.length === 0) {
    return { text: resumeText, injectedSkills: [], modifiedBulletCount: 0 }
  }

  return injectMissingSkills(resumeText, keywordsToTargetSkills(keywords))
}
