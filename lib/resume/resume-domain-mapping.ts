const ROLE_LINE =
  /^(.{4,100}?)\s*(?:—|–|-|\|)\s*(.{2,100}?)(?:\s*\|\s*(.+))?\s*$/

const BULLET_PREFIX = /^[\s•\-*–—]+/

export type ProfessionalDomain =
  | 'executiveManagement'
  | 'programDelivery'
  | 'technicalOperations'
  | 'analyticalSupport'
  | 'generalProfessional'

export const DOMAIN_LABELS: Record<ProfessionalDomain, string> = {
  executiveManagement: 'High-Level Management',
  programDelivery: 'Program & Delivery Leadership',
  technicalOperations: 'Technical / Operational Analysis',
  analyticalSupport: 'Analytical & Support Functions',
  generalProfessional: 'General Professional Experience',
}

export interface MappedBullet {
  lineIndex: number
  text: string
}

export interface MappedPosition {
  title: string
  company: string
  domain: ProfessionalDomain
  domainLabel: string
  headerLineIndex: number
  bullets: MappedBullet[]
  bodyText: string
}

export interface ResumeDomainMap {
  positions: MappedPosition[]
  lines: string[]
}

const EXECUTIVE_PATTERN =
  /\b(chief|ceo|cto|cfo|cio|vp|vice president|director|head of|executive|president|senior leader)\b/i
const PROGRAM_PATTERN =
  /\b(project|program|product|portfolio|delivery|pmo|scrum master|product owner)\s*(manager|director|lead|owner|manager ii|manager iii)\b|\bprogram manager\b|\bproject manager\b/i
const TECHNICAL_PATTERN =
  /\b(software|systems|platform|data|cloud|devops|technical|solution|application|it|engineer|developer|architect|automation|infrastructure|operations analyst)\b/i
const ANALYTICAL_PATTERN =
  /\b(analyst|support|coordinator|specialist|associate|administrator|representative)\b/i

export function categorizePositionDomain(title: string, bodyText: string): ProfessionalDomain {
  const combined = `${title} ${bodyText}`.toLowerCase()

  if (EXECUTIVE_PATTERN.test(title)) return 'executiveManagement'
  if (PROGRAM_PATTERN.test(title)) return 'programDelivery'
  if (TECHNICAL_PATTERN.test(title) || TECHNICAL_PATTERN.test(bodyText.slice(0, 400))) {
    return 'technicalOperations'
  }
  if (ANALYTICAL_PATTERN.test(title)) return 'analyticalSupport'
  if (/\bmanager\b/i.test(title) && !/\bproject|program|product\b/i.test(title)) {
    return 'executiveManagement'
  }
  if (/\boperations\b/i.test(combined)) return 'technicalOperations'

  return 'generalProfessional'
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(BULLET_PREFIX, '').trim()
}

function isBulletLine(line: string): boolean {
  const trimmed = line.trim()
  return BULLET_PREFIX.test(trimmed) && trimmed.length > 2
}

/**
 * Resume mapping pass — categorize each historical position into a professional domain
 * and collect its bullets with stable line indices for in-line modification.
 */
export function mapResumeDomains(resumeText: string): ResumeDomainMap {
  const lines = resumeText.replace(/\r\n/g, '\n').split('\n')
  const positions: MappedPosition[] = []
  let current: Omit<MappedPosition, 'domain' | 'domainLabel' | 'bodyText'> | null = null
  const bodyLines: string[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex] ?? ''
    const line = rawLine.trim()
    if (!line) continue

    if (/^(work experience|experience|employment|professional experience)$/i.test(line)) {
      continue
    }

    const roleMatch = line.match(ROLE_LINE)
    if (roleMatch && !isBulletLine(line)) {
      if (current) {
        const bodyText = bodyLines.join('\n')
        const domain = categorizePositionDomain(current.title, bodyText)
        positions.push({
          ...current,
          bodyText,
          domain,
          domainLabel: DOMAIN_LABELS[domain],
        })
        bodyLines.length = 0
      }

      current = {
        title: roleMatch[1]!.trim(),
        company: roleMatch[2]!.trim(),
        headerLineIndex: lineIndex,
        bullets: [],
      }
      continue
    }

    if (current && isBulletLine(line)) {
      const text = stripBulletPrefix(line)
      if (text.length >= 12) {
        current.bullets.push({ lineIndex, text })
        bodyLines.push(text)
      }
      continue
    }

    if (current && line.length >= 20 && !/^(skills|education|certifications|summary)/i.test(line)) {
      bodyLines.push(line)
    }
  }

  if (current) {
    const bodyText = bodyLines.join('\n')
    const domain = categorizePositionDomain(current.title, bodyText)
    positions.push({
      ...current,
      bodyText,
      domain,
      domainLabel: DOMAIN_LABELS[domain],
    })
  }

  return { positions, lines }
}
