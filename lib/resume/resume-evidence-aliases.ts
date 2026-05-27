import { isLikelyPersonName, isPostingArtifact } from '@/lib/resume/posting-artifact-filter'

/** JD competency terms → resume language that satisfies evidence checks. */
export const RESUME_EVIDENCE_ALIASES: Record<string, string[]> = {
  'information technology': [
    ' it ',
    'it experience',
    'technical',
    'software',
    'computer systems',
    'systems technology',
    'information systems',
    'technical operations',
    'technical analyst',
    'technical projects',
    'application development',
    'software delivery',
  ],
  'information systems': [
    'computer systems',
    'systems technology',
    'software',
    'technical',
    ' it ',
    'it experience',
  ],
  'it services': ['technical support', 'service delivery', 'sla', ' it ', 'operations'],
  'it operations': ['operations', 'infrastructure', 'release', 'deployment', 'technical operations'],
  'operational excellence': [
    'operations',
    'operational',
    'sla',
    'service delivery',
    'infrastructure',
    'release',
    'support team',
  ],
  'process improvement': [
    'automation',
    'automated',
    'manual',
    'workflow',
    'process',
    'system checks',
    'reducing manual',
  ],
  'continuous improvement': ['automation', 'optimized', 'improve', 'reliability', 'efficiency'],
  'change management': ['release', 'deployment', 'stakeholder', 'rollout', 'governance'],
}

const IT_BACKGROUND_PATTERN =
  /\b(?:\bit\b|i\.t\.|information technology|information systems|technical|software|systems technology|computer systems|developer|devops|infrastructure|application development|software delivery|technical analyst|technical operations|technical support|project manager)\b/i

const IT_DOMAIN_TERMS = new Set([
  'information technology',
  'information systems',
  'it services',
  'it operations',
  'it delivery',
  'it support',
  'it infrastructure',
])

export function getResumeEvidenceAliases(term: string): string[] {
  const normalized = term.trim().toLowerCase()
  return RESUME_EVIDENCE_ALIASES[normalized] ?? []
}

export function resumeShowsItExperience(resumeText: string): boolean {
  return IT_BACKGROUND_PATTERN.test(resumeText.toLowerCase())
}

export function isItDomainTerm(term: string): boolean {
  const normalized = term.trim().toLowerCase()
  if (IT_DOMAIN_TERMS.has(normalized)) return true
  return /\bit (?:services|operations|delivery|support|infrastructure)\b/i.test(normalized)
}

function aliasMatchesHaystack(alias: string, haystack: string): boolean {
  const trimmed = alias.trim().toLowerCase()
  if (trimmed === 'it') {
    return /\bit\b/i.test(haystack)
  }
  return haystack.includes(trimmed)
}

export function resumeSupportsPurgedTerm(term: string, resumeText: string): boolean {
  const haystack = resumeText.toLowerCase()
  const normalized = term.trim().toLowerCase()
  if (!normalized || !haystack.trim()) return false
  if (isPostingArtifact(normalized) || isLikelyPersonName(normalized)) return false

  if (haystack.includes(normalized)) return true

  if (isItDomainTerm(normalized) && resumeShowsItExperience(resumeText)) {
    return true
  }

  const aliases = getResumeEvidenceAliases(normalized)
  if (aliases.some((alias) => aliasMatchesHaystack(alias, haystack))) return true

  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.length > 1 && !isLikelyPersonName(normalized)) {
    const matched = tokens.filter((token) => {
      const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      return pattern.test(haystack)
    }).length
    if (matched >= Math.ceil(tokens.length * 0.75)) return true
  }

  if (normalized === 'technology' && resumeShowsItExperience(resumeText)) {
    return true
  }

  return false
}
