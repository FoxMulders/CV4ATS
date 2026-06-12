import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { sanitizeKeywordReport } from '@/lib/api/generation-config'
import { filterRelevantKeywords } from '@/lib/resume/keyword-filter'
import {
  keywordMatchesResume,
  normalizeMatchingText,
} from '@/lib/resume/keyword-matcher'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'
import { getFixedScoringTargetTerms } from '@/lib/resume/scoring-keyword-targets'
import {
  scoringWeightForSkill,
  type SkillPriorityTier,
} from '@/lib/resume/skill-priority'
import { targetSkillTerms, type TargetSkill } from '@/lib/resume/skill-extrapolation'

export type IntersectionResumeSection = 'summary' | 'skills' | 'experience'

export interface TailoredResumeCorpus {
  summary: string
  skills: string
  experience: string
  combined: string
}

export interface SkillIntersectionEntry {
  term: string
  normalizedTerm: string
  matched: boolean
  matchedInSections: IntersectionResumeSection[]
  priorityTier: SkillPriorityTier
  scoringWeight: number
}

export interface SkillIntersectionMatrix {
  entries: SkillIntersectionEntry[]
  targetSkillCount: number
  matchedCount: number
  matchScore: number
}

export interface IntersectionScoreInput {
  resume: TailoredResume
  targetSkills?: string[] | TargetSkill[]
  jobDescription?: string
}

function normalizeSkillKey(term: string): string {
  return term.trim().toLowerCase()
}

/** Map target skills into a deduplicated list while preserving display terms and tiers. */
export function buildTargetSkillTerms(
  targetSkills?: string[] | TargetSkill[],
  jobDescription?: string
): TargetSkill[] {
  if (targetSkills && targetSkills.length > 0) {
    const seen = new Set<string>()
    const terms: TargetSkill[] = []

    for (const entry of targetSkills) {
      if (typeof entry === 'string') {
        const term = entry.trim()
        const key = normalizeSkillKey(term)
        if (!key || seen.has(key)) continue
        seen.add(key)
        terms.push({ term, category: 'domainTech', priorityTier: 'core' })
        continue
      }

      const term = entry.term.trim()
      const key = normalizeSkillKey(term)
      if (!key || seen.has(key)) continue
      seen.add(key)
      terms.push({
        term,
        category: entry.category,
        priorityTier: entry.priorityTier ?? 'core',
      })
    }

    return terms
  }

  if (jobDescription?.trim()) {
    return getFixedScoringTargetTerms(jobDescription).map((term) => ({
      term,
      category: 'domainTech' as const,
      priorityTier: 'core' as const,
    }))
  }

  return []
}

/** @deprecated Prefer buildTargetSkillTerms — string-only helper for legacy callers. */
export function buildTargetSkillTermStrings(
  targetSkills?: string[] | TargetSkill[],
  jobDescription?: string
): string[] {
  return buildTargetSkillTerms(targetSkills, jobDescription).map((skill) => skill.term)
}

/** Structural scoring inputs mirrored by the intersection matcher (summary, skills, bullets). */
export interface TailoredResumeScoringContent {
  summary: string
  skills: string[]
  experienceBullets: string[][]
}

/** Extract normalized summary, skills, and experience bullets for scoring dependency tracking. */
export function extractTailoredResumeScoringContent(
  resume: TailoredResume
): TailoredResumeScoringContent {
  return {
    summary: resume.summary.trim(),
    skills: resume.skills.map((skill) => skill.trim()).filter(Boolean),
    experienceBullets: resume.experience.map((role) =>
      role.bullets.map((bullet) => bullet.trim()).filter(Boolean)
    ),
  }
}

/** Stable fingerprint for debounced ATS recalculation when scoring sections mutate. */
export function buildTailoredResumeScoringFingerprint(resume: TailoredResume): string {
  return JSON.stringify(extractTailoredResumeScoringContent(resume))
}

/** Tokenize summary, skills array, and experience bullets into section-scoped corpus text. */
export function buildTailoredResumeCorpus(resume: TailoredResume): TailoredResumeCorpus {
  const summary = resume.summary.trim()
  const skills = resume.skills.map((skill) => skill.trim()).filter(Boolean).join(' ')
  const experience = resume.experience
    .flatMap((role) => role.bullets.map((bullet) => bullet.trim()))
    .filter(Boolean)
    .join('\n')

  return {
    summary,
    skills,
    experience,
    combined: [summary, skills, experience].filter(Boolean).join('\n'),
  }
}

function targetSkillMatchesResumeText(resumeText: string, term: string): boolean {
  if (!resumeText.trim()) return false
  return keywordMatchesResume(resumeText, term)
}

function resolveMatchedSections(
  corpus: TailoredResumeCorpus,
  normalizedCorpus: TailoredResumeCorpus,
  term: string
): IntersectionResumeSection[] {
  const sections: IntersectionResumeSection[] = []

  if (corpus.summary && targetSkillMatchesResumeText(normalizedCorpus.summary, term)) {
    sections.push('summary')
  }
  if (corpus.skills && targetSkillMatchesResumeText(normalizedCorpus.skills, term)) {
    sections.push('skills')
  }
  if (corpus.experience && targetSkillMatchesResumeText(normalizedCorpus.experience, term)) {
    sections.push('experience')
  }

  return sections
}

/** Strict target-skill intersection matrix: one row per JD target skill. */
export function buildSkillIntersectionMatrix(
  resume: TailoredResume,
  targetSkills?: string[] | TargetSkill[],
  jobDescription?: string
): SkillIntersectionMatrix {
  const skills = buildTargetSkillTerms(targetSkills, jobDescription)
  const corpus = buildTailoredResumeCorpus(resume)
  const normalizedCorpus: TailoredResumeCorpus = {
    summary: normalizeMatchingText(corpus.summary),
    skills: normalizeMatchingText(corpus.skills),
    experience: normalizeMatchingText(corpus.experience),
    combined: normalizeMatchingText(corpus.combined),
  }

  const entries: SkillIntersectionEntry[] = skills.map((skill) => {
    const matchedInSections = resolveMatchedSections(corpus, normalizedCorpus, skill.term)
    const matched =
      matchedInSections.length > 0 ||
      targetSkillMatchesResumeText(normalizedCorpus.combined, skill.term)
    const priorityTier = skill.priorityTier ?? 'core'

    return {
      term: skill.term,
      normalizedTerm: normalizeSkillKey(skill.term),
      matched,
      matchedInSections,
      priorityTier,
      scoringWeight: scoringWeightForSkill(skill.term, priorityTier),
    }
  })

  const totalWeight = entries.reduce((sum, entry) => sum + entry.scoringWeight, 0)
  const matchedWeight = entries
    .filter((entry) => entry.matched)
    .reduce((sum, entry) => sum + entry.scoringWeight, 0)
  const matchedCount = entries.filter((entry) => entry.matched).length
  const targetSkillCount = entries.length
  const matchScore =
    totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100)

  return {
    entries,
    targetSkillCount,
    matchedCount,
    matchScore,
  }
}

function formatIntersectionSuggestions(missingKeywords: string[], score: number): string[] {
  const suggestions: string[] = []

  if (score < 60) {
    suggestions.push(
      'Mirror high-priority job description terms in your summary and most recent role bullets.'
    )
  }

  if (missingKeywords.length > 0) {
    const relevantMissing = filterRelevantKeywords(missingKeywords)
    if (relevantMissing.length > 0) {
      suggestions.push(
        `Add truthful mentions of missing role-specific terms where your experience supports them: ${relevantMissing.slice(0, 5).join(', ')}.`
      )
    }
  }

  if (score >= 85) {
    suggestions.push('Strong target-skill alignment (85%+) — keep phrasing natural in experience bullets.')
  } else if (score >= 80) {
    suggestions.push(
      'Close to the 85% target — weave remaining missing terms into experience bullets where your background supports them.'
    )
  } else if (score >= 76) {
    suggestions.push('Solid alignment — prioritize experience bullets over skills-list repetition to reach 85%.')
  } else {
    suggestions.push(
      'Embed missing competencies in work experience bullets rather than repeating them only in the skills list.'
    )
  }

  return suggestions.slice(0, 5)
}

/** Score = (matched target skills / total target skills) * 100 */
export function computeIntersectionMatchScore(input: IntersectionScoreInput): KeywordReport {
  const matrix = buildSkillIntersectionMatrix(
    input.resume,
    input.targetSkills,
    input.jobDescription
  )
  const corpus = buildTailoredResumeCorpus(input.resume)

  const matchedKeywords = matrix.entries.filter((entry) => entry.matched).map((entry) => entry.term)
  const missingKeywords = matrix.entries.filter((entry) => !entry.matched).map((entry) => entry.term)

  return sanitizeKeywordReport({
    matchScore: matrix.matchScore,
    matchedKeywords: sanitizeKeywordList(matchedKeywords, corpus.combined),
    missingKeywords: sanitizeKeywordList(missingKeywords, corpus.combined),
    suggestions: formatIntersectionSuggestions(missingKeywords, matrix.matchScore),
  })
}

export function targetSkillsFromPreScan(
  preScan?: { targetSkills: TargetSkill[] } | null,
  jobDescription?: string
): string[] {
  if (preScan?.targetSkills?.length) {
    return targetSkillTerms(preScan.targetSkills)
  }
  return jobDescription?.trim() ? getFixedScoringTargetTerms(jobDescription) : []
}
