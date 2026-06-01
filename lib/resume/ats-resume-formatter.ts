import type { Experience, TailoredResume } from '@/lib/ai/schemas'

/** Common PDF/DOCX paste artifacts where compound adjectives lose hyphens or spaces. */
const MERGED_WORD_FIXES: ReadonlyArray<[RegExp, string]> = [
  [/\bendtoend\b/gi, 'end-to-end'],
  [/\bend[- ]?to[- ]?end\b/gi, 'end-to-end'],
  [/\bcrossfunctional\b/gi, 'cross-functional'],
  [/\bcross[- ]?functional\b/gi, 'cross-functional'],
  [/\bhighquality\b/gi, 'high-quality'],
  [/\bhigh[- ]?quality\b/gi, 'high-quality'],
  [/\bfullstack\b/gi, 'full-stack'],
  [/\bfull[- ]?stack\b/gi, 'full-stack'],
  [/\bhandson\b/gi, 'hands-on'],
  [/\bhands[- ]?on\b/gi, 'hands-on'],
  [/\bbestinclass\b/gi, 'best-in-class'],
  [/\bbest[- ]?in[- ]?class\b/gi, 'best-in-class'],
  [/\bdatadriven\b/gi, 'data-driven'],
  [/\bdata[- ]?driven\b/gi, 'data-driven'],
  [/\bresultsoriented\b/gi, 'results-oriented'],
  [/\bresults[- ]?oriented\b/gi, 'results-oriented'],
  [/\bdetailoriented\b/gi, 'detail-oriented'],
  [/\bdetail[- ]?oriented\b/gi, 'detail-oriented'],
  [/\bselfstarter\b/gi, 'self-starter'],
  [/\bself[- ]?starter\b/gi, 'self-starter'],
  [/\bmultidisciplinary\b/gi, 'multi-disciplinary'],
  [/\bmulti[- ]?disciplinary\b/gi, 'multi-disciplinary'],
  [/\bworldclass\b/gi, 'world-class'],
  [/\bworld[- ]?class\b/gi, 'world-class'],
  [/\bstateoftheart\b/gi, 'state-of-the-art'],
  [/\bstate[- ]?of[- ]?the[- ]?art\b/gi, 'state-of-the-art'],
  [/\bprojectmanagement\b/gi, 'project management'],
  [/\bprogrammanagement\b/gi, 'program management'],
  [/\bstakeholdermanagement\b/gi, 'stakeholder management'],
  [/\briskmanagement\b/gi, 'risk management'],
  [/\bchangemanagement\b/gi, 'change management'],
  [/\bworkflowautomation\b/gi, 'workflow automation'],
  [/\bsoftwaredevelopment\b/gi, 'software development'],
  [/\bqualityassurance\b/gi, 'quality assurance'],
]

const PRESENT_ROLE_PATTERN = /\b(present|current|ongoing|now)\b/i

const PAST_TENSE_VERBS: Readonly<Record<string, string>> = {
  lead: 'Led',
  manage: 'Managed',
  deliver: 'Delivered',
  develop: 'Developed',
  implement: 'Implemented',
  architect: 'Architected',
  optimize: 'Optimized',
  standardize: 'Standardized',
  coordinate: 'Coordinated',
  drive: 'Drove',
  build: 'Built',
  create: 'Created',
  design: 'Designed',
  establish: 'Established',
  improve: 'Improved',
  increase: 'Increased',
  reduce: 'Reduced',
  streamline: 'Streamlined',
  automate: 'Automated',
  oversee: 'Oversaw',
  mentor: 'Mentored',
  coach: 'Coached',
  facilitate: 'Facilitated',
  execute: 'Executed',
  launch: 'Launched',
  scale: 'Scaled',
  transform: 'Transformed',
}

const PRESENT_TENSE_VERBS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PAST_TENSE_VERBS).map(([present, past]) => [past.toLowerCase(), capitalize(present)])
)

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSpecialCharacters(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[•◦▪▫●○◆◇■□]/g, ' ')
    .replace(/\t/g, ' ')
}

function fixMergedWords(text: string): string {
  let result = text
  for (const [pattern, replacement] of MERGED_WORD_FIXES) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function fixBulletSpacing(text: string): string {
  return text
    .replace(/([A-Za-z])•([A-Za-z])/g, '$1 • $2')
    .replace(/([A-Za-z]),([A-Za-z])/g, '$1, $2')
    .replace(/\s•\s*/g, ' • ')
    .replace(/^\s*[•\-*–—]\s*/g, '')
}

export function formatResumeText(text: string): string {
  if (!text) return text

  let result = normalizeSpecialCharacters(text)
  result = fixMergedWords(result)
  result = fixBulletSpacing(result)
  result = normalizeWhitespace(result)
  return result
}

function isPresentRole(endDate: string): boolean {
  return PRESENT_ROLE_PATTERN.test(endDate.trim())
}

function standardizeBulletTense(bullet: string, presentRole: boolean): string {
  const cleaned = formatResumeText(bullet)
  const match = cleaned.match(/^([A-Za-z]+)(\b.*)$/)
  if (!match) return cleaned

  const [, verb, rest] = match
  const lowerVerb = verb!.toLowerCase()

  if (presentRole) {
    const presentForm = PRESENT_TENSE_VERBS[lowerVerb]
    if (presentForm) return `${presentForm}${rest}`
    return cleaned
  }

  const pastForm = PAST_TENSE_VERBS[lowerVerb]
  if (pastForm) return `${pastForm}${rest}`

  return cleaned
}

function formatSkills(skills: string[]): string[] {
  const expanded = skills.flatMap((skill) => {
    const cleaned = formatResumeText(skill)
    if (!cleaned || /^[•\-*–—]+$/.test(cleaned)) return []

    return cleaned
      .split(/\s*[•|;,]\s*/)
      .map((part) => formatResumeText(part))
      .filter((part) => part.length > 1)
  })

  const seen = new Set<string>()
  const result: string[] = []

  for (const skill of expanded) {
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(skill)
  }

  return result
}

function formatExperienceEntry(entry: Experience): Experience {
  const presentRole = isPresentRole(entry.endDate)

  return {
    ...entry,
    title: formatResumeText(entry.title),
    company: formatResumeText(entry.company),
    location: formatResumeText(entry.location),
    startDate: formatResumeText(entry.startDate),
    endDate: formatResumeText(entry.endDate),
    bullets: entry.bullets
      .map((bullet) => standardizeBulletTense(bullet, presentRole))
      .filter((bullet) => bullet.length > 0),
  }
}

function formatEarlyCareerSummary(summary: string): string {
  const normalized = formatResumeText(summary)
  const priorMatch = normalized.match(/prior to (\d{4})/i)
  if (!priorMatch) return normalized

  return normalized.replace(
    /\s*—\s*/g,
    ' — '
  )
}

/** Normalize structured resume content for ATS parsing and human readability. */
export function formatTailoredResume(resume: TailoredResume): TailoredResume {
  const formattedSkills = formatSkills(resume.skills)
  const formattedExperience = resume.experience.map(formatExperienceEntry)

  return {
    contact: {
      name: formatResumeText(resume.contact.name),
      email: normalizeWhitespace(resume.contact.email),
      phone: normalizeWhitespace(resume.contact.phone),
      location: formatResumeText(resume.contact.location),
      linkedin: normalizeWhitespace(resume.contact.linkedin),
    },
    summary: formatEarlyCareerSummary(resume.summary),
    skills: formattedSkills.length > 0 ? formattedSkills : resume.skills.map(formatResumeText),
    experience: formattedExperience,
    projects: (resume.projects ?? []).map(formatExperienceEntry),
    education: resume.education.map((entry) => ({
      degree: formatResumeText(entry.degree),
      school: formatResumeText(entry.school),
      graduationDate: formatResumeText(entry.graduationDate),
      details: formatResumeText(entry.details),
    })),
    certifications: (resume.certifications ?? []).map(formatResumeText).filter(Boolean),
  }
}

/** ATS-friendly plain-text layout with standard section headers. */
export function serializeFormattedResume(resume: TailoredResume): string {
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

  lines.push('PROFESSIONAL SUMMARY')
  lines.push(formatted.summary)
  lines.push('')

  lines.push('SKILLS')
  lines.push(formatted.skills.join(' • '))
  lines.push('')

  lines.push('WORK EXPERIENCE')
  for (const job of formatted.experience) {
    const header = [job.title, job.company].filter(Boolean).join(' — ')
    const locationPart = job.location ? ` | ${job.location}` : ''
    lines.push(`${header}${locationPart}`)
    if (job.startDate || job.endDate) {
      lines.push(`${job.startDate} – ${job.endDate}`.trim())
    }
    for (const bullet of job.bullets) {
      lines.push(`• ${bullet}`)
    }
    lines.push('')
  }

  if (formatted.education.length > 0) {
    lines.push('EDUCATION')
    for (const edu of formatted.education) {
      const eduLine = [edu.degree, edu.school].filter(Boolean).join(', ')
      const datePart = edu.graduationDate ? ` — ${edu.graduationDate}` : ''
      lines.push(`${eduLine}${datePart}`)
      if (edu.details) lines.push(edu.details)
    }
    lines.push('')
  }

  if (formatted.certifications.length > 0) {
    lines.push('CERTIFICATIONS')
    for (const cert of formatted.certifications) {
      lines.push(`• ${cert}`)
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
