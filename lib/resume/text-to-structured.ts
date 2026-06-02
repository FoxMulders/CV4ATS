import type { Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import { parseCertificationsFromResumeText } from '@/lib/resume/certification-guard'
import {
  extractLocationFromText,
  inferNameFromEmail,
  looksLikePersonName,
  splitCombinedHeaderLine,
  titleCaseName,
} from '@/lib/resume/contact-extraction'
import {
  isResumeStructuralHeading,
  looksLikeCandidateName,
  resolveCandidateNameFromSource,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'
import {
  parseWorkAndProjectsFromLines,
  scoreExperienceCompleteness,
} from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  normalizeResumeDocumentText,
  stripResumeHeadingMarkers,
} from '@/lib/resume/resume-text-normalize'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|core competencies|(?:professional\s+)?(?:work\s+)?experience|employment|education|certifications?|personal ai projects?|personal ai project experience|personal projects?|side ventures?|product innovations?)\s*:?\s*$/i

const INFERRED_SKILL_TERMS = [
  'release management',
  'program management',
  'project management',
  'technical program management',
  'agile',
  'scrum',
  'kanban',
  'itil',
  'jira',
  'ci/cd',
  'devops',
  'aws',
  'automation',
  'cross-functional',
  'stakeholder management',
  'roadmap',
  'scope management',
  'workflow',
  'cloud',
  'c#',
  'sql',
  'linear',
  'github',
] as const

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function isSectionHeadingLine(line: string): boolean {
  return SECTION_HEADING.test(stripResumeHeadingMarkers(line))
}

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

function extractContact(text: string) {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? ''
  const phone = text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? ''
  const linkedin =
    text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? ''

  const lines = splitLines(text)
    .map((line) => stripResumeHeadingMarkers(line.trim()))
    .filter(Boolean)

  const capsName = lines.find(
    (line) =>
      /^[A-Z][A-Z\s.'-]{2,50}$/.test(line) &&
      line.split(/\s+/).length <= 5 &&
      !line.includes('@') &&
      !isSectionHeadingLine(line)
  )

  const titleCasePerson = lines.slice(0, 8).find(looksLikePersonName)

  let location = extractLocationFromText(text)
  for (const line of lines.slice(0, 6)) {
    const split = splitCombinedHeaderLine(line)
    if (split) {
      location = split.location
      break
    }
  }

  const inferredFromEmail = email ? inferNameFromEmail(email) : null

  const resolvedName =
    (capsName && looksLikeCandidateName(capsName) ? titleCaseName(capsName) : null) ??
    (titleCasePerson ? titleCaseName(titleCasePerson) : null) ??
    (inferredFromEmail && looksLikeCandidateName(inferredFromEmail) ? inferredFromEmail : null) ??
    resolveCandidateNameFromSource(text, email)

  return {
    name: sanitizeCandidateName(resolvedName, text),
    email,
    phone,
    linkedin,
    location: location.replace(/^[A-Z][A-Z\s.'-]+\s+(?=Edmonton|,)/i, '').trim(),
  }
}

function extractSection(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((line) => heading.test(stripResumeHeadingMarkers(line)))
  if (start < 0) return []

  const content: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = stripResumeHeadingMarkers(lines[index]?.trim() ?? '')
    if (!line) continue
    if (isSectionHeadingLine(line)) break
    content.push(line)
  }

  return content
}

function isValidSkillToken(skill: string): boolean {
  const trimmed = skill.trim()
  if (trimmed.length < 2 || trimmed.length > 40) return false
  if (/@|\d{3}[-.)]\d{3}|https?:\/\//i.test(trimmed)) return false
  if (/^(brad|mulders|edmonton|canada|stored|replicating|replicated|verified|including|missing)$/i.test(trimmed)) {
    return false
  }
  if (/^[A-Z0-9]{3}\s?[A-Z0-9]{3}$/.test(trimmed)) return false
  if (/^(and|the|with|for|from|into|using|utilizing|leveraging)$/i.test(trimmed)) return false
  if (isResumeStructuralHeading(trimmed)) return false
  return true
}

function inferSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase()
  const found = INFERRED_SKILL_TERMS.filter((term) => {
    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    return pattern.test(lower)
  }).map((term) => term.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))

  return [...new Set(found)].slice(0, 18)
}

function parseSkills(lines: string[], fullText: string): string[] {
  const section = extractSection(lines, /^(skills|technical skills|core competencies)/i)

  const source =
    section.length > 0
      ? section
      : lines.filter(
          (line) =>
            /[,;|•]/.test(line) &&
            line.length < 120 &&
            !looksLikePersonName(line) &&
            !line.includes('@') &&
            !/^\d/.test(line.trim())
        ).slice(0, 4)

  const skills = source
    .flatMap((line) => line.split(/[,;|•]/))
    .map((skill) => skill.trim())
    .filter(isValidSkillToken)

  const deduped = dedupeSkills(
    [...new Set(skills.map((skill) => skill.replace(/\s+/g, ' ')))].slice(0, 24)
  )
  if (deduped.length >= 4) return deduped

  const inferred = inferSkillsFromText(fullText)
  return dedupeSkills([...new Set([...deduped, ...inferred])]).slice(0, 24)
}

function parseExperienceAndProjects(lines: string[]): { experience: Experience[]; projects: Experience[] } {
  const parsed = parseWorkAndProjectsFromLines(lines.map((line) => stripResumeHeadingMarkers(line)))
  if (parsed.experience.length > 0 || parsed.projects.length > 0) {
    return parsed
  }

  const bullets = lines
    .filter(isBulletLine)
    .map(stripBullet)
    .filter((bullet) => bullet.length > 12)
    .filter((bullet) => !/utilizing .+ utilizing/i.test(bullet))

  if (bullets.length === 0) return { experience: [], projects: [] }

  return {
    experience: [
      {
        title: 'Consultant',
        company: 'Independent',
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: bullets.slice(0, 8),
      },
    ],
    projects: [],
  }
}

function parseEducation(lines: string[]): Education[] {
  const section = extractSection(lines, /^education/i)
  if (section.length === 0) return []

  return section.slice(0, 3).map((line) => ({
    degree: line,
    school: '',
    graduationDate: line.match(/\b(19|20)\d{2}\b/)?.[0] ?? '',
    details: '',
  }))
}

function parseSummary(lines: string[]): string {
  const section = extractSection(lines, /^professional summary|^summary/i)
  if (section.length > 0) {
    return section.join(' ').trim()
  }

  const prose = lines
    .map((line) => stripResumeHeadingMarkers(line))
    .filter(
      (line) =>
        line.trim().length > 40 &&
        line.trim().length < 320 &&
        !isBulletLine(line) &&
        !isSectionHeadingLine(line) &&
        !line.includes('@') &&
        !/^analysis of/i.test(line.trim())
    )
    .slice(0, 2)

  if (prose.length > 0) {
    return prose.join(' ')
  }

  return 'Technical program and delivery leader with experience coordinating cross-functional releases, stakeholder alignment, and operational workflow improvements.'
}

/** Best-effort plain-text resume → structured TailoredResume for local fallback mode. */
export function parseResumeTextToTailoredResume(resumeText: string): TailoredResume {
  const normalizedText = normalizeResumeDocumentText(resumeText)
  const lines = splitLines(normalizedText)
  const contact = extractContact(normalizedText)
  const { experience, projects } = parseExperienceAndProjects(lines)

  return formatTailoredResume({
    contact,
    summary: parseSummary(lines),
    skills: parseSkills(lines, normalizedText),
    experience,
    projects,
    education: parseEducation(lines),
    certifications: parseCertificationsFromResumeText(normalizedText),
  })
}

export { scoreExperienceCompleteness }
