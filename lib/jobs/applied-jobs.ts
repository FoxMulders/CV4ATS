import type { JobListing } from '@/lib/jobs/types'

export const APPLIED_JOBS_STORAGE_KEY = 'ats4cv-applied-jobs'

export interface AppliedJobRecord {
  /** Stable key for deduping — usually job.id */
  key: string
  jobId: string
  title: string
  company: string
  location: string
  applyUrl: string
  targetEmployerId?: string
  /** ISO timestamp when marked applied */
  appliedAt: string
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function getJobApplicationKey(
  job: Pick<JobListing, 'id' | 'company' | 'title' | 'applyUrl'>
): string {
  if (job.id?.trim()) return job.id.trim()
  return [
    normalizeMatchText(job.company),
    normalizeMatchText(job.title),
    normalizeMatchText(job.applyUrl),
  ].join('|')
}

export function createAppliedJobRecord(job: JobListing): AppliedJobRecord {
  return {
    key: getJobApplicationKey(job),
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    applyUrl: job.applyUrl,
    targetEmployerId: job.targetEmployerId,
    appliedAt: new Date().toISOString(),
  }
}

function recordsMatch(job: Pick<JobListing, 'id' | 'company' | 'title' | 'applyUrl'>, record: AppliedJobRecord): boolean {
  const key = getJobApplicationKey(job)
  if (record.key === key || record.jobId === job.id) return true

  const applyUrl = normalizeMatchText(job.applyUrl)
  const recordUrl = normalizeMatchText(record.applyUrl)
  if (applyUrl && recordUrl && applyUrl === recordUrl) return true

  return (
    normalizeMatchText(job.company) === normalizeMatchText(record.company) &&
    normalizeMatchText(job.title) === normalizeMatchText(record.title)
  )
}

export function loadAppliedJobs(): AppliedJobRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(APPLIED_JOBS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as AppliedJobRecord[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (record) =>
          record &&
          typeof record.key === 'string' &&
          typeof record.title === 'string' &&
          typeof record.company === 'string'
      )
      .sort((a, b) => Date.parse(b.appliedAt) - Date.parse(a.appliedAt))
  } catch {
    return []
  }
}

function persistAppliedJobs(records: AppliedJobRecord[]): AppliedJobRecord[] {
  if (typeof window === 'undefined') return records

  window.localStorage.setItem(APPLIED_JOBS_STORAGE_KEY, JSON.stringify(records))
  return records
}

export function addAppliedJob(job: JobListing, existing = loadAppliedJobs()): AppliedJobRecord[] {
  const withoutDuplicate = existing.filter((record) => !recordsMatch(job, record))
  const next = [createAppliedJobRecord(job), ...withoutDuplicate]
  return persistAppliedJobs(next)
}

export function removeAppliedJob(
  job: Pick<JobListing, 'id' | 'company' | 'title' | 'applyUrl'>,
  existing = loadAppliedJobs()
): AppliedJobRecord[] {
  const next = existing.filter((record) => !recordsMatch(job, record))
  return persistAppliedJobs(next)
}

export function findAppliedJob(
  job: Pick<JobListing, 'id' | 'company' | 'title' | 'applyUrl'>,
  records = loadAppliedJobs()
): AppliedJobRecord | undefined {
  return records.find((record) => recordsMatch(job, record))
}

export function isJobApplied(
  job: Pick<JobListing, 'id' | 'company' | 'title' | 'applyUrl'>,
  records = loadAppliedJobs()
): boolean {
  return findAppliedJob(job, records) !== undefined
}

export function formatAppliedDate(isoDate: string): string {
  const parsed = Date.parse(isoDate)
  if (Number.isNaN(parsed)) return isoDate

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

export function partitionJobsByApplied(
  jobs: JobListing[],
  records: AppliedJobRecord[]
): { open: JobListing[]; applied: JobListing[] } {
  const open: JobListing[] = []
  const applied: JobListing[] = []

  for (const job of jobs) {
    if (isJobApplied(job, records)) {
      applied.push(job)
    } else {
      open.push(job)
    }
  }

  return { open, applied }
}
