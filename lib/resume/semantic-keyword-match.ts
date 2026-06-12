import { lemmaToken } from '@/lib/resume/lemma'
import {
  keywordMatchesResume,
  matchesWordBoundaryProfile,
  normalizeMatchingText,
} from '@/lib/resume/keyword-matcher'
import { tokenize } from '@/lib/resume/stopwords'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stemPattern(token: string): RegExp {
  const root = lemmaToken(token)
  return new RegExp(`\\b${escapeRegExp(root)}\\w*\\b`, 'i')
}

/** True when the resume text contains the keyword verbatim (ignoring case/spacing). */
export function resumeContainsVerbatimTerm(resumeText: string, keyword: string): boolean {
  const normalized = normalizeMatchingText(keyword)
  if (!normalized) return false
  return matchesWordBoundaryProfile(resumeText, normalized)
}

/**
 * Soft-match: root skill appears in resume prose even when phrasing differs
 * (e.g. JD "workflows" ↔ resume "automated tracking workflows", "automation" ↔ "automated").
 */
export function resumeSemanticallyMatchesSkill(resumeText: string, keyword: string): boolean {
  if (keywordMatchesResume(resumeText, keyword)) return true

  const normalized = normalizeMatchingText(keyword)
  if (!normalized) return false

  const haystack = normalizeMatchingText(resumeText)
  const tokens = tokenize(normalized)
  if (tokens.length === 0) return false

  if (tokens.length === 1) {
    return stemPattern(tokens[0]!).test(haystack)
  }

  const matchedTokens = tokens.filter((token) => stemPattern(token).test(haystack))
  return matchedTokens.length >= Math.ceil(tokens.length * 0.75)
}

/** True when match is semantic/stem-based but not an exact phrase hit. */
export function resumeExpressesSkillInContext(resumeText: string, keyword: string): boolean {
  return (
    resumeSemanticallyMatchesSkill(resumeText, keyword) &&
    !resumeContainsVerbatimTerm(resumeText, keyword)
  )
}
