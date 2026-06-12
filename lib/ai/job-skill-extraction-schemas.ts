import { z } from 'zod'

/** How the skill should be weighted in ATS scoring. */
export const extractedSkillClassSchema = z.enum([
  'foundational',
  'methodology',
  'vendorSpecific',
  'preferred',
])

export const extractedJobSkillSchema = z.object({
  term: z.string().min(1),
  tier: z.enum(['core', 'desirable']),
  /** Omitted by older model outputs — inferred from term + tier in extract-job-skills. */
  skillClass: extractedSkillClassSchema.optional(),
  functionalEquivalent: z.string().optional(),
})

export const jobSkillExtractionResultSchema = z.object({
  coreMethodologies: z.array(extractedJobSkillSchema),
  desirablePreferred: z.array(extractedJobSkillSchema),
})

export type ExtractedSkillClass = z.infer<typeof extractedSkillClassSchema>
export type ExtractedJobSkill = z.infer<typeof extractedJobSkillSchema>
export type JobSkillExtractionResult = z.infer<typeof jobSkillExtractionResultSchema>
