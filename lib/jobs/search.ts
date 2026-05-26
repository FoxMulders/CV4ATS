import type { JobListing, JobSearchResult } from '@/lib/jobs/types'
import {
  buildEmployerSearchQuery,
  EDMONTON_EMPLOYER_TARGETS,
  resolveTargetEmployer,
} from '@/lib/jobs/edmonton-employers'
import { getActiveEdmontonSdlcPmJobs } from '@/lib/jobs/edmonton-fallback'
import {
  DEFAULT_ROLE_SEARCH_QUERY,
  EDMONTON_LOCATION,
  filterJobSearchResults,
  matchesRoleQuery,
} from '@/lib/jobs/filters'

interface AdzunaJob {
  id: string
  title: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  description: string
  salary_min?: number
  salary_max?: number
  contract_type?: string
  created?: string
  redirect_url: string
}

interface AdzunaResponse {
  results: AdzunaJob[]
}

interface AdzunaSearchOptions {
  what: string
  where: string
  resultsPerPage?: number
  whatExclude?: string
}

const ADZUNA_FIELD_OPS_EXCLUDE =
  'construction civil engineering field operations lineman warehouse truck driver pipefitter landscap janitor retail call center property developer'

const BROAD_SEARCH_QUERIES = [
  'Edmonton Alberta jobs',
  'Edmonton careers full time',
  'Edmonton professional roles',
] as const

function buildGeneralSearchQueries(roleQuery: string): string[] {
  const role = roleQuery.trim()
  if (role) return [role]
  return [...BROAD_SEARCH_QUERIES]
}

function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}/year`
  if (min) return `From $${min.toLocaleString()}/year`
  return `Up to $${max!.toLocaleString()}/year`
}

function mapAdzunaJob(job: AdzunaJob): JobListing {
  const company = job.company?.display_name ?? 'Unknown employer'
  const applyUrl = job.redirect_url
  const resolvedEmployer = resolveTargetEmployer(company, applyUrl)?.id

  return {
    id: `adzuna-${job.id}`,
    title: job.title,
    company,
    location: job.location?.display_name ?? EDMONTON_LOCATION,
    description: job.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    salary: formatSalary(job.salary_min, job.salary_max),
    postedDate: job.created ? new Date(job.created).toLocaleDateString('en-CA') : undefined,
    employmentType: job.contract_type,
    applyUrl,
    source: resolvedEmployer ? `Adzuna · ${resolvedEmployer}` : 'Adzuna',
    targetEmployerId: resolvedEmployer,
  }
}

async function searchAdzuna(options: AdzunaSearchOptions): Promise<JobListing[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) return []

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: options.what,
    where: options.where,
    results_per_page: String(options.resultsPerPage ?? 20),
    'content-type': 'application/json',
  })

  if (options.whatExclude) {
    params.set('what_exclude', options.whatExclude)
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/ca/search/1?${params.toString()}`,
    { next: { revalidate: 3600 } }
  )

  if (!response.ok) return []

  const data = (await response.json()) as AdzunaResponse
  return data.results.map((job) => mapAdzunaJob(job))
}

async function searchGeneralAdzunaJobs(location: string, roleQuery: string): Promise<JobListing[]> {
  const batches = await Promise.all(
    buildGeneralSearchQueries(roleQuery).map((query) =>
      searchAdzuna({
        what: query,
        where: location,
        resultsPerPage: 25,
        whatExclude: ADZUNA_FIELD_OPS_EXCLUDE,
      })
    )
  )

  return batches.flat()
}

async function searchTargetEmployerJobs(location: string, roleQuery: string): Promise<JobListing[]> {
  const employerResults = await Promise.all(
    EDMONTON_EMPLOYER_TARGETS.map(async (employer) => {
      const query = buildEmployerSearchQuery(employer, roleQuery)
      const jobs = await searchAdzuna({
        what: query,
        where: location,
        resultsPerPage: 12,
        whatExclude: ADZUNA_FIELD_OPS_EXCLUDE,
      })

      return jobs
        .filter((job) => resolveTargetEmployer(job.company, job.applyUrl)?.id === employer.id)
        .map((job) => ({
          ...job,
          source: `Adzuna · ${employer.id}`,
          targetEmployerId: employer.id,
        }))
    })
  )

  return employerResults.flat()
}

function dedupeJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>()
  const deduped: JobListing[] = []

  const sorted = [...jobs].sort((a, b) => {
    if (a.targetEmployerId && !b.targetEmployerId) return -1
    if (!a.targetEmployerId && b.targetEmployerId) return 1
    return 0
  })

  for (const job of sorted) {
    const key =
      job.id ||
      `${job.title.toLowerCase()}|${job.company.toLowerCase()}|${job.applyUrl.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(job)
  }

  return deduped
}

function sortJobs(jobs: JobListing[]): JobListing[] {
  return [...jobs].sort((a, b) => {
    if (a.targetEmployerId && !b.targetEmployerId) return -1
    if (!a.targetEmployerId && b.targetEmployerId) return 1
    return a.title.localeCompare(b.title)
  })
}

export async function searchJobs(
  query = DEFAULT_ROLE_SEARCH_QUERY,
  location = 'Edmonton'
): Promise<JobSearchResult> {
  const normalizedQuery = query.trim()
  const normalizedLocation = location.trim() || 'Edmonton'
  const [generalJobs, employerJobs, fallbackJobs] = await Promise.all([
    searchGeneralAdzunaJobs(normalizedLocation, normalizedQuery),
    searchTargetEmployerJobs(normalizedLocation, normalizedQuery),
    Promise.resolve(
      getActiveEdmontonSdlcPmJobs().filter((job) => matchesRoleQuery(job, normalizedQuery))
    ),
  ])

  const hasAdzunaCredentials = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
  const merged = dedupeJobs([...employerJobs, ...generalJobs, ...fallbackJobs])
  const jobs = sortJobs(filterJobSearchResults(merged, normalizedQuery))

  const employerMatches = jobs.filter((job) => job.targetEmployerId).length
  const queryLabel = normalizedQuery || 'all roles'
  const employerLabel = `${EDMONTON_EMPLOYER_TARGETS.length} Edmonton-area employers`

  return {
    jobs,
    source: hasAdzunaCredentials && (generalJobs.length > 0 || employerJobs.length > 0) ? 'adzuna' : 'curated',
    query: normalizedQuery ? `${normalizedQuery} · ${employerLabel}` : `${queryLabel} · ${employerLabel}`,
    location: EDMONTON_LOCATION,
    employerTargetsQueried: EDMONTON_EMPLOYER_TARGETS.length,
    employerMatches,
  }
}
