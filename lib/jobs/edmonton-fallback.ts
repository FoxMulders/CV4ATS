import type { JobListing } from '@/lib/jobs/types'

/** Active Edmonton-area project management listings validated May 24, 2026. */
export const EDMONTON_PM_JOBS: JobListing[] = [
  {
    id: 'gov-ab-infrastructure-pm',
    title: 'Project Manager',
    company: 'Government of Alberta — Alberta Infrastructure',
    location: 'Edmonton, AB (also Calgary, Red Deer)',
    employmentType: 'Full-time (Permanent & Temporary)',
    salary: '$99,348 – $133,694/year',
    postedDate: 'May 6, 2026',
    closingDate: 'Open until suitable candidate is found',
    applyUrl: 'https://jobpostings.alberta.ca/job/Edmonton%2C-Calgary-Project-Manager/601328117/',
    source: 'Alberta Public Service',
    description: `Alberta Infrastructure leads development of the provincial Capital Plan and manages government-owned facilities including schools and hospitals.

Responsibilities:
- Lead capital project planning, delivery, and stakeholder coordination across provincial infrastructure portfolios
- Manage scope, schedule, budget, risk, and quality for complex public-sector construction programs
- Collaborate with ministries, consultants, contractors, and internal teams to deliver projects on time and within budget
- Provide project governance, reporting, and executive briefings on project status and risks
- Ensure compliance with provincial policies, procurement rules, and fiscal accountability standards

Requirements:
- University graduation in a field related to the position (e.g. Engineering or Architecture) plus 4 years directly related experience
- Experience managing large, multi-stakeholder infrastructure or capital projects
- Strong leadership, communication, analytical, and problem-solving skills
- PMP or construction contract administrator certification is an asset`,
  },
  {
    id: 'gov-ab-infrastructure-senior-pm',
    title: 'Senior Project Manager',
    company: 'Government of Alberta — Alberta Infrastructure',
    location: 'Edmonton, AB (also Calgary, Red Deer, Lethbridge)',
    employmentType: 'Full-time (Permanent & Temporary)',
    salary: '$108,763 – $148,399/year',
    postedDate: 'May 6, 2026',
    closingDate: 'Open until suitable candidate is found',
    applyUrl: 'https://jobpostings.alberta.ca/job/Edmonton%2C-Calgary-Senior-Project-Manager/601326517/',
    source: 'Alberta Public Service',
    description: `Senior Project Manager accountable for delivery of safe, functional, high-quality capital facilities for Alberta Education and school jurisdictions. Projects range from $1M to over $60M.

Responsibilities:
- Lead a team of Project Managers and manage assigned capital projects end-to-end
- Define project requirements with clients and coordinate consultants, contractors, and internal teams
- Manage design, procurement, construction, commissioning, and warranty phases
- Control project expenditures, contractual commitments, and stakeholder communications
- Ensure compliance with government legislation, policies, and building codes

Requirements:
- University degree in Architecture, Engineering, or Architectural Technology plus 6 years directly related experience
- Valid Class 5 driver's licence; 25–50% travel required
- Construction Contract Administrator or Project Management certification is an asset
- Experience managing interdisciplinary teams and diverse building project portfolios`,
  },
  {
    id: 'gov-ab-forestry-pm',
    title: 'Project Manager',
    company: 'Government of Alberta — Forestry and Parks',
    location: 'Edmonton, AB (also Red Deer and other Alberta locations)',
    employmentType: 'Permanent Full-time',
    salary: '$82,317 – $108,090/year',
    postedDate: 'May 8, 2026',
    closingDate: 'Open until suitable candidate is found',
    applyUrl: 'https://jobpostings.alberta.ca/job/Edmonton-Project-Manager/599732517/',
    source: 'Alberta Public Service',
    description: `Construction Project Manager to lead complex capital infrastructure projects on Crown land in Alberta's parks and public lands. Projects range from ~$50K to $5M across civil, structural, architectural, mechanical, and electrical disciplines.

Responsibilities:
- Manage planning, execution, control, close-out, and handover within approved scope, budget, and schedule
- Oversee design processes, procurement, contract administration, and consultant/contractor performance
- Conduct site inspections and prepare status reports for senior leadership
- Mitigate risks and ensure compliance with ministry policies and regulatory standards

Requirements:
- Four-year degree in engineering or science plus 4+ years managing capital infrastructure or construction projects (diploma equivalency considered)
- Valid Class 5 driver's licence
- PMP/CAPM certification and public-sector capital project experience are assets`,
  },
  {
    id: 'randstad-pm-remote',
    title: 'Project Manager (Remote)',
    company: 'Randstad — Alberta Financial Services Client',
    location: 'Edmonton, AB (Remote within Alberta)',
    employmentType: 'Contract (10 months)',
    salary: '$87 – $103/hour',
    postedDate: 'April 17, 2026',
    closingDate: 'July 16, 2026',
    applyUrl: 'https://www.randstad.com/jobs/project-manager-remote_edmonton_46758524/',
    source: 'Randstad Canada',
    description: `Project Manager needed for a 10-month contract with an Alberta-based financial institution, focused on IT projects with business process and organizational change components.

Responsibilities:
- Collaborate with Program Manager on quality standards and portfolio alignment
- Develop and execute detailed project plans including resources, timelines, and budget
- Proactively identify and mitigate risks; deliver data-driven status and financial reports
- Lead cross-functional teams and external vendors to meet milestones

Requirements:
- 6+ years leading IT projects with focus on business process and organizational change
- Strong stakeholder management and vendor leadership experience
- Experience in financial services is an asset`,
  },
]

export function searchEdmontonPmJobs(query?: string): JobListing[] {
  const normalizedQuery = (query ?? 'project manager').toLowerCase()

  return EDMONTON_PM_JOBS.filter((job) => {
    const haystack = `${job.title} ${job.company} ${job.description}`.toLowerCase()
    const terms = normalizedQuery.split(/\s+/).filter(Boolean)
    return terms.every((term) => haystack.includes(term) || term === 'project' || term === 'manager')
  })
}

function parseClosingDate(closingDate?: string): boolean {
  if (!closingDate) return true
  const lower = closingDate.toLowerCase()
  if (lower.includes('open until')) return true

  const parsed = Date.parse(closingDate)
  if (Number.isNaN(parsed)) return true

  const today = new Date('2026-05-24T00:00:00')
  return parsed >= today.getTime()
}

/** Returns only jobs whose closing date has not passed (as of May 24, 2026). */
export function getActiveEdmontonPmJobs(query?: string): JobListing[] {
  return searchEdmontonPmJobs(query).filter((job) => parseClosingDate(job.closingDate))
}
