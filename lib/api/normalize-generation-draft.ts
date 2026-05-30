import type { AiGenerationResult } from '@/lib/ai/schemas'
import { ensureApiSafeGenerationResult } from '@/lib/api/ensure-api-safe-draft'
import { applyStructuralPreservation } from '@/lib/ai/preserve-and-enrich'

/** Ensures browser/local/server drafts preserve the locked source timeline before review. */
export function normalizeGenerationDraftForApi(
  draft: AiGenerationResult,
  sourceResumeText?: string
): AiGenerationResult {
  if (!sourceResumeText?.trim()) {
    return {
      ...draft,
      coverLetter: draft.coverLetter.trim() || 'Cover letter pending.',
    }
  }

  return ensureApiSafeGenerationResult(
    applyStructuralPreservation(sourceResumeText, draft, {
      jobDescription: undefined,
      missingKeywords: draft.keywordReport?.missingKeywords,
    }),
    sourceResumeText
  )
}
