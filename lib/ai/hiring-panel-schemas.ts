import { z } from 'zod'

export const panelCritiqueSchema = z.object({
  managerRole: z.string().min(1),
  critique: z.string().min(1),
  /** First-person reaction when the manager returns to the table to judge the rewrite. */
  tableReaction: z.string().min(1),
})

export const hiringPanelResultSchema = z.object({
  /** All 10 original critiques with round-table reactions to the rewrite. */
  panelCritiques: z.array(panelCritiqueSchema).length(10),
  critiquesSummary: z.array(z.string().min(1)).min(1),
  rewrittenBullets: z.array(z.string().min(1)).min(1),
  /** Full cover letter — not a hook fragment. Must address panel feedback. */
  coverLetter: z.string().min(1),
  /** Panel consensus after returning to the table. */
  panelVerdict: z.string().min(1),
})

export type PanelCritique = z.infer<typeof panelCritiqueSchema>
export type HiringPanelResult = z.infer<typeof hiringPanelResultSchema>
