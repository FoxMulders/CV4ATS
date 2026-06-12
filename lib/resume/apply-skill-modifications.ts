import type { TailoredResume } from '@/lib/ai/schemas'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import {
  applyStructuredSkillModifications,
  parseStructuredResumeDocument,
  type StructuredSkillModification,
} from '@/lib/resume/structured-resume-document'

export type AnchoredSkillModification = StructuredSkillModification

export interface AnchoredSkillSelection extends AnchoredSkillModification {
  keyword: string
  placementLabel?: string
  placementBreadcrumb?: string
  targetRoleTitle?: string
  targetCompany?: string
  domainLabel?: string
}

/**
 * Apply user-approved anchored skill modifications by mutating the targeted
 * experience block inside the structured resume document.
 */
export function applyAnchoredSkillModifications(
  resumeText: string,
  modifications: AnchoredSkillModification[]
): string {
  return applyStructuredSkillModifications(resumeText, modifications)
}

export function selectionsToAnchoredModifications(
  selections: AnchoredSkillSelection[]
): AnchoredSkillModification[] {
  return selections.map((selection) => ({
    snippet: selection.snippet,
    positionId: selection.positionId,
    bulletIndex: selection.bulletIndex,
    originalBullet: selection.originalBullet,
    bulletLineIndex: selection.bulletLineIndex,
    modificationType: selection.modificationType,
  }))
}

function cloneTailoredResume(resume: TailoredResume): TailoredResume {
  return structuredClone(resume)
}

function findExperienceIndex(resume: TailoredResume, positionId?: string): number {
  if (!positionId) return -1

  const document = parseStructuredResumeDocument(serializeTailoredResume(resume))
  const position = document.experience.find((entry) => entry.id === positionId)
  if (!position) return -1

  return resume.experience.findIndex(
    (entry) => entry.company === position.company && entry.title === position.title
  )
}

function appendUniqueSkill(skills: string[], snippet: string, keyword?: string): void {
  const candidates = [keyword?.trim(), snippet.trim()].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const exists = skills.some((skill) => skill.toLowerCase() === candidate.toLowerCase())
    if (!exists) {
      skills.push(candidate)
      return
    }
  }
}

/**
 * Apply anchored skill modifications directly to a structured TailoredResume object.
 */
export function applySkillModificationsToTailoredResume(
  resume: TailoredResume,
  modifications: AnchoredSkillModification[],
  options: { keywordsBySnippet?: Record<string, string> } = {}
): TailoredResume {
  if (modifications.length === 0) return resume

  const next = cloneTailoredResume(resume)

  for (const modification of modifications) {
    const snippet = modification.snippet.trim()
    if (!snippet) continue

    const keyword = options.keywordsBySnippet?.[snippet]

    if (modification.modificationType === 'skills-section') {
      appendUniqueSkill(next.skills, snippet, keyword)
      continue
    }

    if (modification.modificationType === 'summary') {
      next.summary = snippet
      continue
    }

    let applied = false
    const experienceIndex = findExperienceIndex(next, modification.positionId)

    if (experienceIndex >= 0 && modification.bulletIndex !== undefined) {
      const role = next.experience[experienceIndex]
      if (role && role.bullets[modification.bulletIndex] !== undefined) {
        role.bullets[modification.bulletIndex] = snippet
        applied = true
      }
    }

    if (!applied && modification.originalBullet?.trim()) {
      const target = modification.originalBullet.trim()
      for (const role of next.experience) {
        const bulletIndex = role.bullets.findIndex((bullet) => bullet.trim() === target)
        if (bulletIndex >= 0) {
          role.bullets[bulletIndex] = snippet
          applied = true
          break
        }
      }
    }

    if (!applied && experienceIndex >= 0) {
      const role = next.experience[experienceIndex]
      if (role) {
        role.bullets.push(snippet)
      }
    }
  }

  return next
}
