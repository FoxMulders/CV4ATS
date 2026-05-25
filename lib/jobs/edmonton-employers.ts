export type EdmontonEmployerSector =
  | 'corporate'
  | 'utilities'
  | 'public-sector'
  | 'higher-education'

export type HiringSourceType = 'adzuna' | 'careers-portal' | 'rss'

export interface EmployerHiringSource {
  type: HiringSourceType
  /** Adzuna `what` query, RSS URL, or careers portal URL depending on type. */
  endpoint: string
  /** Optional extra Adzuna exclude terms for this source. */
  whatExclude?: string
}

export interface EdmontonEmployerTarget {
  id: string
  name: string
  aliases: string[]
  sector: EdmontonEmployerSector
  searchKeywords: string[]
  portalIdentifiers: string[]
  careersUrl: string
  /** Structured hiring sources used by the aggregation layer. */
  hiringSources: EmployerHiringSource[]
}

/** Major Edmonton-area employers for SDLC, IT, and project management hiring. */
export const EDMONTON_EMPLOYER_TARGETS: EdmontonEmployerTarget[] = [
  {
    id: 'atco',
    name: 'ATCO',
    aliases: [
      'ATCO Ltd',
      'ATCO Ltd.',
      'ATCO Electric',
      'ATCO Gas',
      'ATCO Pipelines',
      'ATCO Energy',
      'Canadian Utilities',
      'Canadian Utilities Limited',
    ],
    sector: 'utilities',
    searchKeywords: ['ATCO', 'Canadian Utilities'],
    portalIdentifiers: ['careers.atco.com', 'atco.com/careers', 'atco.com/en-ca/careers'],
    careersUrl: 'https://careers.atco.com/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'ATCO IT project manager SDLC application development software delivery' },
      { type: 'careers-portal', endpoint: 'https://careers.atco.com/' },
    ],
  },
  {
    id: 'telus',
    name: 'TELUS',
    aliases: ['Telus', 'TELUS Communications', 'TELUS Health', 'TELUS International'],
    sector: 'corporate',
    searchKeywords: ['TELUS', 'Telus'],
    portalIdentifiers: ['careers.telus.com', 'telus.com/careers'],
    careersUrl: 'https://careers.telus.com/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'TELUS project manager software developer automation workflow SDLC' },
      { type: 'careers-portal', endpoint: 'https://careers.telus.com/' },
    ],
  },
  {
    id: 'direct-energy',
    name: 'Direct Energy',
    aliases: ['Direct Energy Marketing', 'Direct Energy LP', 'Direct Energy Services'],
    sector: 'utilities',
    searchKeywords: ['Direct Energy'],
    portalIdentifiers: ['directenergy.com/careers', 'nexteraenergyservices.com'],
    careersUrl: 'https://www.directenergy.com/about/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Direct Energy IT project manager application development software delivery' },
      { type: 'careers-portal', endpoint: 'https://www.directenergy.com/about/careers' },
    ],
  },
  {
    id: 'city-of-edmonton',
    name: 'City of Edmonton',
    aliases: ['The City of Edmonton', 'City of Edmonton - Corporate Services', 'City of Edmonton IT'],
    sector: 'public-sector',
    searchKeywords: ['City of Edmonton'],
    portalIdentifiers: ['jobboard.edmonton.ca', 'edmonton.ca/city-government/careers'],
    careersUrl: 'https://www.edmonton.ca/city-government/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'City of Edmonton IT project manager SDLC application development digital' },
      { type: 'careers-portal', endpoint: 'https://www.edmonton.ca/city-government/careers' },
    ],
  },
  {
    id: 'uof-a',
    name: 'University of Alberta',
    aliases: [
      'University of Alberta',
      'U of A',
      'UofA',
      'UAlberta',
      'University of Alberta - Information Services and Technology',
      'University of Alberta IST',
    ],
    sector: 'higher-education',
    searchKeywords: ['University of Alberta', 'U of A', 'UofA'],
    portalIdentifiers: ['careers.ualberta.ca', 'ualberta.ca/careers'],
    careersUrl: 'https://careers.ualberta.ca/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'University of Alberta IT project manager software developer SDLC application' },
      { type: 'careers-portal', endpoint: 'https://careers.ualberta.ca/' },
    ],
  },
  {
    id: 'nait',
    name: 'NAIT',
    aliases: ['NAIT', 'Northern Alberta Institute of Technology', 'NAIT - Information Technology'],
    sector: 'higher-education',
    searchKeywords: ['NAIT', 'Northern Alberta Institute of Technology'],
    portalIdentifiers: ['nait.ca/careers', 'careers.nait.ca'],
    careersUrl: 'https://www.nait.ca/about/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'NAIT IT project manager software developer application development SDLC' },
      { type: 'careers-portal', endpoint: 'https://www.nait.ca/about/careers' },
    ],
  },
  {
    id: 'macewan',
    name: 'MacEwan University',
    aliases: ['MacEwan', 'Grant MacEwan University', 'MacEwan University - IT Services'],
    sector: 'higher-education',
    searchKeywords: ['MacEwan University', 'MacEwan'],
    portalIdentifiers: ['macewan.ca/careers', 'careers.macewan.ca'],
    careersUrl: 'https://www.macewan.ca/about/campus/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'MacEwan University IT project manager software developer SDLC application' },
      { type: 'careers-portal', endpoint: 'https://www.macewan.ca/about/campus/careers/' },
    ],
  },
]

export const EDMONTON_EMPLOYER_NAMES = EDMONTON_EMPLOYER_TARGETS.map((employer) => employer.name)

/** Role title fragments combined with employer names in targeted Adzuna queries. */
export const EDMONTON_ROLE_SEARCH_TERMS = [
  'project manager',
  'program manager',
  'delivery manager',
  'software developer',
  'application developer',
  'automation',
  'workflow',
  'SDLC',
  'application development',
  'software delivery',
  'IT project',
  'agile delivery',
  'devops',
] as const

export function buildEmployerSearchQuery(employer: EdmontonEmployerTarget): string {
  const adzunaSource = employer.hiringSources.find((source) => source.type === 'adzuna')
  if (adzunaSource) return adzunaSource.endpoint

  const employerTerms = employer.searchKeywords.map((term) => `"${term}"`).join(' OR ')
  const roleTerms = EDMONTON_ROLE_SEARCH_TERMS.join(' ')
  return `(${employerTerms}) ${roleTerms}`
}

export function getEmployerAdzunaSources(employer: EdmontonEmployerTarget): EmployerHiringSource[] {
  return employer.hiringSources.filter((source) => source.type === 'adzuna')
}

function normalizeEmployerText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function resolveTargetEmployer(
  company: string,
  applyUrl?: string
): EdmontonEmployerTarget | null {
  const haystack = normalizeEmployerText(`${company} ${applyUrl ?? ''}`)

  for (const employer of EDMONTON_EMPLOYER_TARGETS) {
    const needles = [employer.name, ...employer.aliases, ...employer.searchKeywords]
    if (needles.some((needle) => haystack.includes(normalizeEmployerText(needle)))) {
      return employer
    }

    if (employer.portalIdentifiers.some((portal) => haystack.includes(normalizeEmployerText(portal)))) {
      return employer
    }
  }

  return null
}

export function isTargetEmployerJob(company: string, applyUrl?: string): boolean {
  return resolveTargetEmployer(company, applyUrl) !== null
}

export function getEmployerDisplayName(employerId: string): string | undefined {
  return EDMONTON_EMPLOYER_TARGETS.find((employer) => employer.id === employerId)?.name
}
