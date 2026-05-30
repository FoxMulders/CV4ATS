import type { TailoredResume } from '@/lib/ai/schemas'

import type { ResumeScoringSections } from '@/lib/resume/weighted-ats-scoring'

export const WORK_EXPERIENCE_MISSING_WARNING =
  '⚠️ Critical structural error: Work Experience is missing.'

export const SHORT_RESUME_WARNING =
  '⚠️ Resume content is too short — add work experience bullets before trusting this score.'

export const EMPTY_WORK_EXPERIENCE_SCORE_CAP = 20
export const MIN_RESUME_WORD_COUNT = 150
export const SHORT_RESUME_PENALTY_FACTOR = 0.5
/** Matched keywords must appear in experience bullets for 90%+ scores. */
export const HIGH_SCORE_EXPERIENCE_MATCH_RATIO = 0.55
export const HIGH_SCORE_CEILING_WITHOUT_EXPERIENCE = 89

export function countResumeWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function experienceSectionHasContent(sectionText: string): boolean {
  const trimmed = sectionText.trim()
  if (trimmed.length < 12) return false

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.some(
    (line) =>
      line.length > 8 &&
      (/^[\s•\-*–—]/.test(line) ||
        /\b(19|20)\d{2}\b/.test(line) ||
        / — /.test(line) ||
        /\|/.test(line))
  )
}

/** True when structured experience entries or parsed text contain real work history. */
export function resumeHasWorkExperience(
  structuredResume?: TailoredResume | null,
  sections?: Pick<ResumeScoringSections, 'experience'>,
  resumeText?: string
): boolean {
  if (structuredResume) {
    const entries = structuredResume.experience ?? []
    if (entries.length === 0) return false

    return entries.some(
      (entry) =>
        entry.company?.trim().length > 0 &&
        entry.title?.trim().length > 0 &&
        (entry.bullets ?? []).some((bullet) => bullet.trim().length > 0)
    )
  }

  if (sections && experienceSectionHasContent(sections.experience)) {
    return true
  }

  if (resumeText?.trim()) {
    const lines = resumeText.replace(/\r\n/g, '\n').split('\n')
    const start = lines.findIndex((line) =>
      /^(WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT)\s*$/i.test(line.trim())
    )
    if (start < 0) return false

    const block: string[] = []
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index]?.trim() ?? ''
      if (!line) continue
      if (/^(PROFESSIONAL SUMMARY|SUMMARY|SKILLS|EDUCATION|CERTIFICATIONS)\s*$/i.test(line)) {
        break
      }
      block.push(line)
    }

    return experienceSectionHasContent(block.join('\n'))
  }

  return false
}

export type StructuralScoreAdjustment = {
  matchScore: number
  structuralWarnings: string[]
  workExperienceMissing: boolean
  shortResumePenaltyApplied: boolean
}

export function applyStructuralScoreAdjustments(
  matchScore: number,
  options: {
    structuredResume?: TailoredResume | null
    sections: ResumeScoringSections
    resumeText: string
    experienceBackedMatchRatio?: number
  }
): StructuralScoreAdjustment {
  const structuralWarnings: string[] = []
  const workExperienceMissing = !resumeHasWorkExperience(
    options.structuredResume,
    options.sections,
    options.resumeText
  )

  if (workExperienceMissing) {
    return {
      matchScore: Math.min(matchScore, EMPTY_WORK_EXPERIENCE_SCORE_CAP),
      structuralWarnings: [WORK_EXPERIENCE_MISSING_WARNING],
      workExperienceMissing: true,
      shortResumePenaltyApplied: false,
    }
  }

  let adjustedScore = matchScore
  const wordCount = countResumeWords(options.sections.fullText || options.resumeText)
  let shortResumePenaltyApplied = false

  if (wordCount < MIN_RESUME_WORD_COUNT) {
    adjustedScore = Math.round(adjustedScore * SHORT_RESUME_PENALTY_FACTOR)
    shortResumePenaltyApplied = true
    structuralWarnings.push(SHORT_RESUME_WARNING)
  }

  const experienceRatio = options.experienceBackedMatchRatio ?? 0
  if (
    adjustedScore >= 90 &&
    experienceRatio < HIGH_SCORE_EXPERIENCE_MATCH_RATIO
  ) {
    adjustedScore = Math.min(adjustedScore, HIGH_SCORE_CEILING_WITHOUT_EXPERIENCE)
    structuralWarnings.push(
      '⚠️ High scores require keywords in work experience bullets, not only in the skills list.'
    )
  }

  return {
    matchScore: Math.max(0, Math.min(100, adjustedScore)),
    structuralWarnings,
    workExperienceMissing: false,
    shortResumePenaltyApplied,
  }
}
