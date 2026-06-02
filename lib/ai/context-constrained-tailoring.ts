import type { Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { sanitizeCandidateName } from '@/lib/resume/contact-identity'
import { verifyExperienceMatrixIntegrity } from '@/lib/resume/experience-matrix-guard'
import {
  lockResumeState,
  mergeBulletsOntoOriginalExperience,
  strictStateToTailoredResume,
  type StrictResumeState,
} from '@/lib/resume/strict-resume-state'

/** Context-Constrained Resume Tailoring Engine — cognitive boundaries for all LLM passes. */
export const CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE = `## Context-Constrained Resume Tailoring Engine (mandatory)

You are an editor optimizing an existing resume against a job description — not a fiction writer.

### CRITICAL COGNITIVE BOUNDARIES

1. **IDENTITY IMMUTABILITY**
   - Never alter the candidate's name, contact information, company names, job titles, employment dates, or education history.
   - If the source resume says "Brad Mulders" and "NAIT", the output MUST say "Brad Mulders" and "NAIT".
   - Never output placeholders such as "Candidate Name", "Your Name", or "Professional Candidate".
   - Never invent schools (e.g., Athabasca University) or degrees absent from the source.

2. **NO PLAGIARISM / VERBATIM JD COPYING**
   - Do not copy sentences, paragraphs, or "About the job" prose from the job description into the Professional Summary or bullets.
   - Rewrite accomplishments using the candidate's real experience to *reflect* required competencies — semantic alignment, not transcription.

3. **BULLET-LEVEL ENHANCEMENT ONLY**
   - Optimize wording of existing experience bullets to highlight relevant keywords (e.g., Agile/Kanban delivery metrics).
   - Keep every bullet rooted in what the candidate actually did at that specific company — never transplant achievements between employers.

4. **NO GHOST ROLES**
   - Never synthesize a generic "Independent Consultant", "Self-Employed", or catch-all employment block unless explicitly present in the source resume.

### Strict execution workflow
1. **Lock** the core profile — name, companies, titles, dates, degrees — as non-negotiable strings from the source (and LOCKED EXPERIENCE TIMELINE when provided).
2. **Read** the job description to identify target skills and competency tokens.
3. **Revise** summary and bullets only — align phrasing without changing historical facts or copying the JD verbatim.`

const NAME_PLACEHOLDER =
  /^(?:candidate name|your name|applicant name|professional candidate|name here|full name)$/i

const GHOST_ROLE_PATTERN =
  /\b(?:independent consultant|self[- ]?employed|freelance consultant|independent contractor)\b/i

function isGhostRoleEntry(entry: Experience): boolean {
  const company = entry.company.trim()
  const combined = `${entry.title} ${entry.company}`.trim()
  if (/^(independent|consultant|freelance)$/i.test(company)) return true
  return GHOST_ROLE_PATTERN.test(combined)
}

function sourceAllowsGhostRoles(state: StrictResumeState): boolean {
  return [...state.workExperience, ...state.projects].some((block) =>
    isGhostRoleEntry({
      title: block.title,
      company: block.company,
      location: block.location,
      startDate: block.startDate,
      endDate: block.endDate,
      bullets: block.bullets,
    })
  )
}

function stripGhostRoles(entries: Experience[], allowGhostRoles: boolean): Experience[] {
  if (allowGhostRoles) return entries
  return entries.filter((entry) => !isGhostRoleEntry(entry))
}

function institutionTokenAppearsInSource(token: string, sourceLower: string): boolean {
  const normalized = token.trim().toLowerCase()
  if (normalized.length < 4) return true
  if (sourceLower.includes(normalized)) return true

  const words = normalized.split(/\s+/).filter((word) => word.length > 3)
  return words.length > 0 && words.every((word) => sourceLower.includes(word))
}

function educationEntryIsGrounded(entry: Education, sourceLower: string): boolean {
  const school = entry.school.trim()
  const degree = entry.degree.trim()

  if (school && !/institution not listed/i.test(school) && !institutionTokenAppearsInSource(school, sourceLower)) {
    return false
  }

  const degreeInstitution = degree.match(
    /\b(?:at|from|,)\s+([A-Z][A-Za-z0-9&.'\- ]{3,60})$/i
  )?.[1]
  if (degreeInstitution && !institutionTokenAppearsInSource(degreeInstitution, sourceLower)) {
    return false
  }

  return true
}

function enforceEducationFromSource(
  resumeEducation: Education[],
  lockedEducation: Education[],
  sourceResumeText: string
): Education[] {
  const sourceLower = sourceResumeText.toLowerCase()

  if (lockedEducation.length === 0) {
    return resumeEducation.filter((entry) => educationEntryIsGrounded(entry, sourceLower))
  }

  const hasFabricatedEducation = resumeEducation.some(
    (entry) => !educationEntryIsGrounded(entry, sourceLower)
  )

  if (resumeEducation.length === 0 || hasFabricatedEducation) {
    return lockedEducation.map((entry) => ({
      degree: entry.degree.trim() || 'Degree',
      school: entry.school.trim() || 'Institution not listed',
      graduationDate: entry.graduationDate ?? '',
      details: entry.details ?? '',
    }))
  }

  return resumeEducation.map((entry, index) => {
    const locked = lockedEducation[index]
    if (!locked) return entry

    return {
      degree: locked.degree.trim() || entry.degree.trim(),
      school: locked.school.trim() || entry.school.trim() || 'Institution not listed',
      graduationDate: locked.graduationDate || entry.graduationDate || '',
      details: entry.details ?? locked.details ?? '',
    }
  })
}

function enforceLockedContact(
  resume: TailoredResume,
  locked: StrictResumeState,
  sourceResumeText: string
): TailoredResume['contact'] {
  const resolvedName = sanitizeCandidateName(locked.contact.name, sourceResumeText)
  const name =
    NAME_PLACEHOLDER.test(resume.contact.name.trim()) || !resume.contact.name.trim()
      ? resolvedName
      : sanitizeCandidateName(resume.contact.name, sourceResumeText)

  return {
    name: NAME_PLACEHOLDER.test(name) ? resolvedName : name,
    email: locked.contact.email || resume.contact.email || '',
    phone: locked.contact.phone || resume.contact.phone || '',
    location: locked.contact.location || resume.contact.location || '',
    linkedin: locked.contact.linkedin || resume.contact.linkedin || '',
  }
}

function enforceLockedCertifications(
  resumeCerts: string[],
  lockedCerts: string[],
  sourceLower: string
): string[] {
  if (lockedCerts.length > 0) return lockedCerts
  return resumeCerts.filter((cert) => {
    const trimmed = cert.trim()
    return trimmed.length > 0 && sourceLower.includes(trimmed.toLowerCase())
  })
}

/** Programmatic guardrail — restore immutable identity/timeline after LLM output. */
export function enforceContextConstrainedTailoring(
  resume: TailoredResume,
  sourceResumeText: string
): TailoredResume {
  const source = sourceResumeText.trim()
  if (!source) return resume

  const locked = lockResumeState(source)
  const lockedResume = strictStateToTailoredResume(locked)
  const allowGhostRoles = sourceAllowsGhostRoles(locked)
  const sourceLower = source.toLowerCase()

  const experience = stripGhostRoles(
    mergeBulletsOntoOriginalExperience(lockedResume.experience, resume.experience),
    allowGhostRoles
  )

  const projects = stripGhostRoles(
    mergeBulletsOntoOriginalExperience(lockedResume.projects ?? [], resume.projects ?? []),
    allowGhostRoles
  )

  const matrix = verifyExperienceMatrixIntegrity(
    lockedResume.experience,
    lockedResume.projects ?? [],
    experience,
    projects
  )

  return {
    ...resume,
    contact: enforceLockedContact(resume, locked, source),
    experience: matrix.experience.length > 0 ? matrix.experience : lockedResume.experience,
    projects: matrix.projects,
    education: enforceEducationFromSource(resume.education ?? [], locked.education, source),
    certifications: enforceLockedCertifications(
      resume.certifications ?? [],
      locked.certifications,
      sourceLower
    ),
  }
}
