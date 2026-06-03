import { stripResumeHeadingMarkers } from '@/lib/resume/resume-text-normalize'

/**
 * Role demarcation: `[Job Title] — [Company]` or `[Job Title] - [Company] | [Location]`
 * Optional markdown `###` prefix (serialized tailored output).
 * ASCII hyphen requires surrounding spaces so compound words (e.g. AI-assisted) are not split.
 */
export const ROLE_BOUNDARY_LINE_PATTERN =
  /^(?:#{1,6}\s+)?(.+?)\s*(?:—|–|\s-\s)\s*(.+?)(?:\s*\|\s*(.+))?\s*$/i

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

const COMPANY_HINT =
  /\b(solutions|association|inc|corp|corporation|ltd|limited|company|group|technologies|labs|bank|university|college|ama|cohere|microserve|motor|popup|hub)\b/i

const GHOST_EMPLOYER_PATTERN = /^(?:independent|consultant|freelance|self[- ]?employed)$/i

export type ParsedRoleBoundary = {
  title: string
  company: string
  location: string
}

function looksLikeJobTitle(line: string): boolean {
  const trimmed = line.trim()
  if (/^led\s+\w/i.test(trimmed)) return false
  return /(?:manager|engineer|director|\blead(?:er|ership)?\b|analyst|consultant|developer|architect|specialist|coordinator|administrator|owner|program|project|designer)/i.test(
    trimmed
  )
}

function looksLikeCompanyLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 80) return false
  if (/@|https?:\/\//.test(trimmed)) return false
  if (/\.$/.test(trimmed) && /[a-z]/.test(trimmed.slice(1))) return false
  if (COMPANY_HINT.test(trimmed)) return true
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

export function isGhostConsolidatedEmployer(company: string, title: string): boolean {
  const companyNorm = company.trim().toLowerCase()
  const titleNorm = title.trim().toLowerCase()
  return (
    GHOST_EMPLOYER_PATTERN.test(companyNorm) ||
    GHOST_EMPLOYER_PATTERN.test(titleNorm) ||
    (companyNorm === 'independent' && /consultant/i.test(titleNorm)) ||
    (titleNorm === 'consultant' && companyNorm === 'independent')
  )
}

/** True when a line is a role header, not achievement prose. */
export function parseRoleBoundaryLine(line: string): ParsedRoleBoundary | null {
  const trimmed = stripResumeHeadingMarkers(stripBulletPrefix(line))
  if (!trimmed || trimmed.length < 5 || trimmed.length > 140) return null
  if (isDateLine(trimmed)) return null

  const match = trimmed.match(ROLE_BOUNDARY_LINE_PATTERN)
  if (!match) return null

  const title = match[1]!.trim()
  const company = match[2]!.trim()
  const location = match[3]?.trim() ?? ''

  if (!title || !company) return null
  if (/\.\s+[A-Z]/.test(company) || company.split(/\s+/).length > 10) return null
  if (/^led\s+/i.test(title)) return null

  const titleLooksLikeRole = looksLikeJobTitle(title) || title.split(/\s+/).length <= 6
  const companyLooksLikeEmployer = looksLikeCompanyLine(company) || COMPANY_HINT.test(company)

  if (!titleLooksLikeRole && !companyLooksLikeEmployer) return null
  if (!companyLooksLikeEmployer && looksLikeJobTitle(company)) return null

  return { title, company, location }
}

export function lineSignalsNewRoleBoundary(line: string): boolean {
  if (parseRoleBoundaryLine(line)) return true
  const trimmed = stripResumeHeadingMarkers(stripBulletPrefix(line))
  if (isDateLine(trimmed) && trimmed.length < 40) return true
  if (looksLikeCompanyLine(trimmed) && !looksLikeJobTitle(trimmed)) return true
  return false
}

export function countRoleBoundariesInBullets(bullets: string[]): number {
  let count = 0
  for (const bullet of bullets) {
    if (parseRoleBoundaryLine(bullet)) count += 1
    else if (looksLikeCompanyLine(bullet.trim()) && !looksLikeJobTitle(bullet.trim())) count += 1
  }
  return count
}
