import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  extractCareerContext,
  pickContextEmployer,
  pickContextRole,
  variationSeedFor,
} from '@/lib/resume/resume-career-context'

export interface SuggestedAddition {
  skill: string
  category: SkillCategory
  snippet: string
  placement: 'summary' | 'skills' | 'experience'
}

export interface SnippetGenerationContext {
  resumeText?: string
  jobDescription?: string
  siblingSnippets?: string[]
  variationIndex?: number
}

const BANNED_OPENERS = [
  'directed',
  'led cross-functional delivery utilizing',
  'delivered',
  'led',
]

type TemplateBuilder = (
  term: string,
  context: ReturnType<typeof extractCareerContext>,
  seed: number
) => string

const METHODOLOGY_TEMPLATES: TemplateBuilder[] = [
  (term, context, seed) => {
    const employer = pickContextEmployer(context, seed)
    return employer
      ? `Standardized ${term} cadences at ${employer} to tighten release predictability across dependent teams.`
      : `Institutionalized ${term} practices that shortened feedback loops between planning and delivery.`
  },
  (term, context, seed) => {
    const role = pickContextRole(context, seed + 1)
    return role
      ? `As ${role}, operationalized ${term} ceremonies that clarified ownership and reduced delivery friction.`
      : `Coached teams through ${term} adoption while preserving executive visibility into milestone health.`
  },
  (term) =>
    `Synchronized backlog, sprint, and release rhythms using ${term} to keep multi-workstream programs aligned.`,
  (term, context, seed) => {
    const employer = pickContextEmployer(context, seed + 2)
    return employer
      ? `Embedded ${term} governance at ${employer} so roadmap trade-offs were resolved before build cycles slipped.`
      : `Applied ${term} to translate strategy into sequenced delivery with fewer late-stage scope surprises.`
  },
]

const COMPETENCY_TEMPLATES: TemplateBuilder[] = [
  (term, context, seed) => {
    const employer = pickContextEmployer(context, seed)
    return employer
      ? `At ${employer}, exercised ${term} to coordinate dependencies across business and engineering stakeholders.`
      : `Used ${term} to keep complex programs on track when priorities shifted mid-quarter.`
  },
  (term, context, seed) => {
    const role = pickContextRole(context, seed + 1)
    return role
      ? `In a ${role} capacity, strengthened ${term} by tying milestone plans to measurable business outcomes.`
      : `Strengthened ${term} by converting executive objectives into sequenced, accountable workstreams.`
  },
  (term) =>
    `Balanced competing priorities through ${term}, preserving delivery momentum without sacrificing quality gates.`,
  (term, context, seed) => {
    const employer = pickContextEmployer(context, seed + 3)
    return employer
      ? `While at ${employer}, expanded ${term} coverage so cross-functional handoffs stayed visible to leadership.`
      : `Expanded ${term} discipline so risk, scope, and resourcing decisions were resolved earlier in the cycle.`
  },
]

const DOMAIN_TEMPLATES: TemplateBuilder[] = [
  (term, context, seed) => {
    const employer = pickContextEmployer(context, seed)
    return employer
      ? `At ${employer}, applied ${term} to modernize internal workflows and reduce manual handoffs.`
      : `Applied ${term} to streamline operational workflows and improve throughput across delivery teams.`
  },
  (term, context, seed) => {
    if (context.achievementBullets.length === 0) {
      return `Translated platform improvements into ${term} capabilities that supported faster, safer releases.`
    }
    const bullet = context.achievementBullets[seed % context.achievementBullets.length]!
    return `Built on delivery experience such as "${bullet.slice(0, 60)}…" by deepening ${term} across the stack.`
  },
  (term) =>
    `Connected engineering output to business value by embedding ${term} into day-to-day delivery practices.`,
  (term, context, seed) => {
    const role = pickContextRole(context, seed + 2)
    return role
      ? `From a ${role} perspective, leveraged ${term} to reduce rework and improve operational reliability.`
      : `Leveraged ${term} to reduce rework while keeping architecture decisions pragmatic and incremental.`
  },
]

function templatesForCategory(category: SkillCategory): TemplateBuilder[] {
  switch (category) {
    case 'methodology':
      return METHODOLOGY_TEMPLATES
    case 'competency':
      return COMPETENCY_TEMPLATES
    case 'tool':
      return []
    default:
      return DOMAIN_TEMPLATES
  }
}

function openingPhrase(snippet: string): string {
  return snippet
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .toLowerCase()
}

function isTooSimilar(candidate: string, existing: string[]): boolean {
  const opener = openingPhrase(candidate)

  const matchedBanned = BANNED_OPENERS.find((banned) => opener.startsWith(banned))
  if (matchedBanned) {
    return existing.some((snippet) => openingPhrase(snippet).startsWith(matchedBanned))
  }

  return existing.some((snippet) => {
    const other = openingPhrase(snippet)
    return other === opener || snippet.toLowerCase() === candidate.toLowerCase()
  })
}

function buildDiversifiedSnippet(
  skill: TargetSkill,
  context: SnippetGenerationContext = {}
): string {
  const { term, category } = skill
  if (category === 'tool') {
    return term.charAt(0).toUpperCase() + term.slice(1)
  }

  const career = extractCareerContext(context.resumeText ?? '')
  const templates = templatesForCategory(category)
  const siblings = context.siblingSnippets ?? []
  const baseSeed = variationSeedFor(term, context.variationIndex ?? 0)

  for (let offset = 0; offset < templates.length * 2; offset += 1) {
    const seed = baseSeed + offset
    const template = templates[seed % templates.length]
    if (!template) continue
    const candidate = template(term, career, seed)
    if (!isTooSimilar(candidate, siblings)) {
      return candidate
    }
  }

  const fallback = templates[baseSeed % templates.length]
  return fallback ? fallback(term, career, baseSeed) : term
}

export function buildSuggestedAddition(
  skill: TargetSkill,
  context: SnippetGenerationContext = {}
): SuggestedAddition {
  const { term, category } = skill
  const placement: SuggestedAddition['placement'] = category === 'tool' ? 'skills' : 'experience'

  return {
    skill: term,
    category,
    placement,
    snippet: buildDiversifiedSnippet(skill, context),
  }
}

export function buildSnippetForKeyword(
  keyword: string,
  context: SnippetGenerationContext = {}
): SuggestedAddition {
  const skill = keywordsToTargetSkills([keyword])[0]
  if (!skill) {
    return buildSuggestedAddition({ term: keyword, category: 'domainTech' }, context)
  }
  return buildSuggestedAddition(skill, context)
}

export function buildSnippetsForKeywords(
  keywords: string[],
  context: Omit<SnippetGenerationContext, 'siblingSnippets' | 'variationIndex'> = {}
): SuggestedAddition[] {
  const usedSnippets: string[] = []

  return keywords.map((keyword, index) => {
    const addition = buildSnippetForKeyword(keyword, {
      ...context,
      siblingSnippets: usedSnippets,
      variationIndex: index,
    })
    usedSnippets.push(addition.snippet)
    return addition
  })
}

export function appendSnippetsToResume(resumeText: string, snippets: string[]): string {
  return snippets
    .map((snippet) => snippet.trim())
    .filter(Boolean)
    .reduce((text, snippet) => `${text.trim()}\n\n${snippet}`, resumeText.trim())
}
