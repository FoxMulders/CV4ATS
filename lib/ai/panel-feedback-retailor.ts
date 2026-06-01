import type { HiringManagerReview, HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import { ANTI_FABRICATION_DIRECTIVE } from '@/lib/ai/anti-fabrication'
import { FOUNDATIONAL_ROLE_REFRAMING_DIRECTIVE, PERSONAL_PROJECT_PRESERVATION_DIRECTIVE } from '@/lib/ai/personal-projects-strategy'
export type SanitizedPanelFeedback = {
  finalVerdict: string
  revisionRecommendations: string[]
  dissentingComments: string[]
  droppedFabricationSuggestions: string[]
  themes: {
    overqualified: boolean
    missingCredentials: boolean
  }
}

/** Panel lines that would cause the model to invent credentials or education. */
const FABRICATION_SUGGESTION =
  /\b(?:add|include|obtain|list|earn|complete|pursue|mention)\b.{0,40}\b(?:PMP(?:\s+coursework)?|certification|certified|credential|coursework|degree|diploma|Lean Principles|Scrum Master certification|education entry|MBA|bachelor)/i

const INVENTED_SECTION =
  /\b(?:add (?:an? )?(?:certifications?|education)|create (?:a )?(?:certifications?|education) section|list PMP as)/i

const OVERQUALIFIED_THEME =
  /\boverqualif|too senior|decision[- ]maker|coordinator who supports|foundational (?:role|operations)|entry[- ]level|1[-–]3 year|junior(?:\s+role)?|support role|not (?:a )?leadership|executive[- ]level|senior rather than|leans toward(?:s)? a senior|years of experience (?:far )?exceed|down[- ]level|too much experience|program director|strategic leader/i

export { ANTI_FABRICATION_DIRECTIVE }

function sourceHasCertifications(sourceResumeText: string): boolean {
  return /\bcertifications?\b/i.test(sourceResumeText)
}

function sourceHasEducation(sourceResumeText: string): boolean {
  return /\beducation\b/i.test(sourceResumeText)
}

/** Drop panel suggestions that would hallucinate credentials, education, or coursework. */
export function sanitizePanelSuggestion(
  text: string,
  sourceResumeText: string
): { keep: string; dropped: boolean; reason?: string } {
  const trimmed = text.trim()
  if (!trimmed) return { keep: '', dropped: true }

  if (FABRICATION_SUGGESTION.test(trimmed) || INVENTED_SECTION.test(trimmed)) {
    if (!sourceHasCertifications(sourceResumeText) && /certif|PMP|credential|coursework|Lean Principles/i.test(trimmed)) {
      return {
        keep: '',
        dropped: true,
        reason: 'Would invent certifications or coursework not in source resume',
      }
    }
    if (!sourceHasEducation(sourceResumeText) && /education|degree|diploma|MBA|bachelor/i.test(trimmed)) {
      return {
        keep: '',
        dropped: true,
        reason: 'Would invent education not in source resume',
      }
    }
  }

  return { keep: trimmed, dropped: false }
}

export function extractSanitizedPanelFeedback(
  panel: HiringPanelSessionResult,
  sourceResumeText: string
): SanitizedPanelFeedback {
  const droppedFabricationSuggestions: string[] = []
  const revisionRecommendations: string[] = []

  for (const item of panel.revisionRecommendations) {
    const result = sanitizePanelSuggestion(item, sourceResumeText)
    if (result.dropped) {
      if (result.reason) droppedFabricationSuggestions.push(`${item} → ${result.reason}`)
      continue
    }
    revisionRecommendations.push(result.keep)
  }

  const dissentingComments = panel.managers
    .filter((manager) => !manager.approved)
    .map((manager) => `${manager.managerRole}: ${manager.comment}`)

  const corpus = [
    panel.finalVerdict,
    ...dissentingComments,
    ...panel.revisionRecommendations,
  ].join('\n')

  return {
    finalVerdict: panel.finalVerdict.trim(),
    revisionRecommendations,
    dissentingComments,
    droppedFabricationSuggestions,
    themes: {
      overqualified: OVERQUALIFIED_THEME.test(corpus),
      missingCredentials: /\bmissing (?:PMP|certification|credential)/i.test(corpus),
    },
  }
}

export function shouldOfferPanelFeedbackRetailor(panel: HiringPanelSessionResult): boolean {
  if (panel.reviewFailed) return false
  return !panel.unanimousApproval || panel.revisionRecommendations.length > 0
}

export function buildDownTailoringAddendum(sourceResumeText = ''): string {
  const hasProjects = /personal ai projects|popuphub|tipsy fox|side venture|product innovation/i.test(
    sourceResumeText
  )
  const projectBlock = hasProjects
    ? `

${PERSONAL_PROJECT_PRESERVATION_DIRECTIVE}

${FOUNDATIONAL_ROLE_REFRAMING_DIRECTIVE}

Cover letter: name preserved personal AI products from the source when explaining why a coordinator/foundational role is the deliberate next step — operational tracking, deliverable hygiene, and day-to-day velocity.`
    : ''

  return `[Next Iteration Prompt Context Addendum — Down-Tailoring Pass]
The previous generation was rejected by the hiring panel for making the candidate look overqualified or misaligned with the target role level.

Execute a Down-Tailoring pass:
- Reframe action verbs from leadership/independent definitions ("Led", "Defined", "Architected", "Orchestrated", "Drove strategy") to execution and support compliance ("Coordinated", "Supported", "Maintained tracking for", "Executed under guidance", "Contributed to", "Assisted with delivery of").
- When the job targets coordinator, analyst, or 1–3 years experience, frame the candidate's deep background as structural stability and reliable execution for foundational operations — not executive authority.
- Remove aggressive executive-level wording, program-director framing, and "decision-maker" positioning unless explicitly supported as the target role title.
- Preserve factual employers, dates, and metrics from the source resume — down-level phrasing only, never delete real history from work experience or personal projects.
- Do NOT add certifications, coursework, or education entries to compensate for gaps. Address missing keywords semantically inside existing valid history or leave natural gaps.${projectBlock}`
}

export function buildPanelFeedbackRetailorAddendum(
  panel: HiringPanelSessionResult,
  sourceResumeText: string
): string {
  const sanitized = extractSanitizedPanelFeedback(panel, sourceResumeText)
  const blocks: string[] = [
    '[Panel Feedback Ingestion — Closed-Loop Re-Tailor Constraints]',
    ANTI_FABRICATION_DIRECTIVE,
    '',
    'PANEL FINAL VERDICT (treat as negative constraints — do not amplify rejected positioning):',
    sanitized.finalVerdict,
  ]

  if (sanitized.revisionRecommendations.length > 0) {
    blocks.push(
      '',
      'SANITIZED PANEL ACTION ITEMS (apply all — fabrication-prone items already removed):',
      ...sanitized.revisionRecommendations.map((item) => `- ${item}`)
    )
  }

  if (sanitized.dissentingComments.length > 0) {
    blocks.push(
      '',
      'DISSENTING MANAGER COMMENTS (verbatim — resolve each in the new draft):',
      ...sanitized.dissentingComments.map((item) => `- ${item}`)
    )
  }

  if (sanitized.droppedFabricationSuggestions.length > 0) {
    blocks.push(
      '',
      'IGNORED PANEL SUGGESTIONS (do NOT implement — would hallucinate credentials/education):',
      ...sanitized.droppedFabricationSuggestions.map((item) => `- ${item}`)
    )
  }

  if (sanitized.themes.overqualified) {
    blocks.push('', buildDownTailoringAddendum(sourceResumeText))
  } else if (sanitized.themes.missingCredentials) {
    blocks.push(
      '',
      'MISSING CREDENTIAL KEYWORDS (semantic only):',
      'If managers cite missing PMP, Agile, or similar credentials, address them through demonstrated experience in existing roles — never invent certification or coursework lines.'
    )
  }

  blocks.push(
    '',
    'Re-tailor the resume and cover letter to satisfy the panel constraints above while staying 100% grounded in the source resume.'
  )

  return blocks.join('\n')
}

export function buildSanitizedPanelReviewForRevision(
  panel: HiringPanelSessionResult,
  sourceResumeText: string
): {
  managers: HiringManagerReview[]
  revisionRecommendations: string[]
  finalVerdict: string
} {
  const sanitized = extractSanitizedPanelFeedback(panel, sourceResumeText)
  return {
    managers: panel.managers,
    revisionRecommendations: sanitized.revisionRecommendations,
    finalVerdict: sanitized.finalVerdict,
  }
}
