import { z } from 'zod'

/** Model-facing enrichment payload — maps to TailoredResume after structural merge. */
export const enrichmentWorkExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  dates: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
})

export const enrichmentModelOutputSchema = z.object({
  professionalSummary: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  workExperience: z.array(enrichmentWorkExperienceSchema).min(1),
  coverLetter: z.string().min(1),
})

export type EnrichmentModelOutput = z.infer<typeof enrichmentModelOutputSchema>

export function parseDatesField(dates: string): { startDate: string; endDate: string } {
  const trimmed = dates.trim()
  const parts = trimmed.split(/\s*[-–—]\s*/)
  if (parts.length >= 2) {
    return {
      startDate: parts[0]!.trim(),
      endDate: /present|current|now/i.test(parts[1] ?? '') ? 'Present' : parts[1]!.trim(),
    }
  }
  return { startDate: trimmed || 'Recent', endDate: 'Present' }
}
