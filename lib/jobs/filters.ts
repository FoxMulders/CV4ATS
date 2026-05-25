import type { JobListing } from '@/lib/jobs/types'
import { resolveTargetEmployer } from '@/lib/jobs/edmonton-employers'

export const EDMONTON_LOCATION = 'Edmonton, AB'

const NON_EDMONTON_LOCATION_PATTERNS = [
  /\bcalgary\b/i,
  /\bred\s+deer\b/i,
  /\blethbridge\b/i,
  /\bfort\s+mcmurray\b/i,
  /\bvancouver\b/i,
  /\btoronto\b/i,
  /\bottawa\b/i,
  /\bwinnipeg\b/i,
  /\bmontreal\b/i,
  /\bremote\s*[-–—]\s*(?:us|usa|united\s+states)\b/i,
  /\b(?:us|usa|united\s+states)\s+only\b/i,
  /\b(?:uk|united\s+kingdom|europe)\s+only\b/i,
]

const EXCLUDE_PATTERNS = [
  /\bcyber\s*security\b/i,
  /\binformation\s+security\b/i,
  /\b(?:^|\s)grc\b/i,
  /\bgovernance,?\s+risk\b/i,
  /\bsecurity\s+analyst\b/i,
  /\bsecurity\s+architect\b/i,
  /\bsap\b/i,
  /\berp\b/i,
  /\bworkday\b/i,
  /\bsalesforce\s+(?:implementation|migration|administrator)\b/i,
  /\bconstruction\b/i,
  /\bcivil\s+engineering\b/i,
  /\bcapital\s+infrastructure\b/i,
  /\bbuilding\s+facilities?\b/i,
  /\bcommercial\s+or\s+institutional\s+construction\b/i,
  /\barchitectural\s+technology\b/i,
  /\bcommissioning\s+and\s+warranty\b/i,
  /\bsite\s+inspections?\b/i,
  /\bforestry\s+and\s+parks\b/i,
  /\balberta\s+infrastructure\b/i,
  /\bsupplement\s+an\s+erp\s+team\b/i,
  /\bfield\s+operations?\b/i,
  /\bline\s*(?:worker|person|technician)\b/i,
  /\blineworker\b/i,
  /\bpower\s+line\b/i,
  /\bwarehouse\b/i,
  /\btruck\s+driver\b/i,
  /\bheavy\s+equipment\b/i,
  /\bpipefitter\b/i,
  /\belectrician\s+(?:journeyman|apprentice)\b/i,
  /\bgas\s+(?:fitter|technician)\b/i,
  /\bwater\s+works?\b/i,
  /\broad\s+maintenance\b/i,
  /\btransmission\s+(?:line|tower)\b/i,
  /\bdistribution\s+operator\b/i,
  /\bplant\s+operator\b/i,
  /\bscada\s+operator\b/i,
  /\bfield\s+service\s+technician\b/i,
  /\bcivil\s+technologist\b/i,
  /\bsurvey(?:or|ing)\b/i,
  /\blandscap(?:e|ing)\b/i,
  /\bjanitor(?:ial)?\b/i,
  /\bhousekeep(?:ing|er)\b/i,
  /\bretail\s+(?:associate|clerk)\b/i,
  /\bcall\s+center\s+agent\b/i,
  /\bbusiness\s+development\s+(?:manager|representative|director)\b/i,
  /\bproperty\s+developer\b/i,
  /\bland\s+developer\b/i,
  /\breal\s+estate\s+developer\b/i,
]

const INCLUDE_PATTERNS = [
  /\bsdlc\b/i,
  /\bsoftware\s+(?:development|operations|delivery|engineer(?:ing)?)\b/i,
  /\bapplication\s+(?:development|delivery|focused|installs?|developer)\b/i,
  /\bagile\b/i,
  /\bscrum\b/i,
  /\bdevops\b/i,
  /\bdelivery\s+(?:management|lead|manager|leadership)\b/i,
  /\brelease\s+(?:operations|management|planning)\b/i,
  /\bit\s+project\b/i,
  /\btechnical\s+project\b/i,
  /\bdigital\s+(?:modernization|platforms?|services?|transformation)\b/i,
  /\bcase\s+management\s+system\b/i,
  /\bsoftware\s+installs?\b/i,
  /\bmobile\s+development\b/i,
  /\bcustom\s+builds?\b/i,
  /\bcross-functional\s+(?:teams?|delivery)\b/i,
  /\bprogram\s+management\b/i,
  /\bsystem\s+(?:enhancements?|implementation)\b/i,
  /\b(?:software|application|full[\s-]?stack|web|mobile|\.net|java|python|typescript|react)\s+developer\b/i,
  /\b(?:automation|workflow)\s+(?:engineer|developer|architect|specialist|analyst|lead)\b/i,
  /\b(?:platform|cloud|integration)\s+(?:engineer|developer|architect|specialist)\b/i,
  /\b(?:business|systems?)\s+analyst\b.*\b(?:software|application|it|technology|system)\b/i,
  /\b(?:internal\s+tools?|low[\s-]?code|workflow\s+automation)\b/i,
]

const PM_TITLE_PATTERN =
  /\b(?:senior\s+|intermediate\s+|it\s+|technical\s+|digital\s+|application\s+)?project\s+manager\b|\bprogram\s+manager\b|\b(?:agile|delivery|software|technology)\s+manager\b/i

const DEVELOPER_TITLE_PATTERN =
  /\b(?:senior\s+|intermediate\s+|lead\s+|principal\s+|staff\s+)?(?:software|application|full[\s-]?stack|web|mobile|\.net|java|python|typescript|react|platform|cloud|integration)\s+(?:developer|engineer)\b/i

const AUTOMATION_TITLE_PATTERN =
  /\b(?:automation|workflow|devops|platform|release|delivery)\s+(?:engineer|developer|architect|specialist|analyst|lead|manager)\b/i

const IT_LEADERSHIP_TITLE_PATTERN =
  /\b(?:it|technical|technology|digital|software|application)\s+(?:director|lead|consultant|specialist|coordinator)\b/i

const TECH_ROLE_TITLE_PATTERNS = [
  PM_TITLE_PATTERN,
  DEVELOPER_TITLE_PATTERN,
  AUTOMATION_TITLE_PATTERN,
  IT_LEADERSHIP_TITLE_PATTERN,
]

function hasAlbertaOverlap(job: JobListing): boolean {
  const haystack = `${job.location} ${job.description} ${job.company}`
  return (
    /\b(?:alberta|ab\b|edmonton|sherwood\s+park|st\.?\s*albert)\b/i.test(haystack) ||
    resolveTargetEmployer(job.company, job.applyUrl) !== null
  )
}

export function isEdmontonAreaJob(job: JobListing): boolean {
  const location = job.location.trim()
  if (!location) return hasAlbertaOverlap(job)

  if (NON_EDMONTON_LOCATION_PATTERNS.some((pattern) => pattern.test(location))) {
    return false
  }

  if (/\bedmonton\b/i.test(location)) {
    return true
  }

  if (
    /\bremote\b/i.test(location) &&
    (/\b(?:canada|alberta|ab)\b/i.test(location) || hasAlbertaOverlap(job))
  ) {
    return true
  }

  return (
    /\bedmonton\s+metro\b/i.test(location) ||
    /\bsherwood\s+park\b/i.test(location) ||
    /\bst\.?\s*albert\b/i.test(location) ||
    /\bspruce\s+grove\b/i.test(location) ||
    /\bleduc\b/i.test(location) ||
    (/\b(?:ab|alberta)\b/i.test(location) && hasAlbertaOverlap(job))
  )
}

function titleMatchesTechRole(title: string): boolean {
  return TECH_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(title))
}

export function isSdlcItPmRole(job: JobListing): boolean {
  const haystack = `${job.title} ${job.company} ${job.description}`

  if (!titleMatchesTechRole(job.title)) {
    return false
  }

  if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false
  }

  return INCLUDE_PATTERNS.some((pattern) => pattern.test(haystack))
}

export function filterSdlcItPmJobs(jobs: JobListing[]): JobListing[] {
  return jobs.filter((job) => isEdmontonAreaJob(job) && isSdlcItPmRole(job))
}

export const SDLC_SEARCH_QUERY =
  'IT project manager software developer application development SDLC agile automation workflow delivery'

export const SDLC_FILTER_LABEL =
  'Edmonton, AB & Remote (Canada/Alberta) · PM · Developer · Automation · SDLC · Delivery'
