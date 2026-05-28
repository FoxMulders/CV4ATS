import {
  applyStructuredSkillModifications,
  type StructuredSkillModification,
} from '@/lib/resume/structured-resume-document'

export interface AnchoredSkillModification extends StructuredSkillModification {}

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
