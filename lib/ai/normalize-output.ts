import type { TailoredResume, Experience } from '@/lib/ai/schemas'
import { sanitizeCandidateName, resolveCandidateNameFromSource } from '@/lib/resume/contact-identity'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import { enforceExperienceArrayBoundaries } from '@/lib/resume/enforce-experience-array-boundaries'
import { explodeFlattenedExperienceEntries } from '@/lib/resume/parse-experience-blocks'
import {
  parseJsonFromSanitizedText,
  stripMarkdownJsonFences,
} from '@/lib/ai/sanitize-json-response'

/** Strip markdown fences and conversational wrappers before JSON.parse. */
export function parseJsonFromModelText(text: string): unknown {
  const candidate = stripMarkdownJsonFences(text.trim())

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const jsonSlice =
    start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate

  return JSON.parse(jsonSlice)
}

export { stripMarkdownJsonFences, parseJsonFromSanitizedText }

/** Map Gemini JSON aliases to the strict cv2ats schema before Zod validation. */
export function normalizeAiGenerationOutput(raw: unknown, sourceResumeText = ''): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }

  const root = raw as Record<string, unknown>

  if (isEnrichmentShape(root)) {
    return normalizeEnrichmentToGenerationShape(root, sourceResumeText)
  }

  const coverLetter = normalizeCoverLetter(root.coverLetter)
  const tailoredResume = normalizeTailoredResume(root.tailoredResume, sourceResumeText)

  return {
    ...root,
    coverLetter,
    tailoredResume,
  }
}

function isEnrichmentShape(root: Record<string, unknown>): boolean {
  return (
    typeof root.professionalSummary === 'string' &&
    Array.isArray(root.workExperience) &&
    typeof root.coverLetter === 'string'
  )
}

function normalizeEnrichmentToGenerationShape(
  root: Record<string, unknown>,
  sourceResumeText = ''
): unknown {
  const workExperience = (root.workExperience as unknown[]).map(normalizeEnrichmentExperienceEntry)
  const tailoredResume = normalizeTailoredResume(
    {
      contact: root.contact,
      summary: root.professionalSummary,
      skills: root.skills,
      experience: workExperience,
      education: root.education ?? [],
      certifications: root.certifications ?? [],
    },
    sourceResumeText
  )

  return {
    keywordReport: root.keywordReport,
    coverLetter: normalizeCoverLetter(root.coverLetter),
    tailoredResume,
  }
}

function normalizeEnrichmentExperienceEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return entry
  }

  const block = { ...(entry as Record<string, unknown>) }
  const dates = typeof block.dates === 'string' ? block.dates.trim() : ''
  const parts = dates.split(/\s*[-–—]\s*/)

  if (parts.length >= 2) {
    block.startDate = parts[0]!.trim()
    block.endDate = /present|current|now/i.test(parts[1] ?? '') ? 'Present' : parts[1]!.trim()
  } else if (dates) {
    block.startDate = dates
    block.endDate = 'Present'
  }

  if (typeof block.jobTitle === 'string' && !block.title) {
    block.title = block.jobTitle
  }

  return normalizeExperienceEntry(block)
}

function normalizeCoverLetter(value: unknown): unknown {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of ['text', 'body', 'content', 'coverLetter']) {
      if (typeof record[key] === 'string') {
        return record[key]
      }
    }
  }
  return value
}

function normalizeTailoredResume(value: unknown, sourceResumeText = ''): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const resume = { ...(value as Record<string, unknown>) }

  if (typeof resume.professionalSummary === 'string' && !resume.summary) {
    resume.summary = resume.professionalSummary
  }

  let experience = Array.isArray(resume.experience)
    ? (resume.experience.map(normalizeExperienceEntry) as Experience[])
    : []
  let projects = Array.isArray(resume.projects)
    ? (resume.projects.map(normalizeExperienceEntry) as Experience[])
    : []

  if (sourceResumeText.trim()) {
    const restored = enforceExperienceArrayBoundaries(experience, projects, sourceResumeText)
    experience = restored.experience
    projects = restored.projects
  } else {
    experience = explodeFlattenedExperienceEntries(experience)
    projects = explodeFlattenedExperienceEntries(projects)
  }

  resume.experience = experience
  resume.projects = projects

  if (Array.isArray(resume.education)) {
    resume.education = resume.education.map(normalizeEducationEntry)
  }

  if (resume.contact && typeof resume.contact === 'object' && !Array.isArray(resume.contact)) {
    const contact = { ...(resume.contact as Record<string, unknown>) }
    if (typeof contact.name !== 'string' && typeof contact.fullName === 'string') {
      contact.name = contact.fullName
    }
    if (typeof contact.name === 'string') {
      const sourceName = sourceResumeText.trim()
        ? resolveCandidateNameFromSource(sourceResumeText, String(contact.email ?? ''))
        : null
      contact.name =
        sourceName && sourceName !== 'Professional Candidate'
          ? sourceName
          : sanitizeCandidateName(contact.name, sourceResumeText)
    }
    resume.contact = contact
  }

  return formatTailoredResume(resume as TailoredResume)
}

function normalizeExperienceEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return entry
  }

  const experience = { ...(entry as Record<string, unknown>) }

  if (typeof experience.jobTitle === 'string' && !experience.title) {
    experience.title = experience.jobTitle
  }
  if (typeof experience.role === 'string' && !experience.title) {
    experience.title = experience.role
  }
  if (typeof experience.organization === 'string' && !experience.company) {
    experience.company = experience.organization
  }
  if (typeof experience.employer === 'string' && !experience.company) {
    experience.company = experience.employer
  }

  return experience
}

function normalizeEducationEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return entry
  }

  const education = { ...(entry as Record<string, unknown>) }

  if (typeof education.institution === 'string' && !education.school) {
    education.school = education.institution
  }
  if (typeof education.university === 'string' && !education.school) {
    education.school = education.university
  }

  return education
}
