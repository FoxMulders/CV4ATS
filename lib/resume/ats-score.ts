import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { sanitizeKeywordReport } from '@/lib/api/generation-config'
import { extractHighValueKeywords } from '@/lib/resume/keyword-extraction'
import { filterRelevantKeywords } from '@/lib/resume/keyword-filter'
import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

function formatSuggestions(missingKeywords: string[], score: number): string[] {
  const suggestions: string[] = []

  if (score < 60) {
    suggestions.push(
      'Mirror high-priority job description terms in your summary and most recent role bullets.'
    )
  }

  if (missingKeywords.length > 0) {
    const relevantMissing = filterRelevantKeywords(missingKeywords)
    if (relevantMissing.length > 0) {
      suggestions.push(
        `Add truthful mentions of missing role-specific terms where your experience supports them: ${relevantMissing.slice(0, 5).join(', ')}.`
      )
    }
  }

  if (score >= 80) {
    suggestions.push('Strong ATS keyword alignment — keep phrasing natural and quantified.')
  } else {
    suggestions.push('Use standard section headings and plain text formatting for ATS parsing.')
  }

  return suggestions.slice(0, 5)
}

export function serializeTailoredResume(resume: TailoredResume): string {
  const parts = [
    resume.contact.name,
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.summary,
    resume.skills.join(' '),
    ...resume.experience.flatMap((entry) => [
      entry.title,
      entry.company,
      entry.location ?? '',
      ...entry.bullets,
    ]),
    ...resume.education.flatMap((entry) => [entry.degree, entry.school, entry.details ?? '']),
    ...(resume.certifications ?? []),
  ]

  return parts.filter(Boolean).join('\n')
}

export function scoreAtsCompliance(resumeText: string, jobDescription: string): KeywordReport {
  const terms = sanitizeKeywordList(extractHighValueKeywords(jobDescription))

  const matchedKeywords: string[] = []
  const missingKeywords: string[] = []

  for (const term of terms) {
    if (keywordMatchesResume(resumeText, term)) {
      matchedKeywords.push(term)
    } else {
      missingKeywords.push(term)
    }
  }

  const matchScore =
    terms.length === 0 ? 0 : Math.round((matchedKeywords.length / terms.length) * 100)

  return sanitizeKeywordReport({
    matchScore,
    matchedKeywords: sanitizeKeywordList(matchedKeywords),
    missingKeywords: sanitizeKeywordList(missingKeywords),
    suggestions: formatSuggestions(missingKeywords, matchScore),
  })
}

export function buildAtsComparison(
  beforeText: string,
  afterText: string,
  jobDescription: string,
  aiSuggestions?: string[]
): { baselineKeywordReport: KeywordReport; keywordReport: KeywordReport; improvement: number } {
  const baselineKeywordReport = scoreAtsCompliance(beforeText, jobDescription)
  const afterReport = scoreAtsCompliance(afterText, jobDescription)

  const keywordReport: KeywordReport = sanitizeKeywordReport({
    ...afterReport,
    suggestions:
      aiSuggestions && aiSuggestions.length > 0 ? aiSuggestions : afterReport.suggestions,
  })

  return {
    baselineKeywordReport,
    keywordReport,
    improvement: keywordReport.matchScore - baselineKeywordReport.matchScore,
  }
}
