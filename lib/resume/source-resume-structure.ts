import type { Contact, Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import { parseExperienceFromLines } from '@/lib/resume/parse-experience-blocks'

export type LockedExperienceBlock = {
  blockKey: string
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  /** Original date line as shown on the resume, when available. */
  datesDisplay: string
  bullets: string[]
}

export type LockedResumeStructure = {
  contact: Contact
  summary: string
  skills: string[]
  experience: LockedExperienceBlock[]
  education: Education[]
  certifications: string[]
}

function normalizeBlockKey(company: string, title: string): string {
  return `${company}::${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function formatDatesDisplay(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`
  return startDate || endDate || ''
}

function toLockedBlock(entry: Experience): LockedExperienceBlock {
  return {
    blockKey: normalizeBlockKey(entry.company, entry.title),
    company: entry.company.trim(),
    title: entry.title.trim(),
    location: entry.location ?? '',
    startDate: entry.startDate.trim(),
    endDate: entry.endDate.trim() || 'Present',
    datesDisplay: formatDatesDisplay(entry.startDate.trim(), entry.endDate.trim() || 'Present'),
    bullets: [...entry.bullets],
  }
}

/** Canonical, immutable timeline extracted from the user's source resume. */
export function lockSourceResumeStructure(sourceResumeText: string): LockedResumeStructure {
  const normalized = sourceResumeText.replace(/\r\n/g, '\n').trim()
  const lines = normalized.split('\n')
  const parsed = parseResumeTextToTailoredResume(normalized)
  const experience =
    parseExperienceFromLines(lines).length > 0
      ? parseExperienceFromLines(lines)
      : parsed.experience

  return {
    contact: parsed.contact,
    summary: parsed.summary.trim(),
    skills: [...parsed.skills],
    experience: experience.map(toLockedBlock).filter((block) => block.company || block.bullets.length > 0),
    education: parsed.education,
    certifications: parsed.certifications ?? [],
  }
}

export function lockedStructureToTailoredResume(structure: LockedResumeStructure): TailoredResume {
  return {
    contact: structure.contact,
    summary: structure.summary,
    skills: structure.skills,
    experience: structure.experience.map((block) => ({
      title: block.title,
      company: block.company,
      location: block.location,
      startDate: block.startDate,
      endDate: block.endDate || 'Present',
      bullets: block.bullets.length > 0 ? block.bullets : ['Delivered measurable outcomes in this role.'],
    })),
    projects: [],
    education: structure.education,
    certifications: structure.certifications,
  }
}

export function serializeLockedExperienceForPrompt(structure: LockedResumeStructure): string {
  return JSON.stringify(
    structure.experience.map((block) => ({
      company: block.company,
      title: block.title,
      dates: block.datesDisplay,
      bullets: block.bullets,
    })),
    null,
    2
  )
}
