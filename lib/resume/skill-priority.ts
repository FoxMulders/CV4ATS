import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

/** Core competencies that drive ATS scoring. */
export type SkillPriorityTier = 'core' | 'desirable'

export const SCORING_WEIGHT_BY_TIER: Record<SkillPriorityTier, number> = {
  core: 1,
  desirable: 0.25,
}

/** Foundational architecture/infrastructure terms outweigh single-vendor platforms. */
export const FOUNDATIONAL_SKILL_WEIGHT = 1.5

const VENDOR_BRAND_TOKENS = new Set([
  'genesys',
  'five9',
  'avaya',
  'incontact',
  'nice',
  'cisco',
  'salesforce',
  'servicenow',
  'workday',
  'sap',
  'oracle',
  'dynamics',
  'hubspot',
  'zendesk',
  'twilio',
  'ringcentral',
  'mitel',
  'verint',
  'talkdesk',
  'freshdesk',
  'intercom',
  'snowflake',
  'databricks',
  'tableau',
  'powerbi',
  'splunk',
  'datadog',
  'pagerduty',
  'okta',
  'crowdstrike',
  'palo',
  'fortinet',
  'vmware',
  'citrix',
  'nutanix',
  'veeam',
  'commvault',
  'veeva',
  'epic',
  'cerner',
  'meditech',
  'allscripts',
])

const FOUNDATIONAL_SKILL_PATTERNS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\bcloud technolog(?:y|ies)\b/gi, term: 'cloud technologies' },
  { pattern: /\bcloud computing\b/gi, term: 'cloud computing' },
  { pattern: /\bcloud infrastructure\b/gi, term: 'cloud infrastructure' },
  { pattern: /\bcloud platforms?\b/gi, term: 'cloud platforms' },
  { pattern: /\bdistributed systems?\b/gi, term: 'distributed systems' },
  { pattern: /\bsoftware architecture\b/gi, term: 'software architecture' },
  { pattern: /\benterprise architecture\b/gi, term: 'enterprise architecture' },
  { pattern: /\bsolution architecture\b/gi, term: 'solution architecture' },
  { pattern: /\bsystems architecture\b/gi, term: 'systems architecture' },
  { pattern: /\bmicroservices architecture\b/gi, term: 'microservices architecture' },
  { pattern: /\bdata architecture\b/gi, term: 'data architecture' },
  { pattern: /\binfrastructure as code\b/gi, term: 'infrastructure as code' },
  { pattern: /\bcontact center platforms?\b/gi, term: 'contact center platforms' },
  { pattern: /\bccaas\b/gi, term: 'contact center platforms' },
]

const PROPRIETARY_PLATFORM_PATTERNS = [
  /\bgenesys\s+cloud\b/gi,
  /\bfive9\b/gi,
  /\bnice\s+incontact\b/gi,
  /\bsalesforce(?:\s+(?:crm|service cloud|marketing cloud))?\b/gi,
  /\bservicenow\b/gi,
  /\bworkday\b/gi,
  /\bsap\s+(?:s\/4hana|erp|successfactors)\b/gi,
  /\boracle\s+(?:cloud|fusion|erp)\b/gi,
  /\bdynamics\s+365\b/gi,
  /\bhubspot\b/gi,
  /\bzendesk\b/gi,
  /\btwilio\b/gi,
  /\bsnowflake\b/gi,
  /\bdatabricks\b/gi,
]

function normalizeTerm(term: string): string {
  return phraseWithoutStopWords(term.trim().toLowerCase())
}

/** True when the term is a vendor/platform brand rather than a transferable competency. */
export function isProprietaryPlatformTerm(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  for (const pattern of PROPRIETARY_PLATFORM_PATTERNS) {
    if (pattern.test(normalized)) return true
    pattern.lastIndex = 0
  }

  const tokens = tokenize(normalized)
  if (tokens.some((token) => VENDOR_BRAND_TOKENS.has(token))) {
    return true
  }

  return false
}

/** True for transferable architecture/infrastructure competencies. */
export function isFoundationalSkillTerm(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return false

  return FOUNDATIONAL_SKILL_PATTERNS.some(({ pattern, term: canonical }) => {
    if (normalizeTerm(canonical) === normalized) return true
    pattern.lastIndex = 0
    return pattern.test(normalized)
  })
}

/** Scan JD text for foundational competencies that should anchor core scoring. */
export function extractFoundationalSkillsFromText(text: string): string[] {
  const normalized = text.toLowerCase()
  const found = new Set<string>()

  for (const { pattern, term } of FOUNDATIONAL_SKILL_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(normalized)) {
      found.add(normalizeTerm(term))
    }
    pattern.lastIndex = 0
  }

  return [...found]
}

export function classifySkillPriorityTier(term: string): SkillPriorityTier {
  if (isProprietaryPlatformTerm(term)) return 'desirable'
  return 'core'
}

export function scoringWeightForSkill(term: string, tier: SkillPriorityTier = 'core'): number {
  if (isFoundationalSkillTerm(term)) return FOUNDATIONAL_SKILL_WEIGHT
  return SCORING_WEIGHT_BY_TIER[tier]
}

export function priorityTierLabel(tier: SkillPriorityTier): string {
  return tier === 'desirable' ? 'Vendor Specific / Preferred' : 'Core Methodology'
}
