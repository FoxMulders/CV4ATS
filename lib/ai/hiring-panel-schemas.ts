import { z } from 'zod'

export const hiringPanelResultSchema = z.object({
  critiquesSummary: z.array(z.string().min(1)).min(1),
  rewrittenBullets: z.array(z.string().min(1)).min(1),
  coverLetterHook: z.string().min(1),
})

export type HiringPanelResult = z.infer<typeof hiringPanelResultSchema>
