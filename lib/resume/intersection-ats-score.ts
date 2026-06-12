import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { sanitizeKeywordReport } from '@/lib/api/generation-config'
import { filterRelevantKeywords } from '@/lib/resume/keyword-filter'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'
import { resumeMatchesScoringTarget } from '@/lib/resume/scoring-keyword-targets'
import { getFixedScoringTargetTerms } from '@/lib/resume/scoring-keyword-targets'
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

/** Map target skills into a deduplicated lowercase set while preserving display terms. */
export function buildTargetSkillTerms(
  targetSkills?: string[] | TargetSkill[],
  jobDescription?: string
): string[] {
  if (targetSkills && targetSkills.length > 0) {
    const seen = new Set<string>()
    const terms: string[] = []

    for (const entry of targetSkills) {
      const term = typeof entry === 'string' ? entry : entry.term
      const key = normalizeSkillKey(term)
      if (!key || seen.has(key)) continue
      seen.add(key)
      terms.push(term.trim())
    }

    return terms
  }

  if (jobDescription?.trim()) {
    return getFixedScoringTargetTerms(jobDescription)
  }

  return []
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

function resolveMatchedSections(
  corpus: TailoredResumeCorpus,
  term: string
): IntersectionResumeSection[] {
  const sections: IntersectionResumeSection[] = []

  if (corpus.summary && resumeMatchesScoringTarget(corpus.summary, term)) {
    sections.push('summary')
  }
  if (corpus.skills && resumeMatchesScoringTarget(corpus.skills, term)) {
    sections.push('skills')
  }
  if (corpus.experience && resumeMatchesScoringTarget(corpus.experience, term)) {
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
  const terms = buildTargetSkillTerms(targetSkills, jobDescription)
  const corpus = buildTailoredResumeCorpus(resume)

  const entries: SkillIntersectionEntry[] = terms.map((term) => {
    const matchedInSections = resolveMatchedSections(corpus, term)
    return {
      term,
      normalizedTerm: normalizeSkillKey(term),
      matched: matchedInSections.length > 0,
      matchedInSections,
    }
  })

  const matchedCount = entries.filter((entry) => entry.matched).length
  const targetSkillCount = entries.length
  const matchScore =
    targetSkillCount === 0 ? 0 : Math.round((matchedCount / targetSkillCount) * 100)

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

  if (score >= 76) {
    suggestions.push('Strong target-skill alignment — prioritize experience bullets over skills-list repetition.')
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
