import type { AiGenerationResult } from '@/lib/ai/schemas'
import { generationOutputHasHygieneIssues, isStructurallyIncomplete } from '@/lib/ai/generation-hygiene'

/** Build a debug log line summarizing received generation payload quality. */
export function describeGenerationReceiveLog(result: AiGenerationResult): string[] {
  const lines: string[] = []
  const coverLength = result.coverLetter?.length ?? 0
  const bulletCount = (result.tailoredResume.experience ?? []).reduce(
    (sum, entry) => sum + (entry.bullets?.length ?? 0),
    0
  )

  lines.push(
    `[RECEIVE] Generation payload received — cover letter ${coverLength} chars, ${bulletCount} experience bullets across ${result.tailoredResume.experience?.length ?? 0} roles`
  )
  lines.push('[RECEIVE] Checking string endings for proper completion…')

  const hygieneIssues = generationOutputHasHygieneIssues(result)
  if (hygieneIssues.length > 0) {
    lines.push(`[RECEIVE] Hygiene warnings: ${hygieneIssues.join('; ')}`)
  } else {
    lines.push('[RECEIVE] No truncated bullets or mid-sentence cover letter endings detected')
  }

  if (result.coverLetter && isStructurallyIncomplete(result.coverLetter)) {
    lines.push('[RECEIVE] Cover letter may end mid-sentence — review last paragraph')
  }

  for (const entry of result.tailoredResume.experience ?? []) {
    for (const [index, bullet] of (entry.bullets ?? []).entries()) {
      if (isStructurallyIncomplete(bullet)) {
        lines.push(
          `[RECEIVE] Incomplete bullet detected under ${entry.company || entry.title} (#${index + 1})`
        )
      }
    }
  }

  return lines
}

/** Approximate token count from character length for debug logs. */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}
