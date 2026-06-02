import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  extractBulletsFromSource,
} from '@/lib/resume/contact-extraction'
import {
  resolveCandidateNameFromSource,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'
import { recoverEducationFromSource } from '@/lib/resume/education-preservation'
import { mergeExperienceArraysNonDestructive } from '@/lib/resume/experience-preservation'
import {
  isRealExperienceBullet,
  parseWorkAndProjectsFromLines,
} from '@/lib/resume/parse-experience-blocks'
import { mergeSourceExperienceDates, ensureExperienceDatesForApi } from '@/lib/ai/generation-hygiene'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'

function normalizeExperience(entry: Experience): Experience {
  return {
    title: entry.title.trim() || 'Consultant',
    company: entry.company.trim() || 'Independent',
    location: entry.location ?? '',
    startDate: entry.startDate.trim() || '2010',
    endDate: entry.endDate.trim() || 'Present',
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(isRealExperienceBullet),
  }
}

function mergeExperienceDatesFromSources(
  target: Experience[],
  ...sources: Experience[][]
): Experience[] {
  const flat = sources.flat().filter((entry) => entry.startDate.trim())

  return target.map((entry, index) => {
    const companyMatch = flat.find((source) => {
      const targetKey = entry.company.toLowerCase().replace(/[^a-z0-9]+/g, '')
      const sourceKey = source.company.toLowerCase().replace(/[^a-z0-9]+/g, '')
      return (
        targetKey &&
        sourceKey &&
        (targetKey === sourceKey || targetKey.includes(sourceKey) || sourceKey.includes(targetKey))
      )
    })

    const byIndex = flat[index]

    return normalizeExperience({
      ...entry,
      startDate: entry.startDate.trim() || companyMatch?.startDate || byIndex?.startDate || '',
      endDate: entry.endDate.trim() || companyMatch?.endDate || byIndex?.endDate || 'Present',
    })
  })
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
  if (!sourceResumeText.trim()) return { experience, projects }

  const lines = sourceResumeText.replace(/\r\n/g, '\n').split('\n')
  const reparsedBlocks = parseWorkAndProjectsFromLines(lines)
  const reparsedFromParser = parseResumeTextToTailoredResume(sourceResumeText)

  const mergedExperience = mergeExperienceArraysNonDestructive(
    experience,
    reparsedBlocks.experience,
    reparsedFromParser.experience
  )

  const mergedProjects = mergeExperienceArraysNonDestructive(
    projects,
    reparsedBlocks.projects,
    reparsedFromParser.projects ?? []
  )

  if (mergedExperience.some((entry) => entry.bullets.length > 0)) {
    return {
      experience: mergedExperience
        .map(normalizeExperience)
        .filter((entry) => entry.bullets.length > 0),
      projects: mergedProjects.map(normalizeExperience).filter((entry) => entry.bullets.length > 0),
    }
  }

  const bullets = extractBulletsFromSource(sourceResumeText)
  if (bullets.length === 0) {
    return {
      experience: experience.map(normalizeExperience),
      projects: projects.map(normalizeExperience),
    }
  }

  return {
    experience: [
      normalizeExperience({
        title: 'Consultant',
        company: 'Independent',
        location: '',
        startDate: 'Recent',
        endDate: 'Present',
        bullets,
      }),
    ],
    projects: mergedProjects.map(normalizeExperience).filter((entry) => entry.bullets.length > 0),
  }
}

function fixContactName(resume: TailoredResume, sourceResumeText?: string): TailoredResume['contact'] {
  const name = sanitizeCandidateName(resume.contact.name, sourceResumeText)

  return {
    ...resume.contact,
    name: name === 'Professional Candidate' && sourceResumeText
      ? resolveCandidateNameFromSource(sourceResumeText, resume.contact.email)
      : name,
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
