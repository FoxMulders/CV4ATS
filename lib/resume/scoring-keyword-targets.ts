import { extractHighValueKeywords } from '@/lib/resume/keyword-extraction'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

/** Keywords the ATS scorer evaluates — single source of truth for injection targets. */
export function getScoringKeywordTargets(jobDescription: string): string[] {
  return sanitizeKeywordList(extractHighValueKeywords(jobDescription))
}

export function getMissingScoringKeywords(
  resumeText: string,
  jobDescription: string
): string[] {
  return getScoringKeywordTargets(jobDescription).filter(
    (term) => !keywordMatchesResume(resumeText, term)
  )
}
