/**
 * Immutable ATS block schema for LLM JSON output (cloud + browser Nano).
 * Keeps contact identity isolated from section headings and experience arrays intact.
 */

export const RESUME_BLOCK_SCHEMA_DIRECTIVE = `## Immutable ATS resume blocks (mandatory JSON structure)

Return tailoredResume as four isolated, non-overlapping blocks. **Never place section headings inside contact.name or summary.**

### 1. contact (identity only)
- Keys: name, email, phone, location, linkedin
- **contact.name:** candidate first + last name ONLY — never "Professional Summary", job titles, section headers, or summary prose
- Use "" for missing optional contact fields

### 2. skills (technical competency matrix)
- Flat string array of tools, methodologies, and domain competencies
- Do not embed employers, job titles, or narrative sentences

### 3. experience (reverse-chronological work history array)
- **Strict object split:** ONE array item per employer/role — never nest another company's title, dates, or location inside a sibling role's bullets[]
- **Never** collapse multiple employers into a single "Consultant — Independent" (or similar) parent with other jobs as bullets
- **Non-destructive rule:** include EVERY distinct employer from the source resume as its own object — do not truncate, merge adjacent roles, or drop older entries to save tokens
- Each object: title, company, location, startDate, endDate, bullets[] (achievement prose only in bullets — never job headers or date ranges)
- Preserve reverse-chronological order (most recent first)
- Map non-traditional headers (e.g. "Personal AI Project Experience", "Side Ventures") to projects[] — not experience[]

### 4. projects + education + certifications
- projects[]: same shape as experience[] when source has personal AI / side / product-innovation entries
- education[]: never null/omitted when source lists a school, degree, or graduation year — use [] only when source truly has no education
- certifications[]: verbatim from source only

### Cross-block integrity
- summary: executive prose only — no ALL-CAPS section headers, no markdown # headings
- Do not duplicate section titles inside field values
- coverLetter is separate plain text — not nested inside tailoredResume`

export const BROWSER_NANO_RESUME_BLOCKS = `${RESUME_BLOCK_SCHEMA_DIRECTIVE}

Browser Nano: when rewriting summary or coverLetter only, treat contact.name from the locked resume as read-only identity — never replace it with section labels.`
