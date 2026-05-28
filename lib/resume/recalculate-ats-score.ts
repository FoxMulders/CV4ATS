import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { scoreAtsCompliance, serializeTailoredResume } from '@/lib/resume/ats-score'

export interface RecalculateAtsScoreInput {
  resume: TailoredResume
  jobDescription: string
  sourceResumeText?: string
  baselineScore?: number
  phase?: 'baseline' | 'tailored'
}

/**
 * Re-run the weighted ATS matching pass against the static job description.
 * Uses section weights, density caps, and phrasing penalties from weighted-ats-scoring.
 */
export function recalculateAtsScore(input: RecalculateAtsScoreInput): KeywordReport {
  const resumeText = serializeTailoredResume(input.resume)
  const jobDescription = input.jobDescription.trim()

  if (!resumeText.trim() || !jobDescription) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ['Add resume content and a job description to calculate ATS alignment.'],
    }
  }

  return scoreAtsCompliance(resumeText, jobDescription, {
    phase: input.phase ?? 'tailored',
    sourceResumeText: input.sourceResumeText?.trim() || undefined,
    baselineScore: input.baselineScore,
  })
}

export function recalculateAtsScoreFromText(
  resumeText: string,
  jobDescription: string,
  options: Omit<RecalculateAtsScoreInput, 'resume' | 'jobDescription'> = {}
): KeywordReport {
  const trimmedResume = resumeText.trim()
  const trimmedJob = jobDescription.trim()

  if (!trimmedResume || !trimmedJob) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ['Add resume content and a job description to calculate ATS alignment.'],
    }
  }

  return scoreAtsCompliance(trimmedResume, trimmedJob, {
    phase: options.phase ?? 'tailored',
    sourceResumeText: options.sourceResumeText?.trim() || undefined,
    baselineScore: options.baselineScore,
  })
}
