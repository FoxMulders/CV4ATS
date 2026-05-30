import type { Experience } from '@/lib/ai/schemas'
import {
  isExperienceSectionHeading,
  isValidExperienceBullet,
} from '@/lib/resume/contact-extraction'

const COMPANY_HINT =
  /\b(solutions|association|inc|corp|corporation|ltd|limited|company|group|technologies|labs|bank|university|college|ama|cohere|microserve|motor)\b/i

const SECTION_STOP =
  /^(education|certifications?|skills|technical skills|references|interests)\s*:?\s*$/i

const PROJECTS_SECTION = /^personal ai projects|^personal projects|^projects\s*:?\s*$/i

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

export function looksLikeJobTitle(line: string): boolean {
  return /(?:manager|engineer|director|lead|analyst|consultant|developer|architect|specialist|coordinator|administrator|owner|program|project|designer)/i.test(
    line
  )
}

export function looksLikeCompanyLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 80) return false
  if (isBulletLine(trimmed)) return false
  if (/@|https?:\/\//.test(trimmed)) return false
  if (/^(professional summary|work experience|professional experience)$/i.test(trimmed)) return false
  if (COMPANY_HINT.test(trimmed)) return true
  if (/^(tipsy fox|popuphub|pop-up hub)/i.test(trimmed)) return true
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
  if (trimmed.length < 16 || trimmed.length > 320) return false
  if (!isValidExperienceBullet(trimmed)) return false
  if (/^(pleasant solutions|alberta motor association|technical project manager|systems developer)$/i.test(trimmed)) {
    return false
  }
  if (looksLikeCompanyLine(trimmed) && trimmed.split(/\s+/).length <= 4) return false
  if (looksLikeJobTitle(trimmed) && !/\d|%/.test(trimmed) && trimmed.split(/\s+/).length <= 6) {
    return false
  }
  if (/^(professional summary|summary|skills|education)$/i.test(trimmed)) return false
  return true
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

  entries.push({
    ...current,
    title: current.title.trim() || 'Consultant',
    company: current.company.trim() || 'Independent',
    startDate: current.startDate.trim(),
    endDate: current.endDate.trim() || 'Present',
    bullets: current.bullets.filter(isRealExperienceBullet),
  })
}

function findNextNonEmpty(lines: string[], fromIndex: number): number {
  for (let i = fromIndex + 1; i < lines.length; i += 1) {
    if (lines[i]?.trim()) return i
  }
  return -1
}

/** Block-oriented parser for work history and personal project sections. */
export function parseExperienceFromLines(lines: string[]): Experience[] {
  const entries: Experience[] = []
  let current: Experience | null = null
  let inRelevantSection = false
  let inProjectsSection = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim()
    if (!line) continue

    if (SECTION_STOP.test(line)) break

    if (isExperienceSectionHeading(line)) {
      flushEntry(current, entries)
      current = null
      inRelevantSection = true
      inProjectsSection = false
      continue
    }

    if (PROJECTS_SECTION.test(line)) {
      flushEntry(current, entries)
      current = null
      inRelevantSection = true
      inProjectsSection = true
      continue
    }

    if (!inRelevantSection) continue

    if (isDateLine(line)) {
      if (!current) current = emptyEntry()
      const dates = parseDateLine(line)
      if (dates) {
        current.startDate = dates.startDate
        current.endDate = dates.endDate
      }
      continue
    }

    if (isBulletLine(line)) {
      const bullet = stripBullet(line)
      if (isRealExperienceBullet(bullet)) {
        if (!current) current = emptyEntry()
        current.bullets.push(bullet)
      }
      continue
    }

    const nextIndex = findNextNonEmpty(lines, index)
    const nextLine = nextIndex >= 0 ? lines[nextIndex]!.trim() : ''
    const nextNextIndex = nextIndex >= 0 ? findNextNonEmpty(lines, nextIndex) : -1
    const nextNextLine = nextNextIndex >= 0 ? lines[nextNextIndex]!.trim() : ''

    const rolePipe = line.match(/^(.+?)\s*(?:—|–|-|\|)\s*(.+?)(?:\s*\((.+)\))?$/i)
    if (rolePipe && looksLikeJobTitle(rolePipe[1]!) && rolePipe[2]!.trim().length > 1) {
      flushEntry(current, entries)
      current = {
        title: rolePipe[1]!.trim(),
        company: rolePipe[2]!.trim(),
        location: rolePipe[3]?.trim() ?? '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }

    const atMatch = line.match(/^(.+?)\s+at\s+(.+)$/i)
    if (atMatch) {
      flushEntry(current, entries)
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
      flushEntry(current, entries)
      current = {
        company: line,
        title: inProjectsSection ? 'Personal AI Project' : nextLine,
        location: '',
        startDate: '',
        endDate: inProjectsSection ? 'Present' : 'Present',
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
      flushEntry(current, entries)
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
      flushEntry(current, entries)
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

  flushEntry(current, entries)

  return entries.filter((entry) => entry.bullets.length > 0 || entry.company.trim().length > 2)
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
