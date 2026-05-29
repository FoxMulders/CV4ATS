import { z } from 'zod'

/** Internal council output — not exposed in the product UI. */
export const writingCouncilResultSchema = z.object({
  coverLetter: z.string().min(1),
})

export type WritingCouncilResult = z.infer<typeof writingCouncilResultSchema>
