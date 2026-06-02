import { z } from 'zod'

export const hiringManagerReviewSchema = z.object({
  managerRole: z.string().min(1),
  score: z.number().min(0).max(100),
  approved: z.boolean(),
  comment: z.string().min(1),
})

export const hiringPanelReviewSchema = z.object({
  managers: z.array(hiringManagerReviewSchema).length(10),
  revisionRecommendations: z.array(z.string()),
  finalVerdict: z.string().min(1),
})

export type HiringManagerReview = z.infer<typeof hiringManagerReviewSchema>
export type HiringPanelReview = z.infer<typeof hiringPanelReviewSchema>

export type HiringPanelSessionResult = {
  unanimousApproval: boolean
  aggregateScore: number
  revisionRounds: number
  managers: HiringManagerReview[]
  finalVerdict: string
  revisionRecommendations: string[]
  reviewFailed?: boolean
  /** Server/client diagnostic when reviewFailed is true. */
  failureReason?: string
  /** Score before Editor Agent auto-corrections (first panel pass). */
  initialAggregateScore?: number
  /** Human-readable proof-of-work summary for the UI. */
  autoCorrectionSummary?: string
  /** Deterministic/editor-resolved issue labels. */
  correctedIssues?: string[]
}
