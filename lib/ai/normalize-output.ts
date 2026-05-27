import type { TailoredResume } from '@/lib/ai/schemas'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'

/** Strip markdown fences and conversational wrappers before JSON.parse. */
export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const jsonSlice =
    start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate

  return JSON.parse(jsonSlice)
}

/** Map Gemini JSON aliases to the strict ATS4CV schema before Zod validation. */
export function normalizeAiGenerationOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }

  const root = raw as Record<string, unknown>
  const coverLetter = normalizeCoverLetter(root.coverLetter)
  const tailoredResume = normalizeTailoredResume(root.tailoredResume)

  return {
    ...root,
    coverLetter,
    tailoredResume,
  }
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

function normalizeTailoredResume(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const resume = { ...(value as Record<string, unknown>) }

  if (typeof resume.professionalSummary === 'string' && !resume.summary) {
    resume.summary = resume.professionalSummary
  }

  if (Array.isArray(resume.experience)) {
    resume.experience = resume.experience.map(normalizeExperienceEntry)
  }

  if (Array.isArray(resume.education)) {
    resume.education = resume.education.map(normalizeEducationEntry)
  }

  if (resume.contact && typeof resume.contact === 'object' && !Array.isArray(resume.contact)) {
    const contact = { ...(resume.contact as Record<string, unknown>) }
    if (typeof contact.name !== 'string' && typeof contact.fullName === 'string') {
      contact.name = contact.fullName
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
