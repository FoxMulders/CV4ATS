import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  resolveCandidateNameFromSource,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'
import { recoverEducationFromSource } from '@/lib/resume/education-preservation'
import { enforceExperienceArrayBoundaries } from '@/lib/resume/enforce-experience-array-boundaries'
import {
  explodeFlattenedExperienceEntries,
  isRealExperienceBullet,
} from '@/lib/resume/parse-experience-blocks'
import { mergeSourceExperienceDates, ensureExperienceDatesForApi } from '@/lib/ai/generation-hygiene'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'

function normalizeExperience(entry: Experience): Experience {
  return {
    title: entry.title.trim() || 'Role',
    company: entry.company.trim(),
    location: entry.location ?? '',
    startDate: entry.startDate.trim(),
    endDate: entry.endDate.trim() || 'Present',
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(isRealExperienceBullet),
  }
}

function hasPlaceholderExperience(experience: Experience[]): boolean {
  return experience.some(
    (entry) =>
      /previous employer|confidential|see resume|employer not listed|independent/i.test(entry.company) &&
      entry.title === 'Professional Experience'
  )
}

function resolveExperienceFromSource(
  experience: Experience[],
  projects: Experience[],
  sourceResumeText: string
): { experience: Experience[]; projects: Experience[] } {
  const normalizedWork = experience.map(normalizeExperience).filter((entry) => entry.company.trim())
  const normalizedProjects = (projects ?? [])
    .map(normalizeExperience)
    .filter((entry) => entry.company.trim())

  if (sourceResumeText.trim()) {
    return enforceExperienceArrayBoundaries(normalizedWork, normalizedProjects, sourceResumeText)
  }

  return {
    experience: explodeFlattenedExperienceEntries(normalizedWork).filter(
      (entry) => entry.bullets.length > 0
    ),
    projects: explodeFlattenedExperienceEntries(normalizedProjects).filter(
      (entry) => entry.bullets.length > 0
    ),
  }
}

function fixContactName(resume: TailoredResume, sourceResumeText?: string): TailoredResume['contact'] {
  const sourceName = sourceResumeText?.trim()
    ? resolveCandidateNameFromSource(sourceResumeText, resume.contact.email)
    : null
  const sanitized = sanitizeCandidateName(resume.contact.name, sourceResumeText)
  const name =
    sourceName && sourceName !== 'Professional Candidate'
      ? sourceName
      : sanitized !== 'Professional Candidate'
        ? sanitized
        : sourceName ?? sanitized

  return {
    ...resume.contact,
    name,
    location: resume.contact.location.replace(/^[A-Z][A-Z\s.'-]+\s+(?=Edmonton|,)/i, '').trim(),
  }
}

function cleanSkills(skills: string[]): string[] {
  return dedupeSkills(
    skills.filter((skill) => {
      const lower = skill.toLowerCase()
      if (
        lower.split(/\s+/).length >= 3 &&
        /(?:program|project|engineering|technical)\s+manager|director|engineer$/i.test(lower)
      ) {
        return false
      }
      if (/^(internal tools|methodology|delivery|professional experience)$/i.test(skill.trim())) {
        return false
      }
      return skill.trim().length > 1
    })
  )
}

const DEFAULT_SUMMARY =
  'Technical program and delivery leader with experience coordinating cross-functional releases, stakeholder alignment, and operational workflow improvements.'

/** Ensures browser/local drafts satisfy strict API schemas before server review. */
export function normalizeGenerationDraftForApi(
  draft: AiGenerationResult,
  sourceResumeText?: string
): AiGenerationResult {
  let tailoredResume = draft.tailoredResume

  if (sourceResumeText?.trim()) {
    const reparsed = parseResumeTextToTailoredResume(sourceResumeText)
    const draftSummary = draft.tailoredResume.summary.trim()
    const reparsedSummary = reparsed.summary.trim()
    const useReparsedSummary =
      reparsedSummary.length >= 40 &&
      !reparsedSummary.includes('Analysis of') &&
      reparsedSummary !== DEFAULT_SUMMARY

    tailoredResume = {
      ...draft.tailoredResume,
      contact: reparsed.contact,
      skills: cleanSkills(
        [...new Set([...reparsed.skills, ...draft.tailoredResume.skills])]
      ),
      summary: useReparsedSummary ? reparsedSummary : draftSummary || reparsedSummary,
      education:
        reparsed.education.length > 0 ? reparsed.education : draft.tailoredResume.education,
      certifications:
        reparsed.certifications && reparsed.certifications.length > 0
          ? reparsed.certifications
          : draft.tailoredResume.certifications,
    }
  }

  const resolvedBlocks = resolveExperienceFromSource(
    tailoredResume.experience,
    tailoredResume.projects ?? [],
    sourceResumeText ?? ''
  )

  tailoredResume = {
    ...tailoredResume,
    contact: fixContactName(tailoredResume, sourceResumeText),
    skills: cleanSkills(tailoredResume.skills.map((s) => s.trim()).filter(Boolean)),
    experience:
      resolvedBlocks.experience.length > 0
        ? resolvedBlocks.experience
        : hasPlaceholderExperience(tailoredResume.experience)
          ? []
          : tailoredResume.experience.map(normalizeExperience).filter((entry) => entry.bullets.length > 0),
    projects: resolvedBlocks.projects,
    education: recoverEducationFromSource(tailoredResume.education, sourceResumeText),
    certifications: (tailoredResume.certifications ?? []).map((c) => c.trim()).filter(Boolean),
  }

  if (tailoredResume.experience.length === 0 && sourceResumeText?.trim()) {
    const fallback = resolveExperienceFromSource([], [], sourceResumeText)
    tailoredResume.experience = fallback.experience
    if ((tailoredResume.projects ?? []).length === 0) {
      tailoredResume.projects = fallback.projects
    }
  }

  if (sourceResumeText?.trim()) {
    tailoredResume = mergeSourceExperienceDates(tailoredResume, sourceResumeText)
    tailoredResume = ensureExperienceDatesForApi(tailoredResume, sourceResumeText)
  }

  if (tailoredResume.skills.length === 0) {
    tailoredResume.skills = ['Program Management', 'Release Management', 'Agile']
  }

  return {
    keywordReport: draft.keywordReport,
    tailoredResume,
    coverLetter: draft.coverLetter.trim() || 'Cover letter pending.',
  }
}
