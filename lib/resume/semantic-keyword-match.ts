import { lemmaToken } from '@/lib/resume/lemma'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { tokenize } from '@/lib/resume/stopwords'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function stemPattern(token: string): RegExp {
  const root = lemmaToken(token)
  return new RegExp(`\\b${escapeRegExp(root)}\\w*\\b`, 'i')
}

/** True when the resume text contains the keyword verbatim (ignoring case/spacing). */
export function resumeContainsVerbatimTerm(resumeText: string, keyword: string): boolean {
  const normalized = normalizeText(keyword)
  if (!normalized) return false
  return normalizeText(resumeText).includes(normalized)
}

/**
 * Soft-match: root skill appears in resume prose even when phrasing differs
 * (e.g. JD "workflows" ↔ resume "automated tracking workflows", "automation" ↔ "automated").
 */
export function resumeSemanticallyMatchesSkill(resumeText: string, keyword: string): boolean {
  if (keywordMatchesResume(resumeText, keyword)) return true

  const normalized = normalizeText(keyword)
  if (!normalized) return false

  const haystack = normalizeText(resumeText)
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
