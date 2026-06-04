import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { parseListedSkillTerms } from '@/lib/resume/resume-skill-proposals'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'

/** Factual Anchoring — prevents skill/credential hallucination in tailoring and parsing passes. */
export const FACTUAL_ANCHORING_DIRECTIVE = `## Factual Anchoring (mandatory — zero tolerance for skill fabrication)

You optimize for ATS keyword alignment without inventing unearned technical skills, certifications, or software deployments.

### No Skill Fabrication
- You are **strictly forbidden** from introducing specific certifications, compliance frameworks, audit platforms, or vendor tools (e.g., ISO 27001, SOC 2, SOC 1, Vanta, Drata, OneTrust, explicit compliance software) unless they are **explicitly mentioned or clearly implied** in the user's raw SOURCE RESUME text.
- Never infer compliance credentials from the job description alone. A JD asking for "SOC 2 experience" does **not** authorize adding SOC 2 to skills, bullets, summary, or cover letter unless the source resume proves it.
- The \`skills[]\` array must be a **strict subset** of:
  1. Skills, tools, and methodologies present in the source resume (skills section, bullets, summary, projects), **plus**
  2. Universal delivery/PM methodologies named in the job description that the candidate **logically possesses** based on their actual titles and work history (e.g., "technical requirements", "stakeholder management", "release management") — never niche compliance platforms or audit frameworks.
- **Explicitly strip** high-level compliance frameworks (SOC 2, ISO 27001, HIPAA attestation platforms, FedRAMP tooling, etc.) during tailoring unless the tokens "SOC" or "ISO" appear in the original raw resume text.

### Contextual Escalation Only (never credential invention)
- If the job description asks for a skill the candidate does not explicitly have, you may highlight **transferable** experience by reframing existing bullets — e.g., change "managed deployment rollouts" to "coordinated technical requirements and secure deployment rollouts".
- You must **never** invent specific third-party audits, compliance platform deployments, or certification claims to close keyword gaps.
- Prefer semantic alignment inside existing accomplishment bullets over adding new tools/frameworks to \`skills[]\`.

### Skills matrix self-audit (before JSON output)
1. For every entry in \`skills[]\`, confirm it appears in the source resume OR is a universal methodology from the JD grounded in the candidate's PM/IT/delivery titles.
2. Remove any compliance, audit, or certification-adjacent term not verbatim in the source.
3. Do not import JD-only compliance vocabulary into skills even when it would raise match score.`

/** High-risk compliance / audit / certification-adjacent terms — blocked unless source permits. */
export const COMPLIANCE_FRAMEWORK_PATTERNS: RegExp[] = [
  /\biso\s*2700?\d*\b/i,
  /\bsoc\s*[12]\b/i,
  /\bsoc\s*2\b/i,
  /\bvanta\b/i,
  /\bdrata\b/i,
  /\bonetrust\b/i,
  /\bsecureframe\b/i,
  /\bfedramp\b/i,
  /\bhipaa\s+(?:compliance|audit|certification)\b/i,
  /\bpci[\s-]?dss\b/i,
  /\bnist\s+(?:800|csf|framework)\b/i,
  /\bcompliance\s+(?:platform|software|audit|tooling)\b/i,
  /\baudit\s+(?:readiness|platform|software)\b/i,
]

/** Transferable PM/IT methodologies allowed when JD mentions them and titles support ownership. */
export const UNIVERSAL_METHODOLOGY_PATTERNS: RegExp[] = [
  /\bagile\b/i,
  /\bscrum\b/i,
  /\bkanban\b/i,
  /\bwaterfall\b/i,
  /\bsdlc\b/i,
  /\bdevops\b/i,
  /\bci\s*\/\s*cd\b/i,
  /\bcicd\b/i,
  /\bitil\b/i,
  /\bscope management\b/i,
  /\bproject management\b/i,
  /\bprogram management\b/i,
  /\bstakeholder management\b/i,
  /\bchange management\b/i,
  /\brisk management\b/i,
  /\brelease management\b/i,
  /\btechnical requirements\b/i,
  /\brequirements gathering\b/i,
  /\bcross-functional\b/i,
  /\bworkflow automation\b/i,
  /\bprocess improvement\b/i,
  /\bdelivery\b/i,
  /\broadmap\b/i,
  /\bbacklog\b/i,
]

const DELIVERY_OR_TECHNICAL_TITLE =
  /\b(?:project|program|technical|systems|software|platform|devops|engineer|developer|architect|it manager|delivery manager|product manager|scrum master|business analyst)\b/i

export function sourcePermitsComplianceFrameworks(sourceResumeText: string): boolean {
  return /\b(?:soc|iso)\b/i.test(sourceResumeText)
}

export function isComplianceFrameworkSkill(skill: string): boolean {
  const trimmed = skill.trim()
  if (!trimmed) return false
  return COMPLIANCE_FRAMEWORK_PATTERNS.some((pattern) => {
    const matches = pattern.test(trimmed)
    pattern.lastIndex = 0
    return matches
  })
}

export function isUniversalMethodology(skill: string): boolean {
  const trimmed = skill.trim()
  if (!trimmed) return false
  return UNIVERSAL_METHODOLOGY_PATTERNS.some((pattern) => {
    const matches = pattern.test(trimmed)
    pattern.lastIndex = 0
    return matches
  })
}

export function hasDeliveryOrTechnicalTitle(sourceResumeText: string): boolean {
  return DELIVERY_OR_TECHNICAL_TITLE.test(sourceResumeText)
}

export function skillGroundedInSource(skill: string, sourceResumeText: string): boolean {
  return keywordMatchesResume(sourceResumeText, skill)
}

export function jobDescriptionMentionsSkill(skill: string, jobDescription: string): boolean {
  if (!jobDescription.trim()) return false
  return keywordMatchesResume(jobDescription, skill)
}

function skillAllowedByUniversalMethodologyRule(
  skill: string,
  sourceResumeText: string,
  jobDescription: string
): boolean {
  if (!jobDescription.trim()) return false
  if (!hasDeliveryOrTechnicalTitle(sourceResumeText)) return false
  if (!isUniversalMethodology(skill)) return false
  return jobDescriptionMentionsSkill(skill, jobDescription)
}

function complianceSkillPermitted(skill: string, sourceResumeText: string): boolean {
  if (!sourcePermitsComplianceFrameworks(sourceResumeText)) return false
  if (skillGroundedInSource(skill, sourceResumeText)) return true

  const skillLower = skill.toLowerCase()
  const sourceLower = sourceResumeText.toLowerCase()
  if (/\bsoc\b/.test(skillLower) && /\bsoc\b/.test(sourceLower)) return true
  if (/\biso\b/.test(skillLower) && /\biso\b/.test(sourceLower)) return true

  return false
}

/** Programmatic guard — keep skills[] a factual subset of source + allowed universal JD methodologies. */
export function enforceFactualSkills(
  skills: string[],
  sourceResumeText: string,
  jobDescription = ''
): string[] {
  const source = sourceResumeText.trim()
  if (!source) return dedupeSkills(skills.map((skill) => skill.trim()).filter(Boolean))

  const permitsCompliance = sourcePermitsComplianceFrameworks(source)

  const filtered = skills
    .map((skill) => skill.trim())
    .filter(Boolean)
    .filter((skill) => {
      if (isComplianceFrameworkSkill(skill)) {
        return complianceSkillPermitted(skill, source)
      }
      if (skillGroundedInSource(skill, source)) return true
      return skillAllowedByUniversalMethodologyRule(skill, source, jobDescription)
    })

  const sourceListed = parseListedSkillTerms(source)
  const merged = dedupeSkills([...sourceListed, ...filtered])

  return merged.filter((skill) => {
    if (isComplianceFrameworkSkill(skill)) {
      return complianceSkillPermitted(skill, source)
    }
    if (skillGroundedInSource(skill, source)) return true
    return skillAllowedByUniversalMethodologyRule(skill, source, jobDescription)
  })
}
