import { isRecognizedAtsTerm } from '@/lib/resume/ats-term-lexicon'
import { extractCareerContext } from '@/lib/resume/resume-career-context'
import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

const PROPOSED_SKILL_BLOCK_PATTERNS = [
  /\bsalary\b/i,
  /\bcompensation\b/i,
  /\bextension?s?\b/i,
  /\bhybrid employment\b/i,
  /\bab hybrid\b/i,
  /\bjob title\b/i,
  /\brandstad\b/i,
  /\bmunicipal client\b/i,
  /\bmotor association\b/i,
  /\bmonths?\b/i,
  /\bemployment type\b/i,
  /\bfox escapes\b/i,
  /\bintermediate project manager\b/i,
  /\bcomputer systems technology\b/i,
]

const JOB_TITLE_PATTERNS = [
  /\b(?:senior|junior|lead|principal|intermediate|associate|staff)\s+(?:project|program|product)\s+manager\b/i,
  /\bproject manager\b/i,
  /\bprogram manager\b/i,
  /\bproduct manager\b/i,
]

const ALLOWLIST_MULTI_WORD_SKILLS = new Set([
  'acceptance criteria',
  'agile',
  'application development',
  'automation',
  'backlog',
  'change management',
  'ci/cd',
  'cicd',
  'cloud computing',
  'confluence',
  'continuous delivery',
  'continuous integration',
  'cross-functional',
  'custom automation platforms',
  'custom software',
  'custom software development',
  'data governance',
  'devops',
  'digital transformation',
  'enterprise architecture',
  'internal tools',
  'it operations',
  'itil',
  'jira',
  'kanban',
  'product management',
  'product owner',
  'program management',
  'project management',
  'risk management',
  'roadmap',
  'safe',
  'scope management',
  'sdlc',
  'service delivery',
  'sharepoint',
  'software delivery',
  'stakeholder management',
  'strategy',
  'technical project manager',
  'user stories',
  'waterfall',
  'workflow automation',
  'workflows',
  'ai agents',
  'ai agent',
])

const ALLOWLIST_SINGLE_WORD_SKILLS = new Set([
  'agile',
  'ai',
  'automation',
  'aws',
  'azure',
  'backlog',
  'confluence',
  'devops',
  'jira',
  'kanban',
  'python',
  'roadmap',
  'safe',
  'scrum',
  'sdlc',
  'sharepoint',
  'sql',
  'strategy',
  'terraform',
  'typescript',
  'waterfall',
  'workflows',
  'scope',
])

function normalizeTerm(term: string): string {
  return phraseWithoutStopWords(term.trim().toLowerCase())
}

function tokenOverlapCount(left: string, right: string): number {
  const leftTokens = new Set(tokenize(normalizeTerm(left)))
  return tokenize(normalizeTerm(right)).filter((token) => leftTokens.has(token)).length
}

function mentionsCareerEntity(term: string, entity: string): boolean {
  const normalizedTerm = normalizeTerm(term)
  const normalizedEntity = normalizeTerm(entity)
  if (!normalizedTerm || !normalizedEntity) return false

  if (
    normalizedTerm.includes(normalizedEntity) ||
    normalizedEntity.includes(normalizedTerm)
  ) {
    return true
  }

  const entityTokens = tokenize(normalizedEntity)
  const overlap = tokenOverlapCount(normalizedTerm, normalizedEntity)
  if (entityTokens.length >= 2 && overlap >= 2) return true
  if (entityTokens.length === 1 && overlap >= 1) return true

  return false
}

function looksLikeJobTitle(term: string): boolean {
  const normalized = normalizeTerm(term)
  return JOB_TITLE_PATTERNS.some((pattern) => {
    const matches = pattern.test(normalized)
    pattern.lastIndex = 0
    return matches
  })
}

function isAllowlistedSkill(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  if (ALLOWLIST_MULTI_WORD_SKILLS.has(normalized)) return true
  if (ALLOWLIST_SINGLE_WORD_SKILLS.has(normalized)) return true

  const tokens = tokenize(normalized)
  if (tokens.length === 1) {
    return (
      ALLOWLIST_SINGLE_WORD_SKILLS.has(tokens[0]!) ||
      isRecognizedAtsTerm(tokens[0]!)
    )
  }

  return false
}

export function isProposableSkill(term: string, resumeText: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized || normalized.length < 2) return false

  for (const pattern of PROPOSED_SKILL_BLOCK_PATTERNS) {
    if (pattern.test(normalized)) return false
    pattern.lastIndex = 0
  }

  if (looksLikeJobTitle(normalized)) return false

  const career = extractCareerContext(resumeText)
  for (const employer of career.employers) {
    if (mentionsCareerEntity(normalized, employer)) return false
  }
  for (const role of career.recentRoles) {
    if (mentionsCareerEntity(normalized, role)) return false
  }

  if (!isAllowlistedSkill(normalized)) return false

  return true
}

export function filterProposableSkills(terms: string[], resumeText: string): string[] {
  const seen = new Set<string>()
  const filtered: string[] = []

  for (const term of terms) {
    const normalized = normalizeTerm(term)
    if (!normalized || seen.has(normalized)) continue
    if (!isProposableSkill(normalized, resumeText)) continue
    seen.add(normalized)
    filtered.push(normalized)
  }

  return filtered
}
