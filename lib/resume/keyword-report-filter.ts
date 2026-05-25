import { isRecognizedAtsTerm } from '@/lib/resume/ats-term-lexicon'
import { isRelevantJobKeyword } from '@/lib/resume/keyword-filter'
import {
  isPureStopWordPhrase,
  isStopWord,
  phraseWithoutStopWords,
  tokenize,
} from '@/lib/resume/stopwords'

const MIN_KEYWORD_LENGTH = 2
const TECH_PHRASE_PATTERN = /\b(?:c#|\.net|node\.js|typescript|javascript|python|ci\/cd|cicd)\b/i

/**
 * Final gate for keywords shown in matched/missing UI.
 * Rejects conversational filler and generic English — allows skills, tools, methodologies only.
 */
export function isReportableAtsKeyword(term: string): boolean {
  const stripped = phraseWithoutStopWords(term)
  if (!stripped || stripped.length < MIN_KEYWORD_LENGTH) return false
  if (isPureStopWordPhrase(term)) return false
  if (/[,;:]/.test(term)) return false
  if (!isRelevantJobKeyword(stripped)) return false

  const tokens = tokenize(stripped)
  if (tokens.length === 0) return false
  if (tokens.some((token) => isStopWord(token)) && tokens.length === 1) return false
  if (tokens[0] === 'and' || tokens[0] === 'or') return false

  const substantive = tokens.filter(
    (token) => !isStopWord(token) && (token.length >= 3 || isRecognizedAtsTerm(token))
  )
  if (substantive.length === 0) return false

  if (tokens.length > 3 && !stripped.includes('-')) return false

  if (tokens.length === 1) {
    const token = tokens[0]!
    return isRecognizedAtsTerm(token) || TECH_PHRASE_PATTERN.test(token)
  }

  if (tokens.filter((token) => isStopWord(token)).length >= tokens.length / 2) {
    return false
  }

  return substantive.some((token) => isRecognizedAtsTerm(token) || token.length >= 4)
}

export function filterReportableKeywords(terms: string[]): string[] {
  const seen = new Set<string>()
  const filtered: string[] = []

  for (const term of terms) {
    const normalized = phraseWithoutStopWords(term)
    if (!normalized || !isReportableAtsKeyword(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    filtered.push(normalized)
  }

  return filtered
}
