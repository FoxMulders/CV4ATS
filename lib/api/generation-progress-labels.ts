export const GENERATION_PROGRESS_LABELS = [
  'Skill extrapolation & injection…',
  'Scoring ATS compliance (before)…',
  'Tailoring resume & cover letter…',
  'Hiring panel review…',
  'Finalizing your application…',
] as const

export type GenerationProgressLabel = (typeof GENERATION_PROGRESS_LABELS)[number]
