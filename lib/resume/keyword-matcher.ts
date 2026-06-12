import {
  canonicalForms,
  extractAcronyms,
  extractCapitalizedPhrases,
  extractTokenNgrams,
  lemmaKey,
  lemmaToken,
} from '@/lib/resume/lemma'
import { tokenize } from '@/lib/resume/stopwords'

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Lowercase and strip punctuation so compound phrases index consistently. */
export function normalizeMatchingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build a word-boundary regex for a normalized keyword (single- or multi-word). */
export function buildWordBoundaryPattern(keyword: string): RegExp | null {
  const normalized = normalizeMatchingText(keyword)
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null

  if (parts.length === 1) {
    return new RegExp(`\\b${escapeRegExp(parts[0]!)}\\b`, 'i')
  }

  return new RegExp(`\\b${parts.map(escapeRegExp).join('\\s+')}\\b`, 'i')
}

/** True when keyword appears as a whole token (or phrase) inside resume text. */
export function matchesWordBoundaryProfile(haystack: string, keyword: string): boolean {
  const pattern = buildWordBoundaryPattern(keyword)
  if (!pattern) return false
  return pattern.test(normalizeMatchingText(haystack))
}

export { lemmaKey, lemmaToken }

function buildResumeVocabulary(resumeText: string): Set<string> {
  const vocab = new Set<string>()
  const normalized = normalizeText(resumeText)

  for (const token of tokenize(normalized)) {
    for (const form of canonicalForms(token)) {
      vocab.add(form)
    }
  }

  for (const phrase of extractTokenNgrams(resumeText, [2, 3])) {
    vocab.add(phrase)
    for (const form of canonicalForms(phrase)) {
      vocab.add(form)
    }
  }

  for (const acronym of extractAcronyms(resumeText)) {
    vocab.add(acronym)
  }

  return vocab
}

function matchesStemProfile(matchingHaystack: string, keyword: string): boolean {
  const tokens = normalizeMatchingText(keyword).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false

  if (tokens.length === 1) {
    const root = lemmaToken(tokens[0]!)
    if (root.length < 3) return false
    return new RegExp(`\\b${escapeRegExp(root)}\\w*\\b`, 'i').test(matchingHaystack)
  }

  const matchedTokens = tokens.filter((token) => {
    const root = lemmaToken(token)
    return new RegExp(`\\b${escapeRegExp(root)}\\w*\\b`, 'i').test(matchingHaystack)
  })

  return matchedTokens.length >= Math.ceil(tokens.length * 0.75)
}

function phrasePresent(
  matchingHaystack: string,
  vocabulary: Set<string>,
  phrase: string
): boolean {
  if (matchesWordBoundaryProfile(matchingHaystack, phrase)) return true

  const parts = phrase.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false

  return parts.every((part) => {
    if (matchesWordBoundaryProfile(matchingHaystack, part)) return true
    return canonicalForms(part).some(
      (form) =>
        vocabulary.has(form) ||
        (form.length >= 3 && matchesWordBoundaryProfile(matchingHaystack, form))
    )
  })
}

/** Fuzzy keyword presence check with word-boundary profiling and lightweight lemmatization. */
export function keywordMatchesResume(resumeText: string, keyword: string): boolean {
  const keywordNorm = normalizeMatchingText(keyword)
  if (!keywordNorm) return false

  const matchingHaystack = normalizeMatchingText(resumeText)

  if (matchesWordBoundaryProfile(matchingHaystack, keywordNorm)) return true

  if (matchesStemProfile(matchingHaystack, keywordNorm)) return true

  const vocabulary = buildResumeVocabulary(resumeText)

  if (keywordNorm.includes(' ')) {
    return phrasePresent(matchingHaystack, vocabulary, keywordNorm)
  }

  if (vocabulary.has(keywordNorm)) return true

  return canonicalForms(keywordNorm).some(
    (form) =>
      vocabulary.has(form) ||
      (form.length >= 3 && matchesWordBoundaryProfile(matchingHaystack, form))
  )
}
