import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { buildSkillAnchor } from '@/lib/resume/thematic-skill-anchor'
import { variationSeedFor } from '@/lib/resume/resume-career-context'

export interface SuggestedAddition {
  skill: string
  category: SkillCategory
  /** Modified bullet/summary text — not a freestanding sentence. */
  snippet: string
  placement: 'summary' | 'skills' | 'experience'
  originalBullet?: string
  targetRoleTitle?: string
  targetCompany?: string
  placementLabel?: string
  bulletLineIndex?: number
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  domainLabel?: string
}

export interface SnippetGenerationContext {
  resumeText?: string
  jobDescription?: string
  siblingSnippets?: string[]
  variationIndex?: number
}

function diversifyIntegratedBullet(
  anchorSnippet: string,
  skill: TargetSkill,
  context: SnippetGenerationContext
): string {
  const siblings = context.siblingSnippets ?? []
  if (!siblings.some((entry) => entry.toLowerCase() === anchorSnippet.toLowerCase())) {
    return anchorSnippet
  }

  const seed = variationSeedFor(skill.term, context.variationIndex ?? 0)
  const base = anchorSnippet.endsWith('.') ? anchorSnippet.slice(0, -1) : anchorSnippet
  const alternates = [
    `${base}, with measurable ${skill.term} outcomes.`,
    `${base} to advance ${skill.term} across the organization.`,
    `${base} while strengthening ${skill.term} in daily execution.`,
  ]

  for (let offset = 0; offset < alternates.length; offset += 1) {
    const candidate = alternates[(seed + offset) % alternates.length]!
    if (!siblings.some((entry) => entry.toLowerCase() === candidate.toLowerCase())) {
      return candidate
    }
  }

  return anchorSnippet
}

export function buildSuggestedAddition(
  skill: TargetSkill,
  context: SnippetGenerationContext = {}
): SuggestedAddition {
  const resumeText = context.resumeText ?? ''
  const anchor = buildSkillAnchor(skill, resumeText)
  const snippet = diversifyIntegratedBullet(anchor.modifiedBullet, skill, context)

  return {
    skill: skill.term,
    category: skill.category,
    placement: anchor.placement,
    snippet,
    originalBullet: anchor.originalBullet,
    targetRoleTitle: anchor.position?.title,
    targetCompany: anchor.position?.company,
    placementLabel: anchor.placementLabel,
    bulletLineIndex: anchor.bulletLineIndex,
    modificationType: anchor.modificationType,
    domainLabel: anchor.position?.domainLabel,
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

/** @deprecated Use applyAnchoredSkillModifications for inline bullet updates. */
export function appendSnippetsToResume(resumeText: string, snippets: string[]): string {
  return snippets
    .map((snippet) => snippet.trim())
    .filter(Boolean)
    .reduce((text, snippet) => `${text.trim()}\n\n${snippet}`, resumeText.trim())
}
