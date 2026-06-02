import { stripResumeHeadingMarkers } from '@/lib/resume/resume-text-normalize'

/** Canonical section labels — only exact matches (after normalization) open a new section. */
export const CANONICAL_RESUME_SECTION_LABELS = {
  summary: ['PROFESSIONAL SUMMARY', 'SUMMARY', 'PROFILE'],
  skills: ['SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES', 'COMPETENCIES'],
  workExperience: [
    'WORK EXPERIENCE',
    'EXPERIENCE',
    'EMPLOYMENT',
    'PROFESSIONAL EXPERIENCE',
    'WORK HISTORY',
  ],
  personalProjects: [
    'PERSONAL AI PROJECT EXPERIENCE',
    'PERSONAL AI PROJECTS',
    'PERSONAL AI PROJECT',
    'PERSONAL PROJECTS',
    'SIDE VENTURES',
    'PRODUCT INNOVATIONS',
    'PROJECTS',
    'AI EXPERIENCE',
  ],
  education: ['EDUCATION'],
  certifications: ['CERTIFICATIONS', 'CERTIFICATION'],
} as const

export type CanonicalResumeSectionKey = keyof typeof CANONICAL_RESUME_SECTION_LABELS

const TRUNCATED_SECTION_FRAGMENT =
  /^(?:FESSIONAL|FESSION|SSIONAL|OFSSIONAL|KILLS|HNICAL|PERIENCE|PERIENCE|MPLOYMENT|UCATION|RTIFICATION)/i

const ALL_CANONICAL_LABELS: Set<string> = new Set(
  Object.values(CANONICAL_RESUME_SECTION_LABELS).flat()
)

/** Markdown section header with optional # prefix and trailing colon. */
export const MARKDOWN_SECTION_HEADER_PATTERN =
  /^\s*(?:#{1,6}\s+)?([A-Za-z][A-Za-z0-9\s/&-]{2,48})\s*:?\s*$/i

export function normalizeSectionHeadingLabel(line: string): string {
  return stripResumeHeadingMarkers(line)
    .replace(/\s*:+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Returns canonical section key only when the line is a full, valid section title.
 * Rejects partial stream artifacts (e.g. "fessional Summary" after chunk loss).
 */
export function resolveCanonicalSectionKey(line: string): CanonicalResumeSectionKey | null {
  const normalized = normalizeSectionHeadingLabel(line)
  if (!normalized || normalized.length < 4) return null

  if (TRUNCATED_SECTION_FRAGMENT.test(normalized)) return null
  if (!ALL_CANONICAL_LABELS.has(normalized)) return null

  for (const [key, labels] of Object.entries(CANONICAL_RESUME_SECTION_LABELS) as Array<
    [CanonicalResumeSectionKey, readonly string[]]
  >) {
    if (labels.includes(normalized)) return key
  }

  return null
}

export function isCanonicalSectionHeadingLine(line: string): boolean {
  return resolveCanonicalSectionKey(line) !== null
}

export type ResumeSectionBodies = Partial<Record<CanonicalResumeSectionKey, string>>

/**
 * Split resume markdown/plain text into section bodies using regex-safe full-line matching.
 */
export function splitResumeDocumentBySections(text: string): ResumeSectionBodies {
  const sections: ResumeSectionBodies = {}
  let currentKey: CanonicalResumeSectionKey | null = null
  const buffers = new Map<CanonicalResumeSectionKey, string[]>()

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const sectionKey = resolveCanonicalSectionKey(trimmed)
    if (sectionKey) {
      currentKey = sectionKey
      if (!buffers.has(sectionKey)) {
        buffers.set(sectionKey, [])
      }
      continue
    }

    if (currentKey) {
      buffers.get(currentKey)?.push(rawLine.trim())
    }
  }

  for (const [key, lines] of buffers.entries()) {
    sections[key] = lines.join('\n').trim()
  }

  return sections
}

/**
 * Extract lines belonging to one canonical section (regex scan, no substring offsets).
 */
export function extractSectionLines(
  text: string,
  sectionKey: CanonicalResumeSectionKey
): string[] {
  const allowed = new Set<string>(CANONICAL_RESUME_SECTION_LABELS[sectionKey])
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const content: string[] = []
  let capturing = false

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      if (capturing) content.push('')
      continue
    }

    const normalized = normalizeSectionHeadingLabel(trimmed)
    if (ALL_CANONICAL_LABELS.has(normalized)) {
      if (allowed.has(normalized)) {
        capturing = true
        continue
      }
      if (capturing) break
      continue
    }

    if (capturing) {
      content.push(rawLine)
    }
  }

  return content
}

/** Map legacy section regex tests to canonical keys for weighted scoring. */
export function sectionHeadingMatches(
  line: string,
  aliases: readonly string[]
): boolean {
  const normalized = normalizeSectionHeadingLabel(line)
  return aliases.some((alias) => alias.toUpperCase() === normalized)
}
