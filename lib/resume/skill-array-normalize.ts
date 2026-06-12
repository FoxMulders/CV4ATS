import { isRecognizedAtsTerm } from '@/lib/resume/ats-term-lexicon'
import { matchesKnownCompetencyPhrase } from '@/lib/resume/posting-artifact-filter'

/** Delimiters that join distinct competencies into one ATS-unfriendly compound string. */
const COMPOUND_DELIMITER_PATTERNS = [/\s+&\s+/i, /\s+and\s+/i, /,\s+/, /\s*[•|;]\s*/] as const

/** Trailing descriptors that add noise unless part of a certified keyword phrase. */
const FILLER_SUFFIXES = [
  'platforms',
  'platform',
  'environments',
  'environment',
  'tools',
  'tool',
  'systems',
  'system',
] as const

/**
 * Multi-word phrases where trailing filler tokens must be preserved for ATS matching.
 * e.g. "Google Cloud Platform" — do not strip "Platform".
 */
const PROTECTED_SKILL_PHRASES = new Set([
  'google cloud platform',
  'custom automation platforms',
  'cloud computing',
  'cloud platforms',
  'information technology',
  'information systems',
  'workflow automation',
  'application development',
  'enterprise architecture',
  'continuous integration',
  'continuous delivery',
  'cross-functional',
  'program management',
  'project management',
  'scope management',
  'stakeholder management',
  'risk management',
  'change management',
  'product management',
  'software delivery',
  'service delivery',
  'digital transformation',
  'process improvement',
  'operational excellence',
  'technical project manager',
  'custom software',
  'internal tools',
  'ai agents',
  'ai agent',
  'data governance',
  'user stories',
  'acceptance criteria',
])

/** Standalone tools that may prefix a broader domain phrase in compound strings. */
const LEADING_ATOMIC_TOOLS = new Set([
  'aws',
  'azure',
  'gcp',
  'jira',
  'confluence',
  'sharepoint',
  'kubernetes',
  'terraform',
  'python',
  'typescript',
  'javascript',
  'sql',
  'devops',
  'scrum',
  'kanban',
  'agile',
  'safe',
  'sdlc',
  'itil',
  'salesforce',
  'servicenow',
])

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isProtectedPhrase(phrase: string): boolean {
  const key = normalizeKey(phrase)
  if (!key) return false
  if (PROTECTED_SKILL_PHRASES.has(key)) return true
  return matchesKnownCompetencyPhrase(key)
}

function isAtomicSkill(phrase: string): boolean {
  const key = normalizeKey(phrase)
  if (!key) return false
  if (isProtectedPhrase(key)) return true

  const tokens = key.split(/\s+/)
  if (tokens.length === 1) {
    return isRecognizedAtsTerm(tokens[0]!)
  }

  return tokens.some((token) => isRecognizedAtsTerm(token))
}

function splitOnDelimiters(skill: string): string[] {
  let parts = [skill.trim()]

  for (const pattern of COMPOUND_DELIMITER_PATTERNS) {
    parts = parts.flatMap((part) =>
      part
        .split(pattern)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 1)
    )
  }

  return parts
}

function splitLeadingToolPrefix(segment: string): string[] {
  const trimmed = segment.trim()
  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 2) return [trimmed]

  const first = tokens[0]!
  const firstKey = normalizeKey(first)
  if (!LEADING_ATOMIC_TOOLS.has(firstKey)) return [trimmed]

  const remainder = tokens.slice(1).join(' ').trim()
  if (!remainder) return [trimmed]
  if (isProtectedPhrase(trimmed)) return [trimmed]

  return [first, remainder]
}

function stripTrailingFiller(segment: string): string {
  const trimmed = segment.trim()
  if (!trimmed) return trimmed
  if (isProtectedPhrase(trimmed)) return trimmed

  let result = trimmed
  for (const suffix of FILLER_SUFFIXES) {
    const pattern = new RegExp(`\\s+${suffix}$`, 'i')
    if (!pattern.test(result)) continue

    const stripped = result.replace(pattern, '').trim()
    if (!stripped || stripped.toLowerCase() === suffix) continue

    if (isAtomicSkill(stripped)) {
      result = stripped
    }
  }

  return result
}

function cleanAtomicSegment(segment: string): string | null {
  const formatted = segment.trim().replace(/\s+/g, ' ')
  if (!formatted || formatted.length < 2) return null
  if (/^[•\-*–—]+$/.test(formatted)) return null

  const stripped = stripTrailingFiller(formatted)
  const key = normalizeKey(stripped)
  if (!key) return null
  if (FILLER_SUFFIXES.includes(key as (typeof FILLER_SUFFIXES)[number])) return null

  return stripped
}

function expandSkillString(skill: string): string[] {
  const split = splitOnDelimiters(skill)
  const expanded = split.flatMap((segment) => splitLeadingToolPrefix(segment))

  const atomics: string[] = []
  for (const segment of expanded) {
    const cleaned = cleanAtomicSegment(segment)
    if (cleaned) atomics.push(cleaned)
  }

  return atomics
}

/**
 * Split compound skill strings into atomic, ATS-indexable entries.
 * Runs before skill injection, resume state updates, and ADDED SKILL rendering.
 */
export function normalizeSkillArray(skills: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const skill of skills) {
    if (!skill?.trim()) continue

    for (const atomic of expandSkillString(skill)) {
      const key = normalizeKey(atomic)
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(atomic)
    }
  }

  return result
}
