import { isProprietaryPlatformTerm } from '@/lib/resume/skill-priority'

export type SkillWeavingStrategy = 'platform-exposure' | 'foundational-pivot'

export { isProprietaryPlatformTerm }

/** Transferable competencies emphasized when pivoting away from vendor platforms. */
export const FOUNDATIONAL_PIVOT_TERMS = [
  'AWS',
  'Azure',
  'custom automation platforms',
] as const

const FOUNDATIONAL_RESUME_SIGNALS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\baws\b/i, term: 'AWS' },
  { pattern: /\bazure\b/i, term: 'Azure' },
  {
    pattern: /\bcustom automation (?:platforms?|workflows?|tools?|software)\b/i,
    term: 'custom automation platforms',
  },
  { pattern: /\bcloud (?:infrastructure|platforms?|computing|technologies)\b/i, term: 'cloud infrastructure' },
]

/** Resume-backed foundational terms to emphasize instead of a proprietary platform. */
export function extractFoundationalTermsFromResume(resumeText: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  for (const { pattern, term } of FOUNDATIONAL_RESUME_SIGNALS) {
    pattern.lastIndex = 0
    if (!pattern.test(resumeText)) continue
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    found.push(term)
  }

  return found.length > 0 ? found : [...FOUNDATIONAL_PIVOT_TERMS]
}

export function buildFoundationalPivotPromptAddendum(
  missingSkill: string,
  resumeText: string
): string {
  const terms = extractFoundationalTermsFromResume(resumeText)

  return `## Foundational pivot (mandatory — user confirmed NO direct platform experience)
The candidate chose NOT to claim direct hands-on experience with "${missingSkill.trim()}".
- NEVER write "${missingSkill.trim()}" or imply production use of that vendor/proprietary platform.
- Rewrite the line using ONLY transferable accomplishments already supported by the source resume.
- Prioritize these resume-backed competencies when relevant: ${terms.join(', ')}.
- Emphasize AWS & Azure cloud infrastructure delivery and custom automation platform outcomes — not invented vendor stack experience.
- Each injected token must appear as an exact contiguous substring inside modifiedText for ATS indexing.`
}

export function buildFoundationalPivotUserPromptOverride(missingSkill: string): string {
  return `FOUNDATIONAL PIVOT: Do NOT integrate "${missingSkill.trim()}" — the candidate lacks direct platform experience. Highlight AWS, Azure, and custom automation platform accomplishments from their resume instead.`
}

interface FoundationalSnippetSource {
  snippet: string
  originalBullet?: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}

function formatPivotPhrase(terms: string[]): string {
  if (terms.length === 0) return 'cloud infrastructure'
  if (terms.length === 1) return terms[0]!
  if (terms.length === 2) return `${terms[0]} and ${terms[1]}`
  return `${terms.slice(0, -1).join(', ')}, and ${terms[terms.length - 1]}`
}

/** Local preview snippet when the user pivots away from a proprietary platform term. */
export function buildFoundationalPivotSnippet(
  source: FoundationalSnippetSource,
  resumeText: string
): string {
  const terms = extractFoundationalTermsFromResume(resumeText)
  const pivotPhrase = formatPivotPhrase(terms)
  const original = source.originalBullet?.trim() || source.snippet.trim()

  if (!original) {
    return `Experienced professional with demonstrated ${pivotPhrase} expertise across enterprise cloud and automation delivery.`
  }

  const base = original.endsWith('.') ? original.slice(0, -1) : original

  if (source.modificationType === 'summary') {
    return `${base}, emphasizing ${pivotPhrase} cloud infrastructure and automation platform accomplishments.`
  }

  if (source.modificationType === 'skills-section') {
    return pivotPhrase
  }

  return `${base}, applying ${pivotPhrase} infrastructure and custom automation capabilities in production environments.`
}

export function getEquivalentsForWeavingStrategy(
  missingSkill: string,
  weavingStrategy: SkillWeavingStrategy | undefined,
  resumeText: string
): string[] | undefined {
  if (weavingStrategy !== 'foundational-pivot') return undefined
  return extractFoundationalTermsFromResume(resumeText)
}
