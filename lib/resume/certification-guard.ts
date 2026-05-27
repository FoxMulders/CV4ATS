import type { TailoredResume } from '@/lib/ai/schemas'
import { formatResumeText } from '@/lib/resume/ats-resume-formatter'
import { tokenize } from '@/lib/resume/stopwords'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|work experience|experience|employment|education|certifications?)\s*:?\s*$/i

const CERT_SECTION_HEADING = /^certifications?\s*:?\s*$/i

const BULLET_PREFIX = /^[\s•\-*–—]+/

const CERT_TOKEN_STOP = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'information',
  'infrastructure',
  'library',
  'methodologies',
  'methodology',
  'of',
  'technology',
  'the',
  'to',
])

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function stripBullet(line: string): string {
  return line.trim().replace(BULLET_PREFIX, '').trim()
}

function extractCertificationSection(lines: string[]): string[] {
  const start = lines.findIndex((line) => CERT_SECTION_HEADING.test(line.trim()))
  if (start < 0) return []

  const content: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    if (SECTION_HEADING.test(line)) break
    content.push(line)
  }

  return content
}

function parseCertificationLines(lines: string[]): string[] {
  const certs: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (BULLET_PREFIX.test(line)) {
      const bullet = stripBullet(line)
      if (bullet) certs.push(bullet)
      continue
    }

    const parts = line
      .split(/\s*[•|;/]\s*/)
      .map((part) => part.trim())
      .filter((part) => part.length > 2)

    if (parts.length > 1) {
      certs.push(...parts)
    } else {
      certs.push(line)
    }
  }

  return certs
}

/** Certifications explicitly listed in the source resume CERTIFICATIONS section. */
export function parseCertificationsFromResumeText(resumeText: string): string[] {
  const lines = splitLines(resumeText.replace(/\r\n/g, '\n'))
  const sectionLines = extractCertificationSection(lines)
  if (sectionLines.length === 0) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const cert of parseCertificationLines(sectionLines)) {
    const formatted = formatResumeText(cert)
    const key = normalizeCertKey(formatted)
    if (!formatted || !key || seen.has(key)) continue
    seen.add(key)
    result.push(formatted)
  }

  return result
}

function normalizeCertKey(cert: string): string {
  return tokenize(cert.toLowerCase())
    .filter((token) => !CERT_TOKEN_STOP.has(token))
    .join(' ')
}

function significantCertTokens(cert: string): string[] {
  return tokenize(cert.toLowerCase()).filter(
    (token) => token.length >= 3 && !CERT_TOKEN_STOP.has(token)
  )
}

/** True when a tailored certification corresponds to a source-listed credential. */
export function certificationMatchesSource(cert: string, sourceCerts: string[]): boolean {
  const candidateKey = normalizeCertKey(cert)
  if (!candidateKey) return false

  return sourceCerts.some((sourceCert) => {
    const sourceKey = normalizeCertKey(sourceCert)
    if (!sourceKey) return false
    if (candidateKey === sourceKey) return true
    if (candidateKey.includes(sourceKey) || sourceKey.includes(candidateKey)) return true

    const candidateTokens = significantCertTokens(cert)
    const sourceTokens = significantCertTokens(sourceCert)
    if (candidateTokens.length === 0 || sourceTokens.length === 0) return false

    const overlap = candidateTokens.filter((token) => sourceTokens.includes(token))
    const minimum = Math.min(candidateTokens.length, sourceTokens.length, 2)
    return overlap.length >= minimum
  })
}

/**
 * Strip invented credentials. Certifications may only appear when the source
 * resume already lists them in a CERTIFICATIONS section.
 */
export function enforceSourceCertifications(
  resume: TailoredResume,
  sourceResumeText: string
): TailoredResume {
  const sourceCerts = parseCertificationsFromResumeText(sourceResumeText)

  if (sourceCerts.length === 0) {
    return { ...resume, certifications: [] }
  }

  const tailored = (resume.certifications ?? [])
    .map((cert) => formatResumeText(cert))
    .filter(Boolean)

  const sanitized = tailored.filter((cert) => certificationMatchesSource(cert, sourceCerts))

  return {
    ...resume,
    certifications: sanitized.length > 0 ? sanitized : sourceCerts,
  }
}
