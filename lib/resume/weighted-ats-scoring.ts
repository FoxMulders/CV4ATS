import { auditExactPhrasingMatch } from '@/lib/resume/exact-phrasing-auditor'
import { applyExperienceScoreFloor } from '@/lib/resume/experience-score-floor'
import {
  getFixedScoringTargetTerms,
  resumeMatchesScoringTarget,
} from '@/lib/resume/scoring-keyword-targets'
import {
  filterCompetencyKeywords,
  isNonCompetencyMetadata,
} from '@/lib/resume/non-competency-metadata-filter'

export const SECTION_WEIGHTS = {
  experience: 1.0,
  summary: 0.8,
  skills: 0.5,
} as const

export const DENSITY_OCCURRENCE_CAP = 2
export const PHRASING_PENALTY_FACTOR = 0.85
export const DISPLAY_SCORE_CEILING = 88
export const DISPLAY_SCORE_FLOOR = 38
export const DISPLAY_STRONG_BAND_START = 75
export const NEAR_IDENTICAL_SCORE_FLOOR = 92

export interface ResumeScoringSections {
  summary: string
  skills: string
  experience: string
  fullText: string
}

export interface TermScoreBreakdown {
  term: string
  matched: boolean
  sectionWeight: number
  densityMultiplier: number
  phrasingPenaltyApplied: boolean
  contribution: number
}

export interface WeightedScoreResult {
  matchScore: number
  rawScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  nearIdenticalProfile: boolean
  breakdown: TermScoreBreakdown[]
  targetTermCount: number
}

export interface WeightedScoringOptions {
  phase?: 'baseline' | 'tailored'
  /** Original uploaded resume — used for senior IT floor qualification (survives LLM rewrites). */
  sourceResumeText?: string
  /** Baseline display score — after tailoring never reports lower than this for qualified profiles. */
  baselineScore?: number
}

const SECTION_BOUNDARY =
  /^(PROFESSIONAL SUMMARY|SUMMARY|SKILLS|TECHNICAL SKILLS|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|EDUCATION|CERTIFICATIONS)\s*$/i

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractSectionBlock(lines: string[], heading: RegExp): string {
  const start = lines.findIndex((line) => heading.test(line.trim()))
  if (start < 0) return ''

  const content: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    if (SECTION_BOUNDARY.test(line)) break
    content.push(lines[index]!)
  }

  return content.join('\n').trim()
}

/** Parse standard ATS section blocks from serialized or pasted resume text. */
export function parseScoringSections(resumeText: string): ResumeScoringSections {
  const fullText = resumeText.replace(/\r\n/g, '\n').trim()
  const lines = fullText.split('\n')

  const summary = extractSectionBlock(lines, /^(PROFESSIONAL SUMMARY|SUMMARY)$/i)
  const skills = extractSectionBlock(lines, /^(SKILLS|TECHNICAL SKILLS)$/i)
  const experience = extractSectionBlock(lines, /^(WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT)$/i)

  if (summary || skills || experience) {
    return { summary, skills, experience, fullText }
  }

  const proseBlocks = fullText
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 40)

  return {
    summary: proseBlocks[0] ?? fullText.slice(0, Math.min(700, fullText.length)),
    skills: lines.filter((line) => /[,;|•]/.test(line) && line.length < 140).join('\n'),
    experience: fullText,
    fullText,
  }
}

function countKeywordOccurrences(text: string, keyword: string): number {
  if (!resumeMatchesScoringTarget(text, keyword)) return 0

  const normalized = text.toLowerCase()
  const keywordNorm = keyword.toLowerCase().trim()
  if (!keywordNorm) return 0

  if (!keywordNorm.includes(' ')) {
    const root = keywordNorm.replace(/(?:ing|ed|es|s)$/i, '')
    const pattern = new RegExp(`\\b${escapeRegExp(root)}\\w*\\b`, 'gi')
    return Math.max(1, (normalized.match(pattern) ?? []).length)
  }

  if (normalized.includes(keywordNorm)) {
    let count = 0
    let index = 0
    while ((index = normalized.indexOf(keywordNorm, index)) !== -1) {
      count += 1
      index += keywordNorm.length
    }
    return Math.max(1, count)
  }

  return 1
}

export function densityMultiplier(occurrenceCount: number): number {
  if (occurrenceCount <= DENSITY_OCCURRENCE_CAP) return 1
  return DENSITY_OCCURRENCE_CAP / occurrenceCount
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
}

function keywordInPhrasingViolation(
  keyword: string,
  sections: ResumeScoringSections,
  jobDescription: string
): boolean {
  const scopedText = [sections.summary, sections.experience].filter(Boolean).join('\n')
  const sentences = splitSentences(scopedText).filter((sentence) =>
    resumeMatchesScoringTarget(sentence, keyword)
  )

  return sentences.some(
    (sentence) => auditExactPhrasingMatch(sentence, jobDescription).hasHighSimilarity
  )
}

function resolveSectionWeight(keyword: string, sections: ResumeScoringSections): number {
  const weights: number[] = []

  if (sections.experience && resumeMatchesScoringTarget(sections.experience, keyword)) {
    weights.push(SECTION_WEIGHTS.experience)
  }
  if (sections.summary && resumeMatchesScoringTarget(sections.summary, keyword)) {
    weights.push(SECTION_WEIGHTS.summary)
  }
  if (sections.skills && resumeMatchesScoringTarget(sections.skills, keyword)) {
    weights.push(SECTION_WEIGHTS.skills)
  }

  if (weights.length > 0) {
    return Math.max(...weights)
  }

  if (resumeMatchesScoringTarget(sections.fullText, keyword)) {
    return SECTION_WEIGHTS.summary
  }

  return 0
}

function computeRawPercent(breakdown: TermScoreBreakdown[]): number {
  if (breakdown.length === 0) return 0

  const earned = breakdown.reduce((sum, entry) => sum + entry.contribution, 0)
  return (earned / breakdown.length) * 100
}

function isNearIdenticalProfile(
  breakdown: TermScoreBreakdown[],
  sections: ResumeScoringSections
): boolean {
  const matched = breakdown.filter((entry) => entry.matched)
  if (matched.length === 0 || breakdown.length === 0) return false

  const matchRatio = matched.length / breakdown.length
  const rawPercent = computeRawPercent(breakdown)
  const experienceBacked = matched.filter((entry) =>
    resumeMatchesScoringTarget(sections.experience, entry.term)
  ).length
  const experienceRatio = experienceBacked / matched.length
  const penalizedRatio =
    matched.filter((entry) => entry.phrasingPenaltyApplied).length / matched.length

  return (
    rawPercent >= 90 &&
    matchRatio >= 0.88 &&
    experienceRatio >= 0.72 &&
    penalizedRatio <= 0.2
  )
}

/** Map raw weighted score into a realistic 75–88 band; reserve 95%+ for near-identical profiles. */
export function normalizeDisplayScore(rawPercent: number, nearIdenticalProfile: boolean): number {
  const clampedRaw = Math.max(0, Math.min(100, rawPercent))

  if (nearIdenticalProfile) {
    return Math.round(
      Math.min(100, NEAR_IDENTICAL_SCORE_FLOOR + (clampedRaw / 100) * (100 - NEAR_IDENTICAL_SCORE_FLOOR))
    )
  }

  if (clampedRaw >= 77) {
    return Math.round(
      DISPLAY_STRONG_BAND_START +
        ((clampedRaw - 77) / 23) * (DISPLAY_SCORE_CEILING - DISPLAY_STRONG_BAND_START)
    )
  }

  return Math.round(
    DISPLAY_SCORE_FLOOR + (clampedRaw / 77) * (DISPLAY_STRONG_BAND_START - DISPLAY_SCORE_FLOOR)
  )
}

function scoreTerms(
  terms: string[],
  sections: ResumeScoringSections,
  jobDescription: string,
  options: WeightedScoringOptions = {}
): WeightedScoreResult {
  const targetTerms = terms.length > 0 ? terms : []
  const breakdown: TermScoreBreakdown[] = []

  for (const term of targetTerms) {
    if (isNonCompetencyMetadata(term)) {
      breakdown.push({
        term,
        matched: false,
        sectionWeight: 0,
        densityMultiplier: 0,
        phrasingPenaltyApplied: false,
        contribution: 0,
      })
      continue
    }

    const sectionWeight = resolveSectionWeight(term, sections)
    if (sectionWeight <= 0) {
      breakdown.push({
        term,
        matched: false,
        sectionWeight: 0,
        densityMultiplier: 0,
        phrasingPenaltyApplied: false,
        contribution: 0,
      })
      continue
    }

    const occurrences = countKeywordOccurrences(sections.fullText, term)
    const density = densityMultiplier(occurrences)
    const phrasingPenaltyApplied =
      options.phase !== 'tailored' &&
      keywordInPhrasingViolation(term, sections, jobDescription)
    const penaltyFactor = phrasingPenaltyApplied ? PHRASING_PENALTY_FACTOR : 1
    const contribution = sectionWeight * density * penaltyFactor

    breakdown.push({
      term,
      matched: true,
      sectionWeight,
      densityMultiplier: density,
      phrasingPenaltyApplied,
      contribution,
    })
  }

  const rawScore = computeRawPercent(breakdown)
  const nearIdenticalProfile = isNearIdenticalProfile(breakdown, sections)
  const normalizedScore = normalizeDisplayScore(rawScore, nearIdenticalProfile)
  const matchScore = applyExperienceScoreFloor(
    normalizedScore,
    rawScore,
    sections.fullText,
    options.phase ?? 'tailored',
    {
      sourceResumeText: options.sourceResumeText,
      baselineScore: options.baselineScore,
    }
  )

  const matchedKeywords = breakdown.filter((entry) => entry.matched).map((entry) => entry.term)
  const missingKeywords = breakdown.filter((entry) => !entry.matched).map((entry) => entry.term)

  return {
    matchScore,
    rawScore,
    matchedKeywords,
    missingKeywords,
    nearIdenticalProfile,
    breakdown,
    targetTermCount: targetTerms.length,
  }
}

export function computeWeightedMatchScore(
  resumeText: string,
  jobDescription: string,
  terms?: string[],
  options: WeightedScoringOptions = {}
): WeightedScoreResult {
  const sections = parseScoringSections(resumeText)
  const targetTerms =
    terms && terms.length > 0 ? filterCompetencyKeywords(terms) : getFixedScoringTargetTerms(jobDescription)

  return scoreTerms(targetTerms, sections, jobDescription, options)
}
