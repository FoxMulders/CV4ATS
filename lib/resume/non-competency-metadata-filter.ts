import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

/** Salary, benefits, and posting-admin phrases that are not role competencies. */
const NON_COMPETENCY_PATTERNS = [
  /\b\d[\d\s,.]*(?:cad|usd|eur|gbp|aud|nz|c\$|\$|£|€)\b/i,
  /\b(?:cad|usd|eur|gbp|aud|c\$|\$|£|€)\s*\d[\d\s,.]*/i,
  /\b\d{2,3}(?:\s+\d{3})+\b/,
  /\b\d+\s*(?:k|m)\b/i,
  /\b(?:per|\/)\s*(?:year|annum|hour|hr|month|mo)\b/i,
  /\bsalary\s+(?:depending|range|commensurate|based)\b/i,
  /\b(?:depending|based)\s+(?:on|upon)\s+experience\b/i,
  /\bcompetitive\s+(?:salary|compensation|pay|wages?)\b/i,
  /\bcompensation\s+(?:package|range|plan)\b/i,
  /\bpaid\s+leave\b/i,
  /\bvacation\s+days?\b/i,
  /\bsick\s+leave\b/i,
  /\bparental\s+leave\b/i,
  /\bhealth\s+(?:and\s+)?(?:dental|vision)\b/i,
  /\bdental\s+(?:and\s+)?vision\b/i,
  /\b(?:401\s*\(?\s*k\s*\)?|rrsp|pension\s+plan|retirement\s+plan)\b/i,
  /\bbenefits?\s+(?:package|plan|program)\b/i,
  /\bcomprehensive\s+benefits\b/i,
  /\bemployee\s+(?:benefits|discounts?|assistance)\b/i,
  /\blife\s+insurance\b/i,
  /\bdisability\s+insurance\b/i,
  /\bstock\s+options?\b/i,
  /\bbonus\s+(?:plan|structure|eligible)\b/i,
  /\bovertime\s+(?:pay|eligible|available)\b/i,
  /\bholiday\s+pay\b/i,
  /\bstat\s+holidays?\b/i,
  /\bflexible\s+(?:hours|schedule|work\s+arrangements?)\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bremote\s+(?:work|eligible|friendly)\b/i,
  /\bhybrid\s+(?:work|schedule|model)\b/i,
  /\bequal\s+opportunity\b/i,
  /\beeo\b/i,
  /\baccommodation\b/i,
  /\bbackground\s+check\b/i,
  /\bdrug\s+test\b/i,
  /\bvisa\s+sponsorship\b/i,
  /\bwork\s+permit\b/i,
  /\bcitizenship\s+required\b/i,
  /\bsecurity\s+clearance\b/i,
]

const NON_COMPETENCY_TOKEN_SET = new Set([
  'benefits',
  'bonus',
  'cad',
  'compensation',
  'dental',
  'holiday',
  'holidays',
  'insurance',
  'leave',
  'overtime',
  'pension',
  'salary',
  'sponsor',
  'sponsorship',
  'vacation',
  'wages',
])

function normalizeTerm(term: string): string {
  return phraseWithoutStopWords(term.trim().toLowerCase())
}

function hasCurrencyDigitMix(term: string): boolean {
  const normalized = term.toLowerCase()
  const hasDigit = /\d/.test(normalized)
  const hasCurrency =
    /(?:cad|usd|eur|gbp|aud|c\$|\$|£|€)/i.test(normalized) ||
    /\b\d{2,3}(?:\s+\d{3})+\b/.test(normalized)

  if (hasDigit && hasCurrency) return true

  if (/\b\d[\d\s,.]*(?:cad|usd|eur|gbp|aud)\b/i.test(normalized)) return true
  if (/\b(?:cad|usd|eur|gbp|aud)\s*\d/i.test(normalized)) return true
  if (/\b000\s+cad\b/i.test(normalized)) return true
  if (/\b110\s+000\b/i.test(normalized)) return true

  return false
}

/** True when a term is posting metadata, not a job competency. */
export function isNonCompetencyMetadata(term: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return true

  if (hasCurrencyDigitMix(normalized)) return true

  for (const pattern of NON_COMPETENCY_PATTERNS) {
    if (pattern.test(normalized)) return true
    pattern.lastIndex = 0
  }

  const tokens = tokenize(normalized)
  if (tokens.length <= 4 && tokens.some((token) => NON_COMPETENCY_TOKEN_SET.has(token))) {
    if (
      tokens.some((token) => NON_COMPETENCY_TOKEN_SET.has(token)) &&
      (tokens.some((token) => /\d/.test(token)) ||
        normalized.includes('leave') ||
        normalized.includes('vacation') ||
        normalized.includes('salary') ||
        normalized.includes('benefit') ||
        normalized.includes('compensation'))
    ) {
      return true
    }
  }

  return false
}

export function filterCompetencyKeywords(terms: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const term of terms) {
    const trimmed = term.trim()
    if (!trimmed || isNonCompetencyMetadata(trimmed)) continue

    const key = normalizeTerm(trimmed)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

export function filterCompetencyTargetSkills<T extends { term: string }>(skills: T[]): T[] {
  return skills.filter((skill) => !isNonCompetencyMetadata(skill.term))
}
