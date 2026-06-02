import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import {
  AUTHENTIC_BANNED_PHRASES,
  bulletContainsUngroundedMetric,
} from '@/lib/ai/authentic-resume-optimization'
import { findCoverLetterBannedPhrases } from '@/lib/resume/cover-letter-compliance'
import { isPersonalProjectEntry } from '@/lib/resume/personal-project-detection'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'

export type PanelDraftIssueCode =
  | 'banned-cliche'
  | 'ungrounded-metric'
  | 'personal-venture-in-work'
  | 'timeline-overlap'
  | 'weak-cover-letter-opener'

export type PanelDraftIssue = {
  code: PanelDraftIssueCode
  message: string
  detail?: string
}

const EXTRA_BANNED_OPENERS = [
  'my career focus has been on',
  'i am ready to align',
  'ready to align',
  'career focus has been',
] as const

const PERSONAL_VENTURE_COMPANY = /cv2ats(?:\.ca)?|ats4cv|popuphub|tipsy fox/i

function parseYearMonth(value: string): number | null {
  const trimmed = value.trim()
  const slash = trimmed.match(/^(\d{1,2})\/(\d{4})$/)
  if (slash) return Number(slash[2]) * 12 + Number(slash[1])
  const year = trimmed.match(/^(\d{4})$/)
  if (year) return Number(year[1]) * 12
  return null
}

function rangesOverlap(aStart: number | null, aEnd: number | null, bStart: number | null, bEnd: number | null): boolean {
  if (aStart == null || bStart == null) return false
  const aEndVal = aEnd ?? aStart + 120
  const bEndVal = bEnd ?? bStart + 120
  return aStart <= bEndVal && bStart <= aEndVal
}

function isPersonalVentureEntry(entry: Experience): boolean {
  return isPersonalProjectEntry(entry) || PERSONAL_VENTURE_COMPANY.test(`${entry.company} ${entry.title}`)
}

function scanBannedCliches(text: string, label: string, issues: PanelDraftIssue[]): void {
  const lower = text.toLowerCase()
  for (const phrase of [...AUTHENTIC_BANNED_PHRASES, ...EXTRA_BANNED_OPENERS]) {
    if (lower.includes(phrase.toLowerCase())) {
      issues.push({
        code: 'banned-cliche',
        message: `Banned corporate cliché in ${label}`,
        detail: `"${phrase}"`,
      })
    }
  }
  for (const phrase of findCoverLetterBannedPhrases(text)) {
    issues.push({
      code: 'banned-cliche',
      message: `Banned cover letter phrase in ${label}`,
      detail: `"${phrase}"`,
    })
  }
}

function scanUngroundedMetrics(text: string, label: string, groundTruth: string, issues: PanelDraftIssue[]): void {
  if (bulletContainsUngroundedMetric(text, groundTruth)) {
    issues.push({
      code: 'ungrounded-metric',
      message: `Non-verifiable metric in ${label}`,
      detail: text.slice(0, 120),
    })
  }
}

export function auditPanelDraftIssues(
  draft: AiGenerationResult,
  sourceResumeText: string,
  jobDescription = ''
): PanelDraftIssue[] {
  const issues: PanelDraftIssue[] = []
  const groundTruth = sourceResumeText.trim()
  const resume = draft.tailoredResume

  scanBannedCliches(resume.summary, 'professional summary', issues)
  scanUngroundedMetrics(resume.summary, 'professional summary', groundTruth, issues)

  for (const entry of resume.experience ?? []) {
    if (isPersonalVentureEntry(entry)) {
      issues.push({
        code: 'personal-venture-in-work',
        message: 'Personal venture listed under corporate work experience',
        detail: `${entry.company} — ${entry.title}`,
      })
    }

    for (const bullet of entry.bullets ?? []) {
      scanBannedCliches(bullet, `${entry.company} bullet`, issues)
      scanUngroundedMetrics(bullet, `${entry.company} bullet`, groundTruth, issues)
    }
  }

  for (const entry of resume.projects ?? []) {
    for (const bullet of entry.bullets ?? []) {
      scanBannedCliches(bullet, `${entry.company} project bullet`, issues)
      scanUngroundedMetrics(bullet, `${entry.company} project bullet`, groundTruth, issues)
    }
  }

  scanBannedCliches(draft.coverLetter, 'cover letter', issues)
  scanUngroundedMetrics(draft.coverLetter, 'cover letter', groundTruth, issues)

  const corporate = (resume.experience ?? []).filter((entry) => !isPersonalVentureEntry(entry))
  const venturesInWork = (resume.experience ?? []).filter(isPersonalVentureEntry)

  for (const venture of venturesInWork) {
    const vStart = parseYearMonth(venture.startDate)
    const vEnd = parseYearMonth(venture.endDate)
    for (const corp of corporate) {
      const cStart = parseYearMonth(corp.startDate)
      const cEnd = parseYearMonth(corp.endDate)
      if (rangesOverlap(vStart, vEnd, cStart, cEnd)) {
        issues.push({
          code: 'timeline-overlap',
          message: 'Overlapping full-time employment and personal venture dates',
          detail: `${corp.company} (${corp.startDate} – ${corp.endDate}) overlaps ${venture.company}`,
        })
      }
    }
  }

  const coverLower = draft.coverLetter.toLowerCase()
  const weakOpeners = [
    'i am writing to express',
    'i am applying for',
    'my career focus has been',
    'throughout my career',
    'i am eager to',
  ]
  if (weakOpeners.some((opener) => coverLower.includes(opener))) {
    const job = extractCleanJobContext(jobDescription)
    issues.push({
      code: 'weak-cover-letter-opener',
      message: 'Cover letter uses generic opener instead of role-specific hook',
      detail: job.jobTitle ? `Target: ${job.jobTitle}` : undefined,
    })
  }

  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.code}::${issue.detail ?? issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function summarizePanelDraftIssues(issues: PanelDraftIssue[]): string[] {
  return issues.map((issue) => {
    if (issue.detail) return `${issue.message}: ${issue.detail}`
    return issue.message
  })
}

export function repairPersonalVenturesInWorkExperience(resume: TailoredResume): TailoredResume {
  const experience: Experience[] = []
  const movedProjects: Experience[] = []

  for (const entry of resume.experience ?? []) {
    if (isPersonalVentureEntry(entry)) {
      movedProjects.push({
        ...entry,
        title: entry.title.trim() || 'Personal AI Project',
        startDate: entry.startDate.trim() || 'Concurrent',
        endDate: 'Concurrent / Project-based',
        bullets:
          entry.bullets.length > 0
            ? entry.bullets
            : ['Independent product build documented in source resume.'],
      })
    } else {
      experience.push(entry)
    }
  }

  const existingProjects = resume.projects ?? []
  const projectKeys = new Set(existingProjects.map((entry) => `${entry.company}::${entry.title}`.toLowerCase()))
  const mergedProjects = [
    ...existingProjects,
    ...movedProjects.filter((entry) => !projectKeys.has(`${entry.company}::${entry.title}`.toLowerCase())),
  ]

  return {
    ...resume,
    experience,
    projects: mergedProjects,
  }
}
