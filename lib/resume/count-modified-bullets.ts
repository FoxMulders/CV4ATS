import type { TailoredResume } from '@/lib/ai/schemas'
import {
  lockResumeState,
  type FrozenExperienceBlock,
} from '@/lib/resume/strict-resume-state'

function countBlockBulletDiffs(
  originalBlocks: FrozenExperienceBlock[],
  tailoredBlocks: FrozenExperienceBlock[]
): number {
  let count = 0
  const tailoredByKey = new Map(tailoredBlocks.map((block) => [block.blockKey, block]))

  originalBlocks.forEach((originalBlock, index) => {
    const tailoredBlock =
      tailoredByKey.get(originalBlock.blockKey) ?? tailoredBlocks[index]
    if (!tailoredBlock) return

    const pairCount = Math.max(originalBlock.bullets.length, tailoredBlock.bullets.length)
    for (let bulletIndex = 0; bulletIndex < pairCount; bulletIndex += 1) {
      const originalText = (originalBlock.bullets[bulletIndex] ?? '').trim()
      const tailoredText = (tailoredBlock.bullets[bulletIndex] ?? '').trim()
      if (originalText !== tailoredText) {
        count += 1
      }
    }
  })

  return count
}

/** Count experience/project bullets whose trimmed text differs between two resume snapshots. */
export function countModifiedResumeBullets(
  originalResume: TailoredResume,
  tailoredResume: TailoredResume
): number {
  const original = lockResumeState(originalResume)
  const tailored = lockResumeState(tailoredResume)

  return (
    countBlockBulletDiffs(original.workExperience, tailored.workExperience) +
    countBlockBulletDiffs(original.projects, tailored.projects)
  )
}
