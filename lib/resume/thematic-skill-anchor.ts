import { getResumeEvidenceAliases } from '@/lib/resume/resume-evidence-aliases'
import {
  mapResumeDomains,
  type MappedBullet,
  type MappedPosition,
  type ProfessionalDomain,
  type ResumeDomainMap,
} from '@/lib/resume/resume-domain-mapping'
import { extractOriginalSummary } from '@/lib/resume/resume-diff'
import {
  buildPlacementBreadcrumb,
  parseStructuredResumeDocument,
} from '@/lib/resume/structured-resume-document'
import type { SkillCategory, TargetSkill } from '@/lib/resume/skill-extrapolation'

export interface SkillAnchor {
  skill: string
  category: SkillCategory
  position: MappedPosition | null
  bullet: MappedBullet | null
  originalBullet: string
  modifiedBullet: string
  placement: 'summary' | 'skills' | 'experience'
  placementLabel: string
  placementBreadcrumb: string
  positionId?: string
  targetBulletIndex?: number
  bulletLineIndex?: number
  modificationType: 'inline-bullet' | 'skills-section' | 'summary'
}

const DOMAIN_AFFINITY: Record<SkillCategory, Partial<Record<ProfessionalDomain, number>>> = {
  methodology: {
    programDelivery: 14,
    executiveManagement: 10,
    generalProfessional: 4,
  },
  competency: {
    programDelivery: 12,
    executiveManagement: 11,
    technicalOperations: 6,
    generalProfessional: 4,
  },
  domainTech: {
    technicalOperations: 14,
    analyticalSupport: 10,
    programDelivery: 5,
    generalProfessional: 3,
  },
  tool: {
    technicalOperations: 14,
    analyticalSupport: 8,
    generalProfessional: 2,
  },
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((word) => word.length > 2)
}

function scorePositionForSkill(position: MappedPosition, skill: TargetSkill): number {
  const haystack = `${position.title} ${position.company} ${position.bodyText}`.toLowerCase()
  const term = skill.term.toLowerCase()
  let score = DOMAIN_AFFINITY[skill.category][position.domain] ?? 0

  if (haystack.includes(term)) score += 18

  for (const alias of getResumeEvidenceAliases(term)) {
    if (haystack.includes(alias.trim().toLowerCase())) score += 4
  }

  for (const word of tokenize(skill.term)) {
    if (haystack.includes(word)) score += 2
  }

  if (skill.category === 'domainTech' && position.domain === 'technicalOperations') {
    score += 6
  }
  if (skill.category === 'methodology' && position.domain === 'programDelivery') {
    score += 5
  }

  return score
}

function scoreBulletForSkill(bullet: MappedBullet, skill: TargetSkill): number {
  const haystack = bullet.text.toLowerCase()
  const term = skill.term.toLowerCase()
  let score = 0

  if (haystack.includes(term)) score += 20

  for (const alias of getResumeEvidenceAliases(term)) {
    if (haystack.includes(alias.trim().toLowerCase())) score += 5
  }

  for (const word of tokenize(skill.term)) {
    if (haystack.includes(word)) score += 2
  }

  if (skill.category === 'domainTech' && /\b(build|developed|implemented|automated|delivered|designed|engineered)\b/i.test(haystack)) {
    score += 6
  }
  if (skill.category === 'methodology' && /\b(led|managed|coordinated|delivered|stakeholder|milestone)\b/i.test(haystack)) {
    score += 5
  }

  return score
}

function pickBestAnchor(domainMap: ResumeDomainMap, skill: TargetSkill): {
  position: MappedPosition | null
  bullet: MappedBullet | null
} {
  if (domainMap.positions.length === 0) {
    return { position: null, bullet: null }
  }

  let bestPosition: MappedPosition | null = null
  let bestPositionScore = -1

  for (const position of domainMap.positions) {
    const score = scorePositionForSkill(position, skill)
    if (score > bestPositionScore) {
      bestPositionScore = score
      bestPosition = position
    }
  }

  if (!bestPosition || bestPosition.bullets.length === 0) {
    return { position: bestPosition, bullet: null }
  }

  let bestBullet = bestPosition.bullets[0]!
  let bestBulletScore = -1

  for (const bullet of bestPosition.bullets) {
    const score = scoreBulletForSkill(bullet, skill)
    if (score > bestBulletScore) {
      bestBulletScore = score
      bestBullet = bullet
    }
  }

  return { position: bestPosition, bullet: bestBullet }
}

function formatPlacementLabel(position: MappedPosition | null, placement: SkillAnchor['placement']): string {
  if (placement === 'summary') return 'Professional summary'
  if (placement === 'skills') return 'Skills section'

  if (position) {
    return `Suggested adjustment for ${position.title} at ${position.company}`
  }

  return 'Most relevant work experience bullet'
}

export function integrateSkillIntoBulletLocal(
  bulletText: string,
  skill: TargetSkill
): string {
  const content = bulletText.trim()
  if (!content) return bulletText

  const term = skill.term
  if (normalize(content).includes(normalize(term))) return content

  const base = content.endsWith('.') ? content.slice(0, -1) : content

  switch (skill.category) {
    case 'methodology':
      return `${base}, applying ${term} to strengthen delivery rhythm and cross-team alignment.`
    case 'competency':
      return `${base} while exercising ${term} across stakeholders, milestones, and measurable outcomes.`
    case 'domainTech':
      return `${base}, leveraging ${term} to improve operational reliability and business impact.`
    case 'tool':
      return `${base} using ${term} in production workflows.`
    default:
      return `${base}, incorporating ${term} into established delivery practices.`
  }
}

function integrateSkillIntoSummaryLocal(summary: string, skill: TargetSkill): string {
  const base = summary.trim()
  if (!base) {
    return `Experienced professional with demonstrated ${skill.term} expertise across enterprise environments.`
  }
  if (normalize(base).includes(normalize(skill.term))) return base
  const trimmed = base.endsWith('.') ? base.slice(0, -1) : base
  return `${trimmed}, with proven ${skill.term} experience aligned to complex technical and operational environments.`
}

function shouldUseSummaryPlacement(skill: TargetSkill, documentSummary: string): boolean {
  if (/\binformation technology\b/i.test(skill.term)) return true
  if (skill.category === 'competency' && documentSummary.length < 1200) return false
  return false
}

export function buildSkillAnchor(
  skill: TargetSkill,
  resumeText: string,
  domainMap: ResumeDomainMap = mapResumeDomains(resumeText)
): SkillAnchor {
  const structured = parseStructuredResumeDocument(resumeText)
  const summarySource = structured.summary || extractOriginalSummary(resumeText) || ''

  if (skill.category === 'tool') {
    return {
      skill: skill.term,
      category: skill.category,
      position: null,
      bullet: null,
      originalBullet: '',
      modifiedBullet: skill.term.charAt(0).toUpperCase() + skill.term.slice(1),
      placement: 'skills',
      placementLabel: 'Skills section',
      placementBreadcrumb: buildPlacementBreadcrumb('skills'),
      modificationType: 'skills-section',
    }
  }

  if (shouldUseSummaryPlacement(skill, summarySource)) {
    return {
      skill: skill.term,
      category: skill.category,
      position: null,
      bullet: null,
      originalBullet: summarySource,
      modifiedBullet: integrateSkillIntoSummaryLocal(summarySource, skill),
      placement: 'summary',
      placementLabel: 'Professional summary',
      placementBreadcrumb: buildPlacementBreadcrumb('summary'),
      modificationType: 'summary',
    }
  }

  const { position, bullet } = pickBestAnchor(domainMap, skill)

  if (!bullet || !position) {
    const fallbackSnippet = integrateSkillIntoSummaryLocal('', skill)
    return {
      skill: skill.term,
      category: skill.category,
      position,
      bullet: null,
      originalBullet: '',
      modifiedBullet: fallbackSnippet,
      placement: 'experience',
      placementLabel: formatPlacementLabel(position, 'experience'),
      placementBreadcrumb: buildPlacementBreadcrumb('experience', position?.company),
      modificationType: 'inline-bullet',
    }
  }

  return {
    skill: skill.term,
    category: skill.category,
    position,
    bullet,
    originalBullet: bullet.text,
    modifiedBullet: integrateSkillIntoBulletLocal(bullet.text, skill),
    placement: 'experience',
    placementLabel: formatPlacementLabel(position, 'experience'),
    placementBreadcrumb: buildPlacementBreadcrumb('experience', position.company),
    positionId: position.id,
    targetBulletIndex: bullet.bulletIndex,
    bulletLineIndex: bullet.lineIndex,
    modificationType: 'inline-bullet',
  }
}

export function buildSkillAnchorsForSkills(
  skills: TargetSkill[],
  resumeText: string
): SkillAnchor[] {
  const domainMap = mapResumeDomains(resumeText)
  return skills.map((skill) => buildSkillAnchor(skill, resumeText, domainMap))
}
