export type EdmontonEmployerSector =
  | 'corporate'
  | 'utilities'
  | 'public-sector'
  | 'higher-education'
  | 'healthcare'
  | 'energy'
  | 'financial'
  | 'consulting'
  | 'education-k12'

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

/** Major Edmonton-area employers scanned for open roles across sectors. */
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
  {
    id: 'ahs',
    name: 'Alberta Health Services',
    aliases: ['AHS', 'Alberta Health Services - IT', 'Alberta Health Services AHS'],
    sector: 'healthcare',
    searchKeywords: ['Alberta Health Services', 'AHS'],
    portalIdentifiers: ['careers.albertahealthservices.ca', 'albertahealthservices.ca/careers'],
    careersUrl: 'https://careers.albertahealthservices.ca/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Alberta Health Services IT project manager SDLC application development digital' },
      { type: 'careers-portal', endpoint: 'https://careers.albertahealthservices.ca/' },
    ],
  },
  {
    id: 'goa',
    name: 'Government of Alberta',
    aliases: [
      'Government of Alberta',
      'Alberta Public Service',
      'Alberta Government',
      'GoA',
      'Government of Alberta - Technology and Innovation',
    ],
    sector: 'public-sector',
    searchKeywords: ['Government of Alberta', 'Alberta Public Service'],
    portalIdentifiers: ['jobs.alberta.ca', 'alberta.ca/jobs'],
    careersUrl: 'https://www.alberta.ca/jobs',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Government of Alberta IT project manager SDLC application development software delivery' },
      { type: 'careers-portal', endpoint: 'https://www.alberta.ca/jobs' },
    ],
  },
  {
    id: 'epcor',
    name: 'EPCOR',
    aliases: ['EPCOR Utilities', 'EPCOR Water Services', 'EPCOR Technologies'],
    sector: 'utilities',
    searchKeywords: ['EPCOR'],
    portalIdentifiers: ['epcor.com/careers', 'careers.epcor.com'],
    careersUrl: 'https://www.epcor.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'EPCOR IT project manager application development software delivery SDLC' },
      { type: 'careers-portal', endpoint: 'https://www.epcor.com/careers' },
    ],
  },
  {
    id: 'atb',
    name: 'ATB Financial',
    aliases: ['ATB', 'Alberta Treasury Branches', 'ATB Financial - Technology'],
    sector: 'financial',
    searchKeywords: ['ATB Financial', 'ATB'],
    portalIdentifiers: ['atb.com/careers', 'careers.atb.com'],
    careersUrl: 'https://www.atb.com/company/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'ATB Financial IT project manager software delivery SDLC application development' },
      { type: 'careers-portal', endpoint: 'https://www.atb.com/company/careers/' },
    ],
  },
  {
    id: 'stantec',
    name: 'Stantec',
    aliases: ['Stantec Consulting', 'Stantec Inc.', 'Stantec - Digital Services'],
    sector: 'consulting',
    searchKeywords: ['Stantec'],
    portalIdentifiers: ['stantec.com/careers', 'stantec.jobs'],
    careersUrl: 'https://www.stantec.com/en/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Stantec IT project manager software developer application development SDLC Edmonton' },
      { type: 'careers-portal', endpoint: 'https://www.stantec.com/en/careers' },
    ],
  },
  {
    id: 'abc',
    name: 'Alberta Blue Cross',
    aliases: ['Alberta Blue Cross - IT', 'ABC Benefits Corporation'],
    sector: 'financial',
    searchKeywords: ['Alberta Blue Cross'],
    portalIdentifiers: ['ab.bluecross.ca/careers', 'bluecross.ca/careers'],
    careersUrl: 'https://www.ab.bluecross.ca/about-us/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Alberta Blue Cross IT project manager application development software delivery' },
      { type: 'careers-portal', endpoint: 'https://www.ab.bluecross.ca/about-us/careers/' },
    ],
  },
  {
    id: 'enbridge',
    name: 'Enbridge',
    aliases: ['Enbridge Inc.', 'Enbridge - IT', 'Enbridge Gas'],
    sector: 'energy',
    searchKeywords: ['Enbridge'],
    portalIdentifiers: ['enbridge.com/careers', 'jobs.enbridge.com'],
    careersUrl: 'https://www.enbridge.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Enbridge IT project manager SDLC application development software delivery Alberta' },
      { type: 'careers-portal', endpoint: 'https://www.enbridge.com/careers' },
    ],
  },
  {
    id: 'suncor',
    name: 'Suncor Energy',
    aliases: ['Suncor', 'Suncor Energy Inc.', 'Suncor - Technology'],
    sector: 'energy',
    searchKeywords: ['Suncor Energy', 'Suncor'],
    portalIdentifiers: ['suncor.com/careers', 'jobs.suncor.com'],
    careersUrl: 'https://www.suncor.com/en-ca/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Suncor IT project manager application development software delivery SDLC Alberta' },
      { type: 'careers-portal', endpoint: 'https://www.suncor.com/en-ca/careers' },
    ],
  },
  {
    id: 'cnrl',
    name: 'Canadian Natural Resources',
    aliases: ['Canadian Natural', 'CNRL', 'Canadian Natural Resources Limited'],
    sector: 'energy',
    searchKeywords: ['Canadian Natural Resources', 'CNRL', 'Canadian Natural'],
    portalIdentifiers: ['canadiannatural.com/careers', 'cnrl.com/careers'],
    careersUrl: 'https://www.canadiannatural.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Canadian Natural Resources IT project manager software delivery SDLC application' },
      { type: 'careers-portal', endpoint: 'https://www.canadiannatural.com/careers' },
    ],
  },
  {
    id: 'cenovus',
    name: 'Cenovus Energy',
    aliases: ['Cenovus', 'Cenovus Energy Inc.'],
    sector: 'energy',
    searchKeywords: ['Cenovus Energy', 'Cenovus'],
    portalIdentifiers: ['cenovus.com/careers', 'jobs.cenovus.com'],
    careersUrl: 'https://www.cenovus.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Cenovus IT project manager application development software delivery SDLC' },
      { type: 'careers-portal', endpoint: 'https://www.cenovus.com/careers' },
    ],
  },
  {
    id: 'pembina',
    name: 'Pembina Pipeline',
    aliases: ['Pembina', 'Pembina Pipeline Corporation'],
    sector: 'energy',
    searchKeywords: ['Pembina Pipeline', 'Pembina'],
    portalIdentifiers: ['pembina.com/careers', 'jobs.pembina.com'],
    careersUrl: 'https://www.pembina.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Pembina Pipeline IT project manager software delivery application development' },
      { type: 'careers-portal', endpoint: 'https://www.pembina.com/careers' },
    ],
  },
  {
    id: 'capital-power',
    name: 'Capital Power',
    aliases: ['Capital Power Corporation'],
    sector: 'energy',
    searchKeywords: ['Capital Power'],
    portalIdentifiers: ['capitalpower.com/careers', 'jobs.capitalpower.com'],
    careersUrl: 'https://www.capitalpower.com/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Capital Power IT project manager application development software delivery SDLC' },
      { type: 'careers-portal', endpoint: 'https://www.capitalpower.com/careers/' },
    ],
  },
  {
    id: 'imperial-oil',
    name: 'Imperial Oil',
    aliases: ['Imperial Oil Limited', 'Imperial - IT'],
    sector: 'energy',
    searchKeywords: ['Imperial Oil'],
    portalIdentifiers: ['imperialoil.ca/careers', 'jobs.exxonmobil.com/imperial'],
    careersUrl: 'https://www.imperialoil.ca/en-ca/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Imperial Oil IT project manager software delivery application development SDLC' },
      { type: 'careers-portal', endpoint: 'https://www.imperialoil.ca/en-ca/careers' },
    ],
  },
  {
    id: 'ama',
    name: 'Alberta Motor Association',
    aliases: ['AMA', 'Alberta Motor Association - IT'],
    sector: 'corporate',
    searchKeywords: ['Alberta Motor Association', 'AMA'],
    portalIdentifiers: ['ama.ab.ca/careers', 'careers.ama.ab.ca'],
    careersUrl: 'https://ama.ab.ca/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Alberta Motor Association IT project manager software developer application development' },
      { type: 'careers-portal', endpoint: 'https://ama.ab.ca/careers' },
    ],
  },
  {
    id: 'epsb',
    name: 'Edmonton Public Schools',
    aliases: ['EPSB', 'Edmonton Public School Board', 'Edmonton Public Schools - IT'],
    sector: 'education-k12',
    searchKeywords: ['Edmonton Public Schools', 'EPSB'],
    portalIdentifiers: ['epsb.ca/careers', 'eps.ca/careers'],
    careersUrl: 'https://www.epsb.ca/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Edmonton Public Schools IT project manager application development software delivery' },
      { type: 'careers-portal', endpoint: 'https://www.epsb.ca/careers/' },
    ],
  },
  {
    id: 'servus',
    name: 'Servus Credit Union',
    aliases: ['Servus', 'Servus Credit Union - Technology'],
    sector: 'financial',
    searchKeywords: ['Servus Credit Union', 'Servus'],
    portalIdentifiers: ['servus.ca/careers', 'careers.servus.ca'],
    careersUrl: 'https://www.servus.ca/about-us/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Servus Credit Union IT project manager software delivery application development' },
      { type: 'careers-portal', endpoint: 'https://www.servus.ca/about-us/careers' },
    ],
  },
  {
    id: 'cgi',
    name: 'CGI',
    aliases: ['CGI Group', 'CGI Inc.', 'CGI - Edmonton'],
    sector: 'consulting',
    searchKeywords: ['CGI'],
    portalIdentifiers: ['cgi.com/careers', 'jobs.cgi.com'],
    careersUrl: 'https://www.cgi.com/en/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'CGI IT project manager software developer application development SDLC Edmonton' },
      { type: 'careers-portal', endpoint: 'https://www.cgi.com/en/careers' },
    ],
  },
  {
    id: 'ibm',
    name: 'IBM',
    aliases: ['IBM Canada', 'IBM - Edmonton', 'International Business Machines'],
    sector: 'consulting',
    searchKeywords: ['IBM', 'IBM Canada'],
    portalIdentifiers: ['ibm.com/careers', 'careers.ibm.com'],
    careersUrl: 'https://www.ibm.com/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'IBM IT project manager software delivery application development SDLC Edmonton Alberta' },
      { type: 'careers-portal', endpoint: 'https://www.ibm.com/careers' },
    ],
  },
  {
    id: 'accenture',
    name: 'Accenture',
    aliases: ['Accenture Canada', 'Accenture - Edmonton'],
    sector: 'consulting',
    searchKeywords: ['Accenture'],
    portalIdentifiers: ['accenture.com/careers', 'jobs.accenture.com'],
    careersUrl: 'https://www.accenture.com/ca-en/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Accenture IT project manager software delivery application development SDLC Edmonton' },
      { type: 'careers-portal', endpoint: 'https://www.accenture.com/ca-en/careers' },
    ],
  },
  {
    id: 'deloitte',
    name: 'Deloitte',
    aliases: ['Deloitte Canada', 'Deloitte - Edmonton', 'Deloitte Digital'],
    sector: 'consulting',
    searchKeywords: ['Deloitte'],
    portalIdentifiers: ['deloitte.com/careers', 'jobs.deloitte.com'],
    careersUrl: 'https://www.deloitte.com/ca/en/careers.html',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Deloitte IT project manager software delivery application development SDLC Edmonton' },
      { type: 'careers-portal', endpoint: 'https://www.deloitte.com/ca/en/careers.html' },
    ],
  },
  {
    id: 'norquest',
    name: 'NorQuest College',
    aliases: ['NorQuest', 'NorQuest College - IT'],
    sector: 'higher-education',
    searchKeywords: ['NorQuest College', 'NorQuest'],
    portalIdentifiers: ['norquest.ca/careers', 'careers.norquest.ca'],
    careersUrl: 'https://www.norquest.ca/about/careers.aspx',
    hiringSources: [
      { type: 'adzuna', endpoint: 'NorQuest College IT project manager software developer application development' },
      { type: 'careers-portal', endpoint: 'https://www.norquest.ca/about/careers.aspx' },
    ],
  },
  {
    id: 'concordia-edmonton',
    name: 'Concordia University of Edmonton',
    aliases: ['Concordia Edmonton', 'Concordia University Edmonton', 'CUE'],
    sector: 'higher-education',
    searchKeywords: ['Concordia University of Edmonton', 'Concordia Edmonton'],
    portalIdentifiers: ['concordia.ab.ca/careers', 'cue.ac/careers'],
    careersUrl: 'https://www.concordia.ab.ca/about/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Concordia University of Edmonton IT project manager application development' },
      { type: 'careers-portal', endpoint: 'https://www.concordia.ab.ca/about/careers/' },
    ],
  },
  {
    id: 'rogers',
    name: 'Rogers Communications',
    aliases: ['Rogers', 'Shaw Communications', 'Rogers Business', 'Rogers - Edmonton'],
    sector: 'corporate',
    searchKeywords: ['Rogers Communications', 'Rogers', 'Shaw'],
    portalIdentifiers: ['jobs.rogers.com', 'rogers.com/careers'],
    careersUrl: 'https://jobs.rogers.com/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Rogers IT project manager software developer application development SDLC Edmonton' },
      { type: 'careers-portal', endpoint: 'https://jobs.rogers.com/' },
    ],
  },
  {
    id: 'alberta-innovates',
    name: 'Alberta Innovates',
    aliases: ['Alberta Innovates - Technology Futures', 'AI Alberta Innovates'],
    sector: 'public-sector',
    searchKeywords: ['Alberta Innovates'],
    portalIdentifiers: ['albertainnovates.ca/careers', 'careers.albertainnovates.ca'],
    careersUrl: 'https://albertainnovates.ca/careers/',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Alberta Innovates IT project manager software delivery application development' },
      { type: 'careers-portal', endpoint: 'https://albertainnovates.ca/careers/' },
    ],
  },
  {
    id: 'parkland',
    name: 'Parkland Corporation',
    aliases: ['Parkland', 'Parkland Fuel Corporation'],
    sector: 'energy',
    searchKeywords: ['Parkland Corporation', 'Parkland'],
    portalIdentifiers: ['parkland.ca/careers', 'careers.parkland.ca'],
    careersUrl: 'https://www.parkland.ca/careers',
    hiringSources: [
      { type: 'adzuna', endpoint: 'Parkland Corporation IT project manager software delivery application development' },
      { type: 'careers-portal', endpoint: 'https://www.parkland.ca/careers' },
    ],
  },
]

export const EDMONTON_EMPLOYER_NAMES = EDMONTON_EMPLOYER_TARGETS.map((employer) => employer.name)

export const EDMONTON_EMPLOYER_SECTOR_LABELS: Record<EdmontonEmployerSector, string> = {
  corporate: 'Corporate',
  utilities: 'Utilities',
  'public-sector': 'Public sector',
  'higher-education': 'Higher education',
  healthcare: 'Healthcare',
  energy: 'Energy',
  financial: 'Financial services',
  consulting: 'Consulting & IT services',
  'education-k12': 'K-12 education',
}

export function groupEmployersBySector(): Array<{
  sector: EdmontonEmployerSector
  label: string
  employers: EdmontonEmployerTarget[]
}> {
  const order: EdmontonEmployerSector[] = [
    'public-sector',
    'healthcare',
    'utilities',
    'energy',
    'financial',
    'corporate',
    'consulting',
    'higher-education',
    'education-k12',
  ]

  return order
    .map((sector) => ({
      sector,
      label: EDMONTON_EMPLOYER_SECTOR_LABELS[sector],
      employers: EDMONTON_EMPLOYER_TARGETS.filter((employer) => employer.sector === sector),
    }))
    .filter((group) => group.employers.length > 0)
}

export function formatEmployerScanLabel(limit = 4): string {
  const preview = EDMONTON_EMPLOYER_NAMES.slice(0, limit).join(', ')
  const remaining = EDMONTON_EMPLOYER_TARGETS.length - limit
  if (remaining <= 0) return preview
  return `${preview}, and ${remaining} more Edmonton-area employers`
}

/** Optional role keywords appended to employer-targeted Adzuna searches. */
export const EDMONTON_ROLE_SEARCH_TERMS = [
  'jobs',
  'careers',
  'openings',
  'full time',
  'contract',
] as const

export function buildEmployerSearchQuery(
  employer: EdmontonEmployerTarget,
  roleQuery = ''
): string {
  const employerTerm = employer.searchKeywords[0] ?? employer.name
  const role = roleQuery.trim()
  return role ? `${employerTerm} ${role}` : `${employerTerm} careers jobs`
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
