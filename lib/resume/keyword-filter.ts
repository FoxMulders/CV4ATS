import { isStopWord, phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

const IRRELEVANT_TERMS = new Set([
  'about',
  'above',
  'across',
  'after',
  'also',
  'and',
  'any',
  'applicant',
  'applicants',
  'application',
  'applications',
  'apply',
  'applying',
  'are',
  'authorization',
  'authorized',
  'background',
  'been',
  'being',
  'benefit',
  'benefits',
  'bonus',
  'bonuses',
  'both',
  'but',
  'can',
  'candidate',
  'candidates',
  'check',
  'checks',
  'citizenship',
  'click',
  'closing',
  'com',
  'compensation',
  'contact',
  'could',
  'curriculum',
  'cv',
  'deadline',
  'description',
  'disability',
  'diversity',
  'drug',
  'eeo',
  'eligible',
  'eligibility',
  'email',
  'employer',
  'employment',
  'equal',
  'etc',
  'ethnicity',
  'expired',
  'expires',
  'fax',
  'full',
  'gender',
  'help',
  'here',
  'hire',
  'hires',
  'hiring',
  'hourly',
  'hours',
  'how',
  'http',
  'https',
  'hybrid',
  'inclusion',
  'inclusive',
  'including',
  'information',
  'interview',
  'interviewing',
  'interviews',
  'into',
  'its',
  'job',
  'jobs',
  'join',
  'just',
  'legally',
  'like',
  'location',
  'make',
  'member',
  'members',
  'more',
  'must',
  'not',
  'note',
  'notes',
  'off',
  'offer',
  'offered',
  'offers',
  'office',
  'opening',
  'openings',
  'opportunity',
  'organization',
  'others',
  'our',
  'out',
  'over',
  'part',
  'phone',
  'please',
  'portal',
  'position',
  'positions',
  'post',
  'posted',
  'posting',
  'postings',
  'preferred',
  'qualification',
  'qualifications',
  'qualified',
  'race',
  'recruiter',
  'recruiters',
  'recruiting',
  'recruitment',
  'remote',
  'required',
  'requirement',
  'requirements',
  'resume',
  'role',
  'salary',
  'screen',
  'screening',
  'should',
  'site',
  'sponsor',
  'sponsored',
  'sponsorship',
  'submit',
  'submission',
  'submissions',
  'such',
  'team',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'through',
  'time',
  'today',
  'using',
  'very',
  'veteran',
  'veterans',
  'visa',
  'vitae',
  'was',
  'website',
  'week',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'will',
  'with',
  'within',
  'work',
  'would',
  'www',
  'year',
  'years',
  'your',
])

const IRRELEVANT_PHRASE_PATTERNS = [
  /\bequal opportunity\b/gi,
  /\bhow to apply\b/gi,
  /\bphone screen\b/gi,
  /\bpanel interview\b/gi,
  /\bbackground check\b/gi,
  /\bdrug screen(?:ing)?\b/gi,
  /\bwork authorization\b/gi,
  /\bvisa sponsorship\b/gi,
  /\baccommodation(?:s)?\b/gi,
  /\bapply (?:now|today|online)\b/gi,
  /\bjob posting\b/gi,
  /\bjob description\b/gi,
  /\bcover letter\b/gi,
  /\bsubmit (?:your )?application\b/gi,
  /\bonly (?:shortlisted|selected) candidates\b/gi,
]

function normalizeKeyword(term: string): string {
  return phraseWithoutStopWords(term)
}

export function isRelevantJobKeyword(term: string): boolean {
  const normalized = normalizeKeyword(term)
  if (!normalized || normalized.length < 2) return false

  for (const pattern of IRRELEVANT_PHRASE_PATTERNS) {
    if (pattern.test(normalized)) return false
    pattern.lastIndex = 0
  }

  if (IRRELEVANT_TERMS.has(normalized)) return false
  if (isStopWord(normalized)) return false

  const tokens = tokenize(normalized)
  if (tokens.length === 0) return false
  if (tokens.every((token) => IRRELEVANT_TERMS.has(token) || isStopWord(token))) {
    return false
  }

  if (tokens.length === 1 && isStopWord(tokens[0]!)) return false

  return true
}

export function filterRelevantKeywords(terms: string[]): string[] {
  const seen = new Set<string>()
  const filtered: string[] = []

  for (const term of terms) {
    const normalized = normalizeKeyword(term)
    if (!isRelevantJobKeyword(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    filtered.push(normalized)
  }

  return filtered
}

export function stripIrrelevantJobDescriptionText(jobDescription: string): string {
  let text = jobDescription
  for (const pattern of IRRELEVANT_PHRASE_PATTERNS) {
    text = text.replace(pattern, ' ')
    pattern.lastIndex = 0
  }
  return text.replace(/\s+/g, ' ').trim()
}
