/**
 * Brad Mulders — executive cover letter narrative (ground truth for Pleasant Solutions arc).
 * Injected when his resume is detected; role focus adapts to each job description.
 */

import {
  extractCleanJobContext,
  extractJobTitleFromDescription,
} from '@/lib/resume/extract-job-title'

export const BRAD_MULDERS_NARRATIVE_ID = 'brad-mulders'

const BRAD_EMAIL_PATTERN = /\bbradmulders@/i
const BRAD_NAME_PATTERN = /\bbrad\s+mulders\b/i

/** Canonical Pleasant Solutions story — cover letter ground truth. */
export const BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS = {
  appliedRole: 'Business Analyst',
  offeredRole: 'Project Manager',
  employer: 'Pleasant Solutions',
  kolbeNote: 'high Kolbe assessment scores confirming systems thinking and problem-solving aptitude',
  applications: ['Sheetast', 'Turbo Diagrams', 'Paranoid Photos'] as const,
  legacyTurnaround:
    'inherited a massive legacy application the company had invested heavily in before his arrival; unblocked delivery and shipped it to release',
  marketShift:
    'rapid AI market shift later rendered that product commercially obsolete, leading to layoffs on the program — handled with professional grace, empathy, and accountability',
} as const

export type BradMuldersRoleFocus =
  | 'delivery_leadership'
  | 'business_analysis'
  | 'coordination'
  | 'engineering'
  | 'hybrid_technical_pm'

export function isBradMuldersResume(sourceResumeText: string): boolean {
  const text = sourceResumeText.trim()
  if (!text) return false
  if (BRAD_EMAIL_PATTERN.test(text)) return true
  if (BRAD_NAME_PATTERN.test(text.split('\n').slice(0, 6).join('\n'))) return true
  return false
}

export function classifyBradMuldersRoleFocus(jobDescription: string): BradMuldersRoleFocus {
  const jd = jobDescription.toLowerCase()

  if (
    /\b(?:software engineer|full[\s-]?stack|backend engineer|frontend engineer|devops|site reliability|sre|platform engineer|systems developer)\b/.test(
      jd
    )
  ) {
    return 'engineering'
  }

  if (/\b(?:business analyst|requirements analyst|\bba\b role|\bba,)\b/.test(jd)) {
    return 'business_analysis'
  }

  if (/\b(?:project coordinator|program coordinator|delivery coordinator|coordinator)\b/.test(jd)) {
    return 'coordination'
  }

  if (
    /\b(?:technical program manager|tpm\b|program manager|project manager|delivery manager|release manager|pmo)\b/.test(
      jd
    )
  ) {
    return 'delivery_leadership'
  }

  if (/\b(?:engineering manager|technical manager|development manager)\b/.test(jd)) {
    return 'hybrid_technical_pm'
  }

  return 'delivery_leadership'
}

function roleFocusDirective(focus: BradMuldersRoleFocus, jobTitle: string, companyLabel: string): string {
  const title = jobTitle === 'this role' ? 'the posted role' : jobTitle
  const company = companyLabel

  switch (focus) {
    case 'business_analysis':
      return `- **Role lens (${title}):** Lead with analytical rigor and systems diagnosis — the same aptitude that earned a PM offer at Pleasant Solutions when Brad applied as a BA. Connect requirements clarity, stakeholder translation, and delivery unblocking to ${company}'s stated needs.
- **Close angle:** Offer to translate ambiguous business problems into executable roadmaps and measurable outcomes for ${title}.`

    case 'coordination':
      return `- **Role lens (${title}):** Frame the Pleasant Solutions pivot as proof of immediate operational value — tracking, milestone hygiene, and calm execution under shifting priorities. Pair with PopUpHub/Tipsy Fox independent builds when explaining deliberate interest in hands-on delivery coordination at ${company}.
- **Close angle:** Emphasize unblocking day-to-day execution rhythm and keeping cross-functional work visible for ${title}.`

    case 'engineering':
      return `- **Role lens (${title}):** Open with builder credibility (AMA C# automation, AWS releases, personal AI products) then bridge to Pleasant Solutions shipping Sheetast, Turbo Diagrams, and Paranoid Photos. Position as engineer who owns release outcomes — not only code.
- **Close angle:** Tie shipping discipline, GitHub/CI/CD patterns, and legacy-system recovery to ${company}'s engineering execution gaps for ${title}.`

    case 'hybrid_technical_pm':
      return `- **Role lens (${title}):** Merge delivery leadership with deep technical fluency — BA-to-PM pivot, three application releases, legacy turnaround, plus AMA systems development and personal AI product builds.
- **Close angle:** Offer to align engineering capacity with business priorities and drive ${title} outcomes at ${company} without losing technical credibility.`

    case 'delivery_leadership':
    default:
      return `- **Role lens (${title}):** Executive speechwriter tone — confident, transparent, results-oriented. Hook on fixing broken delivery roadmaps and bridging engineering with business strategy; map Pleasant Solutions proof directly to ${company}'s top responsibilities for ${title}.
- **Close angle:** Sharp call to action on unblocking engineering execution and maximizing operational efficiency for ${title} at ${company}.`
  }
}

const COVER_LETTER_STRUCTURE_TEMPLATE = `### Required cover letter architecture (Brad Mulders — mandatory when this block is present)
Act as an expert executive speechwriter and executive recruiter. Tone: confident, transparent, results-oriented — zero generic corporate fluff.

**Hook (paragraph 1):** Strong, non-traditional opening about fixing broken delivery roadmaps and bridging engineering with business strategy. Name the target role ("__JOB_TITLE__") and at least one specific responsibility or pain point from the job description — not a template opener.

**Body paragraph 1 — The Pivot:** Pleasant Solutions origin story — applied for Business Analyst; interview/assessment revealed deep technical experience and ${BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS.kolbeNote}; management offered Project Manager instead. Frame as immediate value, systems thinking, and cognitive blueprint for problem-solving. Adapt emphasis to the role lens below.

**Body paragraph 2 — Delivery & Grit:** End-to-end release of three custom applications (${BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS.applications.join(', ')}). Address the inherited legacy program with professional grace: ${BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS.legacyTurnaround}; ${BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS.marketShift}. Emphasize resilience and clear-eyed leadership under volatile conditions — never blame the employer; demonstrate empathy and delivery standards.

**Close:** Role-specific call to action (see role lens). No "I welcome the opportunity to discuss" boilerplate.

**Cross-document rules:**
- Pleasant Solutions achievements stay at Pleasant Solutions; AMA systems/automation stays at AMA; personal AI projects (PopUpHub, Tipsy Fox Escapes) only when anchoring "why this role" — names must match the source resume.
- Cite at least **two specific responsibilities or tools** from the job description in the letter body (semantic fit — no 4+ word JD copying).
- 3–4 body paragraphs total; include contact header from resume.`

export function buildBradMuldersCoverLetterAddendum(jobDescription: string): string {
  const { jobTitle, companyName } = extractCleanJobContext(jobDescription)
  const focus = classifyBradMuldersRoleFocus(jobDescription)
  const rawTitle = extractJobTitleFromDescription(jobDescription)
  const companyLabel = companyName ?? 'the hiring organization'

  const structure = COVER_LETTER_STRUCTURE_TEMPLATE.replace(/__JOB_TITLE__/g, jobTitle)

  return `## Candidate narrative — Brad Mulders (mandatory cover letter architecture)
${structure}

### Role-specific tailoring for this application
- Detected target title: **${rawTitle}**
- Detected company: **${companyLabel}**
- Role focus: **${focus}**
${roleFocusDirective(focus, jobTitle, companyLabel)}

### Narrative guardrails
- Do not invent employers, metrics, or application names beyond the source resume and facts above.
- Do not use banned AI cover letter clichés (see Cover Letter Generation Engine).
- Regenerate-level variance still applies — vary sentence mechanics and emphasis per role, but preserve this story spine.`
}

export function buildBradMuldersResumeEmphasisHint(jobDescription: string): string {
  if (!jobDescription.trim()) return ''

  const focus = classifyBradMuldersRoleFocus(jobDescription)

  const hints: Record<BradMuldersRoleFocus, string> = {
    delivery_leadership:
      'Elevate Pleasant Solutions bullets to active release ownership (Sheetast, Turbo Diagrams, Paranoid Photos), roadmap unblocking, and Agile/Jira/Linear/GitHub governance.',
    business_analysis:
      'Highlight requirements translation, assessment-driven pivot to PM, and systems-thinking proof alongside Pleasant Solutions delivery outcomes.',
    coordination:
      'Emphasize milestone tracking, release rhythm, and cross-functional coordination; keep personal AI projects as operational-focus proof.',
    engineering:
      'Lead with AMA C# automation, AWS releases, and builder proof; Pleasant Solutions as shipping three applications including legacy recovery.',
    hybrid_technical_pm:
      'Balance Pleasant Solutions delivery leadership with AMA technical depth and personal AI product execution.',
  }

  return hints[focus]
}
