import { isStopWord } from '@/lib/resume/stopwords'

export const MIN_EXACT_PHRASING_MATCH_WORDS = 4
export const MAX_EXACT_PHRASING_MATCH_WORDS = 16

/** More than 3 consecutive JD words (4+) fails automated compliance checks. */
export const PHRASING_COMPLIANCE_WORD_LIMIT = MIN_EXACT_PHRASING_MATCH_WORDS

export const ANTI_COPY_CONSTRAINT = `CRITICAL CONSTRAINT: Do not copy sentences or multi-word fragments directly from the job description. Translate posting language into the candidate's own career context.

Example — if the job description says "stewardship of AQOE-sponsored platforms across their lifecycle", write something like "Managed enterprise software asset lifecycles and platform adoption strategies" grounded in the source resume.

Any output with more than 3 consecutive words identical to the job description text fails compliance checks. Focus on semantic matching (meaning and skill level), not literal keyword duplication.`

export const SEMANTIC_MATCHING_DIRECTIVE = `Match the job's intent and competency level using the candidate's authentic voice. Single proper nouns, tool names, and standard methodology labels (Agile, Kanban, Jira) may appear verbatim when truthful. Never lift multi-word clauses, duty statements, or sentence fragments from the posting.`

export const REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION = `${ANTI_COPY_CONSTRAINT}

The current draft copies job-description phrasing. Rewrite it completely: change sentence mechanics, swap cloned action phrases, and use distinct verbs while preserving the underlying skill or competency requirement.`

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

const jobDescriptionNgramCache = new Map<string, Set<string>>()

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

function getJobDescriptionNgramSet(jobDescription: string): Set<string> {
  const cached = jobDescriptionNgramCache.get(jobDescription)
  if (cached) return cached

  const ngrams = buildJobDescriptionNgramSet(jobDescription)
  if (jobDescriptionNgramCache.size >= 24) {
    jobDescriptionNgramCache.clear()
  }
  jobDescriptionNgramCache.set(jobDescription, ngrams)
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

  const jobNgrams = getJobDescriptionNgramSet(jobDescription)
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

/** Scan multiple resume fields for job-description copy violations (4+ consecutive words). */
export function auditResumePhrasingCompliance(
  sections: Array<{ label: string; text: string }>,
  jobDescription: string
): PhrasingAuditResult & { violations: Array<{ label: string; matches: PhrasingMatch[] }> } {
  const violations: Array<{ label: string; matches: PhrasingMatch[] }> = []
  const allMatches: PhrasingMatch[] = []

  for (const section of sections) {
    const trimmed = section.text.trim()
    if (!trimmed) continue

    const audit = auditExactPhrasingMatch(trimmed, jobDescription)
    if (audit.matches.length > 0) {
      violations.push({ label: section.label, matches: audit.matches })
      allMatches.push(...audit.matches)
    }
  }

  allMatches.sort((left, right) => left.startIndex - right.startIndex)

  return {
    matches: allMatches,
    hasHighSimilarity: allMatches.length > 0,
    longestMatch: allMatches.reduce<PhrasingMatch | undefined>(
      (longest, match) =>
        !longest || match.wordCount > longest.wordCount ? match : longest,
      undefined
    ),
    violations,
  }
}

export function buildPhrasingComplianceSuggestions(
  audit: PhrasingAuditResult
): string[] {
  if (!audit.hasHighSimilarity) return []

  const longest = audit.longestMatch?.phrase
  const suggestions = [
    'Rewrite flagged phrases in your own words — do not copy multi-word fragments from the job description.',
    'Translate posting duties into accomplishments grounded in the candidate\'s employers, scope, and outcomes.',
  ]

  if (longest) {
    suggestions.push(
      `Replace copied phrasing such as "${longest}" with a semantically equivalent statement unique to this resume.`
    )
  }

  return suggestions.slice(0, 4)
}
