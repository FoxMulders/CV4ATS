import type { JobListing, JobSearchResult } from '@/lib/jobs/types'
import { searchEdmontonPmJobs, getActiveEdmontonPmJobs } from '@/lib/jobs/edmonton-fallback'

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

function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}/year`
  if (min) return `From $${min.toLocaleString()}/year`
  return `Up to $${max!.toLocaleString()}/year`
}

function mapAdzunaJob(job: AdzunaJob): JobListing {
  return {
    id: `adzuna-${job.id}`,
    title: job.title,
    company: job.company?.display_name ?? 'Unknown employer',
    location: job.location?.display_name ?? 'Edmonton, AB',
    description: job.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    salary: formatSalary(job.salary_min, job.salary_max),
    postedDate: job.created ? new Date(job.created).toLocaleDateString('en-CA') : undefined,
    employmentType: job.contract_type,
    applyUrl: job.redirect_url,
    source: 'Adzuna',
  }
}

async function searchAdzuna(
  query: string,
  location: string
): Promise<JobListing[] | null> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) return null

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: query,
    where: location,
    results_per_page: '20',
    'content-type': 'application/json',
  })

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/ca/search/1?${params.toString()}`,
    { next: { revalidate: 3600 } }
  )

  if (!response.ok) return null

  const data = (await response.json()) as AdzunaResponse
  return data.results.map(mapAdzunaJob)
}

function dedupeJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchJobs(
  query = 'project manager',
  location = 'Edmonton'
): Promise<JobSearchResult> {
  const adzunaJobs = await searchAdzuna(query, location)
  const fallbackJobs = getActiveEdmontonPmJobs(query)

  if (adzunaJobs?.length) {
    const merged = dedupeJobs([...adzunaJobs, ...fallbackJobs])
    return {
      jobs: merged,
      source: 'adzuna',
      query,
      location,
    }
  }

  return {
    jobs: fallbackJobs,
    source: 'curated',
    query,
    location,
  }
}
