import { isRecognizedAtsTerm } from '@/lib/resume/ats-term-lexicon'
import { isStopWord, phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

/** Job-title words — present in role labels, not person names. */
const JOB_TITLE_TOKENS = new Set([
  'administrator',
  'analyst',
  'architect',
  'associate',
  'business',
  'chief',
  'consultant',
  'coordinator',
  'developer',
  'director',
  'engineer',
  'executive',
  'head',
  'information',
  'intern',
  'junior',
  'lead',
  'manager',
  'officer',
  'operations',
  'owner',
  'partner',
  'president',
  'principal',
  'product',
  'program',
  'project',
  'senior',
  'software',
  'specialist',
  'staff',
  'systems',
  'technical',
  'technology',
  'vice',
])

/** Posting-admin / contact / sentence-fragment tokens from scraped JDs. */
const POSTING_FRAGMENT_TOKENS = new Set([
  'about',
  'adopt',
  'adoption',
  'apply',
  'applying',
  'call',
  'contact',
  'driven',
  'driving',
  'email',
  'functional',
  'including',
  'initiatives',
  'linkedin',
  'mailto',
  'phone',
  'please',
  'preferred',
  'qualifications',
  'reach',
  'report',
  'reporting',
  'represent',
  'required',
  'responsibilities',
  'submit',
  'www',
])

const NAME_PARTICLES = new Set([
  'de',
  'da',
  'van',
  'von',
  'le',
  'la',
  'du',
  'del',
  'st',
  'jr',
  'sr',
  'ii',
  'iii',
  'iv',
])

const KNOWN_COMPETENCY_PHRASES = [
  /\bproject management\b/i,
  /\bprogram management\b/i,
  /\bproduct management\b/i,
  /\bproduct owner\b/i,
  /\bchange management\b/i,
  /\bstakeholder management\b/i,
  /\brisk management\b/i,
  /\bscope management\b/i,
  /\bagile\b/i,
  /\bscrum\b/i,
  /\bkanban\b/i,
  /\bwaterfall\b/i,
  /\bdevops\b/i,
  /\bsdlc\b/i,
  /\bitil\b/i,
  /\bcross-functional\b/i,
  /\bapplication development\b/i,
  /\bsoftware delivery\b/i,
  /\bservice delivery\b/i,
  /\bdigital transformation\b/i,
  /\bworkflow automation\b/i,
  /\bprocess improvement\b/i,
  /\boperational excellence\b/i,
  /\binformation technology\b/i,
  /\binformation systems\b/i,
  /\bit operations\b/i,
  /\btechnical project manager\b/i,
  /\buser stories\b/i,
  /\bacceptance criteria\b/i,
  /\bcontinuous integration\b/i,
  /\bcontinuous delivery\b/i,
  /\bcustom software\b/i,
  /\binternal tools\b/i,
  /\bai agents?\b/i,
  /\bdata governance\b/i,
  /\benterprise architecture\b/i,
  /\bcloud computing\b/i,
  /\bsenior business analyst\b/i,
  /\bbusiness analyst\b/i,
]

const CONTACT_LINE_PATTERN =
  /\b(?:contact|recruiter|reach out|reach|email|mailto:|phone|call|linkedin|reporting to|hiring manager|questions\?)\b/i

const PERSON_NAME_IN_LINE_PATTERN =
  /\b(?:contact|reach|email|recruiter|hiring manager|reporting to)\b[^.\n]{0,80}\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/i

function normalizeTerm(term: string): string {
  return phraseWithoutStopWords(term.trim().toLowerCase())
}

export function matchesKnownCompetencyPhrase(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  return KNOWN_COMPETENCY_PHRASES.some((pattern) => {
    const matches = pattern.test(normalized)
    pattern.lastIndex = 0
    return matches
  })
}

/** True when a multi-token phrase looks like a recruiter or candidate name, not a skill. */
export function isLikelyPersonName(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  const tokens = tokenize(normalized)
  if (tokens.length < 2 || tokens.length > 4) return false
  if (tokens.some((token) => JOB_TITLE_TOKENS.has(token))) return false
  if (tokens.some((token) => isRecognizedAtsTerm(token))) return false
  if (tokens.some((token) => isStopWord(token))) return false
  if (tokens.some((token) => POSTING_FRAGMENT_TOKENS.has(token))) return false
  if (matchesKnownCompetencyPhrase(normalized)) return false

  if (!tokens.every((token) => /^[a-z'.-]+$/i.test(token) && token.length >= 2 && token.length <= 18)) {
    return false
  }

  const substantive = tokens.filter((token) => !NAME_PARTICLES.has(token))
  return substantive.length >= 2
}

/** True when n-gram / capitalized-phrase heuristics produced posting prose, not a competency. */
export function isLikelyPostingFragment(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return true

  if (matchesKnownCompetencyPhrase(normalized)) return false

  const tokens = tokenize(normalized)
  if (tokens.length === 0) return true

  if (tokens.some((token) => POSTING_FRAGMENT_TOKENS.has(token))) return true

  if (tokens.length >= 2) {
    const industryHits = tokens.filter((token) => isRecognizedAtsTerm(token)).length
    if (industryHits === 0 && !JOB_TITLE_TOKENS.has(tokens[0]!)) {
      return true
    }
  }

  return false
}

/** True for recruiter names, contact lines, and JD sentence fragments — never resume keywords. */
export function isPostingArtifact(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return true

  if (isLikelyPersonName(normalized)) return true
  if (isLikelyPostingFragment(normalized)) return true

  return false
}

/** Skills safe to inject into accomplishment bullets — not names or posting prose. */
export function isInjectableCompetency(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized || isPostingArtifact(normalized)) return false
  if (matchesKnownCompetencyPhrase(normalized)) return true

  const tokens = tokenize(normalized)
  if (tokens.some((token) => isRecognizedAtsTerm(token))) return true

  return tokens.length === 1 && tokens[0]!.length >= 3 && isRecognizedAtsTerm(tokens[0]!)
}

export function filterPostingArtifacts(terms: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const term of terms) {
    const normalized = normalizeTerm(term)
    if (!normalized || isPostingArtifact(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(term.trim())
  }

  return result
}

/** Remove recruiter / contact lines before keyword extraction. */
export function stripRecruiterContactText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const cleaned: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (CONTACT_LINE_PATTERN.test(trimmed)) continue
    if (PERSON_NAME_IN_LINE_PATTERN.test(trimmed)) continue
    if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[-–—]\s*(?:recruiter|talent|staffing|hr)\b/i.test(trimmed)) {
      continue
    }
    cleaned.push(line)
  }

  return cleaned.join('\n')
}
