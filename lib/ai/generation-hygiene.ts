import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { extractCoverLetterFromModelOutput } from '@/lib/ai/sanitize-model-output'
import {
  bulletContainsUngroundedMetric,
  enforceAuthenticResumeOptimization,
  stripBannedAuthenticPhrases,
  stripFabricatedMetricClauses,
} from '@/lib/ai/authentic-resume-optimization'
import { enforceContextConstrainedTailoring } from '@/lib/ai/context-constrained-tailoring'
import { guardTailoredResumeExperience } from '@/lib/resume/experience-preservation'
import {
  isDateLine,
  looksLikeCompanyLine,
  looksLikeJobTitle,
  parseDateLine,
  parseExperienceFromLines,
} from '@/lib/resume/parse-experience-blocks'
import { finalizeDisplayText } from '@/lib/resume/prepare-resume-for-display'
import { lockResumeState, strictStateToTailoredResume } from '@/lib/resume/strict-resume-state'

const INCOMPLETE_TAIL =
  /\s+(?:,|;|:)?(?:and|or|with|including|such as|missing|per|to|for|the|a|an)\s*$/i

const PLACEHOLDER_START = /^(recent|n\/a|unknown|tbd)?$/i
const PLACEHOLDER_END = /^(present|current|ongoing|now|n\/a|unknown|tbd)?$/i

export function isPlaceholderStartDate(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || PLACEHOLDER_START.test(trimmed)
}

export function isPlaceholderEndDate(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || PLACEHOLDER_END.test(trimmed)
}

export function isPlaceholderDateRange(startDate: string, endDate: string): boolean {
  return isPlaceholderStartDate(startDate) && isPlaceholderEndDate(endDate)
}

/** Detect generic template stamps like "2010 – Present" when source has specific ranges. */
export function isBlanketTimelineStamp(startDate: string, endDate: string): boolean {
  const start = startDate.trim()
  const end = endDate.trim().toLowerCase()
  if (/^2010$/i.test(start) && (end === 'present' || end === 'current')) return true
  if (/^20(?:10|11|12)$/i.test(start) && !/\//.test(start) && (end === 'present' || end === 'current')) {
    return true
  }
  return false
}

/** True when text ends mid-thought (trailing conjunction, comma, or no closing punctuation on long prose). */
export function isStructurallyIncomplete(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (INCOMPLETE_TAIL.test(trimmed)) return true
  if (/,\s*$/.test(trimmed)) return true
  if (trimmed.length > 48 && /[a-z0-9]$/i.test(trimmed) && !/[.!?)"']$/.test(trimmed)) {
    return /\b(and|or|with|including|missing|per)$/i.test(trimmed)
  }
  return false
}

/** Trim dangling conjunctions and incomplete trailing clauses from generated prose. */
export function repairIncompleteText(text: string): string {
  let cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return cleaned

  while (INCOMPLETE_TAIL.test(cleaned)) {
    cleaned = cleaned.replace(INCOMPLETE_TAIL, '').trim()
  }

  cleaned = cleaned.replace(/,\s*$/, '').trim()

  if (
    cleaned.length > 24 &&
    /[a-z0-9]$/i.test(cleaned) &&
    !/[.!?)"']$/.test(cleaned) &&
    !/\b(and|or|with|including|missing|per)$/i.test(cleaned)
  ) {
    cleaned = `${cleaned}.`
  }

  return cleaned
}

function normalizeCompanyKey(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export type SourceExperienceTimeline = {
  company: string
  title: string
  startDate: string
  endDate: string
}

/** Extract employer timelines from raw resume text for date grounding. */
export function extractExperienceTimelineFromSource(sourceResumeText: string): SourceExperienceTimeline[] {
  const lines = sourceResumeText.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim())

  const parsed = parseExperienceFromLines(lines)
  if (parsed.length > 0) {
    return parsed
      .filter((entry) => entry.company.trim().length > 0)
      .map((entry) => ({
        company: entry.company.trim(),
        title: entry.title.trim(),
        startDate: entry.startDate.trim(),
        endDate: entry.endDate.trim() || 'Present',
      }))
      .filter((entry) => !isPlaceholderDateRange(entry.startDate, entry.endDate))
  }

  const fallback: SourceExperienceTimeline[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (!isDateLine(line)) continue

    const dates = parseDateLine(line)
    if (!dates || isPlaceholderDateRange(dates.startDate, dates.endDate)) continue

    const titleLine = lines[index - 1] ?? ''
    const companyLine = lines[index - 2] ?? ''
    const altCompanyLine = lines[index - 1] ?? ''

    let company = ''
    let title = ''

    if (looksLikeCompanyLine(companyLine) && looksLikeJobTitle(titleLine)) {
      company = companyLine
      title = titleLine
    } else if (looksLikeCompanyLine(altCompanyLine) && !looksLikeJobTitle(altCompanyLine)) {
      company = altCompanyLine
      title = looksLikeJobTitle(titleLine) ? titleLine : ''
    }

    if (!company) continue

    fallback.push({
      company,
      title,
      startDate: dates.startDate,
      endDate: dates.endDate,
    })
  }

  return fallback
}

function findTimelineMatch(
  entry: Experience,
  timeline: SourceExperienceTimeline[]
): SourceExperienceTimeline | undefined {
  const entryKey = normalizeCompanyKey(entry.company)
  const entryTitleKey = normalizeCompanyKey(entry.title)
  if (!entryKey && !entryTitleKey) return undefined

  const companyPrefix = entry.company.split(/\s[-–—|]\s/)[0]?.trim() ?? ''
  const prefixKey = normalizeCompanyKey(companyPrefix)

  return timeline.find((item) => {
    const itemKey = normalizeCompanyKey(item.company)
    const itemTitleKey = normalizeCompanyKey(item.title)

    if (
      entryKey &&
      itemKey &&
      (itemKey === entryKey || entryKey.includes(itemKey) || itemKey.includes(entryKey))
    ) {
      return true
    }

    if (prefixKey && itemKey && (prefixKey === itemKey || itemKey.includes(prefixKey))) {
      return true
    }

    if (
      entryTitleKey &&
      itemTitleKey &&
      (entryTitleKey.includes(itemTitleKey) || itemTitleKey.includes(entryTitleKey))
    ) {
      return true
    }

    return false
  })
}

function extractOrderedDatePairsFromSource(
  sourceResumeText: string
): Array<{ startDate: string; endDate: string }> {
  const pairs: Array<{ startDate: string; endDate: string }> = []

  for (const line of sourceResumeText.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!isDateLine(trimmed)) continue
    const dates = parseDateLine(trimmed)
    if (!dates || isPlaceholderDateRange(dates.startDate, dates.endDate)) continue
    pairs.push(dates)
  }

  return pairs
}

/** Guarantee every experience row has schema-safe dates before hiring panel / export validation. */
export function ensureExperienceDatesForApi(
  resume: TailoredResume,
  sourceResumeText: string
): TailoredResume {
  const source = sourceResumeText.trim()
  let next = source ? mergeSourceExperienceDates(resume, source) : resume
  const timeline = source ? extractExperienceTimelineFromSource(source) : []
  const orderedDates = source ? extractOrderedDatePairsFromSource(source) : []

  next = {
    ...next,
    experience: (next.experience ?? []).map((entry, index) => {
      let startDate = entry.startDate.trim()
      let endDate = entry.endDate.trim() || 'Present'

      const match = findTimelineMatch(entry, timeline)

      if (match && (isBlanketTimelineStamp(startDate, endDate) || isPlaceholderDateRange(startDate, endDate))) {
        startDate = match.startDate.trim()
        endDate = match.endDate.trim() || endDate
      }

      const needsStart = !startDate || isPlaceholderStartDate(startDate)
      const needsEnd = !endDate || (isPlaceholderEndDate(endDate) && endDate.toLowerCase() !== 'present')

      if (needsStart || needsEnd) {
        if (match) {
          if (needsStart && match.startDate.trim()) startDate = match.startDate.trim()
          if (needsEnd && match.endDate.trim()) endDate = match.endDate.trim()
        }
      }

      if ((!startDate || isPlaceholderStartDate(startDate)) && orderedDates[index]) {
        startDate = orderedDates[index]!.startDate
        if (!endDate || isPlaceholderEndDate(endDate)) {
          endDate = orderedDates[index]!.endDate
        }
      }

      if (!startDate.trim()) {
        startDate =
          match?.startDate?.trim() ||
          orderedDates[index]?.startDate ||
          timeline[index]?.startDate?.trim() ||
          entry.startDate.trim()
      }

      if (!startDate.trim() || isPlaceholderStartDate(startDate)) {
        const yearFromEnd = endDate.match(/\b(19|20)\d{2}\b/)?.[0]
        if (yearFromEnd && !match?.startDate?.trim()) {
          startDate = yearFromEnd
        }
      }

      if (!startDate.trim()) {
        startDate = match?.startDate?.trim() || orderedDates[index]?.startDate || 'Recent'
      }

      if (!endDate.trim()) {
        endDate = 'Present'
      }

      return {
        ...entry,
        startDate,
        endDate,
      }
    }),
  }

  return next
}

/** Replace template placeholders (Recent – Present) with dates from the user's source resume. */
export function mergeSourceExperienceDates(
  resume: TailoredResume,
  sourceResumeText: string
): TailoredResume {
  const timeline = extractExperienceTimelineFromSource(sourceResumeText)
  if (timeline.length === 0) return resume

  return {
    ...resume,
    experience: (resume.experience ?? []).map((entry) => {
      const match = findTimelineMatch(entry, timeline)
      if (!match) return entry

      const startDate =
        isPlaceholderStartDate(entry.startDate) && match.startDate
          ? match.startDate
          : entry.startDate.trim()
      const endDate =
        isPlaceholderEndDate(entry.endDate) && match.endDate ? match.endDate : entry.endDate.trim()

      return {
        ...entry,
        startDate: startDate || entry.startDate,
        endDate: endDate || entry.endDate,
      }
    }),
  }
}

function sanitizeExperienceEntry(entry: Experience): Experience {
  return {
    ...entry,
    title: finalizeDisplayText(entry.title),
    company: finalizeDisplayText(entry.company),
    location: finalizeDisplayText(entry.location),
    startDate: entry.startDate.trim(),
    endDate: entry.endDate.trim(),
    bullets: (entry.bullets ?? [])
      .map((bullet) => repairIncompleteText(bullet))
      .filter((bullet) => bullet.length > 0),
  }
}

export type GenerationHygieneOptions = {
  achievementSupplement?: string
}

function sanitizeTailoredResume(
  resume: TailoredResume,
  sourceResumeText: string,
  options: GenerationHygieneOptions = {}
): TailoredResume {
  let next = {
    ...resume,
    summary: repairIncompleteText(resume.summary),
    experience: (resume.experience ?? []).map(sanitizeExperienceEntry),
    projects: (resume.projects ?? []).map(sanitizeExperienceEntry),
  }

  if (sourceResumeText.trim()) {
    next = mergeSourceExperienceDates(next, sourceResumeText)
    next = ensureExperienceDatesForApi(next, sourceResumeText)
    next = enforceContextConstrainedTailoring(next, sourceResumeText)
    next = enforceAuthenticResumeOptimization(next, sourceResumeText, {
      achievementSupplement: options.achievementSupplement,
    })

    const baseline = strictStateToTailoredResume(lockResumeState(sourceResumeText))
    next = guardTailoredResumeExperience(next, baseline)
  }

  return next
}

function sanitizeCoverLetter(
  coverLetter: string,
  sourceResumeText: string,
  options: GenerationHygieneOptions = {}
): string {
  const groundTruth = [sourceResumeText, options.achievementSupplement?.trim()]
    .filter(Boolean)
    .join('\n\n')

  let next = stripBannedAuthenticPhrases(coverLetter)
  if (groundTruth && bulletContainsUngroundedMetric(next, groundTruth)) {
    next = stripFabricatedMetricClauses(next)
  }
  return repairIncompleteText(next)
}

/** Post-process AI output: complete sentences, strip template dates, sanitize cover letter body. */
export function applyGenerationHygiene(
  result: AiGenerationResult,
  sourceResumeText = '',
  options: GenerationHygieneOptions = {}
): AiGenerationResult {
  const coverLetter = sanitizeCoverLetter(
    extractCoverLetterFromModelOutput(result.coverLetter ?? ''),
    sourceResumeText,
    options
  )

  return {
    ...result,
    coverLetter,
    tailoredResume: sanitizeTailoredResume(result.tailoredResume, sourceResumeText, options),
  }
}

export function generationOutputHasHygieneIssues(result: AiGenerationResult): string[] {
  const issues: string[] = []

  for (const entry of result.tailoredResume.experience ?? []) {
    if (isPlaceholderDateRange(entry.startDate, entry.endDate)) {
      issues.push(`Placeholder dates on ${entry.company || entry.title}`)
    }
    for (const bullet of entry.bullets ?? []) {
      if (isStructurallyIncomplete(bullet)) {
        issues.push(`Incomplete bullet under ${entry.company || entry.title}`)
      }
    }
  }

  if (isStructurallyIncomplete(result.coverLetter)) {
    issues.push('Cover letter ends mid-sentence')
  }

  return issues
}
