export {
  categorizePositionDomain,
  DOMAIN_LABELS,
  type ProfessionalDomain,
} from '@/lib/resume/structured-resume-document'

import {
  mapStructuredExperienceToDomainMap,
  parseStructuredResumeDocument,
  type ProfessionalDomain,
} from '@/lib/resume/structured-resume-document'

export interface MappedBullet {
  lineIndex: number
  text: string
  bulletIndex: number
}

export interface MappedPosition {
  id: string
  title: string
  company: string
  domain: ProfessionalDomain
  domainLabel: string
  headerLineIndex: number
  bullets: MappedBullet[]
  bodyText: string
}

export interface ResumeDomainMap {
  positions: MappedPosition[]
  lines: string[]
}

/**
 * Resume mapping pass — uses structured parsing so contact metadata and raw dates
 * never become false company anchors.
 */
export function mapResumeDomains(resumeText: string): ResumeDomainMap {
  const document = parseStructuredResumeDocument(resumeText)
  return mapStructuredExperienceToDomainMap(document)
}
