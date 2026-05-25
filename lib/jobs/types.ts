import { z } from 'zod'

export const jobListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  description: z.string(),
  salary: z.string().optional(),
  closingDate: z.string().optional(),
  postedDate: z.string().optional(),
  employmentType: z.string().optional(),
  applyUrl: z.string().url(),
  source: z.string(),
  targetEmployerId: z.string().optional(),
})

export type JobListing = z.infer<typeof jobListingSchema>

export const jobSearchResultSchema = z.object({
  jobs: z.array(jobListingSchema),
  source: z.enum(['adzuna', 'curated', 'manual']),
  query: z.string(),
  location: z.string(),
  employerTargetsQueried: z.number().optional(),
  employerMatches: z.number().optional(),
})

export const jobIngestResultSchema = z.object({
  job: jobListingSchema,
  bypassFilters: z.literal(true),
  status: z.enum(['parsed']),
})

export type JobIngestResult = z.infer<typeof jobIngestResultSchema>

export type JobSearchResult = z.infer<typeof jobSearchResultSchema>

export function formatJobDescriptionForAi(job: JobListing): string {
  const parts = [
    `Job Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    job.employmentType ? `Employment Type: ${job.employmentType}` : null,
    job.salary ? `Salary: ${job.salary}` : null,
    job.closingDate ? `Closing Date: ${job.closingDate}` : null,
    '',
    'Job Description:',
    job.description,
  ]

  return parts.filter(Boolean).join('\n')
}
