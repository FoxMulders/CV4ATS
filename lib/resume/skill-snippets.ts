import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'

export interface SuggestedAddition {
  skill: string
  category: SkillCategory
  snippet: string
  placement: 'summary' | 'skills' | 'experience'
}

export function buildSuggestedAddition(skill: TargetSkill): SuggestedAddition {
  const { term, category } = skill

  switch (category) {
    case 'methodology':
      return {
        skill: term,
        category,
        placement: 'experience',
        snippet: `Led cross-functional delivery utilizing ${term} methodologies to improve predictability and stakeholder alignment.`,
      }
    case 'competency':
      return {
        skill: term,
        category,
        placement: 'experience',
        snippet: `Directed ${term} initiatives with executive scope oversight across complex technology programs.`,
      }
    case 'tool':
      return {
        skill: term,
        category,
        placement: 'skills',
        snippet: `${term.charAt(0).toUpperCase()}${term.slice(1)}`,
      }
    default:
      return {
        skill: term,
        category,
        placement: 'experience',
        snippet: `Delivered ${term} solutions that improved operational efficiency and measurable business outcomes.`,
      }
  }
}

export function buildSnippetForKeyword(keyword: string): SuggestedAddition {
  const skill = keywordsToTargetSkills([keyword])[0]
  if (!skill) {
    return {
      skill: keyword,
      category: 'domainTech',
      placement: 'experience',
      snippet: `Delivered ${keyword} initiatives that improved operational efficiency and measurable business outcomes.`,
    }
  }
  return buildSuggestedAddition(skill)
}

export function buildSnippetsForKeywords(keywords: string[]): SuggestedAddition[] {
  return keywords.map((keyword) => buildSnippetForKeyword(keyword))
}

export function appendSnippetsToResume(resumeText: string, snippets: string[]): string {
  return snippets
    .map((snippet) => snippet.trim())
    .filter(Boolean)
    .reduce((text, snippet) => `${text.trim()}\n\n${snippet}`, resumeText.trim())
}
