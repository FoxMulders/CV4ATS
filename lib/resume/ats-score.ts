import type { KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import { sanitizeKeywordReport } from '@/lib/api/generation-config'
import { serializeFormattedResume } from '@/lib/resume/ats-resume-formatter'
import { filterRelevantKeywords } from '@/lib/resume/keyword-filter'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'
import { computeWeightedMatchScore, type WeightedScoringOptions } from '@/lib/resume/weighted-ats-scoring'

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

  if (score >= 76) {
    suggestions.push(
      'Strong weighted ATS alignment — prioritize experience bullets over skills-list repetition to improve further.'
    )
  } else {
    suggestions.push(
      'Embed missing competencies in work experience bullets (full weight) rather than repeating them in the skills list.'
    )
  }

  if (score >= 84) {
    suggestions.push('Scores above 88% are reserved for near-identical profile matches — keep phrasing natural.')
  }

  return suggestions.slice(0, 5)
}

export function serializeTailoredResume(resume: TailoredResume): string {
  return serializeFormattedResume(resume)
}

export function scoreAtsCompliance(
  resumeText: string,
  jobDescription: string,
  options: WeightedScoringOptions = {}
): KeywordReport {
  const weighted = computeWeightedMatchScore(resumeText, jobDescription, undefined, options)

  return sanitizeKeywordReport({
    matchScore: weighted.matchScore,
    matchedKeywords: sanitizeKeywordList(weighted.matchedKeywords),
    missingKeywords: sanitizeKeywordList(weighted.missingKeywords),
    suggestions: formatSuggestions(weighted.missingKeywords, weighted.matchScore),
  })
}

export function buildAtsComparison(
  beforeText: string,
  afterText: string,
  jobDescription: string,
  aiSuggestions?: string[]
): { baselineKeywordReport: KeywordReport; keywordReport: KeywordReport; improvement: number } {
  const baselineKeywordReport = scoreAtsCompliance(beforeText, jobDescription, {
    phase: 'baseline',
  })
  const afterReport = scoreAtsCompliance(afterText, jobDescription, { phase: 'tailored' })

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
