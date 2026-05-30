import type { TailoredResume } from '@/lib/ai/schemas'
import {
  inferNameFromEmail,
  isSummaryLikeLine,
  isValidExperienceBullet,
  titleCaseName,
} from '@/lib/resume/contact-extraction'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'

const KEYWORD_SOUP =
  /(?:utilizing|leveraging|delivering)\s+.+\s+(?:utilizing|leveraging|delivering)|initiatives with measurable impact|aligned to business outcomes/i

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

function resolveContactName(resume: TailoredResume, sourceResumeText: string): string {
  const current = resume.contact.name.trim()
  if (
    current &&
    current !== 'Professional Candidate' &&
    !/^Bradmulder/i.test(current) &&
    !current.split(/\s+/).some((part) => part.length === 1)
  ) {
    return current
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

  const fromEmail = inferNameFromEmail(resume.contact.email)
  if (fromEmail) return fromEmail

  return current || 'Candidate'
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

/** Deterministic cover letter using isolated job title / company primitives. */
export function buildFallbackCoverLetter(
  resume: TailoredResume,
  jobDescription: string,
  sourceResumeText: string
): string {
  const { jobTitle: role, companyName: company } = extractCleanJobContext(jobDescription)
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
