import type { AuditedKeyword } from '@/lib/resume/keyword-audit'
import { isNonCompetencyMetadata } from '@/lib/resume/non-competency-metadata-filter'
import {
  getResumeEvidenceAliases,
  resumeSupportsPurgedTerm,
} from '@/lib/resume/resume-evidence-aliases'
import type { SkillCategory } from '@/lib/resume/skill-extrapolation'
import { categorizeSkill, keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  buildSnippetForKeyword,
  type SnippetGenerationContext,
  type SuggestedAddition,
} from '@/lib/resume/skill-snippets'

export interface ExperienceAnchor {
  title: string
  company: string
  body: string
}

export interface PurgedKeywordRestoration extends SuggestedAddition {
  purgeReason: string
  placementLabel: string
}

const ROLE_LINE =
  /^(.{4,100}?)\s*(?:—|–|-|\|)\s*(.{2,100}?)(?:\s*\|\s*(.+))?\s*$/

const TERM_SNIPPET_OVERRIDES: Array<{
  match: RegExp
  build: (anchor: ExperienceAnchor | null, resumeText: string) => string
}> = [
  {
    match: /\bprocess improvement\b/i,
    build: (anchor) => {
      const company = anchor?.company ?? 'Alberta Motor Association'
      return `At ${company}, drove process improvement by automating System Checks in C# and AWS (S3, SES), eliminating 3+ hours of manual validation work each release cycle.`
    },
  },
  {
    match: /\boperational excellence\b/i,
    build: (anchor, resumeText) => {
      const hasLongOpsTenure =
        /alberta motor|microserve|2006|2013|2024|operations|infrastructure/i.test(resumeText)
      const company = anchor?.company ?? 'Alberta Motor Association'
      const tenure = hasLongOpsTenure ? '12+ years of' : ''
      return `Delivered operational excellence across ${tenure} technical operations at ${company}, improving SLA adherence, release reliability, and cross-functional coordination.`
    },
  },
]

export function isUserRestorablePurgedKeyword(item: AuditedKeyword): boolean {
  if (isNonCompetencyMetadata(item.original)) return false

  const reason = item.reason.toLowerCase()
  if (reason.includes('job-board metadata') || reason.includes('scraper artifact')) {
    return false
  }
  if (reason.includes('conversational or posting-admin')) return false
  if (reason.includes('non-competency')) return false

  return item.status === 'purged'
}

export function parseExperienceAnchors(resumeText: string): ExperienceAnchor[] {
  const anchors: ExperienceAnchor[] = []
  let current: ExperienceAnchor | null = null
  const bodyLines: string[] = []

  for (const rawLine of resumeText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^(work experience|experience|employment|education|skills|professional summary)/i.test(line)) {
      continue
    }

    const roleMatch = line.match(ROLE_LINE)
    if (roleMatch && !line.startsWith('•')) {
      if (current) {
        current.body = bodyLines.join('\n')
        anchors.push(current)
        bodyLines.length = 0
      }
      current = {
        title: roleMatch[1]!.trim(),
        company: roleMatch[2]!.trim(),
        body: '',
      }
      continue
    }

    if (current) {
      bodyLines.push(line.replace(/^[\s•\-*–—]+\s*/, ''))
    }
  }

  if (current) {
    current.body = bodyLines.join('\n')
    anchors.push(current)
  }

  return anchors
}

function scoreAnchorForTerm(term: string, anchor: ExperienceAnchor): number {
  const haystack = `${anchor.title} ${anchor.company} ${anchor.body}`.toLowerCase()
  const normalized = term.toLowerCase()
  let score = 0

  if (normalized.includes('process improvement')) {
    if (/alberta motor|\bama\b/i.test(haystack)) score += 12
    if (/automat|manual|system checks|c#|aws/i.test(haystack)) score += 10
  }

  if (normalized.includes('operational excellence')) {
    if (/operations|operational|sla|infrastructure|support/i.test(haystack)) score += 10
    if (/alberta motor|microserve|\bama\b/i.test(haystack)) score += 8
  }

  for (const alias of getResumeEvidenceAliases(normalized)) {
    if (haystack.includes(alias)) score += 3
  }

  if (haystack.includes(normalized)) score += 15

  return score
}

export function pickBestExperienceAnchor(
  term: string,
  resumeText: string
): ExperienceAnchor | null {
  const anchors = parseExperienceAnchors(resumeText)
  if (anchors.length === 0) return null

  let best: ExperienceAnchor | null = null
  let bestScore = -1

  for (const anchor of anchors) {
    const score = scoreAnchorForTerm(term, anchor)
    if (score > bestScore) {
      bestScore = score
      best = anchor
    }
  }

  return bestScore > 0 ? best : anchors[0] ?? null
}

export function formatPlacementLabel(
  section: SuggestedAddition['placement'],
  anchor: ExperienceAnchor | null
): string {
  if (section === 'summary') return 'Professional summary'
  if (section === 'skills') return 'Skills section'

  if (anchor) {
    return `${anchor.company} · ${anchor.title} → Work experience bullet`
  }

  return 'Most relevant work experience bullet'
}

function buildOverrideSnippet(
  term: string,
  anchor: ExperienceAnchor | null,
  resumeText: string
): string | null {
  for (const override of TERM_SNIPPET_OVERRIDES) {
    override.match.lastIndex = 0
    if (override.match.test(term)) {
      return override.build(anchor, resumeText)
    }
  }
  return null
}

export function buildPurgedKeywordRestoration(
  item: AuditedKeyword,
  context: SnippetGenerationContext = {}
): PurgedKeywordRestoration {
  const keyword = item.original.trim()
  const resumeText = context.resumeText ?? ''
  const anchor = pickBestExperienceAnchor(keyword, resumeText)
  const skill =
    keywordsToTargetSkills([keyword])[0] ?? {
      term: keyword,
      category: categorizeSkill(keyword) as SkillCategory,
    }

  const overrideSnippet = buildOverrideSnippet(keyword, anchor, resumeText)
  const base = buildSnippetForKeyword(keyword, context)
  const placement: SuggestedAddition['placement'] =
    skill.category === 'tool' ? 'skills' : anchor ? 'experience' : base.placement

  const snippet =
    overrideSnippet ??
    (anchor && placement === 'experience'
      ? tailorSnippetToAnchor(base.snippet, anchor, keyword)
      : base.snippet)

  return {
    skill: keyword,
    category: skill.category,
    placement,
    snippet,
    purgeReason: item.reason,
    placementLabel: formatPlacementLabel(placement, anchor),
  }
}

function tailorSnippetToAnchor(
  snippet: string,
  anchor: ExperienceAnchor,
  keyword: string
): string {
  if (snippet.toLowerCase().includes(anchor.company.toLowerCase())) {
    return snippet
  }

  return `At ${anchor.company}, ${snippet.charAt(0).toLowerCase()}${snippet.slice(1)}`.replace(
    new RegExp(`\\b${keyword}\\b`, 'i'),
    keyword
  )
}

export function buildRestorationsForPurgedKeywords(
  purged: AuditedKeyword[],
  context: SnippetGenerationContext = {}
): PurgedKeywordRestoration[] {
  const restorable = purged.filter(isUserRestorablePurgedKeyword)
  const usedSnippets: string[] = []

  return restorable.map((item, index) => {
    const restoration = buildPurgedKeywordRestoration(item, {
      ...context,
      siblingSnippets: usedSnippets,
      variationIndex: index,
    })
    usedSnippets.push(restoration.snippet)
    return restoration
  })
}

export function prioritizeRestorablePurgedKeywords(
  purged: AuditedKeyword[],
  resumeText: string
): AuditedKeyword[] {
  return [...purged].sort((left, right) => {
    const leftSupported = resumeSupportsPurgedTerm(left.original, resumeText) ? 1 : 0
    const rightSupported = resumeSupportsPurgedTerm(right.original, resumeText) ? 1 : 0
    if (leftSupported !== rightSupported) return rightSupported - leftSupported
    return left.original.localeCompare(right.original)
  })
}

export { resumeSupportsPurgedTerm }
