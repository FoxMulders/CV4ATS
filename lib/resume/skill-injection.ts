import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { isInjectableCompetency } from '@/lib/resume/posting-artifact-filter'
import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'

export interface SkillInjectionResult {
  text: string
  injectedSkills: string[]
  modifiedBulletCount: number
}

const BULLET_PREFIX = /^[\s•\-*]+/
const PM_TITLE_PATTERN =
  /\b(project|program|product|portfolio|delivery|pmo)\s*(manager|director|lead|owner)\b/i
const TECH_TITLE_PATTERN =
  /\b(software|systems|platform|data|cloud|devops|technical|solution|application|it|engineer|developer|architect|analyst|consultant)\b/i
const TECH_BULLET_PATTERN =
  /\b(build|built|develop|developed|implement|implemented|engineer|engineered|design|designed|automate|automated|deploy|deployed|integrate|integrated|architect|architected|code|coded|create|created)\b/i

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function joinLines(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function isBulletLine(line: string): boolean {
  const trimmed = line.trim()
  return BULLET_PREFIX.test(trimmed) && trimmed.length > 2
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(BULLET_PREFIX, '').trim()
}

function restoreBulletPrefix(original: string, content: string): string {
  const prefix = original.trim().match(BULLET_PREFIX)?.[0] ?? '• '
  return `${prefix}${content}`
}

function titleCase(term: string): string {
  return term
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatSkillList(terms: string[]): string {
  const labeled = terms.map(titleCase)
  if (labeled.length === 1) return labeled[0]!
  if (labeled.length === 2) return `${labeled[0]} and ${labeled[1]}`
  return `${labeled.slice(0, -1).join(', ')}, and ${labeled[labeled.length - 1]}`
}

function appendFragmentToBullet(bullet: string, fragment: string): string {
  const content = stripBulletPrefix(bullet)
  if (!content) return bullet

  const normalizedFragment = fragment.startsWith(',') || fragment.startsWith(';') ? fragment : ` ${fragment}`
  const base = content.endsWith('.') ? content.slice(0, -1) : content
  return restoreBulletPrefix(bullet, `${base}${normalizedFragment}.`)
}

interface ParsedResume {
  lines: string[]
  bulletIndices: number[]
  roleHeaderIndices: number[]
}

function parseResumeLines(lines: string[]): ParsedResume {
  const bulletIndices: number[] = []
  const roleHeaderIndices: number[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (isBulletLine(line)) {
      bulletIndices.push(index)
      continue
    }

    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 120) continue
    if (/^(professional summary|summary|skills|work experience|experience|education)/i.test(trimmed)) {
      continue
    }
    if (/^#{1,6}\s+\S/.test(trimmed) || trimmed.includes('—') || trimmed.includes(' - ') || /\bat\b/i.test(trimmed)) {
      roleHeaderIndices.push(index)
    }
  }

  return { lines, bulletIndices, roleHeaderIndices }
}

function roleContextForBullet(parsed: ParsedResume, bulletIndex: number): 'pm' | 'technical' | 'general' {
  let nearestHeader = -1
  for (const headerIndex of parsed.roleHeaderIndices) {
    if (headerIndex < bulletIndex && headerIndex > nearestHeader) {
      nearestHeader = headerIndex
    }
  }

  const headerLine = nearestHeader >= 0 ? (parsed.lines[nearestHeader] ?? '') : ''
  if (PM_TITLE_PATTERN.test(headerLine)) return 'pm'
  if (TECH_TITLE_PATTERN.test(headerLine)) return 'technical'

  const bulletContent = stripBulletPrefix(parsed.lines[bulletIndex] ?? '')
  if (TECH_BULLET_PATTERN.test(bulletContent)) return 'technical'

  return 'general'
}

function findBulletIndex(parsed: ParsedResume, preference: 'pm' | 'technical' | 'general'): number {
  const ranked = parsed.bulletIndices.filter((index) => {
    const context = roleContextForBullet(parsed, index)
    if (preference === 'pm') return context === 'pm' || context === 'general'
    if (preference === 'technical') return context === 'technical' || context === 'general'
    return true
  })

  return ranked[0] ?? parsed.bulletIndices[0] ?? -1
}

function buildMethodologyFragment(terms: string[]): string {
  if (terms.length === 0) return ''
  return `, utilizing ${formatSkillList(terms)} methodologies`
}

function buildCompetencyFragment(terms: string[]): string {
  if (terms.length === 0) return ''
  if (terms.includes('program management')) {
    return ', with executive-level program management and scope oversight'
  }
  if (terms.includes('scope management')) {
    return ', managing scope, milestones, and cross-functional delivery'
  }
  if (terms.includes('scope')) {
    return ', managing scope, milestones, and cross-functional delivery'
  }
  return `, applying ${formatSkillList(terms)} across enterprise initiatives`
}

function buildDomainFragment(terms: string[]): string {
  const termSet = new Set(terms)
  const hasAutomation = termSet.has('automation') || termSet.has('workflow automation')
  const hasWorkflows = termSet.has('workflows') || termSet.has('workflow automation')
  const hasCustomSoftware = termSet.has('custom software')
  const hasAgents = termSet.has('ai agents') || termSet.has('ai agent')

  if (hasCustomSoftware && hasAutomation && hasWorkflows) {
    return ', building custom automation workflows to optimize operations'
  }
  if (hasAutomation && hasWorkflows) {
    return ', building automation workflows to optimize operations'
  }
  if (hasAgents) {
    return ', delivering AI agent and intelligent automation capabilities'
  }
  if (hasAutomation) {
    return ', driving automation initiatives to improve operational efficiency'
  }
  if (hasWorkflows) {
    return ', optimizing business workflows and process throughput'
  }
  if (hasCustomSoftware) {
    return ', delivering custom software solutions aligned to business outcomes'
  }

  const injectable = terms.filter((term) => isInjectableCompetency(term))
  if (injectable.length === 0) return ''

  return `, delivering ${formatSkillList(injectable)} initiatives with measurable impact`
}

function injectIntoBullet(
  lines: string[],
  bulletIndex: number,
  fragment: string
): boolean {
  if (bulletIndex < 0 || !fragment) return false
  const current = lines[bulletIndex]
  if (!current) return false
  lines[bulletIndex] = appendFragmentToBullet(current, fragment)
  return true
}

function missingSkillsFromTargets(
  resumeText: string,
  extrapolatedSkills: TargetSkill[]
): TargetSkill[] {
  return extrapolatedSkills.filter(
    (skill) =>
      isInjectableCompetency(skill.term) && !keywordMatchesResume(resumeText, skill.term)
  )
}

function groupMissingByCategory(missing: TargetSkill[]): Record<SkillCategory, string[]> {
  const groups: Record<SkillCategory, string[]> = {
    methodology: [],
    competency: [],
    domainTech: [],
    tool: [],
  }

  for (const skill of missing) {
    groups[skill.category].push(skill.term)
  }

  return groups
}

/**
 * Step 2: Contextually inject missing high-value skills into resume bullet points.
 * PM roles receive methodology/competency phrasing; technical roles receive domain phrasing.
 */
export function injectMissingSkills(
  currentResumeText: string,
  extrapolatedSkills: TargetSkill[]
): SkillInjectionResult {
  const missing = missingSkillsFromTargets(currentResumeText, extrapolatedSkills)
  if (missing.length === 0) {
    return { text: currentResumeText, injectedSkills: [], modifiedBulletCount: 0 }
  }

  const groups = groupMissingByCategory(missing)
  const lines = splitLines(currentResumeText)
  const parsed = parseResumeLines(lines)
  const injectedSkills: string[] = []
  let modifiedBulletCount = 0

  const usedBulletIndices = new Set<number>()

  const tryInject = (preference: 'pm' | 'technical' | 'general', fragment: string, skills: string[]) => {
    if (!fragment || skills.length === 0) return

    let bulletIndex = findBulletIndex(parsed, preference)
    if (usedBulletIndices.has(bulletIndex)) {
      bulletIndex = parsed.bulletIndices.find((index) => !usedBulletIndices.has(index)) ?? bulletIndex
    }

    if (injectIntoBullet(lines, bulletIndex, fragment)) {
      usedBulletIndices.add(bulletIndex)
      modifiedBulletCount += 1
      injectedSkills.push(...skills)
    }
  }

  if (groups.methodology.length > 0) {
    tryInject('pm', buildMethodologyFragment(groups.methodology), groups.methodology)
  }

  if (groups.competency.length > 0) {
    tryInject('pm', buildCompetencyFragment(groups.competency), groups.competency)
  }

  if (groups.domainTech.length > 0) {
    tryInject('technical', buildDomainFragment(groups.domainTech), groups.domainTech)
  }

  if (groups.tool.length > 0) {
    const toolFragment = `, leveraging ${formatSkillList(groups.tool)}`
    tryInject('technical', toolFragment, groups.tool)
  }

  return {
    text: joinLines(lines),
    injectedSkills: [...new Set(injectedSkills)],
    modifiedBulletCount,
  }
}
