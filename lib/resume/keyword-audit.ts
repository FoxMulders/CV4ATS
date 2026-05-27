import {
  getResumeEvidenceAliases,
  isItDomainTerm,
  resumeShowsItExperience,
  resumeSupportsPurgedTerm,
} from '@/lib/resume/resume-evidence-aliases'
import { isRecognizedAtsTerm } from '@/lib/resume/ats-term-lexicon'
import { isNonCompetencyMetadata } from '@/lib/resume/non-competency-metadata-filter'
import { isRelevantJobKeyword } from '@/lib/resume/keyword-filter'
import { isReportableAtsKeyword } from '@/lib/resume/keyword-report-filter'
import { extractCareerContext } from '@/lib/resume/resume-career-context'
import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

export type KeywordAuditStatus = 'approved' | 'modified' | 'purged'

export interface AuditedKeyword {
  original: string
  term: string
  status: KeywordAuditStatus
  reason: string
}

export interface KeywordAuditSummary {
  approved: AuditedKeyword[]
  modified: AuditedKeyword[]
  purged: AuditedKeyword[]
}

const SCRAPER_ARTIFACT_PATTERNS = [
  /\bposted(?:\s+posted)?\s+(?:\d+\s+)?(?:days?\s+)?ago\b/i,
  /\bposted\s+ago\b/i,
  /\bago\s+left\b/i,
  /\bleft\s+ago\b/i,
  /\bremuneration\s+refer\b/i,
  /\brefer\s+remuneration\b/i,
  /\bend\s+date\b/i,
  /\bstart\s+date\b/i,
  /\bclosing\s+date\b/i,
  /\bhybrid\s+locations?\b/i,
  /\blocations?\s+hybrid\b/i,
  /\bapply\s+now\b/i,
  /\bshare\s+job\b/i,
  /\bsimilar\s+jobs\b/i,
  /\bviewed\s+by\b/i,
  /\bapplicants?\s+applied\b/i,
  /\b\d+\s+applicants?\b/i,
  /\bposted\s+\d+\b/i,
  /\bjob\s+id\b/i,
  /\brequisition\s+(?:id|number|#)\b/i,
  /\bexpir(?:es|y|ed)\b/i,
  /\bcontract\s+length\b/i,
  /\bmonths?\s+extensions?\b/i,
  /\bab\s+hybrid\b/i,
  /\bhybrid\s+employment\b/i,
]

const SCRAPER_JUNK_TOKENS = new Set([
  'ago',
  'applied',
  'applicants',
  'contract',
  'employment',
  'expired',
  'expires',
  'extension',
  'extensions',
  'hybrid',
  'left',
  'months',
  'month',
  'posted',
  'posting',
  'refer',
  'remuneration',
  'requisition',
  'salary',
  'viewed',
])

const DOMAIN_MISMATCH_PATTERNS = [
  /\bred\s+seal\b/i,
  /\bjourneyman\b/i,
  /\bapprenticeship\b/i,
  /\bapprentice\b/i,
  /\btrade\s+certificate\b/i,
  /\bcarpenter\b/i,
  /\belectrician\s+journeyman\b/i,
  /\bplumber\b/i,
  /\bwelder\b/i,
  /\bunion\s+clause\b/i,
  /\bacademic\s+union\b/i,
  /\bnursing\s+license\b/i,
  /\brn\s+license\b/i,
  /\bregistered\s+nurse\b/i,
  /\bcpa\s+designation\b/i,
  /\bchartered\s+professional\s+accountant\b/i,
]

const PM_IT_ALIGNMENT_TERMS = new Set([
  'agile',
  'automation',
  'backlog',
  'change',
  'cloud',
  'confluence',
  'delivery',
  'devops',
  'digital',
  'integration',
  'internal',
  'it',
  'jira',
  'kanban',
  'management',
  'operations',
  'owner',
  'platform',
  'portfolio',
  'product',
  'program',
  'project',
  'release',
  'roadmap',
  'safe',
  'scrum',
  'sdlc',
  'software',
  'stakeholder',
  'strategy',
  'technical',
  'tools',
  'transformation',
  'waterfall',
  'workflow',
  'workflows',
  'operational',
  'excellence',
  'improvement',
  'process',
  'technology',
  'information',
])

const CONTEXTUAL_PHRASE_HINTS: Record<string, string> = {
  delivery: 'managed end-to-end software delivery',
  automation: 'workflow automation',
  digital: 'digital transformation',
  integration: 'system integration',
  operations: 'IT operations',
  strategy: 'delivery strategy',
  workflows: 'business workflows',
  'process improvement': 'process improvement through workflow automation',
  'operational excellence': 'operational excellence across technical operations',
  'information technology': 'information technology delivery and operations',
  'information systems': 'information systems and application delivery',
}

function normalizeTerm(term: string): string {
  return phraseWithoutStopWords(term.trim().toLowerCase())
}

function isScraperArtifact(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return true

  for (const pattern of SCRAPER_ARTIFACT_PATTERNS) {
    if (pattern.test(normalized)) return true
    pattern.lastIndex = 0
  }

  const tokens = tokenize(normalized)
  if (tokens.length <= 3 && tokens.every((token) => SCRAPER_JUNK_TOKENS.has(token))) {
    return true
  }

  if (tokens.length === 1 && SCRAPER_JUNK_TOKENS.has(tokens[0]!)) {
    return true
  }

  if (normalized.includes('posted') && normalized.includes('ago')) return true
  if (normalized.includes('remuneration') || normalized === 'refer') return true

  return false
}

function isDomainMismatch(term: string): boolean {
  const normalized = normalizeTerm(term)
  return DOMAIN_MISMATCH_PATTERNS.some((pattern) => {
    const matches = pattern.test(normalized)
    pattern.lastIndex = 0
    return matches
  })
}

function alignsWithPmItBackground(term: string, resumeText: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  if (isRecognizedAtsTerm(normalized)) return true
  if (PM_IT_ALIGNMENT_TERMS.has(normalized)) return true

  const tokens = tokenize(normalized)
  if (tokens.some((token) => PM_IT_ALIGNMENT_TERMS.has(token) || isRecognizedAtsTerm(token))) {
    return true
  }

  const career = extractCareerContext(resumeText)
  const haystack = `${resumeText} ${career.recentRoles.join(' ')} ${career.achievementBullets.join(' ')}`.toLowerCase()

  if (haystack.includes(normalized)) return true

  for (const alias of getResumeEvidenceAliases(normalized)) {
    if (haystack.includes(alias)) return true
  }

  if (resumeSupportsPurgedTerm(normalized, resumeText)) return true

  if (isItDomainTerm(normalized) && resumeShowsItExperience(haystack)) return true

  if (tokens.length === 1 && tokens[0]!.length >= 4) {
    return haystack.includes(tokens[0]!)
  }

  return false
}

function suggestContextualPhrase(term: string): string | null {
  const normalized = normalizeTerm(term)
  if (!normalized) return null

  if (CONTEXTUAL_PHRASE_HINTS[normalized]) {
    return CONTEXTUAL_PHRASE_HINTS[normalized]!
  }

  if (normalized.includes(' ') && isReportableAtsKeyword(normalized)) {
    return null
  }

  if (isRecognizedAtsTerm(normalized) && normalized.length >= 4) {
    return null
  }

  if (tokensAreBareSkill(normalized)) {
    return `demonstrated ${normalized} in delivery initiatives`
  }

  return null
}

function tokensAreBareSkill(term: string): boolean {
  const tokens = tokenize(term)
  return tokens.length === 1 && tokens[0]!.length >= 4 && !SCRAPER_JUNK_TOKENS.has(tokens[0]!)
}

export function auditKeywordTerm(term: string, resumeText = ''): AuditedKeyword {
  const original = term.trim()
  const normalized = normalizeTerm(original)

  if (!normalized || !isRelevantJobKeyword(normalized)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'Conversational or posting-admin filler',
    }
  }

  if (isNonCompetencyMetadata(normalized)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'Non-competency posting metadata (compensation, benefits, or salary)',
    }
  }

  if (isScraperArtifact(normalized)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'Job-board metadata or scraper artifact',
    }
  }

  if (isDomainMismatch(normalized)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'Domain credential or trade term not aligned with PM/IT background',
    }
  }

  if (resumeText.trim() && !alignsWithPmItBackground(normalized, resumeText)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'No evidence in resume for this PM/IT competency',
    }
  }

  if (!isReportableAtsKeyword(normalized)) {
    return {
      original,
      term: normalized,
      status: 'purged',
      reason: 'Not a reportable ATS skill or competency',
    }
  }

  const contextual = suggestContextualPhrase(normalized)
  if (contextual && contextual !== normalized) {
    return {
      original,
      term: contextual,
      status: 'modified',
      reason: 'Rephrased for natural accomplishment context',
    }
  }

  return {
    original,
    term: normalized,
    status: 'approved',
    reason: 'Approved ATS keyword',
  }
}

export function auditKeywordTerms(terms: string[], resumeText = ''): KeywordAuditSummary {
  const approved: AuditedKeyword[] = []
  const modified: AuditedKeyword[] = []
  const purged: AuditedKeyword[] = []
  const seen = new Set<string>()

  for (const term of terms) {
    const result = auditKeywordTerm(term, resumeText)
    const key = normalizeTerm(result.term)
    if (!key || seen.has(key)) continue
    seen.add(key)

    if (result.status === 'approved') approved.push(result)
    else if (result.status === 'modified') modified.push(result)
    else purged.push(result)
  }

  return { approved, modified, purged }
}

export function filterAuditedKeywordTerms(terms: string[], resumeText = ''): string[] {
  const audit = auditKeywordTerms(terms, resumeText)
  return [
    ...audit.approved.map((entry) => entry.term),
    ...audit.modified.map((entry) => entry.term),
  ]
}

export function stripJobBoardMetadata(text: string): string {
  let cleaned = text

  for (const pattern of SCRAPER_ARTIFACT_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
    pattern.lastIndex = 0
  }

  return cleaned.replace(/\s+/g, ' ').trim()
}
