import { extractHighValueKeywords, isHighValueKeyword } from '@/lib/resume/keyword-extraction'
import { stripIrrelevantJobDescriptionText } from '@/lib/resume/keyword-filter'
import {
  filterCompetencyKeywords,
  filterCompetencyTargetSkills,
} from '@/lib/resume/non-competency-metadata-filter'
import { tokenize } from '@/lib/resume/stopwords'

export type SkillCategory = 'methodology' | 'competency' | 'domainTech' | 'tool'

export interface TargetSkill {
  term: string
  category: SkillCategory
}

/** Guaranteed high-value targets — scanned via strict regex before NLP extraction. */
const EXPLICIT_TARGET_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\bagile\b/gi, term: 'agile' },
  { pattern: /\bkanban\b/gi, term: 'kanban' },
  { pattern: /\bwaterfall\b/gi, term: 'waterfall' },
  { pattern: /\bscrum\b/gi, term: 'scrum' },
  { pattern: /\bautomation\b/gi, term: 'automation' },
  { pattern: /\bscope\b/gi, term: 'scope' },
  { pattern: /\bscope management\b/gi, term: 'scope management' },
  { pattern: /\bjira\b/gi, term: 'jira' },
  { pattern: /\bprogram management\b/gi, term: 'program management' },
  { pattern: /\bproject management\b/gi, term: 'project management' },
  { pattern: /\bcustom software\b/gi, term: 'custom software' },
  { pattern: /\bworkflows?\b/gi, term: 'workflows' },
  { pattern: /\bai agents?\b/gi, term: 'ai agents' },
  { pattern: /\bworkflow automation\b/gi, term: 'workflow automation' },
  { pattern: /\bprocess improvement\b/gi, term: 'process improvement' },
  { pattern: /\boperational excellence\b/gi, term: 'operational excellence' },
  { pattern: /\binformation technology\b/gi, term: 'information technology' },
  { pattern: /\binformation systems\b/gi, term: 'information systems' },
  { pattern: /\bdevops\b/gi, term: 'devops' },
  { pattern: /\bsdlc\b/gi, term: 'sdlc' },
  { pattern: /\bsafe\b/gi, term: 'safe' },
  { pattern: /\bstrategy\b/gi, term: 'strategy' },
  { pattern: /\broadmap\b/gi, term: 'roadmap' },
  { pattern: /\bproduct owner\b/gi, term: 'product owner' },
  { pattern: /\bbacklog\b/gi, term: 'backlog' },
  { pattern: /\binternal tools\b/gi, term: 'internal tools' },
  { pattern: /\bcustom automation platforms?\b/gi, term: 'custom automation platforms' },
]

const METHODOLOGY_TERMS = new Set([
  'agile',
  'scrum',
  'kanban',
  'waterfall',
  'safe',
  'devops',
  'sdlc',
  'itil',
  'cicd',
  'ci/cd',
  'pmp',
  'pmo',
  'lean',
])

const COMPETENCY_PATTERNS = [
  /\bprogram management\b/gi,
  /\bproject management\b/gi,
  /\bscope management\b/gi,
  /\bscope\b/gi,
  /\bstakeholder management\b/gi,
  /\brisk management\b/gi,
  /\bchange management\b/gi,
  /\bdelivery\b/gi,
  /\bservice delivery\b/gi,
  /\bsoftware delivery\b/gi,
  /\bcross-functional\b/gi,
  /\bproduct management\b/gi,
  /\bproduct owner\b/gi,
  /\bbacklog\b/gi,
  /\bstrategy\b/gi,
  /\broadmap\b/gi,
  /\bprocess improvement\b/gi,
  /\boperational excellence\b/gi,
  /\binformation technology\b/gi,
  /\binformation systems\b/gi,
]

const DOMAIN_PATTERNS = [
  /\bai agents?\b/gi,
  /\bworkflow automation\b/gi,
  /\bautomation\b/gi,
  /\bcustom software\b/gi,
  /\bworkflows?\b/gi,
  /\binternal tools\b/gi,
  /\bdigital transformation\b/gi,
  /\bapplication development\b/gi,
  /\bsoftware\b/gi,
  /\bintegration\b/gi,
  /\barchitecture\b/gi,
  /\bgovernance\b/gi,
]

const TOOL_TERMS = new Set([
  'jira',
  'confluence',
  'sharepoint',
  'azure',
  'aws',
  'sql',
  'python',
  'typescript',
  'javascript',
  'kubernetes',
  'terraform',
  'salesforce',
  'servicenow',
])

function normalizeTerm(term: string): string {
  return tokenize(term).join(' ')
}

export function categorizeSkill(term: string): SkillCategory {
  const normalized = normalizeTerm(term)
  const tokens = tokenize(normalized)

  if (tokens.some((token) => TOOL_TERMS.has(token))) return 'tool'
  if (tokens.some((token) => METHODOLOGY_TERMS.has(token))) return 'methodology'

  for (const pattern of DOMAIN_PATTERNS) {
    if (pattern.test(normalized)) {
      pattern.lastIndex = 0
      return 'domainTech'
    }
    pattern.lastIndex = 0
  }

  for (const pattern of COMPETENCY_PATTERNS) {
    if (pattern.test(normalized)) {
      pattern.lastIndex = 0
      return 'competency'
    }
    pattern.lastIndex = 0
  }

  if (normalized.includes('management') || normalized.includes('delivery')) {
    return 'competency'
  }

  return 'domainTech'
}

function categoryRank(category: SkillCategory): number {
  switch (category) {
    case 'methodology':
      return 4
    case 'competency':
      return 3
    case 'domainTech':
      return 2
    case 'tool':
      return 1
  }
}

function extractExplicitTargets(cleanedText: string): string[] {
  const found: string[] = []
  const normalized = cleanedText.toLowerCase()

  for (const { pattern, term } of EXPLICIT_TARGET_PATTERNS) {
    if (pattern.test(normalized) && isHighValueKeyword(term)) {
      found.push(normalizeTerm(term))
    }
    pattern.lastIndex = 0
  }

  return found
}

/** Strict regex-only skill matches — safe for resume body text. */
export function extractExplicitTargetSkills(text: string): TargetSkill[] {
  const byTerm = new Map<string, TargetSkill>()

  for (const term of extractExplicitTargets(text)) {
    if (!byTerm.has(term)) {
      byTerm.set(term, { term, category: categorizeSkill(term) })
    }
  }

  return [...byTerm.values()]
}

/**
 * Step 1: Parse the job description and return cleaned high-value skills.
 * Combines strict regex matching with NLP extraction — no conversational filler.
 */
export function extrapolateTargetSkills(jobDescription: string): TargetSkill[] {
  const cleaned = stripIrrelevantJobDescriptionText(jobDescription)
  const byTerm = new Map<string, TargetSkill>()

  for (const skill of extractExplicitTargetSkills(cleaned)) {
    byTerm.set(skill.term, skill)
  }

  for (const keyword of extractHighValueKeywords(cleaned)) {
    const term = normalizeTerm(keyword)
    if (!term || byTerm.has(term)) continue
    byTerm.set(term, { term, category: categorizeSkill(term) })
  }

  return filterCompetencyTargetSkills(
    [...byTerm.values()].sort((a, b) => {
      const rankDiff = categoryRank(b.category) - categoryRank(a.category)
      if (rankDiff !== 0) return rankDiff
      return a.term.localeCompare(b.term)
    })
  )
}

export function targetSkillTerms(skills: TargetSkill[]): string[] {
  return skills.map((skill) => skill.term)
}

export function keywordsToTargetSkills(keywords: string[]): TargetSkill[] {
  const byTerm = new Map<string, TargetSkill>()

  for (const keyword of filterCompetencyKeywords(keywords)) {
    const term = normalizeTerm(keyword)
    if (!term || byTerm.has(term)) continue
    byTerm.set(term, { term, category: categorizeSkill(term) })
  }

  return [...byTerm.values()]
}
