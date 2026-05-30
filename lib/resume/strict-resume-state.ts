import type { Contact, Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  isRealExperienceBullet,
  looksLikeRogueExperienceBlock,
} from '@/lib/resume/parse-experience-blocks'

export type FrozenExperienceBlock = {
  blockKey: string
  kind: 'work' | 'project'
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  datesDisplay: string
  bullets: string[]
}

export type StrictResumeState = {
  contact: Contact
  summary: string
  skills: string[]
  workExperience: FrozenExperienceBlock[]
  projects: FrozenExperienceBlock[]
  education: Education[]
  certifications: string[]
}

export type ResumeDocument = {
  contactInfo: Contact
  summary: string
  skills: string[]
  workExperience: Experience[]
  education: Education[]
  projects: Experience[]
  certifications: string[]
}

function normalizeBlockKey(company: string, title: string, index: number): string {
  const base = `${company}::${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return base.length > 2 ? base : `block-${index}`
}

export function normalizeExperienceBlockKey(company: string, title: string, index: number): string {
  return normalizeBlockKey(company, title, index)
}

function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function formatDatesDisplay(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`
  return startDate || endDate || ''
}

function isProjectEntry(entry: Experience): boolean {
  return (
    /personal ai project|side project|freelance project|personal project/i.test(entry.title) ||
    /^tipsy fox/i.test(entry.company.trim())
  )
}

function toFrozenBlock(entry: Experience, index: number, kind: 'work' | 'project'): FrozenExperienceBlock {
  return {
    blockKey: normalizeBlockKey(entry.company, entry.title, index),
    kind,
    company: entry.company.trim(),
    title: entry.title.trim(),
    location: entry.location ?? '',
    startDate: entry.startDate.trim(),
    endDate: entry.endDate.trim() || 'Present',
    datesDisplay: formatDatesDisplay(entry.startDate.trim(), entry.endDate.trim() || 'Present'),
    bullets: [...entry.bullets],
  }
}

function blockToExperience(block: FrozenExperienceBlock): Experience {
  return {
    company: block.company,
    title: block.title,
    location: block.location,
    startDate: block.startDate || 'Recent',
    endDate: block.endDate || 'Present',
    bullets: block.bullets.length > 0 ? block.bullets : ['Delivered measurable outcomes in this role.'],
  }
}

function filterValidExperience(entries: Experience[]): Experience[] {
  return entries
    .filter((entry) => !looksLikeRogueExperienceBlock(entry))
    .filter((entry) => entry.bullets.some(isRealExperienceBullet) || entry.company.trim().length > 2)
}

function splitExperienceEntries(resume: TailoredResume): {
  workExperience: Experience[]
  projects: Experience[]
} {
  const explicitProjects = filterValidExperience(resume.projects ?? [])
  const explicitWork = filterValidExperience(resume.experience ?? [])

  if (explicitProjects.length > 0) {
    return {
      workExperience: explicitWork.filter((entry) => !isProjectEntry(entry)),
      projects: [
        ...explicitProjects,
        ...explicitWork.filter((entry) => isProjectEntry(entry)),
      ],
    }
  }

  return {
    workExperience: explicitWork.filter((entry) => !isProjectEntry(entry)),
    projects: explicitWork.filter((entry) => isProjectEntry(entry)),
  }
}

/** Freezes the full resume object — education, projects, dates, and employers cannot be dropped. */
export function lockResumeState(source: TailoredResume | string): StrictResumeState {
  const resume =
    typeof source === 'string' ? parseResumeTextToTailoredResume(source) : structuredClone(source)

  const { workExperience, projects } = splitExperienceEntries(resume)

  return {
    contact: { ...resume.contact },
    summary: resume.summary.trim(),
    skills: [...resume.skills],
    workExperience: workExperience.map((entry, index) => toFrozenBlock(entry, index, 'work')),
    projects: projects.map((entry, index) => toFrozenBlock(entry, index, 'project')),
    education: [...(resume.education ?? [])],
    certifications: [...(resume.certifications ?? [])],
  }
}

export function allFrozenBlocks(state: StrictResumeState): FrozenExperienceBlock[] {
  return [...state.workExperience, ...state.projects]
}

/** Payload sent to the LLM — skills and bullets only; no employers, dates, or education. */
export type AiEnrichmentInput = {
  skills: string[]
  experienceBullets: Array<{ blockKey: string; bullets: string[] }>
}

export function extractAiEnrichmentInput(state: StrictResumeState): AiEnrichmentInput {
  return {
    skills: [...state.skills],
    experienceBullets: allFrozenBlocks(state).map((block) => ({
      blockKey: block.blockKey,
      bullets: [...block.bullets],
    })),
  }
}

export function strictStateToTailoredResume(state: StrictResumeState): TailoredResume {
  return {
    contact: { ...state.contact },
    summary: state.summary,
    skills: [...state.skills],
    experience: state.workExperience.map(blockToExperience),
    projects: state.projects.map(blockToExperience),
    education: [...state.education],
    certifications: [...state.certifications],
  }
}

export function tailoredResumeToDocument(resume: TailoredResume): ResumeDocument {
  const state = lockResumeState(resume)
  return {
    contactInfo: state.contact,
    summary: state.summary,
    skills: state.skills,
    workExperience: state.workExperience.map(blockToExperience),
    education: state.education,
    projects: state.projects.map(blockToExperience),
    certifications: state.certifications,
  }
}

/** Prefer populated timeline sections from resumeDocument when tailoredResume arrays are empty. */
export function coalesceTailoredResumeFromGeneration(
  tailoredResume: TailoredResume,
  resumeDocument?: ResumeDocument
): TailoredResume {
  const experience =
    tailoredResume.experience?.length > 0
      ? tailoredResume.experience
      : (resumeDocument?.workExperience ?? [])

  const education =
    tailoredResume.education?.length > 0
      ? tailoredResume.education
      : (resumeDocument?.education ?? [])

  const projects =
    (tailoredResume.projects?.length ?? 0) > 0
      ? (tailoredResume.projects ?? [])
      : (resumeDocument?.projects ?? [])

  return {
    ...tailoredResume,
    experience,
    education,
    projects,
  }
}

export function serializeAiEnrichmentInputForPrompt(input: AiEnrichmentInput): string {
  return JSON.stringify(input, null, 2)
}

export function parseCurrentResumeJson(raw: unknown): TailoredResume | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const contact = (parsed.contactInfo ?? parsed.contact) as Contact | undefined
    if (!contact?.name) return null

    const workExperience = (parsed.workExperience ?? parsed.experience) as Experience[] | undefined
    if (!Array.isArray(workExperience) || workExperience.length === 0) return null

    return {
      contact,
      summary: String(parsed.summary ?? ''),
      skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
      experience: workExperience.map((entry) => ({
        title: String(entry.title ?? ''),
        company: String(entry.company ?? ''),
        location: String(entry.location ?? ''),
        startDate: String(entry.startDate ?? ''),
        endDate: String(entry.endDate ?? 'Present'),
        bullets: Array.isArray(entry.bullets)
          ? entry.bullets.map(String).filter(Boolean)
          : ['Delivered measurable outcomes in this role.'],
      })),
      projects: Array.isArray(parsed.projects)
        ? (parsed.projects as Experience[]).map((entry) => ({
            title: String(entry.title ?? ''),
            company: String(entry.company ?? ''),
            location: String(entry.location ?? ''),
            startDate: String(entry.startDate ?? ''),
            endDate: String(entry.endDate ?? 'Present'),
            bullets: Array.isArray(entry.bullets)
              ? entry.bullets.map(String).filter(Boolean)
              : ['Delivered measurable outcomes in this role.'],
          }))
        : [],
      education: Array.isArray(parsed.education)
        ? (parsed.education as Education[]).map((entry) => ({
            degree: String(entry.degree ?? ''),
            school: String(entry.school ?? ''),
            graduationDate: String(entry.graduationDate ?? ''),
            details: String(entry.details ?? ''),
          }))
        : [],
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.map(String)
        : [],
    }
  } catch {
    return null
  }
}

/** Maps AI bullets onto the original timeline — company, title, and dates are never overwritten. */
export function mergeBulletsOntoOriginalExperience(
  original: Experience[],
  aiEntries: Experience[] | undefined,
  aiBulletsByKey: Array<{ blockKey: string; bullets: string[] }> = []
): Experience[] {
  if (original.length === 0) {
    return aiEntries ?? []
  }

  const byBlockKey = new Map<string, string[]>()
  const byCompany = new Map<string, string[]>()
  const byIndex = new Map<number, string[]>()

  for (const { blockKey, bullets } of aiBulletsByKey) {
    if (blockKey && bullets.length > 0) {
      byBlockKey.set(blockKey, bullets)
    }
  }

  aiEntries?.forEach((entry, index) => {
    if (!entry.bullets?.length) return
    const blockKey = normalizeBlockKey(entry.company, entry.title, index)
    byBlockKey.set(blockKey, entry.bullets)
    byIndex.set(index, entry.bullets)
    const companyKey = normalizeCompanyKey(entry.company)
    if (companyKey) {
      byCompany.set(companyKey, entry.bullets)
    }
  })

  return original.map((entry, index) => {
    const blockKey = normalizeBlockKey(entry.company, entry.title, index)
    const companyKey = normalizeCompanyKey(entry.company)
    const aiBullets =
      byBlockKey.get(blockKey) ??
      (companyKey ? byCompany.get(companyKey) : undefined) ??
      byIndex.get(index)

    return {
      company: entry.company,
      title: entry.title,
      location: entry.location ?? '',
      startDate: entry.startDate || 'Recent',
      endDate: entry.endDate || 'Present',
      bullets:
        aiBullets?.length && aiBullets.some((bullet) => bullet.trim())
          ? aiBullets
          : entry.bullets.length > 0
            ? entry.bullets
            : ['Delivered measurable outcomes in this role.'],
    }
  })
}
