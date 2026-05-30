import type { AiGenerationResult, TailoredResume } from '@/lib/ai/schemas'
import { buildCoreCompetencyChecklist } from '@/lib/resume/core-competency-checklist'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import {
  extractCompanyFromDescription,
  extractJobTitleFromDescription,
} from '@/lib/resume/extract-job-title'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { injectIntoTailoredResume } from '@/lib/resume/tailored-resume-injection'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'

const LOCAL_KEYWORD_TARGETS = [
  'agile',
  'kanban',
  'jira',
  'automation',
  'scope',
  'program management',
  'workflows',
  'waterfall',
  'scrum',
  'sdlc',
] as const

const KEYWORD_SOUP =
  /(?:utilizing|leveraging|delivering)\s+.+\s+(?:utilizing|leveraging|delivering)|initiatives with measurable impact|aligned to business outcomes/i

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

function titleCaseName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function resolveContactName(resume: TailoredResume, sourceResumeText: string): string {
  if (resume.contact.name && resume.contact.name !== 'Professional Candidate') {
    return resume.contact.name
  }

  const lines = sourceResumeText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const capsName = lines.find(
    (line) =>
      /^[A-Z][A-Z\s.'-]{2,50}$/.test(line) &&
      line.split(/\s+/).length <= 5 &&
      !line.includes('@')
  )
  if (capsName) return titleCaseName(capsName)

  return resume.contact.name || 'Candidate'
}

function pickProofBullet(sourceResumeText: string): string | null {
  const bullets = sourceResumeText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(stripBullet)
    .filter((line) => line.length >= 35 && line.length <= 220)
    .filter((line) => !KEYWORD_SOUP.test(line))

  return bullets[0] ?? null
}

function pickRecentRole(resume: TailoredResume) {
  return (
    resume.experience.find(
      (entry) =>
        entry.company !== 'Previous Employer' &&
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
  const role = extractJobTitleFromDescription(jobDescription)
  const company = extractCompanyFromDescription(jobDescription)
  const name = resolveContactName(resume, sourceResumeText)
  const recentRole = pickRecentRole(resume)
  const proofBullet = pickProofBullet(sourceResumeText)
  const salutation = company ? `Dear ${company} Hiring Team,` : 'Dear Hiring Manager,'

  const opening = company
    ? `The ${role} opening at ${company} aligns with my track record in technical program delivery, release coordination, and cross-functional execution.`
    : `The ${role} opening aligns with my track record in technical program delivery, release coordination, and cross-functional execution.`

  const experienceParagraph = recentRole
    ? `In my recent work as ${recentRole.title} at ${recentRole.company}, I focused on shipping reliable releases, tightening delivery workflows, and aligning engineering, product, and operations stakeholders.${
        proofBullet ? ` One example: ${proofBullet}` : ''
      }`
    : proofBullet
      ? `A recent example from my work: ${proofBullet}`
      : `My recent work centers on release coordination, delivery risk reduction, and measurable improvements to engineering throughput.`

  const close = company
    ? `I would welcome a conversation about how this experience can support ${company}'s ${role} priorities.`
    : `I would welcome a conversation about how this experience can support your team's priorities.`

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
    keywordsToTargetSkills(priorityMissing.length > 0 ? priorityMissing : [...LOCAL_KEYWORD_TARGETS])
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
  const coverLetter = buildLocalCoverLetter(tailoredResume, jobDescription, resumeText)

  return {
    tailoredResume,
    keywordReport,
    coverLetter,
  }
}

export function refineTailoredResumeLocally(
  jobDescription: string,
  sourceResumeText: string,
  _currentScore: number,
  _missingKeywords: string[]
): AiGenerationResult {
  return generateTailoredResumeLocally(jobDescription, sourceResumeText)
}
