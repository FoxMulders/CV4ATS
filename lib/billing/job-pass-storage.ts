export interface StoredJobPass {
  jobDescriptionHash: string
  accessToken: string
  expiresAt: number
  unlockedAt: number
}

export const JOB_PASSES_STORAGE_KEY = 'ats4cv-job-passes'

function readPassMap(): Record<string, StoredJobPass> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = localStorage.getItem(JOB_PASSES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StoredJobPass>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePassMap(passes: Record<string, StoredJobPass>): void {
  localStorage.setItem(JOB_PASSES_STORAGE_KEY, JSON.stringify(passes))
}

export function pruneExpiredJobPasses(
  passes: Record<string, StoredJobPass>,
  now = Date.now()
): Record<string, StoredJobPass> {
  return Object.fromEntries(
    Object.entries(passes).filter(([, pass]) => pass.expiresAt > now)
  )
}

export function loadJobPasses(): Record<string, StoredJobPass> {
  return pruneExpiredJobPasses(readPassMap())
}

export function getJobPass(jobDescriptionHash: string): StoredJobPass | null {
  if (!jobDescriptionHash) return null
  const pass = loadJobPasses()[jobDescriptionHash]
  if (!pass || pass.expiresAt <= Date.now()) return null
  return pass
}

export function saveJobPass(pass: StoredJobPass): void {
  const passes = loadJobPasses()
  passes[pass.jobDescriptionHash] = pass
  writePassMap(pruneExpiredJobPasses(passes))
}

export function clearJobPass(jobDescriptionHash: string): void {
  const passes = loadJobPasses()
  delete passes[jobDescriptionHash]
  writePassMap(passes)
}

export function formatJobPassExpiry(expiresAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(expiresAt))
}
