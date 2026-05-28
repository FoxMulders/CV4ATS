const BULLET_PREFIX = /^[\s•\-*–—]+/

function stripBulletPrefix(line: string): string {
  return line.trim().replace(BULLET_PREFIX, '').trim()
}

function restoreBulletPrefix(originalLine: string, content: string): string {
  const prefix = originalLine.trim().match(BULLET_PREFIX)?.[0] ?? '• '
  return `${prefix}${content.trim()}`
}

export interface AnchoredSkillModification {
  snippet: string
  originalBullet?: string
  bulletLineIndex?: number
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}

export interface AnchoredSkillSelection extends AnchoredSkillModification {
  keyword: string
  placementLabel?: string
  targetRoleTitle?: string
  targetCompany?: string
  domainLabel?: string
}

/**
 * Apply user-approved anchored skill modifications back into raw resume text.
 */
export function applyAnchoredSkillModifications(
  resumeText: string,
  modifications: AnchoredSkillModification[]
): string {
  if (modifications.length === 0) return resumeText

  const lines = resumeText.replace(/\r\n/g, '\n').split('\n')

  for (const modification of modifications) {
    const nextText = modification.snippet.trim()
    if (!nextText) continue

    if (
      modification.modificationType === 'inline-bullet' &&
      modification.bulletLineIndex !== undefined &&
      modification.bulletLineIndex >= 0
    ) {
      const currentLine = lines[modification.bulletLineIndex]
      if (currentLine) {
        lines[modification.bulletLineIndex] = restoreBulletPrefix(currentLine, nextText)
        continue
      }
    }

    if (modification.originalBullet?.trim()) {
      const target = modification.originalBullet.trim()
      const lineIndex = lines.findIndex((line) => stripBulletPrefix(line) === target)
      if (lineIndex >= 0) {
        lines[lineIndex] = restoreBulletPrefix(lines[lineIndex]!, nextText)
        continue
      }
    }

    if (modification.modificationType === 'summary') {
      const summaryStart = lines.findIndex((line) =>
        /^(professional summary|summary|profile)$/i.test(line.trim())
      )
      if (summaryStart >= 0) {
        let summaryEnd = summaryStart + 1
        while (summaryEnd < lines.length && lines[summaryEnd]?.trim() && !/^[\s•\-*]/.test(lines[summaryEnd]!.trim()) && !/^(skills|work experience|experience|education)/i.test(lines[summaryEnd]!.trim())) {
          summaryEnd += 1
        }
        if (summaryEnd === summaryStart + 1) {
          lines.splice(summaryStart + 1, 0, nextText)
        } else {
          lines[summaryStart + 1] = nextText
        }
        continue
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function selectionsToAnchoredModifications(
  selections: AnchoredSkillSelection[]
): AnchoredSkillModification[] {
  return selections.map((selection) => ({
    snippet: selection.snippet,
    originalBullet: selection.originalBullet,
    bulletLineIndex: selection.bulletLineIndex,
    modificationType: selection.modificationType,
  }))
}
