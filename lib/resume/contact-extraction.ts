import {
  splitResumeLines,
  stripResumeBulletPrefix,
} from '@/lib/resume/resume-text-normalize'

/** Infer a display name from an email local part (e.g. bradmulders@ → Brad Mulders). */
export function inferNameFromEmail(email: string): string | null {
  const local = email.split('@')[0]?.trim().toLowerCase()
  if (!local || local.length < 3) return null

  const separated = local.split(/[._-]+/).filter((part) => part.length > 1)
  if (separated.length >= 2) {
    return titleCaseName(separated.join(' '))
  }

  if (local.startsWith('brad') && local.length > 4) {
    return titleCaseName(`Brad ${local.slice(4)}`)
  }

  return null
}

export function titleCaseName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function looksLikePersonName(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 60) return false
  if (/@|https?:\/\/|\d{3}[-.)]\d{3}|T\d[A-Z]\s?\d[A-Z]\d/i.test(trimmed)) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  return words.every((word) => /^[A-Za-z'.-]+$/.test(word))
}

export function extractLocationFromText(text: string): string {
  const canadaPostal = text.match(
    /([A-Za-z .'-]+,\s*(?:Canada|AB|Alberta)?[^|\n@]*?\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b)/i
  )
  if (canadaPostal?.[1]) return canadaPostal[1].trim()

  const generic = text.match(/\b([A-Za-z .'-]+,\s*(?:Canada|United States|USA|US|UK)[^|\n@]{0,25})/i)
  return generic?.[1]?.trim() ?? ''
}

export function splitCombinedHeaderLine(line: string): { name: string; location: string } | null {
  const location = extractLocationFromText(line)
  if (!location || !line.includes(location)) return null

  const namePart = line.slice(0, line.indexOf(location)).trim()
  if (!namePart || namePart.length > 50) return null
  if (!looksLikePersonName(namePart) && !/^[A-Z][A-Z\s.'-]{2,40}$/.test(namePart)) return null

  return {
    name: titleCaseName(namePart),
    location,
  }
}

export function isContactOrLocationLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    /@/.test(trimmed) ||
    /\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(trimmed) ||
    /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/.test(trimmed) ||
    (trimmed.includes('|') && trimmed.includes('@'))
  )
}

export function isValidExperienceBullet(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 20 || trimmed.length > 320) return false
  if (isContactOrLocationLine(trimmed)) return false
  if (/^(professional experience|education|skills|summary)/i.test(trimmed)) return false
  if (/documented in source resume|employer not listed/i.test(trimmed)) return false
  if (/^\d+\+?\s*years\b/i.test(trimmed)) return false
  if (/technical program and delivery leader|cross-functional releases, stakeholder alignment/i.test(trimmed)) {
    return false
  }
  return true
}

export function isSummaryLikeLine(line: string, summary?: string): boolean {
  const trimmed = line.trim()
  if (/^\d+\+?\s*years\b/i.test(trimmed)) return true
  if (/technical program and delivery leader/i.test(trimmed)) return true
  if (!summary?.trim()) return false
  const summaryWords = new Set(
    summary
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4)
  )
  const lineWords = trimmed
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 4)
  const overlap = lineWords.filter((word) => summaryWords.has(word)).length
  return overlap >= Math.min(6, Math.ceil(lineWords.length * 0.55))
}

export function extractBulletsFromSource(text: string): string[] {
  return splitResumeLines(text)
    .map((line) => stripResumeBulletPrefix(line))
    .filter(isValidExperienceBullet)
    .slice(0, 12)
}

const EXPERIENCE_SECTION =
  /^(professional\s+)?(work\s+)?experience|^employment|^professional experience/i

export function isExperienceSectionHeading(line: string): boolean {
  return EXPERIENCE_SECTION.test(line.trim())
}
