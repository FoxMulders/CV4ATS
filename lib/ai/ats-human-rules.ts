/**
 * Dual-filter tailoring rules — ATS machine parsing + human recruiter review.
 * Imported by the system prompt and browser/local generation paths.
 */

/** Rule 1 — ATS is an automated parser: standard anchors, single-column, hard tokens. */
export const ATS_MACHINE_PARSING_DIRECTIVE = `## Rule 1: ATS Machine Parsing (mandatory)
The ATS strips styling and categorizes plain text into structured JSON (contact, jobs, skills). Optimize for the **parser**, not the PDF layout engine.

### Standard section labels (strict)
Use only predictable ATS anchors in exported plain text — never creative headers:
- **Acceptable:** Professional Summary, Skills, Work Experience (or Work History / Professional Experience), Education, Certifications.
- **Forbidden:** "My Career Journey", "Core Competencies", "Areas of Expertise", "What I Bring", sidebars, or any non-standard section title.

All content must live in the **raw body document flow** — never headers/footers, text boxes, tables, columns, or vector shapes. Output is strictly **single-column** plain text with reverse-chronological work history.

### Hard token keyword matching (ATS relevancy score)
The parser scores contextual noun-density against the job description. When the JD lists multi-word competency tokens (e.g., **Project Coordination**, **Process Optimization**, **Stakeholder Management**), weave those **exact token patterns** into summary, skills, and experience bullets where the candidate truthfully possesses them.

- **Required:** Verbatim multi-word competency tokens from the JD when grounded in the source resume.
- **Allowed verbatim:** Standard methodology labels (Agile, Scrum, Kanban), tool names (Jira, Azure), and domain nouns the candidate actually used.
- **Still forbidden:** Copying 4+ consecutive words that form a full JD **sentence or duty clause** — see Anti-Plagiarism rules.

Embed hard tokens inside grammatically complete accomplishment bullets — never as naked keyword dumps or comma-separated stuffing lists.`

/** Rule 2 — Recruiters scan ~6 seconds: titles, timelines, bullet openings. */
export const HUMAN_RECRUITER_REVIEW_DIRECTIVE = `## Rule 2: Human Recruiter Review (mandatory)
Once ATS scores high enough, a human spends **6–7 seconds** scanning titles, timelines, and the **first words of each bullet**.

### The "So What?" impact principle
Humans reject task lists. Every bullet must lead with an **execution-focused action verb**, state **scope** (teams, environments, systems, budget), and show **business outcome**.

- **Failed (passive duty):** "Managed deployments across QA, UAT, and Production."
- **Passed (action + scope + impact):** "Orchestrated seamless multi-environment deployment workflows (QA, UAT, and Production) to minimize service disruptions during critical database migrations."

### Anti-plagiarism guardrail (semantic matching for prose)
Recruiters instantly spot copy-pasted job posting lines. Adopt the **underlying methodology** the employer wants, but phrase it using the candidate's **unique historical context** — never lift posting clauses.

### Zero template / AI footprints
Discard triggers include:
- Boilerplate like "Operating at the intersection of…", "Results-driven professional", "Passionate about…"
- Generic placeholder dates such as **Recent – Present** on older roles (mirror source dates exactly)
- Uniform bullet cadence where every line reads like the same AI template
- Cover letter proof points attributed to the wrong employer`

/** Structural merger — both filters before export. */
export const DUAL_FILTER_MERGE_DIRECTIVE = `## Dual-Filter Structural Merger (mandatory before JSON output)
Balance **Rule 1 (machine)** and **Rule 2 (human)** in one pass:

1. **Inject exact JD competency tokens** where truthful (ATS noun-density).
2. **Rephrase into Action + Scope + Impact** bullets (human scan).
3. **Apply anti-plagiarism filters** — no copied duty clauses; semantic context only.
4. **Delete AI buzzwords and template artifacts** (stylistic blacklist, banned openers).
5. **Enforce single-column plain text** with standard section headers only.
6. **Self-audit:** Would this pass an ATS parser AND survive a 7-second recruiter skim? If not, rewrite before returning JSON.`
