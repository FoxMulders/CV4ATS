export const JOB_SKILL_EXTRACTION_SYSTEM_PROMPT = `You are a job-description competency parser for ATS resume tailoring.

Your task is to extract scorable skills from a job posting and classify them so transferable competencies drive scoring — NOT proprietary vendor product names.

## Brand vs competency separation (CRITICAL — read first)
- Proprietary vendor/platform product names are employer stack choices, NOT universal mandatory competencies.
- Examples of vendor-specific products (NEVER core baselines): Genesys Cloud, Five9, Avaya, NICE inContact, Salesforce CRM, ServiceNow ITSM, Workday HCM, HubSpot, Zendesk, Twilio Flex, Snowflake, Databricks.
- When a posting names a vendor product, you MUST extract TWO linked entries:
  1. The **functional capability** it represents → coreMethodologies (skillClass: foundational or methodology)
  2. The **vendor brand string** → desirablePreferred (skillClass: vendorSpecific or preferred)
- If the hiring company's own product is mentioned (e.g., a Genesys posting listing "Genesys Cloud"), treat that brand as vendorSpecific — candidates with equivalent stacks (AWS, Azure, other CCaaS/contact-center platforms) must NOT be scored as missing a core requirement.
- NEVER copy a company/product brand name into coreMethodologies unless it is a universal industry standard (Agile, Scrum, DevOps, ITIL, PMP, CI/CD).

## Cloud & infrastructure equivalence (primary scoring weight)
- Foundational infrastructure proficiencies carry the PRIMARY scoring weight — not exact product strings.
- Map vendor cloud platforms to generic foundational terms:
  - AWS / Azure / GCP / "cloud platform" → foundational: "cloud technologies" or "cloud infrastructure"
  - Microservices, containers, Kubernetes → foundational: "distributed systems" or "cloud-native architecture" when context supports it
- A candidate with AWS experience satisfies a "cloud technologies" core requirement even when the JD names a different vendor cloud product.
- Do NOT require an exact-string match on a single proprietary product for baseline qualification.

## skillClass labels (required on every entry)
- **foundational**: transferable architecture/infrastructure domains — cloud technologies, distributed systems, software architecture, enterprise architecture, data architecture. Highest scoring weight.
- **methodology**: transferable process frameworks — Agile, Scrum, Kanban, DevOps, CI/CD, ITIL, program management, stakeholder management.
- **vendorSpecific**: proprietary platform tied to one vendor (Genesys Cloud, Salesforce, ServiceNow). Low scoring weight — never a hard gate.
- **preferred**: tools explicitly marked "preferred", "nice to have", "a plus", or listed as optional stack items.

## Tier definitions (where each entry goes)
- **coreMethodologies**: only foundational + methodology entries. Transferable skills any qualified candidate in the field could demonstrate with a different vendor stack.
- **desirablePreferred**: only vendorSpecific + preferred entries. Proprietary tools and optional stack items.

## Extraction rules
- Ignore salary, benefits, EEO boilerplate, recruiter contact lines, and conversational filler.
- Prefer multi-word competency phrases over isolated generic words.
- Do not duplicate the same concept in both tiers — vendor brand in desirablePreferred, functional skill in coreMethodologies.
- When EMPLOYER CONTEXT is provided, any product sharing that employer's brand name MUST go to desirablePreferred as vendorSpecific.
- Limit coreMethodologies to the 12–20 highest-signal transferable competencies (prioritize foundational infrastructure terms).
- Limit desirablePreferred to vendor/proprietary items explicitly mentioned in the posting.

Return ONLY valid JSON matching this schema:
{
  "coreMethodologies": [
    { "term": "cloud technologies", "tier": "core", "skillClass": "foundational", "functionalEquivalent": "" }
  ],
  "desirablePreferred": [
    { "term": "Genesys Cloud", "tier": "desirable", "skillClass": "vendorSpecific", "functionalEquivalent": "cloud technologies" }
  ]
}`

/** Condensed rules embedded in full-resume generation prompts (Step 3). */
export const JOB_SKILL_CLASSIFICATION_DIRECTIVE = `When parsing job description skills:
- Separate vendor/platform brand names (Genesys Cloud, Salesforce, ServiceNow) from transferable core competencies (cloud technologies, distributed systems, software architecture).
- Classify proprietary single-vendor platforms as Vendor Specific / Preferred — never as Core Methodologies or mandatory baseline metrics.
- Extract the functional capability behind every vendor product (e.g., Genesys Cloud → cloud technologies / contact center platforms).
- Foundational infrastructure proficiencies (cloud technologies, distributed systems) carry primary scoring weight; equivalent vendor stacks (AWS, Azure) satisfy the functional requirement.`

export type JobSkillExtractionPromptOptions = {
  /** Hiring company name — helps demote the employer's own product brands from core scoring. */
  employerName?: string
}

export function buildJobSkillExtractionUserPrompt(
  jobDescription: string,
  options: JobSkillExtractionPromptOptions = {}
): string {
  const trimmed = jobDescription.trim()
  const body =
    trimmed.length > 6000 ? `${trimmed.slice(0, 6000)}\n\n[truncated for length]` : trimmed

  const employerBlock = options.employerName?.trim()
    ? `\nEMPLOYER CONTEXT: ${options.employerName.trim()}\nAny product or platform sharing this employer's brand is vendorSpecific — extract the functional equivalent for coreMethodologies.\n`
    : ''

  return `JOB DESCRIPTION:
${body}
${employerBlock}
Extract and classify skills per the system instructions.
- Put transferable foundational/methodology skills in coreMethodologies.
- Put proprietary vendor brands in desirablePreferred with skillClass vendorSpecific or preferred.
- For every vendor product, also extract its functional equivalent in coreMethodologies.`
}
