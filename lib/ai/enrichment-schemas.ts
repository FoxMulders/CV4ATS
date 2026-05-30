import { z } from 'zod'

/** Model-facing enrichment payload — bullets + skills only; merged onto frozen resume state. */
export const enrichmentExperienceBulletsSchema = z.object({
  blockKey: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
})

export const enrichmentModelOutputSchema = z.object({
  skills: z.array(z.string().min(1)).min(1),
  experienceBullets: z.array(enrichmentExperienceBulletsSchema).min(1),
  professionalSummary: z.string().min(1).optional(),
  coverLetter: z.string().min(1),
})

export type EnrichmentModelOutput = z.infer<typeof enrichmentModelOutputSchema>

/** @deprecated Legacy shape — converted to experienceBullets before merge. */
export const enrichmentWorkExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  dates: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
})

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
