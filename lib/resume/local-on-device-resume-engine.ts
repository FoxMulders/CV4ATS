import type { TailoredResume } from '@/lib/ai/schemas'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import {
  splitResumeDocumentBySections,
  type ResumeSectionBodies,
} from '@/lib/resume/defensive-markdown-parser'
import { parseWorkAndProjectsFromLines } from '@/lib/resume/parse-experience-blocks'

/** Canonical section titles for on-device markdown resume output. */
export const LOCAL_RESUME_SECTION = {
  summary: 'PROFESSIONAL SUMMARY',
  skills: 'SKILLS',
  workExperience: 'WORK EXPERIENCE',
  personalProjects: 'PERSONAL AI PROJECT EXPERIENCE',
  education: 'EDUCATION',
  certifications: 'CERTIFICATIONS',
} as const

export const LOCAL_RESUME_SECTION_TITLE_REGEX =
  /^(PROFESSIONAL SUMMARY|SUMMARY|PROFILE|SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE|WORK HISTORY|PERSONAL AI PROJECT(?: EXPERIENCE|S)?|PERSONAL PROJECTS?|SIDE VENTURES|PRODUCT INNOVATIONS|PROJECTS|AI EXPERIENCE|EDUCATION|CERTIFICATIONS?)\s*$/i

export const LOCAL_RESUME_SECTION_REGEX =
  /^#{1,6}\s+(PROFESSIONAL SUMMARY|SUMMARY|SKILLS|TECHNICAL SKILLS|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|PERSONAL AI PROJECT(?: EXPERIENCE|S)?|PERSONAL PROJECTS?|EDUCATION|CERTIFICATIONS)\s*$/i

/** Deterministic local Resume Parser directive — chronology-safe markdown output. */
export const LOCAL_ON_DEVICE_RESUME_DIRECTIVE = `You are a local, deterministically structured Resume Parser.
Your job is to optimize the resume for the target job description without altering professional chronology.

CRITICAL PARSING CONSTRAINTS:
1. MANDATORY SEPARATION: Every historical employer MUST be an independent entry. Pleasant Solutions, Alberta Motor Association, and Microserve are separate entities. Never group them into "Independent Consultant" or "Self-Employed".
2. TEXT BOX BREAKING TOKENS: Output each distinct role using the application's expected field structure. Separate job title, company name, and date range so the frontend parser maps them to individual state variables.
3. ISOLATE SIDE PROJECTS: Move cv2ats.ca, popuphub.ca, whobringswhat.ca, and Tipsy Fox Escapes out of work experience into standalone section "#### PERSONAL AI PROJECT EXPERIENCE".
4. NO METRIC INFLATION: Do not invent statistics or percentages. Use qualitative technical achievements only.

OUTPUT COMPLIANCE FORMAT:
Section headers use #### (PROFESSIONAL SUMMARY, SKILLS, WORK EXPERIENCE, PERSONAL AI PROJECT EXPERIENCE, EDUCATION).
Each work experience block MUST start with:
### [Job Title] — [Company]
[Start Date] – [End Date]`

function markdownSectionHeader(title: string): string {
  return `#### ${title}`
}

/** Role block header: `### [Job Title] — [Company]` */
export const ROLE_BLOCK_HEADER_REGEX =
  /^#{1,6}\s*(.+?)\s*(?:—|–|-)\s*(.+?)\s*$/

export function formatRoleBlockHeader(title: string, company: string): string {
  return `### ${title.trim()} — ${company.trim()}`
}

export function formatRoleBlockDateRange(startDate: string, endDate: string): string {
  const start = startDate.trim()
  const end = endDate.trim()
  if (!start && !end) return ''
  return `${start} – ${end}`.trim()
}

function serializeRoleBlock(
  lines: string[],
  entry: { title: string; company: string; startDate: string; endDate: string; location: string; bullets: string[] }
): void {
  const company = entry.company.trim()
  const title = entry.title.trim()
  if (company || title) {
    lines.push(formatRoleBlockHeader(title || 'Role', company || title))
  }
  const dates = formatRoleBlockDateRange(entry.startDate, entry.endDate)
  if (dates) lines.push(dates)
  if (entry.location.trim()) lines.push(entry.location.trim())
  for (const bullet of entry.bullets) {
    lines.push(`• ${bullet}`)
  }
  lines.push('')
}

/** Serialize resume as Markdown with #### section headers for UI regex splitting. */
export function serializeTailoredResumeMarkdown(resume: TailoredResume): string {
  const formatted = formatTailoredResume(resume)
  const lines: string[] = []

  lines.push(formatted.contact.name)

  const contactLine = [
    formatted.contact.email,
    formatted.contact.phone,
    formatted.contact.location,
    formatted.contact.linkedin,
  ]
    .filter(Boolean)
    .join(' | ')

  if (contactLine) lines.push(contactLine)
  lines.push('')

  lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.summary))
  lines.push(formatted.summary)
  lines.push('')

  lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.skills))
  lines.push(formatted.skills.join(' • '))
  lines.push('')

  lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.workExperience))
  for (const job of formatted.experience) {
    serializeRoleBlock(lines, job)
  }

  if ((formatted.projects ?? []).length > 0) {
    lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.personalProjects))
    for (const project of formatted.projects ?? []) {
      serializeRoleBlock(lines, {
        title: project.title.trim() || 'Personal AI Project',
        company: project.company.trim() || project.title.trim(),
        startDate: project.startDate,
        endDate: project.endDate,
        location: project.location,
        bullets: project.bullets,
      })
    }
  }

  if (formatted.education.length > 0) {
    lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.education))
    for (const edu of formatted.education) {
      const eduLine = [edu.degree, edu.school].filter(Boolean).join(', ')
      const datePart = edu.graduationDate ? ` — ${edu.graduationDate}` : ''
      lines.push(`${eduLine}${datePart}`)
      if (edu.details) lines.push(edu.details)
    }
    lines.push('')
  }

  if (formatted.certifications.length > 0) {
    lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.certifications))
    for (const cert of formatted.certifications) {
      lines.push(`• ${cert}`)
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export type MarkdownResumeSections = Partial<
  Record<
    | 'summary'
    | 'skills'
    | 'workExperience'
    | 'personalProjects'
    | 'education'
    | 'certifications',
    string
  >
>

function mapCanonicalSections(sections: ResumeSectionBodies): MarkdownResumeSections {
  return {
    summary: sections.summary,
    skills: sections.skills,
    workExperience: sections.workExperience,
    personalProjects: sections.personalProjects,
    education: sections.education,
    certifications: sections.certifications,
  }
}

/** Split markdown resume text into section bodies for UI field mapping. */
export function splitMarkdownResumeSections(text: string): MarkdownResumeSections {
  return mapCanonicalSections(splitResumeDocumentBySections(text))
}

/** Parse role blocks from a markdown work-experience or personal-projects section body. */
export function parseRoleBlocksFromMarkdownSection(
  sectionText: string,
  kind: 'work' | 'projects' = 'work'
) {
  const heading =
    kind === 'projects'
      ? LOCAL_RESUME_SECTION.personalProjects
      : LOCAL_RESUME_SECTION.workExperience
  const lines = [heading, ...sectionText.replace(/\r\n/g, '\n').split('\n')]
  return parseWorkAndProjectsFromLines(lines)
}
