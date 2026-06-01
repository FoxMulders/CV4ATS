import type { Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { formatResumeText, formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import { parseCertificationsFromResumeText } from '@/lib/resume/certification-guard'
import {
  extractLocationFromText,
  inferNameFromEmail,
  looksLikePersonName,
  splitCombinedHeaderLine,
  titleCaseName,
} from '@/lib/resume/contact-extraction'
import {
  parseExperienceFromLines,
  scoreExperienceCompleteness,
} from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|core competencies|(?:professional\s+)?(?:work\s+)?experience|employment|education|certifications?|personal ai projects|personal projects|side ventures?|product innovations?)\s*:?\s*$/i

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

  const lines = splitLines(text).map((line) => line.trim()).filter(Boolean)

  const capsName = lines.find(
    (line) =>
      /^[A-Z][A-Z\s.'-]{2,50}$/.test(line) &&
      line.split(/\s+/).length <= 5 &&
      !line.includes('@') &&
      !SECTION_HEADING.test(line)
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
    (capsName ? titleCaseName(capsName) : null) ??
    (titleCasePerson ? titleCaseName(titleCasePerson) : null) ??
    inferredFromEmail ??
    'Professional Candidate'

  return {
    name: resolvedName,
    email,
    phone,
    linkedin,
    location: location.replace(/^[A-Z][A-Z\s.'-]+\s+(?=Edmonton|,)/i, '').trim(),
  }
}

function extractSection(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((line) => heading.test(line.trim()))
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

function isValidSkillToken(skill: string): boolean {
  const trimmed = skill.trim()
  if (trimmed.length < 2 || trimmed.length > 40) return false
  if (/@|\d{3}[-.)]\d{3}|https?:\/\//i.test(trimmed)) return false
  if (/^(brad|mulders|edmonton|canada|stored|replicating|replicated|verified|including|missing)$/i.test(trimmed)) {
    return false
  }
  if (/^[A-Z0-9]{3}\s?[A-Z0-9]{3}$/.test(trimmed)) return false
  if (/^(and|the|with|for|from|into|using|utilizing|leveraging)$/i.test(trimmed)) return false
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

function parseExperience(lines: string[]): Experience[] {
  const parsed = parseExperienceFromLines(lines)
  if (parsed.length > 0) return parsed

  const bullets = lines
    .filter(isBulletLine)
    .map(stripBullet)
    .filter((bullet) => bullet.length > 12)
    .filter((bullet) => !/utilizing .+ utilizing/i.test(bullet))

  if (bullets.length === 0) return []

  return [
    {
      title: 'Consultant',
      company: 'Independent',
      location: '',
      startDate: '',
      endDate: 'Present',
      bullets: bullets.slice(0, 8),
    },
  ]
}

function parseEducation(lines: string[]): Education[] {
  const section = extractSection(lines, /^education/i)
  if (section.length === 0) return []

  return section.slice(0, 3).map((line) => ({
    degree: line,
    school: '',
    graduationDate: '',
    details: '',
  }))
}

function parseSummary(lines: string[]): string {
  const section = extractSection(lines, /^professional summary|^summary/i)
  if (section.length > 0) {
    return section.join(' ').trim()
  }

  const prose = lines
    .filter(
      (line) =>
        line.trim().length > 40 &&
        line.trim().length < 320 &&
        !isBulletLine(line) &&
        !SECTION_HEADING.test(line.trim()) &&
        !line.includes('@') &&
        !/^#{1,6}\s/.test(line.trim()) &&
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
  const normalizedText = formatResumeText(resumeText.replace(/\r\n/g, '\n'))
  const lines = splitLines(normalizedText)
  const contact = extractContact(normalizedText)

  return formatTailoredResume({
    contact,
    summary: parseSummary(lines),
    skills: parseSkills(lines, normalizedText),
    experience: parseExperience(lines),
    projects: [],
    education: parseEducation(lines),
    certifications: parseCertificationsFromResumeText(normalizedText),
  })
}
