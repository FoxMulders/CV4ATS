import type { Experience } from '@/lib/ai/schemas'

/** Section headings that signal a whitelisted personal-projects block in source text. */
export const PERSONAL_PROJECT_SECTION_PATTERN =
  /^(?:personal ai projects|personal projects|side ventures?|product innovations?|projects)\s*:?\s*$/i

const PROJECT_COMPANY_PATTERN =
  /^(?:tipsy fox|popuphub|pop-up hub|pop up hub)/i

const PROJECT_TITLE_PATTERN =
  /personal ai project|side project|side venture|freelance project|personal project|product innovation|founder|independent product/i

const PROJECT_NAME_PATTERN =
  /\b(?:PopUpHub|Pop-Up Hub|Tipsy Fox(?: Escapes)?)\b/i

export function isPersonalProjectEntry(entry: Pick<Experience, 'title' | 'company'>): boolean {
  const company = entry.company.trim()
  const title = entry.title.trim()
  return (
    PROJECT_TITLE_PATTERN.test(title) ||
    PROJECT_COMPANY_PATTERN.test(company) ||
    PROJECT_NAME_PATTERN.test(company) ||
    PROJECT_NAME_PATTERN.test(title)
  )
}

export function sourceHasPersonalProjects(sourceResumeText: string): boolean {
  const text = sourceResumeText.trim()
  if (!text) return false
  const lines = text.split('\n').map((line) => line.trim())
  if (lines.some((line) => PERSONAL_PROJECT_SECTION_PATTERN.test(line))) return true
  return (
    /personal ai projects|side ventures?|product innovations?/i.test(text) ||
    PROJECT_NAME_PATTERN.test(text) ||
    /personal project|side project/i.test(text)
  )
}

/** Product names from source text — used for cover letter anchoring (never invented). */
export function extractPersonalProjectProductNames(sourceResumeText: string): string[] {
  const names = new Set<string>()
  for (const match of sourceResumeText.matchAll(/\b(PopUpHub|Pop-Up Hub|Tipsy Fox(?: Escapes)?)\b/gi)) {
    const normalized =
      /^tipsy/i.test(match[1]!) ? 'Tipsy Fox' : 'PopUpHub'
    names.add(normalized)
  }
  return [...names]
}

export function isFoundationalTargetRole(jobDescription: string): boolean {
  return /\b(?:project coordinator|program coordinator|delivery coordinator|operations coordinator|junior project|entry[- ]level|foundational role|1\s*[-–]\s*3\s*(?:years?|yrs?)|one to three years?|0\s*[-–]\s*2\s*(?:years?|yrs?)|support role|coordinator who supports)\b/i.test(
    jobDescription
  )
}

export function sourceSuggestsDeepCareerHistory(sourceResumeText: string): boolean {
  const years = sourceResumeText.match(/\b(19|20)\d{2}\b/g) ?? []
  const uniqueDecades = new Set(years.map((year) => year.slice(0, 3)))
  return (
    uniqueDecades.size >= 3 ||
    /\b(?:20|25|30)\+?\s*years?\s*(?:of\s*)?(?:experience|background|tenure)/i.test(sourceResumeText)
  )
}

export function shouldApplyFoundationalReframing(
  sourceResumeText: string,
  jobDescription: string
): boolean {
  return (
    sourceHasPersonalProjects(sourceResumeText) &&
    isFoundationalTargetRole(jobDescription) &&
    sourceSuggestsDeepCareerHistory(sourceResumeText)
  )
}
