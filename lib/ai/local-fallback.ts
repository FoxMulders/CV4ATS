import type { AiGenerationResult, TailoredResume } from '@/lib/ai/schemas'
import { applyGenerationHygiene } from '@/lib/ai/generation-hygiene'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { buildCoreCompetencyChecklist } from '@/lib/resume/core-competency-checklist'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import {
  isSummaryLikeLine,
  isValidExperienceBullet,
} from '@/lib/resume/contact-extraction'
import {
  resolveCandidateNameFromSource,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'
import {
  extractCompanyFromDescription,
  extractJobTitleFromDescription,
  sanitizeJobTitleForProse,
} from '@/lib/resume/extract-job-title'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { injectIntoTailoredResume } from '@/lib/resume/tailored-resume-injection'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'

const LOCAL_KEYWORD_TARGETS = [
  'agile',
  'kanban',
  'jira',
  'linear',
  'github',
  'automation',
  'scope management',
  'program management',
  'workflows',
  'waterfall',
  'scrum',
  'sdlc',
  'release management',
] as const

const KEYWORD_SOUP =
  /(?:utilizing|leveraging|delivering)\s+.+\s+(?:utilizing|leveraging|delivering)|initiatives with measurable impact|aligned to business outcomes/i

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

function resolveContactName(resume: TailoredResume, sourceResumeText: string): string {
  return sanitizeCandidateName(resume.contact.name, sourceResumeText)
}

function pickProofBullet(resume: TailoredResume, sourceResumeText: string): string | null {
  for (const entry of resume.experience) {
    for (const bullet of entry.bullets) {
      if (
        bullet.length >= 35 &&
        bullet.length <= 220 &&
        isRealExperienceBullet(bullet) &&
        !isSummaryLikeLine(bullet, resume.summary) &&
        !KEYWORD_SOUP.test(bullet)
      ) {
        if (/\d|%/.test(bullet)) return bullet
      }
    }
  }

  const bullets = sourceResumeText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(stripBullet)
    .filter((line) => line.length >= 35 && line.length <= 220)
    .filter((line) => !KEYWORD_SOUP.test(line))
    .filter(isValidExperienceBullet)
    .filter((line) => isRealExperienceBullet(line))
    .filter((line) => !isSummaryLikeLine(line, resume.summary))

  return bullets.find((line) => /\d|%/.test(line)) ?? bullets[0] ?? null
}

function pickRecentRole(resume: TailoredResume) {
  return (
    resume.experience.find(
      (entry) =>
        entry.company.trim() &&
        !/previous employer|independent|confidential|see resume/i.test(entry.company) &&
        entry.title !== 'Professional Experience' &&
        entry.bullets.length > 0
    ) ?? resume.experience[0]
  )
}

function formatContactHeader(resume: TailoredResume, name: string): string[] {
  const lines: string[] = [name]
  const contactParts = [
    resume.contact.location,
    resume.contact.phone,
    resume.contact.email,
    resume.contact.linkedin,
  ].filter((part) => part?.trim())

  if (contactParts.length > 0) {
    lines.push(contactParts.join(' | '))
  }

  return lines
}

function buildLocalCoverLetter(
  resume: TailoredResume,
  jobDescription: string,
  sourceResumeText: string
): string {
  const role = sanitizeJobTitleForProse(extractJobTitleFromDescription(jobDescription))
  const company = extractCompanyFromDescription(jobDescription)
  const name = resolveContactName(resume, sourceResumeText)
  const recentRole = pickRecentRole(resume)
  const proofBullet = pickProofBullet(resume, sourceResumeText)
  const salutation = company ? `Dear ${company} Hiring Team,` : 'Dear Hiring Manager,'

  const opening = company
    ? `I am interested in the ${role} role at ${company}, with a track record in technical program delivery, release coordination, and cross-functional execution.`
    : `I am interested in the ${role} role, with a track record in technical program delivery, release coordination, and cross-functional execution.`

  const roleContext =
    recentRole?.company?.trim() &&
    !/previous employer|independent|confidential|see resume/i.test(recentRole.company)
      ? ` as ${recentRole.title} at ${recentRole.company}`
      : recentRole?.title?.trim() && recentRole.title !== 'Professional Experience'
        ? ` as ${recentRole.title}`
        : ''

  const experienceParagraph = roleContext
    ? `In my recent work${roleContext}, I focused on shipping reliable releases, tightening delivery workflows, and aligning engineering, product, and operations stakeholders.${
        proofBullet ? ` One measurable result: ${proofBullet}` : ''
      }`
    : proofBullet
      ? `One measurable delivery result from my background: ${proofBullet}`
      : `My recent work centers on release coordination, delivery risk reduction, and measurable improvements to engineering throughput.`

  const toolingParagraph =
    role.toLowerCase().includes('program manager') && resume.skills.length > 0
      ? `I have hands-on experience with ${resume.skills
          .filter((skill) => /linear|github|jira|release|agile|aws|automation/i.test(skill))
          .slice(0, 4)
          .join(', ')} in prior release and delivery programs.`
      : ''

  const close = company
    ? `I am ready to discuss how this background maps to ${company}'s ${role} delivery priorities.`
    : `I am ready to discuss how this background maps to your team's delivery priorities.`

  return [
    ...formatContactHeader(resume, name),
    '',
    '[Date]',
    '',
    salutation,
    '',
    opening,
    '',
    experienceParagraph,
    ...(toolingParagraph ? ['', toolingParagraph] : []),
    '',
    close,
    '',
    'Sincerely,',
    name,
  ].join('\n')
}

/**
 * Rule-based tailoring when free-tier AI providers return 429/quota errors.
 * Parses resume text, injects missing keywords deterministically, and builds ATS report.
 */
export function generateTailoredResumeLocally(
  jobDescription: string,
  resumeText: string
): AiGenerationResult {
  const checklist = buildCoreCompetencyChecklist(jobDescription, resumeText)
  const jdTargets = checklist.allTerms
  const priorityMissing = [
    ...new Set([
      ...checklist.missingTerms,
      ...LOCAL_KEYWORD_TARGETS.filter(
        (term) =>
          new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(jobDescription) &&
          !resumeText.toLowerCase().includes(term.toLowerCase())
      ),
    ]),
  ]

  let tailoredResume = parseResumeTextToTailoredResume(resumeText)

  const injection = injectIntoTailoredResume(
    tailoredResume,
    keywordsToTargetSkills(priorityMissing.length > 0 ? priorityMissing : [...LOCAL_KEYWORD_TARGETS]),
    { skillsOnly: true }
  )
  tailoredResume = injection.resume

  for (const term of jdTargets) {
    if (!tailoredResume.skills.some((skill) => skill.toLowerCase().includes(term.toLowerCase()))) {
      const stillMissing = !injection.injectedSkills.includes(term)
      if (stillMissing && priorityMissing.includes(term)) {
        tailoredResume.skills.push(term.charAt(0).toUpperCase() + term.slice(1))
      }
    }
  }

  const serialized = [
    tailoredResume.summary,
    tailoredResume.skills.join(' '),
    ...tailoredResume.experience.flatMap((entry) => entry.bullets),
  ].join('\n')

  const keywordReport = scoreAtsCompliance(serialized, jobDescription)

  const normalizedDraft = normalizeGenerationDraftForApi(
    {
      tailoredResume,
      keywordReport,
      coverLetter: '',
    },
    resumeText
  )

  const coverLetter = buildLocalCoverLetter(
    normalizedDraft.tailoredResume,
    jobDescription,
    resumeText
  )

  return applyGenerationHygiene(
    {
      ...normalizedDraft,
      coverLetter,
    },
    resumeText
  )
}

export function refineTailoredResumeLocally(
  jobDescription: string,
  sourceResumeText: string,
  _currentScore: number,
  _missingKeywords: string[]
): AiGenerationResult {
  return generateTailoredResumeLocally(jobDescription, sourceResumeText)
}
