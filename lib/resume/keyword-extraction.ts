import {
  canonicalKeyword,
  extractAcronyms,
  extractCapitalizedPhrases,
  extractTokenNgrams,
} from '@/lib/resume/lemma'
import {
  stripIrrelevantJobDescriptionText,
} from '@/lib/resume/keyword-filter'
import { isLikelyPersonName, isPostingArtifact } from '@/lib/resume/posting-artifact-filter'
import { filterReportableKeywords } from '@/lib/resume/keyword-report-filter'
import {
  filterStopWordTokens,
  isStopWord,
  phraseWithoutStopWords,
  tokenize,
} from '@/lib/resume/stopwords'

/** Curated multi-word ATS signals (PM / SDLC / IT delivery). */
const CURATED_PHRASE_PATTERNS = [
  /\bproject management\b/gi,
  /\bprogram management\b/gi,
  /\bagile\b/gi,
  /\bscrum\b/gi,
  /\bsafe\b/gi,
  /\bdevops\b/gi,
  /\bsdlc\b/gi,
  /\bitil\b/gi,
  /\bpmp\b/gi,
  /\bpmo\b/gi,
  /\bchange management\b/gi,
  /\bstakeholder management\b/gi,
  /\brisk management\b/gi,
  /\bcross-functional\b/gi,
  /\bapplication development\b/gi,
  /\bsoftware delivery\b/gi,
  /\bservice delivery\b/gi,
  /\bdigital transformation\b/gi,
  /\bworkflow automation\b/gi,
  /\binternal tools\b/gi,
  /\bcustom software\b/gi,
  /\bai agents?\b/gi,
  /\btechnical project manager\b/gi,
  /\bit operations\b/gi,
  /\bazure\b/gi,
  /\baws\b/gi,
  /\bjira\b/gi,
  /\bconfluence\b/gi,
  /\bsharepoint\b/gi,
  /\bwaterfall\b/gi,
  /\bkanban\b/gi,
  /\bcloud computing\b/gi,
  /\bdata governance\b/gi,
  /\benterprise architecture\b/gi,
  /\bproduct owner\b/gi,
  /\bproduct management\b/gi,
  /\buser stories\b/gi,
  /\bacceptance criteria\b/gi,
  /\bcontinuous integration\b/gi,
  /\bcontinuous delivery\b/gi,
  /\bcicd\b/gi,
  /\bci\/cd\b/gi,
]

const TECH_TOKEN_PATTERN = /\b(?:c#|\.net|node\.js|typescript|javascript|python|sql|saas|paas|iaas|api|apis|ui|ux|erp|crm|hris|etl|bi|ml|ai|llm|llms|gpu|ci\/cd)\b/gi

const MAX_KEYWORDS = 35

function normalizePhrase(phrase: string): string {
  return phraseWithoutStopWords(phrase)
}

/** @deprecated Use isReportableAtsKeyword from keyword-report-filter */
export function isHighValueKeyword(term: string): boolean {
  return filterReportableKeywords([term]).length > 0
}

function canonicalKeywordTerm(term: string): string {
  return canonicalKeyword(term)
}

export function pruneRedundantKeywords(ranked: string[]): string[] {
  const kept: string[] = []

  for (const term of ranked) {
    const dominated = ranked.some(
      (other) =>
        other !== term &&
        other.length > term.length &&
        (other.includes(term) ||
          canonicalKeywordTerm(other).includes(canonicalKeywordTerm(term)))
    )
    if (!dominated) kept.push(term)
  }

  return kept
}

function addScore(scores: Map<string, number>, term: string, weight: number): void {
  const normalized = normalizePhrase(term)
  if (!normalized || isPostingArtifact(normalized)) return
  scores.set(normalized, (scores.get(normalized) ?? 0) + weight)
}

function extractCuratedPhrases(text: string, scores: Map<string, number>): void {
  for (const pattern of CURATED_PHRASE_PATTERNS) {
    const matches = text.match(pattern)
    if (!matches) continue
    for (const match of matches) {
      addScore(scores, match, 5)
    }
    pattern.lastIndex = 0
  }
}

function extractTechTokens(text: string, scores: Map<string, number>): void {
  const matches = text.match(TECH_TOKEN_PATTERN)
  if (!matches) return
  for (const match of matches) {
    addScore(scores, match, 4)
  }
}

function extractHeuristicTerms(cleanedText: string, scores: Map<string, number>): void {
  for (const phrase of extractCapitalizedPhrases(cleanedText)) {
    if (isLikelyPersonName(phrase)) continue
    addScore(scores, phrase, 4)
  }

  for (const acronym of extractAcronyms(cleanedText)) {
    addScore(scores, acronym, 4)
  }

  for (const phrase of extractTokenNgrams(cleanedText, [2, 3])) {
    addScore(scores, phrase, phrase.split(' ').length >= 3 ? 4 : 3)
  }

  for (const token of filterStopWordTokens(tokenize(cleanedText.toLowerCase()))) {
    addScore(scores, token, 2)
  }
}

/**
 * Curated skill phrases only — no capitalized-phrase or n-gram heuristics.
 * Safe for resume body text (avoids employers, clients, and posting metadata).
 */
export function extractCuratedSkillMatches(text: string): string[] {
  const normalized = text.toLowerCase()
  const found = new Set<string>()

  for (const pattern of CURATED_PHRASE_PATTERNS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    const matcher = new RegExp(pattern.source, flags)
    let match: RegExpExecArray | null
    while ((match = matcher.exec(normalized)) !== null) {
      const phrase = normalizePhrase(match[0])
      if (phrase) found.add(phrase)
    }
  }

  const techMatches = normalized.match(TECH_TOKEN_PATTERN)
  if (techMatches) {
    for (const match of techMatches) {
      const phrase = normalizePhrase(match)
      if (phrase) found.add(phrase)
    }
  }

  return filterReportableKeywords([...found])
}

/**
 * Extract high-value ATS keywords from a job description.
 * Prioritizes nouns, noun phrases, acronyms, and curated multi-word skills.
 */
export function extractHighValueKeywords(jobDescription: string): string[] {
  const cleaned = stripIrrelevantJobDescriptionText(jobDescription)
  const normalized = cleaned.toLowerCase()
  const scores = new Map<string, number>()

  extractCuratedPhrases(normalized, scores)
  extractTechTokens(normalized, scores)
  extractHeuristicTerms(cleaned, scores)

  return filterReportableKeywords(
    pruneRedundantKeywords(
      [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_KEYWORDS)
        .map(([term]) => canonicalKeywordTerm(term))
        .filter(Boolean)
    )
  )
}
