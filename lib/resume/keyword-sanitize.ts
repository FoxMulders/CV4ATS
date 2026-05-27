import { filterCompetencyKeywords } from '@/lib/resume/non-competency-metadata-filter'
import { isRecognizedAtsTerm, INDUSTRY_SKILL_TERMS } from '@/lib/resume/ats-term-lexicon'
import { isHighValueKeyword, pruneRedundantKeywords } from '@/lib/resume/keyword-extraction'
import { filterAuditedKeywordTerms } from '@/lib/resume/keyword-audit'
import { filterReportableKeywords, isReportableAtsKeyword } from '@/lib/resume/keyword-report-filter'
import { lemmaKey, lemmaToken } from '@/lib/resume/lemma'
import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

export { INDUSTRY_SKILL_TERMS, isRecognizedAtsTerm, lemmaKey, lemmaToken }

function normalizeDisplayKeyword(term: string): string {
  return phraseWithoutStopWords(term)
}

function pickPreferredKeyword(a: string, b: string): string {
  const aTokens = tokenize(a)
  const bTokens = tokenize(b)

  const aIndustry = aTokens.some((token) => INDUSTRY_SKILL_TERMS.has(token))
  const bIndustry = bTokens.some((token) => INDUSTRY_SKILL_TERMS.has(token))
  if (aIndustry && !bIndustry) return a
  if (bIndustry && !aIndustry) return b

  if (a.includes(' ') && !b.includes(' ')) return a
  if (b.includes(' ') && !a.includes(' ')) return b

  return a.length <= b.length ? a : b
}

/**
 * Final cleanup for matched/missing keyword arrays:
 * stop-word filter → reportability gate → lemma dedupe → phrase pruning.
 */
export function sanitizeKeywordList(keywords: string[], resumeText = ''): string[] {
  const relevant = filterReportableKeywords(
    keywords.map(normalizeDisplayKeyword).filter(Boolean)
  ).filter(isReportableAtsKeyword)

  const byLemma = new Map<string, string>()
  for (const keyword of relevant) {
    const key = lemmaKey(keyword)
    if (!key) continue
    const existing = byLemma.get(key)
    byLemma.set(key, existing ? pickPreferredKeyword(existing, keyword) : keyword)
  }

  const deduped = pruneRedundantKeywords([...byLemma.values()])

  return filterCompetencyKeywords(
    filterAuditedKeywordTerms(
      deduped.sort((a, b) => {
        const aScore = scoreIndustryPriority(a)
        const bScore = scoreIndustryPriority(b)
        if (aScore !== bScore) return bScore - aScore
        return a.localeCompare(b)
      }),
      resumeText
    )
  )
}

function scoreIndustryPriority(term: string): number {
  const tokens = tokenize(term)
  let score = term.includes(' ') ? 2 : 0
  for (const token of tokens) {
    if (INDUSTRY_SKILL_TERMS.has(token)) score += 3
  }
  return score
}

/** @deprecated Use isReportableAtsKeyword */
export { isHighValueKeyword as isHighValueKeywordLegacy }
