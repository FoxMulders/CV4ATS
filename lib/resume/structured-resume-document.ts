const EXECUTIVE_PATTERN =
  /\b(chief|ceo|cto|cfo|cio|vp|vice president|director|head of|executive|president|senior leader)\b/i
const PROGRAM_PATTERN =
  /\b(project|program|product|portfolio|delivery|pmo|scrum master|product owner)\s*(manager|director|lead|owner|manager ii|manager iii)\b|\bprogram manager\b|\bproject manager\b/i
const TECHNICAL_PATTERN =
  /\b(software|systems|platform|data|cloud|devops|technical|solution|application|it|engineer|developer|architect|automation|infrastructure|operations analyst)\b/i
const ANALYTICAL_PATTERN =
  /\b(analyst|support|coordinator|specialist|associate|administrator|representative)\b/i

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

const SECTION_HEADING =
  /^(professional summary|summary|profile|skills|technical skills|work experience|experience|employment|education|certifications?)\s*:?\s*$/i

const BULLET_PREFIX = /^[\s•\-*–—]+/

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const URL_PATTERN = /https?:\/\/|linkedin\.com/i

const ROLE_LINE =
  /^(.{3,100}?)\s*(?:—|–|-|\|)\s*(.{2,100}?)(?:\s*\|\s*(.+))?\s*$/

export interface StructuredResumeContact {
  name: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  /** Line indices belonging to the contact header block (excluded from tailoring). */
  lineIndices: number[]
}

export interface StructuredExperienceBullet {
  bulletIndex: number
  text: string
  lineIndex: number
}

export interface StructuredExperiencePosition {
  id: string
  title: string
  company: string
  location?: string
  startDate?: string
  endDate?: string
  dateLineIndex?: number
  headerLineIndex: number
  domain: ProfessionalDomain
  domainLabel: string
  bullets: StructuredExperienceBullet[]
  bodyText: string
}

export interface StructuredResumeDocument {
  sourceLines: string[]
  contact: StructuredResumeContact
  summary: string
  summaryLineIndices: number[]
  skillsLineIndices: number[]
  experience: StructuredExperiencePosition[]
  rawText: string
}

export function isDateToken(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^(present|current|ongoing)$/i.test(trimmed)) return true
  if (/^\d{1,2}\/\d{4}$/.test(trimmed)) return true
  if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}$/i.test(trimmed)) {
    return true
  }
  if (/^\d{4}$/.test(trimmed)) return true
  return false
}

export function isDateRangeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || isBulletLine(trimmed)) return false

  return (
    /^\d{1,2}\/\d{4}\s*(?:[-–—]|to)\s*(present|current|\d{1,2}\/\d{4})/i.test(trimmed) ||
    /^(?:\w+\s+)?\d{4}\s*(?:[-–—]|to)\s*(?:present|current|\w+\s+\d{4}|\d{4})/i.test(trimmed) ||
    /^\d{4}\s*(?:[-–—]|to)\s*\d{4}$/.test(trimmed)
  )
}

function parseDateRange(line: string): { startDate?: string; endDate?: string } {
  const trimmed = line.trim()
  const match = trimmed.match(
    /^(.+?)\s*(?:[-–—]|to)\s*(present|current|\d{1,2}\/\d{4}|\w+\s+\d{4}|\d{4})$/i
  )
  if (!match) return {}
  return {
    startDate: match[1]?.trim(),
    endDate: match[2]?.trim(),
  }
}

export function isContactMetadataLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (EMAIL_PATTERN.test(trimmed)) return true
  if (PHONE_PATTERN.test(trimmed)) return true
  if (URL_PATTERN.test(trimmed)) return true
  if (/^[\w.+-]+\s+[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(trimmed)) return true
  return false
}

export function isValidCompanyName(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 2) return false
  if (isDateToken(trimmed)) return false
  if (isDateRangeLine(trimmed)) return false
  if (EMAIL_PATTERN.test(trimmed)) return false
  if (PHONE_PATTERN.test(trimmed)) return false
  if (/^(present|current)$/i.test(trimmed)) return false
  if (!/[a-zA-Z]/.test(trimmed)) return false
  if (/^\d{1,2}\/\d{4}/.test(trimmed)) return false
  return true
}

export function isValidJobTitle(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 3) return false
  if (isDateToken(trimmed)) return false
  if (isDateRangeLine(trimmed)) return false
  if (EMAIL_PATTERN.test(trimmed)) return false
  if (PHONE_PATTERN.test(trimmed)) return false
  if (!/[a-zA-Z]/.test(trimmed)) return false
  return true
}

function isBulletLine(line: string): boolean {
  const trimmed = line.trim()
  return BULLET_PREFIX.test(trimmed) && trimmed.length > 2
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(BULLET_PREFIX, '').trim()
}

function restoreBulletPrefix(originalLine: string, content: string): string {
  const prefix = originalLine.trim().match(BULLET_PREFIX)?.[0] ?? '• '
  return `${prefix}${content.trim()}`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function extractContactBlock(lines: string[]): StructuredResumeContact {
  const contact: StructuredResumeContact = {
    name: '',
    lineIndices: [],
  }

  const experienceStart = lines.findIndex((line) =>
    /^(work experience|experience|employment)/i.test(line.trim())
  )
  const scanUntil = experienceStart >= 0 ? experienceStart : Math.min(lines.length, 12)

  for (let index = 0; index < scanUntil; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line || SECTION_HEADING.test(line)) continue

    contact.lineIndices.push(index)

    const email = line.match(EMAIL_PATTERN)?.[0]
    if (email && !contact.email) contact.email = email

    const phone = line.match(PHONE_PATTERN)?.[0]
    if (phone && !contact.phone) contact.phone = phone

    const linkedin = line.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0]
    if (linkedin && !contact.linkedin) contact.linkedin = linkedin

    if (
      !contact.name &&
      !EMAIL_PATTERN.test(line) &&
      !PHONE_PATTERN.test(line) &&
      !URL_PATTERN.test(line) &&
      line.length <= 80 &&
      /[a-zA-Z]/.test(line)
    ) {
      contact.name = line.replace(EMAIL_PATTERN, '').replace(PHONE_PATTERN, '').trim()
    }
  }

  if (!contact.name) contact.name = 'Professional Candidate'
  return contact
}

function extractSummary(lines: string[]): { summary: string; lineIndices: number[] } {
  const start = lines.findIndex((line) => /^(professional summary|summary|profile)$/i.test(line.trim()))
  if (start < 0) return { summary: '', lineIndices: [] }

  const lineIndices: number[] = [start]
  const parts: string[] = []

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    if (SECTION_HEADING.test(line)) break
    if (isBulletLine(line)) break
    lineIndices.push(index)
    parts.push(line)
  }

  return { summary: parts.join(' ').trim(), lineIndices }
}

function isExcludedLineIndex(
  lineIndex: number,
  contact: StructuredResumeContact,
  summaryLineIndices: number[],
  skillsLineIndices: number[]
): boolean {
  return (
    contact.lineIndices.includes(lineIndex) ||
    summaryLineIndices.includes(lineIndex) ||
    skillsLineIndices.includes(lineIndex)
  )
}

function finalizePosition(
  draft: Omit<StructuredExperiencePosition, 'id' | 'domain' | 'domainLabel' | 'bodyText'>
): StructuredExperiencePosition | null {
  if (!isValidJobTitle(draft.title) || !isValidCompanyName(draft.company)) {
    return null
  }

  const bodyText = draft.bullets.map((bullet) => bullet.text).join('\n')
  const domain = categorizePositionDomain(draft.title, bodyText)

  return {
    ...draft,
    id: `${slugify(draft.company)}-${slugify(draft.title)}-${draft.headerLineIndex}`,
    bodyText,
    domain,
    domainLabel: DOMAIN_LABELS[domain],
  }
}

/**
 * Parse flat resume text into a structured document with contact metadata isolated
 * from experience blocks suitable for skill anchoring and LLM prompts.
 */
export function parseStructuredResumeDocument(resumeText: string): StructuredResumeDocument {
  const sourceLines = resumeText.replace(/\r\n/g, '\n').split('\n')
  const contact = extractContactBlock(sourceLines)
  const { summary, lineIndices: summaryLineIndices } = extractSummary(sourceLines)

  const skillsStart = sourceLines.findIndex((line) => /^skills|technical skills/i.test(line.trim()))
  const skillsLineIndices: number[] = skillsStart >= 0 ? [skillsStart] : []

  const experience: StructuredExperiencePosition[] = []
  let current: Omit<StructuredExperiencePosition, 'id' | 'domain' | 'domainLabel' | 'bodyText'> | null =
    null

  for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex += 1) {
    const rawLine = sourceLines[lineIndex] ?? ''
    const line = rawLine.trim()
    if (!line) continue

    if (isExcludedLineIndex(lineIndex, contact, summaryLineIndices, skillsLineIndices)) {
      continue
    }

    if (/^(work experience|experience|employment|professional experience)$/i.test(line)) {
      continue
    }

    if (/^(education|certifications?)$/i.test(line)) {
      break
    }

    if (isDateRangeLine(line) && current) {
      const dates = parseDateRange(line)
      current.startDate = dates.startDate
      current.endDate = dates.endDate
      current.dateLineIndex = lineIndex
      continue
    }

    const roleMatch = line.match(ROLE_LINE)
    if (roleMatch && !isBulletLine(line) && !isDateRangeLine(line)) {
      const title = roleMatch[1]!.trim()
      const company = roleMatch[2]!.trim()
      const location = roleMatch[3]?.trim()

      if (isValidJobTitle(title) && isValidCompanyName(company)) {
        if (current) {
          const finalized = finalizePosition(current)
          if (finalized) experience.push(finalized)
        }

        current = {
          title,
          company,
          location,
          headerLineIndex: lineIndex,
          bullets: [],
        }
        continue
      }
    }

    if (current && isBulletLine(line)) {
      const text = stripBulletPrefix(line)
      if (text.length >= 12 && !isContactMetadataLine(text)) {
        current.bullets.push({
          bulletIndex: current.bullets.length,
          text,
          lineIndex,
        })
      }
    }
  }

  if (current) {
    const finalized = finalizePosition(current)
    if (finalized) experience.push(finalized)
  }

  return {
    sourceLines,
    contact,
    summary,
    summaryLineIndices,
    skillsLineIndices,
    experience,
    rawText: resumeText,
  }
}

/** Experience-only context for LLM prompts — no contact headers, emails, or raw date tokens as employers. */
export function buildSanitizedTailoringContext(document: StructuredResumeDocument): string {
  if (document.experience.length === 0) {
    const raw = document.rawText.trim()
    return raw || '[No structured experience blocks detected]'
  }

  return document.experience
    .map((position) => {
      const bullets = position.bullets.map((bullet) => `  • ${bullet.text}`).join('\n')
      return [
        `Role: ${position.title}`,
        `Company: ${position.company}`,
        position.location ? `Location: ${position.location}` : null,
        position.startDate || position.endDate
          ? `Tenure: ${position.startDate ?? '?'} – ${position.endDate ?? 'Present'}`
          : null,
        `Domain: ${position.domainLabel}`,
        bullets || '  • [No bullets parsed]',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export function buildPlacementBreadcrumb(
  placement: 'summary' | 'skills' | 'experience',
  company?: string | null
): string {
  if (placement === 'summary') return '→ summary'
  if (placement === 'skills') return '→ skills'
  if (company?.trim()) return `→ experience [${company.trim()}]`
  return '→ experience'
}

export interface StructuredSkillModification {
  snippet: string
  positionId?: string
  bulletIndex?: number
  originalBullet?: string
  bulletLineIndex?: number
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}

export function applyStructuredSkillModifications(
  resumeText: string,
  modifications: StructuredSkillModification[]
): string {
  if (modifications.length === 0) return resumeText

  const document = parseStructuredResumeDocument(resumeText)
  const lines = [...document.sourceLines]

  for (const modification of modifications) {
    const nextText = modification.snippet.trim()
    if (!nextText) continue

    if (modification.positionId && modification.bulletIndex !== undefined) {
      const position = document.experience.find((entry) => entry.id === modification.positionId)
      const bullet = position?.bullets[modification.bulletIndex]
      if (bullet) {
        bullet.text = nextText
        const line = lines[bullet.lineIndex]
        if (line) {
          lines[bullet.lineIndex] = restoreBulletPrefix(line, nextText)
        }
        continue
      }
    }

    if (
      modification.modificationType === 'inline-bullet' &&
      modification.bulletLineIndex !== undefined &&
      modification.bulletLineIndex >= 0
    ) {
      const line = lines[modification.bulletLineIndex]
      if (line) {
        lines[modification.bulletLineIndex] = restoreBulletPrefix(line, nextText)
        continue
      }
    }

    if (modification.originalBullet?.trim()) {
      const target = modification.originalBullet.trim()
      const lineIndex = lines.findIndex((line) => stripBulletPrefix(line) === target)
      if (lineIndex >= 0) {
        lines[lineIndex] = restoreBulletPrefix(lines[lineIndex]!, nextText)
        continue
      }
    }

    if (modification.modificationType === 'summary' && document.summaryLineIndices.length > 0) {
      const insertAt = document.summaryLineIndices[0]! + 1
      if (lines[insertAt]?.trim()) {
        lines[insertAt] = nextText
      } else {
        lines.splice(insertAt, 0, nextText)
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function mapStructuredExperienceToDomainMap(document: StructuredResumeDocument) {
  return {
    positions: document.experience.map((position) => ({
      title: position.title,
      company: position.company,
      domain: position.domain,
      domainLabel: position.domainLabel,
      headerLineIndex: position.headerLineIndex,
      bodyText: position.bodyText,
      id: position.id,
      bullets: position.bullets.map((bullet) => ({
        lineIndex: bullet.lineIndex,
        text: bullet.text,
        bulletIndex: bullet.bulletIndex,
      })),
    })),
    lines: document.sourceLines,
  }
}
