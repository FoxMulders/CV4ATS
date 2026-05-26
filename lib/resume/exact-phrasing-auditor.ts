import { isStopWord } from '@/lib/resume/stopwords'

export const MIN_EXACT_PHRASING_MATCH_WORDS = 4
export const MAX_EXACT_PHRASING_MATCH_WORDS = 16

export const REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION =
  "CRITICAL DIRECTIVE: The user's current draft relies on an exact copied string from the job description. Rewrite this statement completely. Alter the sentence mechanics, swap out cloned action phrases, and use completely distinct verbs while retaining the underlying technical keyword or core skill requirement."

export interface PhrasingMatch {
  /** Matched substring as it appears in the input text. */
  phrase: string
  startIndex: number
  endIndex: number
  wordCount: number
}

export interface PhrasingAuditResult {
  matches: PhrasingMatch[]
  hasHighSimilarity: boolean
  longestMatch?: PhrasingMatch
}

export interface PhrasingHighlightSpan {
  text: string
  highlighted: boolean
}

interface WordToken {
  raw: string
  normalized: string
  start: number
  end: number
  isStop: boolean
}

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/['']/g, '').replace(/[.,;:!?]+$/g, '')
}

function tokenizeWithPositions(text: string): WordToken[] {
  const tokens: WordToken[] = []
  const pattern = /[a-z0-9+#][a-z0-9+#./-]*/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0]
    const normalized = normalizeToken(raw)
    tokens.push({
      raw,
      normalized,
      start: match.index,
      end: match.index + raw.length,
      isStop: isStopWord(normalized),
    })
  }

  return tokens
}

function contentTokenIndices(tokens: WordToken[]): number[] {
  const indices: number[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (!token.isStop && token.normalized.length >= 2) {
      indices.push(index)
    }
  }
  return indices
}

function buildJobDescriptionNgramSet(jobDescription: string): Set<string> {
  const tokens = tokenizeWithPositions(jobDescription)
  const contentIndices = contentTokenIndices(tokens)
  const ngrams = new Set<string>()

  for (let start = 0; start <= contentIndices.length - MIN_EXACT_PHRASING_MATCH_WORDS; start += 1) {
    const maxLength = Math.min(
      MAX_EXACT_PHRASING_MATCH_WORDS,
      contentIndices.length - start
    )

    for (
      let length = MIN_EXACT_PHRASING_MATCH_WORDS;
      length <= maxLength;
      length += 1
    ) {
      const phrase = contentIndices
        .slice(start, start + length)
        .map((tokenIndex) => tokens[tokenIndex]!.normalized)
        .join(' ')
      ngrams.add(phrase)
    }
  }

  return ngrams
}

function rangeIsCovered(
  start: number,
  end: number,
  coveredRanges: Array<[number, number]>
): boolean {
  return coveredRanges.some(([rangeStart, rangeEnd]) => start <= rangeEnd && end >= rangeStart)
}

export function auditExactPhrasingMatch(
  inputText: string,
  jobDescription: string
): PhrasingAuditResult {
  if (!inputText.trim() || !jobDescription.trim()) {
    return { matches: [], hasHighSimilarity: false }
  }

  const jobNgrams = buildJobDescriptionNgramSet(jobDescription)
  if (jobNgrams.size === 0) {
    return { matches: [], hasHighSimilarity: false }
  }

  const inputTokens = tokenizeWithPositions(inputText)
  const contentIndices = contentTokenIndices(inputTokens)
  if (contentIndices.length < MIN_EXACT_PHRASING_MATCH_WORDS) {
    return { matches: [], hasHighSimilarity: false }
  }

  const matches: PhrasingMatch[] = []
  const coveredRanges: Array<[number, number]> = []
  const maxWindow = Math.min(MAX_EXACT_PHRASING_MATCH_WORDS, contentIndices.length)

  for (let windowSize = maxWindow; windowSize >= MIN_EXACT_PHRASING_MATCH_WORDS; windowSize -= 1) {
    for (let start = 0; start <= contentIndices.length - windowSize; start += 1) {
      const end = start + windowSize - 1
      if (rangeIsCovered(start, end, coveredRanges)) continue

      const tokenIndices = contentIndices.slice(start, end + 1)
      const normalizedPhrase = tokenIndices
        .map((tokenIndex) => inputTokens[tokenIndex]!.normalized)
        .join(' ')

      if (!jobNgrams.has(normalizedPhrase)) continue

      coveredRanges.push([start, end])
      const startChar = inputTokens[tokenIndices[0]!]!.start
      const endChar = inputTokens[tokenIndices[tokenIndices.length - 1]!]!.end

      matches.push({
        phrase: inputText.slice(startChar, endChar),
        startIndex: startChar,
        endIndex: endChar,
        wordCount: windowSize,
      })
    }
  }

  matches.sort((left, right) => left.startIndex - right.startIndex)

  return {
    matches,
    hasHighSimilarity: matches.length > 0,
    longestMatch: matches.reduce<PhrasingMatch | undefined>(
      (longest, match) =>
        !longest || match.wordCount > longest.wordCount ? match : longest,
      undefined
    ),
  }
}

export function buildPhrasingHighlightSpans(
  text: string,
  matches: PhrasingMatch[]
): PhrasingHighlightSpan[] {
  if (!text || matches.length === 0) {
    return [{ text, highlighted: false }]
  }

  const sorted = [...matches].sort((left, right) => left.startIndex - right.startIndex)
  const spans: PhrasingHighlightSpan[] = []
  let cursor = 0

  for (const match of sorted) {
    if (match.startIndex > cursor) {
      spans.push({ text: text.slice(cursor, match.startIndex), highlighted: false })
    }

    spans.push({
      text: text.slice(match.startIndex, match.endIndex),
      highlighted: true,
    })
    cursor = Math.max(cursor, match.endIndex)
  }

  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), highlighted: false })
  }

  return spans.filter((span) => span.text.length > 0)
}
