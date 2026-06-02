import { z } from 'zod'

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
  deflateNestedWorkExperience,
  parseWorkAndProjectsFromLines,
} from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  normalizeResumeDocumentText,
  stripResumeHeadingMarkers,
} from '@/lib/resume/resume-text-normalize'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|core competencies|(?:professional\s+)?(?:work\s+)?experience|employment|education|certifications?|personal ai projects?|personal ai project experience|personal projects?|side ventures?|product innovations?|projects?|ai experience)\s*:?\s*$/i

export const deterministicWorkExperienceSchema = z.object({
  job_title: z.string().min(1),
  company: z.string().min(1),
  location: z.string(),
  date_range: z.string(),
  bullets: z.array(z.string().min(1)).min(1),
})

export const deterministicProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  bullets: z.array(z.string().min(1)).min(1),
})

export const deterministicEducationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string(),
  year: z.string(),
  details: z.array(z.string()),
})

export const deterministicResumeSchema = z.object({
  professional_summary: z.string().min(1),
  skills: z.array(z.string().min(1)),
  work_experience: z.array(deterministicWorkExperienceSchema),
  projects: z.array(deterministicProjectSchema),
  education: z.array(deterministicEducationSchema),
})

export type DeterministicWorkExperience = z.infer<typeof deterministicWorkExperienceSchema>
export type DeterministicProject = z.infer<typeof deterministicProjectSchema>
export type DeterministicEducation = z.infer<typeof deterministicEducationSchema>
export type DeterministicResume = z.infer<typeof deterministicResumeSchema>

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function isSectionHeadingLine(line: string): boolean {
  return SECTION_HEADING.test(stripResumeHeadingMarkers(line))
}

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
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

function formatDateRange(startDate: string, endDate: string): string {
  const start = startDate.trim()
  const end = endDate.trim() || 'Present'
  if (!start) return end === 'Present' ? '' : end
  return `${start} - ${end}`
}

function parseDateRange(dateRange: string): { startDate: string; endDate: string } {
  const trimmed = dateRange.trim()
  const parts = trimmed.split(/\s*[-–—]\s*/)
  if (parts.length >= 2) {
    return {
      startDate: parts[0]!.trim(),
      endDate: /present|current|now/i.test(parts[1] ?? '') ? 'Present' : parts[1]!.trim(),
    }
  }
  return { startDate: trimmed, endDate: 'Present' }
}

function isValidSkillToken(skill: string): boolean {
  const trimmed = skill.trim()
  if (trimmed.length < 2 || trimmed.length > 48) return false
  if (/@|\d{3}[-.)]\d{3}|https?:\/\//i.test(trimmed)) return false
  if (isResumeStructuralHeading(trimmed)) return false
  if (/^(and|the|with|for|from|into|using)$/i.test(trimmed)) return false
  return true
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
            !line.includes('@')
        )

  const skills = source
    .flatMap((line) => line.split(/[,;|•]/))
    .map((skill) => skill.trim())
    .filter(isValidSkillToken)

  const deduped = dedupeSkills([...new Set(skills)])
  if (deduped.length > 0) return deduped

  const lower = fullText.toLowerCase()
  const inferred = ['Agile', 'Jira', 'GitHub', 'AWS', 'SQL', 'CI/CD'].filter((term) =>
    lower.includes(term.toLowerCase())
  )
  return dedupeSkills(inferred)
}

function parseProfessionalSummary(lines: string[]): string {
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
        !line.includes('@')
    )
    .slice(0, 2)

  if (prose.length > 0) return prose.join(' ')

  return 'Professional summary not detected in source text.'
}

function parseEducationEntries(lines: string[]): DeterministicEducation[] {
  const section = extractSection(lines, /^education/i)
  if (section.length === 0) return []

  return section.map((line) => {
    const year = line.match(/\b(19|20)\d{2}\b/)?.[0] ?? ''
    const commaSplit = line.split(',').map((part) => part.trim()).filter(Boolean)
    if (commaSplit.length >= 2) {
      return {
        degree: commaSplit[0]!,
        institution: commaSplit.slice(1).join(', ').replace(year, '').trim(),
        year,
        details: [],
      }
    }

    return {
      degree: line,
      institution: '',
      year,
      details: [],
    }
  })
}

function experienceToWorkEntry(entry: Experience): DeterministicWorkExperience {
  return {
    job_title: entry.title.trim() || 'Role',
    company: entry.company.trim(),
    location: entry.location?.trim() ?? '',
    date_range: formatDateRange(entry.startDate, entry.endDate),
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  }
}

function projectToDeterministic(entry: Experience): DeterministicProject {
  const title = entry.company.trim() || entry.title.trim() || 'Project'
  const description = entry.title.trim() && entry.title !== 'Personal AI Project' ? entry.title.trim() : ''
  return {
    title,
    description,
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  }
}

/**
 * Deterministic Resume Parser Engine — converts plain-text resumes into isolated,
 * chronologically structured JSON without LLM involvement.
 */
export function parseResumeDeterministic(input: string): DeterministicResume {
  const normalizedText = normalizeResumeDocumentText(input)
  const lines = splitLines(normalizedText).map((line) => line.trim()).filter(Boolean)

  const { experience, projects } = deflateNestedWorkExperience(
    parseWorkAndProjectsFromLines(lines.map((line) => stripResumeHeadingMarkers(line)))
  )

  const workExperience = experience
    .map(experienceToWorkEntry)
    .filter((entry) => entry.company.trim() && entry.bullets.length > 0)

  const projectEntries = projects
    .map(projectToDeterministic)
    .filter((entry) => entry.bullets.length > 0)

  const parsed: DeterministicResume = {
    professional_summary: parseProfessionalSummary(lines),
    skills: parseSkills(lines, normalizedText),
    work_experience: workExperience,
    projects: projectEntries,
    education: parseEducationEntries(lines),
  }

  return deterministicResumeSchema.parse(parsed)
}

export function deterministicResumeToTailoredResume(
  parsed: DeterministicResume,
  sourceText: string
): TailoredResume {
  const email = sourceText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? ''
  const phone = sourceText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? ''
  const linkedin =
    sourceText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? ''

  const lines = splitLines(sourceText)
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
  const inferredFromEmail = email ? inferNameFromEmail(email) : null

  const resolvedName =
    (capsName && looksLikeCandidateName(capsName) ? titleCaseName(capsName) : null) ??
    (titleCasePerson ? titleCaseName(titleCasePerson) : null) ??
    (inferredFromEmail && looksLikeCandidateName(inferredFromEmail) ? inferredFromEmail : null) ??
    resolveCandidateNameFromSource(sourceText, email)

  let location = extractLocationFromText(sourceText)
  for (const line of lines.slice(0, 6)) {
    const split = splitCombinedHeaderLine(line)
    if (split) {
      location = split.location
      break
    }
  }

  const experience: Experience[] = parsed.work_experience.map((entry) => {
    const dates = parseDateRange(entry.date_range)
    return {
      title: entry.job_title,
      company: entry.company,
      location: entry.location,
      startDate: dates.startDate || '2010',
      endDate: dates.endDate || 'Present',
      bullets: entry.bullets,
    }
  })

  const projects: Experience[] = parsed.projects.map((entry) => ({
    title: entry.description.trim() || 'Personal AI Project',
    company: entry.title,
    location: '',
    startDate: '',
    endDate: 'Present',
    bullets: entry.bullets,
  }))

  const education: Education[] = parsed.education.map((entry) => ({
    degree: entry.degree,
    school: entry.institution || 'Institution not listed',
    graduationDate: entry.year,
    details: entry.details.join(' '),
  }))

  return formatTailoredResume({
    contact: {
      name: sanitizeCandidateName(resolvedName, sourceText),
      email,
      phone,
      location: location.replace(/^[A-Z][A-Z\s.'-]+\s+(?=Edmonton|,)/i, '').trim(),
      linkedin,
    },
    summary: parsed.professional_summary,
    skills: parsed.skills.length > 0 ? parsed.skills : ['Program Management'],
    experience,
    projects,
    education,
    certifications: parseCertificationsFromResumeText(normalizeResumeDocumentText(sourceText)),
  })
}

/** Plain-text resume → TailoredResume via the deterministic parser engine. */
export function parseResumeTextToTailoredResume(resumeText: string): TailoredResume {
  const parsed = parseResumeDeterministic(resumeText)
  return deterministicResumeToTailoredResume(parsed, resumeText)
}

export { scoreExperienceCompleteness } from '@/lib/resume/parse-experience-blocks'
