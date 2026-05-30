import type { AiGenerationResult } from '@/lib/ai/schemas'
import { applyStructuralPreservation } from '@/lib/ai/preserve-and-enrich'
import { scoreAtsCompliance, serializeTailoredResume } from '@/lib/resume/ats-score'
import { getMissingScoringKeywords } from '@/lib/resume/scoring-keyword-targets'
import { integrateScoringKeywordsUntilSaturation } from '@/lib/resume/scoring-keyword-integration'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'

/** Weaves missing ATS keywords into the draft before panel review or export. */
export function applyKeywordImprovementsToDraft(
  draft: AiGenerationResult,
  jobDescription: string,
  sourceResumeText: string,
  currentResume?: import('@/lib/ai/schemas').TailoredResume
): { aiResult: AiGenerationResult; injectedSkills: string[] } {
  const missing = getMissingScoringKeywords(
    serializeTailoredResume(draft.tailoredResume),
    jobDescription
  )

  const integration = integrateScoringKeywordsUntilSaturation(
    draft.tailoredResume,
    jobDescription,
    keywordsToTargetSkills([...(draft.keywordReport?.missingKeywords ?? []), ...missing])
  )

  let aiResult: AiGenerationResult = {
    ...draft,
    tailoredResume: integration.resume,
  }

  const serialized = serializeTailoredResume(aiResult.tailoredResume)
  aiResult = {
    ...aiResult,
    keywordReport: scoreAtsCompliance(serialized, jobDescription),
  }

  aiResult = applyStructuralPreservation(currentResume ?? sourceResumeText, aiResult, {
    jobDescription,
    missingKeywords: getMissingScoringKeywords(
      serializeTailoredResume(aiResult.tailoredResume),
      jobDescription
    ),
  })

  return { aiResult, injectedSkills: integration.injectedSkills }
}
