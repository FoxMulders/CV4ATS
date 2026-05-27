export const RESUME_EVIDENCE_ALIASES: Record<string, string[]> = {
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

export function getResumeEvidenceAliases(term: string): string[] {
  const normalized = term.trim().toLowerCase()
  return RESUME_EVIDENCE_ALIASES[normalized] ?? []
}

export function resumeSupportsPurgedTerm(term: string, resumeText: string): boolean {
  const haystack = resumeText.toLowerCase()
  const normalized = term.trim().toLowerCase()
  if (haystack.includes(normalized)) return true

  const aliases = getResumeEvidenceAliases(normalized)
  if (aliases.some((alias) => haystack.includes(alias))) return true

  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 4)
  if (tokens.length > 1) {
    const matched = tokens.filter((token) => haystack.includes(token)).length
    return matched >= Math.ceil(tokens.length * 0.5)
  }

  return false
}
