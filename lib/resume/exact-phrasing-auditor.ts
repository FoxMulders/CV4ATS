import { isStopWord } from '@/lib/resume/stopwords'

export const MIN_EXACT_PHRASING_MATCH_WORDS = 4
export const MAX_EXACT_PHRASING_MATCH_WORDS = 16

/** More than 3 consecutive JD words (4+) fails automated compliance checks. */
export const PHRASING_COMPLIANCE_WORD_LIMIT = MIN_EXACT_PHRASING_MATCH_WORDS

export const ANTI_COPY_CONSTRAINT = `CRITICAL CONSTRAINT: Do not copy sentences or multi-word fragments directly from the job description. Translate posting language into the candidate's own career context.

Example — if the job description says "stewardship of AQOE-sponsored platforms across their lifecycle", write something like "Managed enterprise software asset lifecycles and platform adoption strategies" grounded in the source resume.

Any output with more than 3 consecutive words identical to the job description text fails compliance checks. Focus on semantic matching (meaning and skill level), not literal keyword duplication.`

export const SEMANTIC_MATCHING_DIRECTIVE = `Match the job's intent and competency level using the candidate's authentic voice.

**Hard token rule (ATS):** Multi-word competency tokens from the job description (e.g., "Project Coordination", "Stakeholder Management", "Process Optimization") must appear **verbatim** in summary, skills, or bullets when the candidate truthfully possesses them — this drives ATS noun-density scoring.

**Anti-plagiarism rule (human):** Never lift 4+ consecutive words that reproduce a JD **sentence, duty statement, or clause**. Single proper nouns, tool names, standard methodology labels (Agile, Kanban, Jira), and grounded multi-word competency tokens may appear verbatim. Rewrite everything else in the candidate's career context.`

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

export interface ContentWordToken {
  raw: string
  normalized: string
  start: number
  end: number
}

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/['']/g, '').replace(/[.,;:!?]+$/g, '')
}

/** Tokenize prose while retaining character offsets for highlight rendering. */
export function tokenizeWithPositions(text: string): ContentWordToken[] {
  const tokens: ContentWordToken[] = []
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
    })
  }

  return tokens
}

/** Drop stop words and very short tokens before n-gram construction. */
export function tokenizeContentWords(text: string): ContentWordToken[] {
  return tokenizeWithPositions(text).filter(
    (token) => !isStopWord(token.normalized) && token.normalized.length >= 2
  )
}

function buildFourGramKey(tokens: ContentWordToken[], start: number): string | null {
  if (start + MIN_EXACT_PHRASING_MATCH_WORDS > tokens.length) {
    return null
  }

  const parts: string[] = []
  for (let index = 0; index < MIN_EXACT_PHRASING_MATCH_WORDS; index += 1) {
    parts.push(tokens[start + index]!.normalized)
  }
  return parts.join(' ')
}

/**
 * Build a hash set of continuous 4-word sequences from a job description,
 * excluding standard stop words from each sequence.
 */
export function buildJobDescriptionFourGramSet(jobDescription: string): Set<string> {
  const tokens = tokenizeContentWords(jobDescription)
  const ngrams = new Set<string>()

  for (let start = 0; start <= tokens.length - MIN_EXACT_PHRASING_MATCH_WORDS; start += 1) {
    const key = buildFourGramKey(tokens, start)
    if (key) {
      ngrams.add(key)
    }
  }

  return ngrams
}

const jobDescriptionNgramCache = new Map<string, Set<string>>()

function getJobDescriptionFourGramSet(jobDescription: string): Set<string> {
  const cached = jobDescriptionNgramCache.get(jobDescription)
  if (cached) return cached

  const ngrams = buildJobDescriptionFourGramSet(jobDescription)
  if (jobDescriptionNgramCache.size >= 24) {
    jobDescriptionNgramCache.clear()
  }
  jobDescriptionNgramCache.set(jobDescription, ngrams)
  return ngrams
}

function extendMatchEnd(
  tokens: ContentWordToken[],
  jobNgrams: Set<string>,
  start: number,
  end: number
): number {
  let extendedEnd = end

  while (extendedEnd + 1 < tokens.length) {
    const trailingFourGramStart = extendedEnd - (MIN_EXACT_PHRASING_MATCH_WORDS - 2)
    const key = buildFourGramKey(tokens, trailingFourGramStart)
    if (!key || !jobNgrams.has(key)) {
      break
    }
    extendedEnd += 1
  }

  return extendedEnd
}

function findPhrasingMatches(
  inputTokens: ContentWordToken[],
  inputText: string,
  jobNgrams: Set<string>
): PhrasingMatch[] {
  if (inputTokens.length < MIN_EXACT_PHRASING_MATCH_WORDS) {
    return []
  }

  const matches: PhrasingMatch[] = []
  let contentPos = 0

  while (contentPos <= inputTokens.length - MIN_EXACT_PHRASING_MATCH_WORDS) {
    const seedKey = buildFourGramKey(inputTokens, contentPos)
    if (!seedKey || !jobNgrams.has(seedKey)) {
      contentPos += 1
      continue
    }

    const endPos = extendMatchEnd(
      inputTokens,
      jobNgrams,
      contentPos,
      contentPos + MIN_EXACT_PHRASING_MATCH_WORDS - 1
    )
    const startChar = inputTokens[contentPos]!.start
    const endChar = inputTokens[endPos]!.end

    matches.push({
      phrase: inputText.slice(startChar, endChar),
      startIndex: startChar,
      endIndex: endChar,
      wordCount: endPos - contentPos + 1,
    })

    contentPos = endPos + 1
  }

  return matches
}

export function auditExactPhrasingMatch(
  inputText: string,
  jobDescription: string
): PhrasingAuditResult {
  if (!inputText.trim() || !jobDescription.trim()) {
    return { matches: [], hasHighSimilarity: false }
  }

  const jobNgrams = getJobDescriptionFourGramSet(jobDescription)
  if (jobNgrams.size === 0) {
    return { matches: [], hasHighSimilarity: false }
  }

  const inputTokens = tokenizeContentWords(inputText)
  const matches = findPhrasingMatches(inputTokens, inputText, jobNgrams)

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
