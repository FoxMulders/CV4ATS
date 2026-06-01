import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'

export type PanelCoreMandates = {
  expandCoverLetter: boolean
  injectCeremoniesAndTools: boolean
  deliverablesOverDocumentation: boolean
  tieMedicalImagingSaMD: boolean
}

const CEREMONY_TERMS =
  /\b(?:sprint planning|daily stand[- ]?ups?|retrospectives?|agile ceremon)/i

const TOOL_TERMS = /\b(?:github|smartsheet|smartsheets|aws)\b/i

const MEDICAL_IMAGING =
  /\b(?:medical imaging|samD|software as a medical device|regulated release|release background)\b/i

const COVER_LETTER_CRITIQUE =
  /\b(?:cover letter|paragraph|too short|placeholder|this role role|expand the letter)\b/i

const DELIVERABLES_CRITIQUE =
  /\b(?:document(?:ed|ation)?|passive|deliverable|execution|pleasant solutions|identified and)\b/i

export function extractPanelCoreMandates(
  panel: HiringPanelSessionResult,
  jobDescription: string
): PanelCoreMandates {
  const corpus = [
    panel.finalVerdict,
    ...panel.revisionRecommendations,
    ...panel.managers.map((manager) => manager.comment),
    jobDescription,
  ].join('\n')

  return {
    expandCoverLetter: COVER_LETTER_CRITIQUE.test(corpus) || MEDICAL_IMAGING.test(corpus),
    injectCeremoniesAndTools: CEREMONY_TERMS.test(corpus) || TOOL_TERMS.test(corpus),
    deliverablesOverDocumentation: DELIVERABLES_CRITIQUE.test(corpus),
    tieMedicalImagingSaMD: MEDICAL_IMAGING.test(corpus),
  }
}

export const PANEL_DATA_INTEGRITY_DIRECTIVE = `[Panel Pass 2 — Rigid Data Integrity Controls]

DATE LOCK (mandatory — fix template stamp bug):
- NEVER overwrite unique employment timelines with a blanket date stamp.
- Each experience entry's startDate and endDate must mirror the exact range from the SOURCE RESUME for that employer (e.g., if source shows "04/2013 - 07/2024", output startDate "04/2013" and endDate "07/2024" — never inject generic "2010" or "2010 – Present").
- Rendering sub-headers must match the raw parent object parameters exactly. Do not normalize all roles to the same year range.

TOKEN COMPLETION & DEDUPLICATION (mandatory):
- Eliminate sentence looping and duplicated qualifying phrases within a single bullet (e.g., forbid "with measurable impact, delivering X initiatives with measurable impact").
- Each bullet must be one distinct, structurally linear sentence ending with proper punctuation.
- No consecutive duplicate clause patterns inside bullets or cover letter sentences.`

export function buildPanelValidationMandatesAddendum(
  panel: HiringPanelSessionResult,
  sourceResumeText: string,
  jobDescription: string
): string {
  const mandates = extractPanelCoreMandates(panel, jobDescription)
  const blocks: string[] = [
    '[Panel Pass 2 — Forced Validation Overrides (satisfy ALL mandates below)]',
    PANEL_DATA_INTEGRITY_DIRECTIVE,
    '',
    'The hiring panel critique is binding for this revision. You must resolve every dissenting manager comment and revision recommendation unless it would fabricate credentials.',
  ]

  blocks.push(
    '',
    '### Mandate 1 — Expand the Cover Letter Payload',
    '- Force exactly **3 body paragraphs** (plus header/salutation/closing) — no thin 1–2 paragraph drafts.',
    '- Eradicate placeholder text artifacts: never output "this role role", bracket placeholders, or duplicated role nouns.',
    mandates.tieMedicalImagingSaMD || /medical imaging|samD/i.test(jobDescription)
      ? '- Explicitly tie the candidate\'s release / delivery background to **Medical Imaging / SaMD** (Software as a Medical Device) tracking, milestone hygiene, and regulated delivery context when supported by the source resume.'
      : '- Tie cover letter proof points to the posting\'s domain (releases, compliance tracking, deliverable cadence) using source-resume evidence only.'
  )

  blocks.push(
    '',
    '### Mandate 2 — Inject Explicit Ceremonies & Tooling',
    '- Weave **Agile ceremony** references into work experience bullets where truthful: Sprint Planning, Daily Stand-ups, Retrospectives.',
    '- Name toolsets in bullet context when the source supports them: **GitHub**, **Smartsheets**, **AWS** (and Jira/Confluence when present in source).',
    '- Embed tools inside execution sentences — not naked keyword lists.'
  )

  blocks.push(
    '',
    '### Mandate 3 — Deliverables Over Documentation',
    '- Shift **Pleasant Solutions** (and similar PM/consulting blocks) from passive tracking language ("Identified and documented…") to **active technical project execution** and deliverable outcomes.',
    '- Prefer verbs: coordinated delivery of, executed release milestones, maintained tracking frameworks, supported cross-functional execution — with concrete deliverables, not documentation-only framing.'
  )

  if (mandates.expandCoverLetter || mandates.injectCeremoniesAndTools || mandates.deliverablesOverDocumentation) {
    blocks.push(
      '',
      'PANEL-DETECTED PRIORITY FLAGS:',
      `- Cover letter expansion: ${mandates.expandCoverLetter ? 'REQUIRED' : 'apply if panel cited letter issues'}`,
      `- Ceremonies & tooling injection: ${mandates.injectCeremoniesAndTools ? 'REQUIRED' : 'apply where source supports'}`,
      `- Deliverables-over-documentation shift: ${mandates.deliverablesOverDocumentation ? 'REQUIRED' : 'apply to PM/consulting blocks'}`
    )
  }

  if (/pleasant solutions/i.test(sourceResumeText)) {
    blocks.push(
      '',
      'PLEASANT SOLUTIONS BLOCK: Downgrade passive documentation phrasing; upgrade to deliverable execution language while preserving factual scope from the source resume.'
    )
  }

  blocks.push(
    '',
    'Self-audit before JSON output: (1) three cover letter body paragraphs, (2) zero placeholder date stamps, (3) zero "this role role" artifacts, (4) zero repeated "with measurable impact" loops, (5) ceremonies/tools present in bullets when source supports them.'
  )

  return blocks.join('\n')
}
