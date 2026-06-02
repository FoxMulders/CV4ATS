import type { Experience } from '@/lib/ai/schemas'
import { mergeExperienceArraysNonDestructive } from '@/lib/resume/experience-preservation'

function companyKey(company: string): string {
  return company.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export type ExperienceMatrixVerification = {
  experience: Experience[]
  projects: Experience[]
  droppedEmployers: string[]
  restoredCount: number
}

/**
 * Non-destructive chronology guard — never allows fewer distinct employers than the locked baseline.
 */
export function verifyExperienceMatrixIntegrity(
  baselineWork: Experience[],
  baselineProjects: Experience[],
  candidateWork: Experience[],
  candidateProjects: Experience[]
): ExperienceMatrixVerification {
  const mergedWork = mergeExperienceArraysNonDestructive(baselineWork, candidateWork)
  const mergedProjects = mergeExperienceArraysNonDestructive(baselineProjects, candidateProjects)

  const baselineKeys = new Set(
    [...baselineWork, ...baselineProjects]
      .map((entry) => companyKey(entry.company))
      .filter((key) => key.length > 1)
  )

  const mergedKeys = new Set(
    [...mergedWork, ...mergedProjects]
      .map((entry) => companyKey(entry.company))
      .filter((key) => key.length > 1)
  )

  const droppedEmployers = [...baselineKeys].filter((key) => !mergedKeys.has(key))

  return {
    experience: mergedWork,
    projects: mergedProjects,
    droppedEmployers,
    restoredCount: Math.max(0, mergedWork.length - candidateWork.length),
  }
}
