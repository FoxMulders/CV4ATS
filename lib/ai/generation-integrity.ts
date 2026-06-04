import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import {
  extractExperienceTimelineFromSource,
  isBlanketTimelineStamp,
  isPlaceholderDateRange,
  isPlaceholderEndDate,
  isPlaceholderStartDate,
  mergeSourceExperienceDates,
  type SourceExperienceTimeline,
} from '@/lib/ai/generation-hygiene'

export { isBlanketTimelineStamp } from '@/lib/ai/generation-hygiene'

export const PANEL_PASS_2_LOADING_LABEL =
  '[Processing Pass 2: Resolving Date Discrepancies & Elevating Metrics...]'

const COVER_LETTER_PLACEHOLDER_ARTIFACT =
  /\bthis role role\b|\bthe role role\b|\brole role\b|\[\s*(?:date|company|job title|role)\s*\]/i

const BULLET_REPETITION_LOOP =
  /(\bwith measurable impact\b)(?:,\s*delivering[^.]+\1)+/i

const PASSIVE_DOCUMENTATION =
  /\b(?:identified and documented|documented and tracked|maintained documentation only)\b/i

function normalizeCompanyKey(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function findTimelineMatch(
  entry: Experience,
  timeline: SourceExperienceTimeline[]
): SourceExperienceTimeline | undefined {
  const entryKey = normalizeCompanyKey(entry.company)
  const companyPrefix = entry.company.split(/\s[-–—|]\s/)[0]?.trim() ?? ''
  const prefixKey = normalizeCompanyKey(companyPrefix)

  return timeline.find((item) => {
    const itemKey = normalizeCompanyKey(item.company)
    if (entryKey && itemKey && (itemKey === entryKey || entryKey.includes(itemKey) || itemKey.includes(entryKey))) {
      return true
    }
    if (prefixKey && itemKey && (prefixKey === itemKey || itemKey.includes(prefixKey))) {
      return true
    }
    return false
  })
}

function sourceDateIsMoreSpecific(sourceDate: string, entryDate: string): boolean {
  const source = sourceDate.trim()
  const entry = entryDate.trim()
  if (!source || !entry) return Boolean(source)
  if (/\//.test(source) && !/\//.test(entry)) return true
  if (source.length > entry.length + 2) return true
  return false
}

function shouldLockDatesToSource(
  entry: Experience,
  match: SourceExperienceTimeline | undefined
): boolean {
  if (!match) return false
  if (isPlaceholderDateRange(entry.startDate, entry.endDate)) return true
  if (isBlanketTimelineStamp(entry.startDate, entry.endDate)) return true
  if (sourceDateIsMoreSpecific(match.startDate, entry.startDate)) return true
  if (sourceDateIsMoreSpecific(match.endDate, entry.endDate)) return true
  return false
}

function lockExperienceDates(
  entries: Experience[],
  timeline: SourceExperienceTimeline[]
): Experience[] {
  return entries.map((entry) => {
    const match = findTimelineMatch(entry, timeline)
    if (!match || !shouldLockDatesToSource(entry, match)) {
      return {
        ...entry,
        startDate: entry.startDate.trim(),
        endDate: entry.endDate.trim() || 'Present',
      }
    }

    return {
      ...entry,
      startDate: match.startDate.trim(),
      endDate: match.endDate.trim() || 'Present',
    }
  })
}

/** Force employment timelines to mirror source — never apply blanket 2010–Present stamps. */
export function enforceLockedExperienceDates(
  resume: TailoredResume,
  sourceResumeText: string
): TailoredResume {
  const source = sourceResumeText.trim()
  if (!source) return resume

  const next = mergeSourceExperienceDates(resume, source)
  const timeline = extractExperienceTimelineFromSource(source)
  if (timeline.length === 0) return next

  return {
    ...next,
    experience: lockExperienceDates(next.experience ?? [], timeline),
    projects: lockExperienceDates(next.projects ?? [], timeline),
  }
}

export function repairCoverLetterArtifacts(coverLetter: string): string {
  return coverLetter
    .replace(/\bthis role role\b/gi, 'this role')
    .replace(/\bthe role role\b/gi, 'this role')
    .replace(/\brole role\b/gi, 'role')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

export function repairBulletRepetition(bullet: string): string {
  let text = bullet.trim()
  if (!text) return text

  text = text.replace(BULLET_REPETITION_LOOP, '$1')
  text = text.replace(/(\b[\w\s,'-]{12,60}\b)(?:,\s*\1\b)+/gi, '$1')
  text = text.replace(/(\bwith measurable impact\b)(?:,\s*[^.]+\1\b)+/gi, '$1')
  text = text.replace(/\s{2,}/g, ' ').trim()

  if (text.length > 24 && !/[.!?)"']$/.test(text)) {
    text = `${text}.`
  }

  return text
}

export function dedupeResumeBullets(resume: TailoredResume): TailoredResume {
  const mapEntries = (entries: Experience[]) =>
    entries.map((entry) => ({
      ...entry,
      bullets: (entry.bullets ?? []).map(repairBulletRepetition),
    }))

  return {
    ...resume,
    experience: mapEntries(resume.experience ?? []),
    projects: mapEntries(resume.projects ?? []),
  }
}

export function countCoverLetterBodyParagraphs(coverLetter: string): number {
  const body = coverLetter
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .replace(/^[\s\S]*?(?:dear\s+[\w\s,]+,\s*\n+)/i, '')
    .replace(/\n(?:sincerely|regards|best)[\s\S]*$/i, '')
    .trim()

  return body.split(/\n\s*\n+/).filter((block) => block.trim().length > 40).length
}

export function countPlaceholderDateIssues(resume: TailoredResume): number {
  let count = 0
  for (const entry of [...(resume.experience ?? []), ...(resume.projects ?? [])]) {
    if (isPlaceholderDateRange(entry.startDate, entry.endDate)) count += 1
    if (isBlanketTimelineStamp(entry.startDate, entry.endDate)) count += 1
  }
  return count
}

export function countCoverLetterArtifacts(coverLetter: string): number {
  const matches = coverLetter.match(new RegExp(COVER_LETTER_PLACEHOLDER_ARTIFACT.source, 'gi'))
  return matches?.length ?? 0
}

export function countBulletRepetitionIssues(resume: TailoredResume): number {
  let count = 0
  for (const bullet of [
    ...(resume.experience ?? []).flatMap((entry) => entry.bullets ?? []),
    ...(resume.projects ?? []).flatMap((entry) => entry.bullets ?? []),
  ]) {
    if (BULLET_REPETITION_LOOP.test(bullet)) count += 1
    if (/\bwith measurable impact\b.*\bwith measurable impact\b/i.test(bullet)) count += 1
  }
  return count
}

export function countPassiveDocumentationBullets(resume: TailoredResume, companyHint = 'pleasant'): number {
  const hint = companyHint.toLowerCase()
  let count = 0
  for (const entry of resume.experience ?? []) {
    if (!entry.company.toLowerCase().includes(hint)) continue
    for (const bullet of entry.bullets ?? []) {
      if (PASSIVE_DOCUMENTATION.test(bullet)) count += 1
    }
  }
  return count
}

export type DraftQualityAudit = {
  issues: string[]
  placeholderDates: number
  coverLetterArtifacts: number
  bulletRepetitions: number
  coverLetterParagraphs: number
  passiveDocumentationBullets: number
}

export function auditDraftQuality(
  draft: AiGenerationResult,
  sourceResumeText = ''
): DraftQualityAudit {
  const resume = draft.tailoredResume
  const coverLetter = draft.coverLetter ?? ''
  const issues: string[] = []

  const placeholderDates = countPlaceholderDateIssues(resume)
  const coverLetterArtifacts = countCoverLetterArtifacts(coverLetter)
  const bulletRepetitions = countBulletRepetitionIssues(resume)
  const coverLetterParagraphs = countCoverLetterBodyParagraphs(coverLetter)
  const passiveDocumentationBullets = countPassiveDocumentationBullets(resume)

  if (placeholderDates > 0) {
    issues.push(`${placeholderDates} employment date placeholder or blanket stamp(s)`)
  }
  if (coverLetterArtifacts > 0) {
    issues.push(`${coverLetterArtifacts} cover letter placeholder artifact(s)`)
  }
  if (bulletRepetitions > 0) {
    issues.push(`${bulletRepetitions} bullet repetition loop(s)`)
  }
  if (coverLetterParagraphs > 0 && coverLetterParagraphs < 3) {
    issues.push(`Cover letter has ${coverLetterParagraphs} body paragraph(s) — require 3`)
  }
  if (passiveDocumentationBullets > 0) {
    issues.push(`${passiveDocumentationBullets} passive documentation bullet(s) in Pleasant Solutions block`)
  }

  if (sourceResumeText.trim()) {
    const timeline = extractExperienceTimelineFromSource(sourceResumeText)
    for (const entry of resume.experience ?? []) {
      const match = findTimelineMatch(entry, timeline)
      if (match && isBlanketTimelineStamp(entry.startDate, entry.endDate)) {
        issues.push(`Blanket date stamp on ${entry.company} — source has ${match.startDate} – ${match.endDate}`)
      }
    }
  }

  return {
    issues,
    placeholderDates,
    coverLetterArtifacts,
    bulletRepetitions,
    coverLetterParagraphs,
    passiveDocumentationBullets,
  }
}

export type PanelRevisionDelta = {
  resolvedIssues: string[]
  remainingIssues: string[]
  before: DraftQualityAudit
  after: DraftQualityAudit
  pass: boolean
}

export function computePanelRevisionDelta(
  before: AiGenerationResult,
  after: AiGenerationResult,
  sourceResumeText = ''
): PanelRevisionDelta {
  const beforeAudit = auditDraftQuality(before, sourceResumeText)
  const afterAudit = auditDraftQuality(after, sourceResumeText)

  const resolvedIssues: string[] = []
  const remainingIssues = [...afterAudit.issues]

  if (beforeAudit.placeholderDates > afterAudit.placeholderDates) {
    resolvedIssues.push('Employment date placeholders reduced')
  }
  if (beforeAudit.coverLetterArtifacts > afterAudit.coverLetterArtifacts) {
    resolvedIssues.push('Cover letter placeholder artifacts reduced')
  }
  if (beforeAudit.bulletRepetitions > afterAudit.bulletRepetitions) {
    resolvedIssues.push('Bullet repetition loops reduced')
  }
  if (beforeAudit.coverLetterParagraphs < 3 && afterAudit.coverLetterParagraphs >= 3) {
    resolvedIssues.push('Cover letter expanded to 3+ body paragraphs')
  }
  if (beforeAudit.passiveDocumentationBullets > afterAudit.passiveDocumentationBullets) {
    resolvedIssues.push('Passive documentation language reduced')
  }

  const pass =
    afterAudit.issues.length === 0 ||
    (afterAudit.placeholderDates === 0 &&
      afterAudit.coverLetterArtifacts === 0 &&
      afterAudit.bulletRepetitions === 0)

  return {
    resolvedIssues,
    remainingIssues,
    before: beforeAudit,
    after: afterAudit,
    pass,
  }
}

export function applyPostRevisionIntegrity(
  result: AiGenerationResult,
  sourceResumeText: string
): AiGenerationResult {
  let tailoredResume = enforceLockedExperienceDates(result.tailoredResume, sourceResumeText)
  tailoredResume = dedupeResumeBullets(tailoredResume)

  return {
    ...result,
    coverLetter: repairCoverLetterArtifacts(result.coverLetter),
    tailoredResume,
  }
}
