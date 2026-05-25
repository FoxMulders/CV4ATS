import { filterStopWordTokens, tokenize } from '@/lib/resume/stopwords'

const IRREGULAR_FORMS: Record<string, string> = {
  managed: 'manage',
  managing: 'manage',
  managers: 'manager',
  delivered: 'deliver',
  delivering: 'deliver',
  automated: 'automate',
  automating: 'automate',
  optimized: 'optimize',
  led: 'lead',
  leading: 'lead',
  built: 'build',
  building: 'build',
  designed: 'design',
  developed: 'develop',
  developing: 'develop',
  implemented: 'implement',
  implementing: 'implement',
  stakeholders: 'stakeholder',
  workflows: 'workflow',
  initiatives: 'initiative',
  technologies: 'technology',
  applications: 'application',
  operations: 'operation',
  analyses: 'analysis',
}

/** Lightweight lemmatizer safe for Edge runtime (no eval / dynamic code). */
export function lemmaToken(token: string): string {
  const lower = token.toLowerCase()
  if (IRREGULAR_FORMS[lower]) return IRREGULAR_FORMS[lower]

  if (lower.endsWith('ies') && lower.length > 4) {
    return `${lower.slice(0, -3)}y`
  }
  if (lower.endsWith('ing') && lower.length > 5) {
    const stem = lower.slice(0, -3)
    if (stem.endsWith(stem.at(-1) ?? '')) return stem.slice(0, -1)
    return stem
  }
  if (lower.endsWith('ed') && lower.length > 4) {
    const stem = lower.slice(0, -2)
    if (stem.endsWith(stem.at(-1) ?? '')) return stem.slice(0, -1)
    return stem
  }
  if (lower.endsWith('es') && lower.length > 4) {
    return lower.slice(0, -2)
  }
  if (lower.endsWith('s') && lower.length > 3 && !lower.endsWith('ss')) {
    return lower.slice(0, -1)
  }

  return lower
}

export function lemmaKey(term: string): string {
  const tokens = tokenize(term)
  if (tokens.length === 0) return ''
  return tokens.map(lemmaToken).join(' ')
}

export function canonicalForms(term: string): string[] {
  const forms = new Set<string>()
  const base = term.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!base) return []

  forms.add(base)
  forms.add(lemmaKey(base))

  for (const token of tokenize(base)) {
    forms.add(token)
    forms.add(lemmaToken(token))
  }

  return [...forms].filter((form) => form.length >= 2)
}

const ACRONYM_PATTERN = /\b[A-Z]{2,}(?:\/[A-Z]{2,})?\b/g
const CAPITALIZED_PHRASE_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g

export function extractAcronyms(text: string): string[] {
  const matches = text.match(new RegExp(ACRONYM_PATTERN.source, 'gi')) ?? []
  return [...new Set(matches.map((match) => match.toLowerCase()))]
}

export function extractCapitalizedPhrases(text: string): string[] {
  const matches = text.match(CAPITALIZED_PHRASE_PATTERN) ?? []
  return [...new Set(matches.map((match) => match.toLowerCase()))]
}

export function extractTokenNgrams(text: string, sizes: number[] = [2, 3]): string[] {
  const tokens = filterStopWordTokens(tokenize(text.toLowerCase()))
  const phrases: string[] = []

  for (const size of sizes) {
    if (tokens.length < size) continue
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(' '))
    }
  }

  return [...new Set(phrases)]
}

export function canonicalKeyword(term: string): string {
  const normalized = term.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (!normalized.includes(' ')) return lemmaToken(normalized)
  return normalized
}
