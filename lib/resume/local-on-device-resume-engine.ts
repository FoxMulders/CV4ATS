import type { TailoredResume } from '@/lib/ai/schemas'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import { stripResumeHeadingMarkers } from '@/lib/resume/resume-text-normalize'

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
  /^(PROFESSIONAL SUMMARY|SUMMARY|SKILLS|TECHNICAL SKILLS|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|PERSONAL AI PROJECT(?: EXPERIENCE|S)?|PERSONAL PROJECTS?|EDUCATION|CERTIFICATIONS)\s*$/i

export const LOCAL_RESUME_SECTION_REGEX =
  /^#{1,6}\s+(PROFESSIONAL SUMMARY|SUMMARY|SKILLS|TECHNICAL SKILLS|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|PERSONAL AI PROJECT(?: EXPERIENCE|S)?|PERSONAL PROJECTS?|EDUCATION|CERTIFICATIONS)\s*$/i

/** Advanced on-device Resume Parser & Optimization Engine — prompt directive. */
export const LOCAL_ON_DEVICE_RESUME_DIRECTIVE = `You are an Advanced local Resume Parser & Optimization Engine running on-device.

TASK: Optimize the resume for the target Job Description. Output structured, chronologically accurate content.

STRICT TIMELINE & SEGREGATION RULES:
1. DETECT EVERY EMPLOYER: Never group different companies under "Independent Consultant". Pleasant Solutions, Alberta Motor Association, and Microserve are separate entries.
2. PRESERVE DATES: Do not alter date ranges. Each employer keeps its own block with original dates visible.
3. PERSONAL PROJECTS ISOLATION: cv2ats.ca, popuphub.ca, whobringswhat.ca, and Tipsy Fox Escapes are personal software applications — section "PERSONAL AI PROJECT EXPERIENCE" only, never full-time employment.
4. NO INVENTED METRICS: Keep achievements qualitative — architecture, scope, and technical leadership. No fictional percentages.

OUTPUT STRUCTURE (Markdown headers for UI parsing):
#### PROFESSIONAL SUMMARY
#### SKILLS
#### WORK EXPERIENCE
#### PERSONAL AI PROJECT EXPERIENCE
#### EDUCATION`

function markdownSectionHeader(title: string): string {
  return `#### ${title}`
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
    lines.push(job.company.trim())
    lines.push(job.title.trim())
    if (job.startDate || job.endDate) {
      lines.push(`${job.startDate} - ${job.endDate}`.trim())
    }
    if (job.location.trim()) {
      lines.push(job.location.trim())
    }
    for (const bullet of job.bullets) {
      lines.push(`• ${bullet}`)
    }
    lines.push('')
  }

  if ((formatted.projects ?? []).length > 0) {
    lines.push(markdownSectionHeader(LOCAL_RESUME_SECTION.personalProjects))
    for (const project of formatted.projects ?? []) {
      lines.push(project.company.trim() || project.title.trim())
      if (project.title.trim() && project.company.trim()) {
        lines.push(project.title.trim())
      }
      if (project.startDate || project.endDate) {
        lines.push(`${project.startDate} - ${project.endDate}`.trim())
      }
      for (const bullet of project.bullets) {
        lines.push(`• ${bullet}`)
      }
      lines.push('')
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

/** Split markdown resume text into section bodies for UI field mapping. */
export function splitMarkdownResumeSections(text: string): MarkdownResumeSections {
  const sections: MarkdownResumeSections = {}
  let currentKey: keyof MarkdownResumeSections | null = null
  const buffers = new Map<keyof MarkdownResumeSections, string[]>()

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = stripResumeHeadingMarkers(rawLine.trim())
    if (!line) continue

    if (LOCAL_RESUME_SECTION_TITLE_REGEX.test(line)) {
      const normalized = line.toUpperCase()
      if (/^PROFESSIONAL SUMMARY|^SUMMARY$/.test(normalized)) currentKey = 'summary'
      else if (/^SKILLS|^TECHNICAL SKILLS$/.test(normalized)) currentKey = 'skills'
      else if (/^WORK EXPERIENCE|^EXPERIENCE|^EMPLOYMENT$/.test(normalized)) currentKey = 'workExperience'
      else if (/^PERSONAL AI PROJECT|^PERSONAL PROJECT/.test(normalized)) currentKey = 'personalProjects'
      else if (/^EDUCATION$/.test(normalized)) currentKey = 'education'
      else if (/^CERTIFICATIONS?$/.test(normalized)) currentKey = 'certifications'
      else currentKey = null

      if (currentKey && !buffers.has(currentKey)) {
        buffers.set(currentKey, [])
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
