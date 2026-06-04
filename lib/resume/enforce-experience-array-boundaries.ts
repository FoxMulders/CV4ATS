import type { Experience } from '@/lib/ai/schemas'
import { verifyExperienceMatrixIntegrity } from '@/lib/resume/experience-matrix-guard'
import {
  explodeFlattenedExperienceEntries,
  isRealExperienceBullet,
} from '@/lib/resume/parse-experience-blocks'
import { isGhostConsolidatedEmployer } from '@/lib/resume/role-boundary-parser'
import {
  lockResumeState,
  mergeBulletsOntoOriginalExperience,
  strictStateToTailoredResume,
} from '@/lib/resume/strict-resume-state'

function hasUsableBullets(entry: Experience): boolean {
  return entry.bullets.some(isRealExperienceBullet)
}

function stripGhostRoles(entries: Experience[]): Experience[] {
  const real = entries.filter(
    (entry) =>
      hasUsableBullets(entry) &&
      entry.company.trim().length > 0 &&
      !isGhostConsolidatedEmployer(entry.company, entry.title)
  )
  return real.length > 0 ? real : entries.filter(hasUsableBullets)
}

/**
 * Preserve source timeline object boundaries while applying tailored bullet text.
 * A company or date-range change always maps to a distinct experience[] item.
 */
export function enforceExperienceArrayBoundaries(
  candidateWork: Experience[],
  candidateProjects: Experience[],
  sourceResumeText: string
): { experience: Experience[]; projects: Experience[] } {
  const source = sourceResumeText.trim()
  const explodedWork = explodeFlattenedExperienceEntries(candidateWork)
  const explodedProjects = explodeFlattenedExperienceEntries(candidateProjects)

  if (!source) {
    return {
      experience: stripGhostRoles(explodedWork),
      projects: stripGhostRoles(explodedProjects),
    }
  }

  const lockedResume = strictStateToTailoredResume(lockResumeState(source))
  const matrix = verifyExperienceMatrixIntegrity(
    lockedResume.experience,
    lockedResume.projects ?? [],
    explodedWork,
    explodedProjects
  )

  const baselineWork =
    matrix.experience.length > 0 ? matrix.experience : lockedResume.experience
  const baselineProjects =
    matrix.projects.length > 0 ? matrix.projects : lockedResume.projects ?? []

  const experience = stripGhostRoles(
    mergeBulletsOntoOriginalExperience(baselineWork, explodedWork).filter(hasUsableBullets)
  )
  const projects = stripGhostRoles(
    mergeBulletsOntoOriginalExperience(baselineProjects, explodedProjects).filter(hasUsableBullets)
  )

  return {
    experience:
      experience.length > 0
        ? experience
        : stripGhostRoles(baselineWork.filter(hasUsableBullets)),
    projects:
      projects.length > 0
        ? projects
        : stripGhostRoles(baselineProjects.filter(hasUsableBullets)),
  }
}
