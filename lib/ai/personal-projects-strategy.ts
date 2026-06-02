import {
  extractPersonalProjectProductNames,
  shouldApplyFoundationalReframing,
  sourceHasPersonalProjects,
} from '@/lib/resume/personal-project-detection'

/** Whitelist — personal project sections must never be dropped or compressed away. */
export const PERSONAL_PROJECT_PRESERVATION_DIRECTIVE = `## Personal AI Projects preservation whitelist (mandatory)
When the source resume contains a "Personal AI Projects", "Side Ventures", "Product Innovations", or equivalent personal-projects section:
- **Never purge, hide, merge into work experience, or compress** these entries to save space or improve corporate JD alignment.
- Output every personal project in \`tailoredResume.projects[]\` with the same employers/product names, titles, dates, and bullet count as the source (rewrite bullet phrasing only — never delete entries).
- Even when a personal project does not mirror the target job's formal corporate structure, it remains **whitelisted** and must appear in the final export layout under **PERSONAL AI PROJECT EXPERIENCE** (after WORK EXPERIENCE, before EDUCATION).
- Do not demote personal projects to a one-line footnote or skills mention — they require full title, company/product name, dates, and accomplishment bullets.
- Server-side structural preservation will restore any dropped project blocks — omitting them fails validation.`

/** Anti-overqualification reframing using preserved personal projects + down-leveled corporate history. */
export const FOUNDATIONAL_ROLE_REFRAMING_DIRECTIVE = `## Foundational-role reframing (anti-overqualification — when applicable)
When the candidate's career timeline materially exceeds the target role level (e.g., 20+ years of background vs. a 1–3 year Project Coordinator requirement) AND personal AI projects exist in the source:

**Summary & narrative pivot**
- Position the **personal AI projects as the candidate's current professional focus** — not a hobby appendix.
- Frame the target role application as a **deliberate career alignment choice**: bringing structured tracking, operational discipline, and reliable delivery execution to modern, fast-paced technical and AI-adjacent teams — not a step backward.
- The summary must connect independent product builds to coordinator competencies: milestone tracking, deliverable hygiene, release rhythm, stakeholder updates, and day-to-day operational velocity.

**Personal AI Projects section**
- Keep full executive/builder proof in project bullets (full-stack delivery, AI integration, shipped products) — this section carries the "current focus" story.
- Use present-tense or ongoing framing where dates support it.

**Corporate work history (Pleasant Solutions, AMA, etc.)**
- **Do not delete roles, employers, dates, or bullets.**
- Downgrade leadership-heavy verbs (*Led*, *Architected*, *Defined*, *Orchestrated*, *Drove strategy*) to implementation-focused coordination language: *Coordinated cross-functional milestones*, *Maintained project tracking frameworks*, *Supported release optimization pipelines under leadership guidance*, *Executed delivery tasks within established governance*.
- Preserve metrics and factual scope — change verb framing and positioning only.`

/** Cover letter must anchor "Why this role?" on personal projects when present. */
export const COVER_LETTER_PERSONAL_PROJECTS_ANCHOR_DIRECTIVE = `## Cover letter — personal projects as "Why this role?" anchor (mandatory when source includes personal AI projects)
When the source resume lists personal AI projects (e.g., PopUpHub, Tipsy Fox, or similar independent products):
- Paragraph 2 or 3 must explicitly reference **those preserved personal projects by name** as the "Why this role?" anchor.
- State that building independent AI products highlighted a professional focus on the **foundational side of product delivery** — maintaining clean organization, tracking shifting deliverables, and driving day-to-day operational velocity.
- Connect that focus directly to the posted coordinator/support role as the **ideal professional destination** — deliberate alignment, not downgrade apology.
- Example narrative shape (adapt names and products to the source only): "Building independent products such as PopUpHub and Tipsy Fox sharpened my focus on the operational backbone of delivery — clean tracking, shifting milestone hygiene, and day-to-day execution velocity — which is why a dedicated Project Coordinator role is my intended next step."
- Never invent project names absent from the source resume.
- Cross-document integrity: personal project names in the cover letter must match \`tailoredResume.projects[]\` entries exactly.`

export function buildPersonalProjectsPromptAddendum(
  sourceResumeText: string,
  jobDescription: string
): string {
  if (!sourceHasPersonalProjects(sourceResumeText)) return ''

  const blocks: string[] = [PERSONAL_PROJECT_PRESERVATION_DIRECTIVE]

  if (shouldApplyFoundationalReframing(sourceResumeText, jobDescription)) {
    blocks.push('', FOUNDATIONAL_ROLE_REFRAMING_DIRECTIVE)
  }

  const productNames = extractPersonalProjectProductNames(sourceResumeText)
  if (productNames.length > 0) {
    blocks.push(
      '',
      'SOURCE PERSONAL PROJECT PRODUCTS (must appear in projects[] and cover letter when anchoring "Why this role?"):',
      ...productNames.map((name) => `- ${name}`)
    )
  }

  return blocks.join('\n')
}

export function buildFoundationalCoverLetterAnchorHint(sourceResumeText: string): string {
  const productNames = extractPersonalProjectProductNames(sourceResumeText)
  if (productNames.length === 0) {
    return 'Reference the candidate\'s personal AI projects from the source resume by name when explaining role fit.'
  }
  const list = productNames.join(' and ')
  return `The cover letter must name ${list} when anchoring why a coordinator/foundational delivery role is the candidate's deliberate next step — operational tracking, deliverable hygiene, and day-to-day velocity from independent product builds.`
}
