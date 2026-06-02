import {
  inferNameFromEmail,
  looksLikePersonName,
  splitCombinedHeaderLine,
  titleCaseName,
} from '@/lib/resume/contact-extraction'
import { stripResumeHeadingMarkers } from '@/lib/resume/resume-text-normalize'

/** ATS section headers and template labels — never valid candidate names. */
export const RESUME_STRUCTURAL_HEADING =
  /^(?:professional summary|summary|profile|skills|technical skills|core competencies|(?:professional\s+)?(?:work\s+)?experience|employment|work history|education|certifications?|personal ai projects?|personal projects?|personal ai project experience|side ventures?|product innovations?|projects?|references|interests)\s*:?\s*$/i

const INVALID_NAME_FRAGMENT =
  /\b(professional summary|work experience|technical skills|personal ai|cover letter|candidate name|your name|resume|curriculum vitae)\b/i

export function isResumeStructuralHeading(line: string): boolean {
  const cleaned = stripResumeHeadingMarkers(line)
  return RESUME_STRUCTURAL_HEADING.test(cleaned)
}

export function looksLikeCandidateName(line: string): boolean {
  const cleaned = stripResumeHeadingMarkers(line).trim()
  if (!cleaned || cleaned.length < 3 || cleaned.length > 60) return false
  if (/@|https?:\/\/|\d{3}[-.)]\d{3}/i.test(cleaned)) return false
  if (isResumeStructuralHeading(cleaned)) return false
  if (INVALID_NAME_FRAGMENT.test(cleaned)) return false
  if (/^(professional candidate|hiring manager|dear hiring)/i.test(cleaned)) return false

  if (/^[A-Z][A-Z\s.'-]{2,50}$/.test(cleaned) && cleaned.split(/\s+/).length <= 5) {
    return true
  }

  return looksLikePersonName(cleaned)
}

/** Reject section-heading bleed and restore identity from source/email when needed. */
export function sanitizeCandidateName(name: string, sourceResumeText?: string): string {
  const trimmed = stripResumeHeadingMarkers(name).trim()
  if (trimmed && looksLikeCandidateName(trimmed)) {
    return titleCaseName(trimmed)
  }

  if (sourceResumeText?.trim()) {
    const resolved = resolveCandidateNameFromSource(sourceResumeText)
    if (resolved !== 'Professional Candidate') return resolved
  }

  return trimmed && !isResumeStructuralHeading(trimmed) && !INVALID_NAME_FRAGMENT.test(trimmed)
    ? titleCaseName(trimmed)
    : 'Professional Candidate'
}

export function resolveCandidateNameFromSource(sourceResumeText: string, emailHint?: string): string {
  const lines = sourceResumeText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => stripResumeHeadingMarkers(line.trim()))
    .filter(Boolean)

  for (const line of lines.slice(0, 8)) {
    const split = splitCombinedHeaderLine(line)
    if (split?.name && looksLikeCandidateName(split.name)) {
      return titleCaseName(split.name)
    }
  }

  for (const line of lines.slice(0, 8)) {
    if (looksLikeCandidateName(line)) {
      return titleCaseName(line)
    }
  }

  const email =
    emailHint?.trim() ||
    sourceResumeText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ||
    ''
  const fromEmail = email ? inferNameFromEmail(email) : null
  if (fromEmail && looksLikeCandidateName(fromEmail)) {
    return fromEmail
  }

  return 'Professional Candidate'
}
