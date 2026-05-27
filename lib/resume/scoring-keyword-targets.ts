import { filterCompetencyKeywords } from '@/lib/resume/non-competency-metadata-filter'
import { extractHighValueKeywords } from '@/lib/resume/keyword-extraction'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { filterAuditedKeywordTerms } from '@/lib/resume/keyword-audit'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

/** Keywords the ATS scorer evaluates — single source of truth for injection targets. */
export function getScoringKeywordTargets(jobDescription: string, resumeText = ''): string[] {
  return filterCompetencyKeywords(
    filterAuditedKeywordTerms(
      sanitizeKeywordList(extractHighValueKeywords(jobDescription), resumeText),
      resumeText
    )
  )
}

export function getMissingScoringKeywords(
  resumeText: string,
  jobDescription: string
): string[] {
  return getScoringKeywordTargets(jobDescription, resumeText).filter(
    (term) => !keywordMatchesResume(resumeText, term)
  )
}
