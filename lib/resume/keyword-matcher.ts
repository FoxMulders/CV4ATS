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

function phrasePresent(normalizedResume: string, vocabulary: Set<string>, phrase: string): boolean {
  if (normalizedResume.includes(phrase)) return true

  const parts = phrase.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false

  return parts.every((part) => {
    if (normalizedResume.includes(part)) return true
    return canonicalForms(part).some((form) => vocabulary.has(form) || normalizedResume.includes(form))
  })
}

/** Fuzzy keyword presence check with lightweight lemmatization. */
export function keywordMatchesResume(resumeText: string, keyword: string): boolean {
  const normalizedResume = normalizeText(resumeText)
  const keywordNorm = normalizeText(keyword)
  if (!keywordNorm) return false

  if (normalizedResume.includes(keywordNorm)) return true

  const vocabulary = buildResumeVocabulary(resumeText)

  if (keywordNorm.includes(' ')) {
    return phrasePresent(normalizedResume, vocabulary, keywordNorm)
  }

  if (vocabulary.has(keywordNorm)) return true

  return canonicalForms(keywordNorm).some(
    (form) => vocabulary.has(form) || (form.length >= 3 && normalizedResume.includes(form))
  )
}
