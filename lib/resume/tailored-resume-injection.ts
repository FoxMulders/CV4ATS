import type { TailoredResume } from '@/lib/ai/schemas'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { isInjectableCompetency } from '@/lib/resume/posting-artifact-filter'
import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

export interface TailoredResumeInjectionResult {
  resume: TailoredResume
  injectedSkills: string[]
  modifiedBulletCount: number
}

const PM_TITLE_PATTERN =
  /\b(project|program|product|portfolio|delivery|pmo|consultant|consulting)\s*(manager|director|lead|owner|manager)?\b/i
const TECH_TITLE_PATTERN =
  /\b(software|systems|platform|data|cloud|devops|technical|solution|application|it|engineer|developer|architect|analyst|consultant|infrastructure)\b/i

function titleCase(term: string): string {
  if (term === 'jira') return 'Jira'
  if (term === 'ai agents' || term === 'agent') return 'AI Agents'
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
  const normalizedFragment = fragment.startsWith(',') || fragment.startsWith(';') ? fragment : ` ${fragment}`
  const base = bullet.trim().endsWith('.') ? bullet.trim().slice(0, -1) : bullet.trim()
  return `${base}${normalizedFragment}.`
}

function roleContext(title: string, company: string): 'pm' | 'technical' | 'general' {
  const combined = `${title} ${company}`
  if (PM_TITLE_PATTERN.test(combined)) return 'pm'
  if (TECH_TITLE_PATTERN.test(combined)) return 'technical'
  return 'general'
}

function preferenceForSkill(skill: TargetSkill): 'pm' | 'technical' | 'general' {
  if (skill.category === 'methodology' || skill.category === 'competency') return 'pm'
  if (skill.category === 'tool' || skill.category === 'domainTech') return 'technical'
  return 'general'
}

/** Full accomplishment bullets embedding the exact ATS keyword phrase. */
export function buildDedicatedKeywordBullet(skill: TargetSkill): string {
  const term = skill.term.toLowerCase()

  const bullets: Record<string, string> = {
    scope: 'Managed project scope, milestones, and delivery governance across concurrent initiatives.',
    'scope management':
      'Applied scope management discipline to control requirements, change intake, and delivery boundaries.',
    'program management':
      'Led program management across cross-functional teams, aligning outcomes to enterprise priorities.',
    agile: 'Delivered initiatives using Agile practices with iterative planning and stakeholder feedback loops.',
    kanban: 'Applied Kanban flow management to optimize work-in-progress and delivery throughput.',
    waterfall: 'Executed structured Waterfall delivery for regulated releases with formal stage-gate controls.',
    scrum: 'Facilitated Scrum ceremonies and sprint execution with measurable delivery outcomes.',
    jira: 'Used Jira for backlog prioritization, sprint tracking, and delivery visibility across teams.',
    automation: 'Drove automation initiatives that improved operational efficiency and reduced manual effort.',
    workflows: 'Optimized business workflows to increase throughput, reliability, and handoff clarity.',
    'workflow automation': 'Implemented workflow automation to streamline operations and reduce cycle time.',
    'internal tools': 'Built internal tools that improved team productivity and operational visibility.',
    'custom software': 'Delivered custom software solutions aligned to business outcomes and user needs.',
    software: 'Led software delivery initiatives spanning design, development, testing, and release.',
    custom: 'Delivered custom solutions tailored to business requirements and operational constraints.',
    strategy: 'Defined delivery strategy and roadmap sequencing aligned to business priorities and capacity.',
    roadmap: 'Sequenced product roadmaps and release plans to balance value delivery with technical dependencies.',
    'product owner':
      'Coached clients through product ownership practices including backlog prioritization and value sequencing.',
    'product management':
      'Partnered with stakeholders on product management activities including roadmap alignment and prioritization.',
    backlog:
      'Guided backlog prioritization and refinement to maximize value delivery across sprints and releases.',
    agent: 'Delivered AI agent capabilities supporting intelligent automation and decision support workflows.',
    'ai agents': 'Delivered AI agent capabilities supporting intelligent automation and decision support workflows.',
    'custom automation platforms':
      'Built custom automation platforms that streamlined workflows and improved operational throughput.',
    devops: 'Championed DevOps practices to accelerate release cadence and improve deployment reliability.',
    sdlc: 'Oversaw SDLC governance from intake through release with quality and compliance checkpoints.',
  }

  if (bullets[term]) return bullets[term]!

  if (skill.category === 'methodology') {
    return `Applied ${titleCase(term)} methodologies to improve delivery predictability and stakeholder alignment.`
  }
  if (skill.category === 'competency') {
    return `Led ${titleCase(term)} activities that improved cross-functional coordination and executive visibility.`
  }
  if (skill.category === 'tool') {
    return `Leveraged ${titleCase(term)} to improve delivery tracking, collaboration, and release readiness.`
  }

  if (!isInjectableCompetency(term)) {
    return ''
  }

  return `Delivered ${titleCase(term)} initiatives with measurable impact on quality, speed, and business outcomes.`
}

function buildFragmentForSkill(skill: TargetSkill): string {
  const term = skill.term

  switch (term) {
    case 'program management':
      return ', with executive-level program management and scope oversight'
    case 'scope management':
    case 'scope':
      return ', managing scope, milestones, and cross-functional delivery'
    case 'agile':
    case 'kanban':
    case 'waterfall':
    case 'scrum':
    case 'sdlc':
    case 'devops':
    case 'safe':
      return `, utilizing ${titleCase(term)} delivery practices`
    case 'jira':
    case 'confluence':
      return `, leveraging ${titleCase(term)} for delivery tracking and stakeholder visibility`
    case 'automation':
      return ', driving automation initiatives to improve operational efficiency'
    case 'workflows':
    case 'workflow automation':
      return ', optimizing business workflows and process throughput'
    case 'internal tools':
      return ', delivering internal tools aligned to business outcomes'
    case 'ai agents':
    case 'agent':
      return ', delivering AI agent and intelligent automation capabilities'
    case 'custom software':
    case 'custom':
      return ', delivering custom software solutions aligned to business outcomes'
    case 'strategy':
      return ', defining delivery strategy and roadmap sequencing for enterprise initiatives'
    case 'roadmap':
      return ', sequencing product roadmaps and release plans across stakeholders'
    case 'product owner':
    case 'backlog':
      return ', coaching stakeholders through product ownership and backlog prioritization'
    default:
      if (skill.category === 'methodology') {
        return `, utilizing ${titleCase(term)} methodologies`
      }
      if (skill.category === 'competency') {
        return `, applying ${titleCase(term)} across enterprise initiatives`
      }
      if (skill.category === 'tool') {
        return `, leveraging ${titleCase(term)}`
      }
      if (!isInjectableCompetency(term)) {
        return ''
      }
      return `, delivering ${titleCase(term)} initiatives with measurable impact`
  }
}

function findExperienceIndex(
  resume: TailoredResume,
  preference: 'pm' | 'technical' | 'general',
  usedIndices: Set<number>
): number {
  const ranked = resume.experience
    .map((entry, index) => ({
      index,
      context: roleContext(entry.title, entry.company),
    }))
    .filter(({ index, context }) => {
      if (usedIndices.has(index)) return false
      if (preference === 'pm') return context === 'pm' || context === 'general'
      if (preference === 'technical') return context === 'technical' || context === 'general'
      return true
    })

  return ranked[0]?.index ?? resume.experience.findIndex((_, index) => !usedIndices.has(index))
}

function injectSkillIntoResume(
  resume: TailoredResume,
  skill: TargetSkill,
  usedBullets: Set<string>,
  usedExperienceIndices: Set<number>
): boolean {
  const fragment = buildFragmentForSkill(skill)
  if (!fragment) return false

  const preference = preferenceForSkill(skill)
  let attempts = 0

  while (attempts < resume.experience.length) {
    attempts += 1
    const experienceIndex = findExperienceIndex(resume, preference, usedExperienceIndices)
    if (experienceIndex < 0) return addDedicatedKeywordBullet(resume, skill, preference)

    const entry = resume.experience[experienceIndex]
    if (!entry) return false

    const bulletIndex = entry.bullets.findIndex(
      (bullet) => !usedBullets.has(`${experienceIndex}:${bullet}`)
    )

    if (bulletIndex < 0) {
      usedExperienceIndices.add(experienceIndex)
      continue
    }

    const originalBullet = entry.bullets[bulletIndex]!
    usedBullets.add(`${experienceIndex}:${originalBullet}`)
    entry.bullets[bulletIndex] = appendFragmentToBullet(originalBullet, fragment)
    return true
  }

  return addDedicatedKeywordBullet(resume, skill, preference)
}

function addDedicatedKeywordBullet(
  resume: TailoredResume,
  skill: TargetSkill,
  preference: 'pm' | 'technical' | 'general'
): boolean {
  const experienceIndex = findExperienceIndex(resume, preference, new Set())
  if (experienceIndex < 0) return false

  const entry = resume.experience[experienceIndex]
  if (!entry) return false

  entry.bullets.push(buildDedicatedKeywordBullet(skill))
  return true
}

function ensureSkillsPresent(resume: TailoredResume, terms: string[]): string[] {
  const added: string[] = []
  const skillsLower = resume.skills.map((skill) => skill.toLowerCase())

  for (const term of terms) {
    const serialized = serializeTailoredResume(resume)
    if (keywordMatchesResume(serialized, term)) continue

    const label = titleCase(term)
    if (!skillsLower.includes(label.toLowerCase()) && !skillsLower.includes(term.toLowerCase())) {
      resume.skills.push(label)
      added.push(term)
    }
  }

  return added
}

function weaveSummaryTerms(resume: TailoredResume, terms: string[]): string[] {
  const added: string[] = []
  const stillAbsent = terms.filter((term) => !keywordMatchesResume(serializeTailoredResume(resume), term))
  if (stillAbsent.length === 0) return added

  const methodologies = stillAbsent.filter((term) =>
    ['agile', 'kanban', 'waterfall', 'scrum', 'sdlc', 'devops', 'safe'].includes(term)
  )
  const domains = stillAbsent.filter((term) =>
    ['automation', 'workflows', 'internal tools', 'ai agents', 'agent', 'custom software', 'software', 'custom'].includes(
      term
    )
  )
  const leadership = stillAbsent.filter((term) =>
    ['strategy', 'program management', 'scope', 'scope management', 'roadmap'].includes(term)
  )

  let summary = resume.summary.trim()
  const suffixes: string[] = []

  if (methodologies.length > 0) {
    suffixes.push(`proven ${formatSkillList(methodologies)} delivery leadership`)
  }
  if (domains.length > 0) {
    suffixes.push(`${formatSkillList(domains)} expertise`)
  }
  if (leadership.length > 0) {
    suffixes.push(`${formatSkillList(leadership)} capability`)
  }

  if (suffixes.length > 0) {
    const clause = ` Executive profile with ${suffixes.join(', ')}.`
    if (!summary.endsWith('.')) summary += '.'
    resume.summary = `${summary}${clause}`
    added.push(...stillAbsent.filter((term) => [...methodologies, ...domains, ...leadership].includes(term)))
  }

  return added
}

export function injectIntoTailoredResume(
  resume: TailoredResume,
  missingSkills: TargetSkill[]
): TailoredResumeInjectionResult {
  const serialized = serializeTailoredResume(resume)
  const stillMissing = missingSkills.filter(
    (skill) =>
      isInjectableCompetency(skill.term) && !keywordMatchesResume(serialized, skill.term)
  )

  if (stillMissing.length === 0) {
    return { resume, injectedSkills: [], modifiedBulletCount: 0 }
  }

  const cloned: TailoredResume = structuredClone(resume)
  const injectedSkills: string[] = []
  let modifiedBulletCount = 0
  const usedBullets = new Set<string>()
  const usedExperienceIndices = new Set<number>()

  for (const skill of stillMissing) {
    if (keywordMatchesResume(serializeTailoredResume(cloned), skill.term)) continue

    if (injectSkillIntoResume(cloned, skill, usedBullets, usedExperienceIndices)) {
      modifiedBulletCount += 1
      injectedSkills.push(skill.term)
      continue
    }

    if (addDedicatedKeywordBullet(cloned, skill, preferenceForSkill(skill))) {
      modifiedBulletCount += 1
      injectedSkills.push(skill.term)
    }
  }

  const summaryAdded = weaveSummaryTerms(
    cloned,
    stillMissing.map((skill) => skill.term).filter((term) => !injectedSkills.includes(term))
  )
  injectedSkills.push(...summaryAdded)

  const skillAdded = ensureSkillsPresent(
    cloned,
    stillMissing.map((skill) => skill.term).filter((term) => !injectedSkills.includes(term))
  )
  injectedSkills.push(...skillAdded)

  return {
    resume: cloned,
    injectedSkills: [...new Set(injectedSkills)],
    modifiedBulletCount,
  }
}

export function mergeTargetSkills(...groups: TargetSkill[][]): TargetSkill[] {
  const byTerm = new Map<string, TargetSkill>()
  for (const skill of groups.flat()) {
    if (!byTerm.has(skill.term)) byTerm.set(skill.term, skill)
  }
  return [...byTerm.values()]
}
