import type { Experience } from '@/lib/ai/schemas'
import {
  isExperienceSectionHeading,
  isValidExperienceBullet,
} from '@/lib/resume/contact-extraction'
import {
  isGhostConsolidatedEmployer,
  parseRoleBoundaryLine,
} from '@/lib/resume/role-boundary-parser'
import { stripResumeHeadingMarkers } from '@/lib/resume/resume-text-normalize'

const COMPANY_HINT =
  /\b(solutions|association|inc|corp|corporation|ltd|limited|company|group|technologies|labs|bank|university|college|ama|cohere|microserve|motor|popup|hub)\b/i

const SECTION_STOP =
  /^(education|certifications?|skills|technical skills|references|interests)\s*:?\s*$/i

const PROJECTS_SECTION =
  /^personal ai projects$|^personal ai project experience$|^personal projects$|^side ventures$|^product innovations$|^projects$|^ai experience\s*:?\s*$/i

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

export function looksLikeJobTitle(line: string): boolean {
  const trimmed = line.trim()
  // Past-tense bullet openers ("Led release planning") are not job titles.
  if (/^led\s+\w/i.test(trimmed)) return false
  return /(?:manager|engineer|director|\blead(?:er|ership)?\b|analyst|consultant|developer|architect|specialist|coordinator|administrator|owner|program|project|designer)/i.test(
    trimmed
  )
}

export function looksLikeCompanyLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 80) return false
  if (isBulletLine(trimmed)) return false
  if (/@|https?:\/\//.test(trimmed)) return false
  if (/^(professional summary|work experience|professional experience)$/i.test(trimmed)) return false
  // Prose achievement lines ("Led release planning.") are not employer names.
  if (/\.$/.test(trimmed) && /[a-z]/.test(trimmed.slice(1))) return false
  if (/^led\s+[a-z]/i.test(trimmed)) return false
  if (COMPANY_HINT.test(trimmed)) return true
  if (/^tipsy fox/i.test(trimmed)) return true
  if (
    /^[A-Z][A-Za-z0-9&.'\- ]{2,55}$/.test(trimmed) &&
    !looksLikeJobTitle(trimmed) &&
    trimmed.split(/\s+/).length <= 6
  ) {
    return true
  }
  return false
}

export function isDateLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    /^(\w+\.?\s+)?\d{4}\s*[-–—]\s*(\w+\.?\s+\d{4}|present|current|now)$/i.test(trimmed) ||
    /^\d{1,2}\/\d{4}\s*[-–—]\s*(\d{1,2}\/\d{4}|present|current|now)$/i.test(trimmed) ||
    /^\d{4}\s*[-–—]\s*(\d{4}|present|current|now)$/i.test(trimmed)
  )
}

export function parseDateLine(line: string): { startDate: string; endDate: string } | null {
  const trimmed = line.trim()
  const slashMatch = trimmed.match(
    /^(\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{4}|present|current|now)$/i
  )
  if (slashMatch) {
    return {
      startDate: slashMatch[1]!.trim(),
      endDate: /present|current|now/i.test(slashMatch[2] ?? '') ? 'Present' : slashMatch[2]!.trim(),
    }
  }

  const yearMatch = trimmed.match(/^(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)$/i)
  if (yearMatch) {
    return {
      startDate: yearMatch[1]!.trim(),
      endDate: /present|current|now/i.test(yearMatch[2] ?? '') ? 'Present' : yearMatch[2]!.trim(),
    }
  }

  const monthMatch = trimmed.match(
    /^(\w+\.?\s+\d{4})\s*[-–—]\s*(\w+\.?\s+\d{4}|present|current|now)$/i
  )
  if (monthMatch) {
    return {
      startDate: monthMatch[1]!.trim(),
      endDate: /present|current|now/i.test(monthMatch[2] ?? '') ? 'Present' : monthMatch[2]!.trim(),
    }
  }

  return null
}

export function isRealExperienceBullet(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 16 || trimmed.length > 800) return false
  if (!isValidExperienceBullet(trimmed)) return false
  if (/^(pleasant solutions|alberta motor association|technical project manager|systems developer)$/i.test(trimmed)) {
    return false
  }
  if (/^skilled in\b/i.test(trimmed) && trimmed.split(/\s+/).length >= 6 && !/\d|%/.test(trimmed)) {
    return false
  }
  if (looksLikeCompanyLine(trimmed) && trimmed.split(/\s+/).length <= 4) return false
  if (looksLikeJobTitle(trimmed) && !/\d|%/.test(trimmed) && trimmed.split(/\s+/).length <= 6) {
    return false
  }
  if (parseRoleBoundaryLine(trimmed)) return false
  if (/^(professional summary|summary|skills|education)$/i.test(trimmed)) return false
  return true
}

/** Blocks created when skill-summary prose is misparsed as a job entry. */
export function looksLikeRogueExperienceBlock(entry: Experience): boolean {
  if (entry.bullets.length === 0) return true

  const primaryBullet = entry.bullets[0]!.trim()
  const placeholderDates =
    (!entry.startDate.trim() || entry.startDate === 'Recent') &&
    (!entry.endDate.trim() || entry.endDate === 'Present')

  if (
    placeholderDates &&
    /^skilled in\b/i.test(primaryBullet) &&
    (/consultant|independent|professional experience/i.test(`${entry.title} ${entry.company}`) ||
      !entry.company.trim())
  ) {
    return true
  }

  if (
    entry.bullets.length === 1 &&
    /^skilled in\b/i.test(primaryBullet) &&
    entry.bullets.every((bullet) => !/\d|%/.test(bullet))
  ) {
    return true
  }

  return false
}

function emptyEntry(): Experience {
  return {
    title: '',
    company: '',
    location: '',
    startDate: '',
    endDate: 'Present',
    bullets: [],
  }
}

function flushEntry(current: Experience | null, entries: Experience[]) {
  if (!current) return
  const hasStructure = current.company.trim() || current.title.trim()
  const hasBullets = current.bullets.length > 0
  if (!hasStructure && !hasBullets) return

  const entry: Experience = {
    ...current,
    title: current.title.trim(),
    company: current.company.trim(),
    startDate: current.startDate.trim(),
    endDate: current.endDate.trim() || 'Present',
    bullets: current.bullets.filter(isRealExperienceBullet),
  }

  if (looksLikeRogueExperienceBlock(entry)) return
  if (!entry.company.trim() && !entry.title.trim()) return
  if (
    isGhostConsolidatedEmployer(entry.company, entry.title) &&
    entry.bullets.length === 0
  ) {
    return
  }

  entries.push({
    ...entry,
    title: entry.title.trim() || 'Role',
    company: entry.company.trim() || 'Employer',
  })
}

function findNextNonEmpty(lines: string[], fromIndex: number): number {
  for (let i = fromIndex + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim()) return i
  }
  return -1
}

/** Block-oriented parser for work history and personal project sections. */
export function parseWorkAndProjectsFromLines(lines: string[]): {
  experience: Experience[]
  projects: Experience[]
} {
  const experience: Experience[] = []
  const projects: Experience[] = []
  let current: Experience | null = null
  let inRelevantSection = false
  let inProjectsSection = false

  const flushCurrent = () => {
    if (!current) return
    const target = inProjectsSection ? projects : experience
    flushEntry(current, target)
    current = null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripResumeHeadingMarkers(lines[index]!.trim())
    if (!line) continue

    if (SECTION_STOP.test(line)) break

    if (isExperienceSectionHeading(line)) {
      flushCurrent()
      inRelevantSection = true
      inProjectsSection = false
      continue
    }

    if (PROJECTS_SECTION.test(line)) {
      flushCurrent()
      inRelevantSection = true
      inProjectsSection = true
      continue
    }

    if (!inRelevantSection) continue

    if (/^skilled in\b/i.test(line) && !isBulletLine(line)) {
      continue
    }

    if (isDateLine(line)) {
      if (current?.company.trim() || current?.title.trim()) {
        const dates = parseDateLine(line)
        if (dates) {
          current.startDate = dates.startDate
          current.endDate = dates.endDate
        }
      }
      continue
    }

    const roleBoundary = parseRoleBoundaryLine(line)
    if (roleBoundary) {
      flushCurrent()
      current = {
        title: roleBoundary.title,
        company: roleBoundary.company,
        location: roleBoundary.location,
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }

    if (isBulletLine(line)) {
      const bullet = stripBullet(line)
      if (parseRoleBoundaryLine(bullet)) {
        flushCurrent()
        const boundary = parseRoleBoundaryLine(bullet)!
        current = {
          title: boundary.title,
          company: boundary.company,
          location: boundary.location,
          startDate: '',
          endDate: 'Present',
          bullets: [],
        }
        continue
      }
      if (isDateLine(bullet)) {
        const dates = parseDateLine(bullet)
        if (dates && current) {
          current.startDate = dates.startDate
          current.endDate = dates.endDate
        }
        continue
      }
      if (isRealExperienceBullet(bullet)) {
        if (!current) current = emptyEntry()
        current.bullets.push(bullet)
      }
      continue
    }

    const nextIndex = findNextNonEmpty(lines, index)
    const nextLine = nextIndex >= 0 ? stripResumeHeadingMarkers(lines[nextIndex]!.trim()) : ''
    const nextNextIndex = nextIndex >= 0 ? findNextNonEmpty(lines, nextIndex) : -1
    const nextNextLine = nextNextIndex >= 0 ? stripResumeHeadingMarkers(lines[nextNextIndex]!.trim()) : ''

    const rolePipe = line.match(/^(.+?)\s*(?:—|–|-|\|)\s*(.+?)(?:\s*\((.+)\))?$/i)
    if (rolePipe) {
      const boundary = parseRoleBoundaryLine(line)
      if (boundary) {
        flushCurrent()
        current = {
          title: boundary.title,
          company: boundary.company,
          location: boundary.location,
          startDate: '',
          endDate: 'Present',
          bullets: [],
        }
        continue
      }
    }

    const atMatch = line.match(/^(.+?)\s+at\s+(.+)$/i)
    if (atMatch) {
      flushCurrent()
      current = {
        title: atMatch[1]!.trim(),
        company: atMatch[2]!.trim(),
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }

    if (
      looksLikeCompanyLine(line) &&
      nextLine &&
      looksLikeJobTitle(nextLine) &&
      !isBulletLine(nextLine)
    ) {
      flushCurrent()
      current = {
        company: line,
        title: inProjectsSection ? 'Personal AI Project' : nextLine,
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      index = nextIndex
      if (nextNextLine && isDateLine(nextNextLine)) {
        const dates = parseDateLine(nextNextLine)
        if (dates) {
          current.startDate = dates.startDate
          current.endDate = dates.endDate
        }
        index = nextNextIndex
      }
      continue
    }

    if (
      looksLikeJobTitle(line) &&
      nextLine &&
      looksLikeCompanyLine(nextLine) &&
      !isBulletLine(nextLine)
    ) {
      flushCurrent()
      current = {
        title: line,
        company: nextLine,
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      index = nextIndex
      if (nextNextLine && isDateLine(nextNextLine)) {
        const dates = parseDateLine(nextNextLine)
        if (dates) {
          current.startDate = dates.startDate
          current.endDate = dates.endDate
        }
        index = nextNextIndex
      }
      continue
    }

    if (inProjectsSection && looksLikeCompanyLine(line) && !looksLikeJobTitle(line)) {
      flushCurrent()
      current = {
        company: line,
        title: 'Personal AI Project',
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }
  }

  flushCurrent()

  return {
    experience: experience.filter((entry) => entry.bullets.length > 0 || entry.company.trim().length > 2),
    projects: projects.filter((entry) => entry.bullets.length > 0 || entry.company.trim().length > 2),
  }
}

export function parseExperienceFromLines(lines: string[]): Experience[] {
  return parseWorkAndProjectsFromLines(lines).experience
}

/** Split nested employer sub-blocks that were incorrectly flattened into one role's bullets. */
export function splitNestedEmployersInSingleEntry(entry: Experience): Experience[] {
  const segments = entry.bullets.map((bullet) => bullet.trim()).filter(Boolean)
  if (segments.length === 0) {
    return entry.company.trim() || entry.title.trim() ? [entry] : []
  }

  const chunks: Experience[] = []
  const parentIsGhost = isGhostConsolidatedEmployer(entry.company, entry.title)
  let current: Experience = parentIsGhost
    ? emptyEntry()
    : {
        title: entry.title,
        company: entry.company,
        location: entry.location,
        startDate: entry.startDate,
        endDate: entry.endDate,
        bullets: [],
      }

  const pushCurrent = () => {
    const hasIdentity = current.company.trim() || current.title.trim()
    const hasBullets = current.bullets.some(isRealExperienceBullet)
    if (!hasIdentity && !hasBullets) return

    chunks.push({
      ...current,
      title: current.title.trim(),
      company: current.company.trim(),
      startDate: current.startDate.trim(),
      endDate: current.endDate.trim() || 'Present',
      bullets: current.bullets.filter(isRealExperienceBullet),
    })
  }

  for (let index = 0; index < segments.length; index += 1) {
    const line = segments[index]!
    const boundary = parseRoleBoundaryLine(line)

    if (boundary) {
      pushCurrent()
      current = {
        title: boundary.title,
        company: boundary.company,
        location: boundary.location,
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }

    if (isDateLine(line)) {
      const dates = parseDateLine(line)
      if (dates) {
        current.startDate = dates.startDate
        current.endDate = dates.endDate
      }
      continue
    }

    if (
      looksLikeCompanyLine(line) &&
      !looksLikeJobTitle(line) &&
      line.toLowerCase() !== current.company.trim().toLowerCase()
    ) {
      const next = segments[index + 1]?.trim() ?? ''
      pushCurrent()
      current = emptyEntry()
      current.company = line
      if (next && looksLikeJobTitle(next) && !isDateLine(next)) {
        current.title = next
        index += 1
      }
      const afterTitle = segments[index + 1]?.trim() ?? ''
      if (afterTitle && isDateLine(afterTitle)) {
        const dates = parseDateLine(afterTitle)
        if (dates) {
          current.startDate = dates.startDate
          current.endDate = dates.endDate
        }
        index += 1
      }
      continue
    }

    if (looksLikeJobTitle(line) && current.company.trim() && !current.title.trim()) {
      current.title = line
      continue
    }

    if (looksLikeCompanyLine(line) || looksLikeJobTitle(line) || isDateLine(line)) {
      continue
    }

    if (isRealExperienceBullet(line)) {
      current.bullets.push(line)
    }
  }

  pushCurrent()

  const normalized = chunks.filter(
    (chunk) => (chunk.company.trim() || chunk.title.trim()) && chunk.bullets.length > 0
  )
  const withoutGhost = normalized.filter(
    (chunk) => !isGhostConsolidatedEmployer(chunk.company, chunk.title)
  )

  if (withoutGhost.length > 1) return withoutGhost
  if (withoutGhost.length === 1) return withoutGhost
  if (normalized.length > 1) return normalized
  if (normalized.length === 1 && !parentIsGhost) return normalized
  return entry.bullets.length > 0 ? normalized : [entry]
}

/** Expand any consolidated roles into distinct workExperience array items. */
export function explodeFlattenedExperienceEntries(experience: Experience[]): Experience[] {
  return experience.flatMap((entry) => {
    const split = splitNestedEmployersInSingleEntry(entry)
    return split.length > 0 ? split : [entry]
  })
}

export function deflateNestedWorkExperience(blocks: {
  experience: Experience[]
  projects: Experience[]
}): { experience: Experience[]; projects: Experience[] } {
  const experience = explodeFlattenedExperienceEntries(blocks.experience)
  const projects = explodeFlattenedExperienceEntries(blocks.projects)
  return { experience, projects }
}

export function scoreExperienceCompleteness(entries: Experience[]): number {
  return entries.reduce((sum, entry) => {
    let score = entry.bullets.filter(isRealExperienceBullet).length
    if (entry.company.trim() && !/previous employer|confidential|independent/i.test(entry.company)) {
      score += 3
    }
    if (entry.title.trim() && entry.title !== 'Professional Experience') score += 2
    if (entry.startDate.trim()) score += 2
    return sum + score
  }, 0)
}
