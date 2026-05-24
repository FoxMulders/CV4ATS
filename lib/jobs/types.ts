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
})

export type JobListing = z.infer<typeof jobListingSchema>

export const jobSearchResultSchema = z.object({
  jobs: z.array(jobListingSchema),
  source: z.enum(['adzuna', 'curated']),
  query: z.string(),
  location: z.string(),
})

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
