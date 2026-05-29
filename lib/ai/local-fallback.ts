import type { AiGenerationResult, TailoredResume } from '@/lib/ai/schemas'
import { buildCoreCompetencyChecklist } from '@/lib/resume/core-competency-checklist'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
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

function extractJobTitle(jobDescription: string): string {
  const titleMatch = jobDescription.match(/Job Title:\s*(.+)/i)
  if (titleMatch?.[1]) return titleMatch[1].trim()

  const firstLine = jobDescription.split('\n').find((line) => line.trim().length > 0)
  return firstLine?.trim().slice(0, 80) ?? 'this role'
}

function formatContactHeader(resume: TailoredResume): string[] {
  const lines: string[] = [resume.contact.name]
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
  matchedKeywords: string[]
): string {
  const role = extractJobTitle(jobDescription)
  const recentRole = resume.experience[0]
  const topBullet = recentRole?.bullets[0]?.trim()
  const proofKeywords =
    matchedKeywords.slice(0, 5).join(', ') ||
    'delivery leadership, technical program execution, and process optimization'

  const hook =
    `Delivering on ${role} commitments rarely fails in the planning deck—it fails when teams cannot translate scope into shippable work under real constraints.`

  const proofOne =
    `${recentRole?.title ?? 'Senior delivery leadership'} at ${recentRole?.company ?? 'enterprise organizations'} sharpened that instinct: strategic ownership over checklist execution.${topBullet ? ` One concrete win: ${topBullet}` : ''}`

  const proofTwo =
    `Recent work maps directly to ${proofKeywords}. Bottlenecks get removed, workflows tightened, and manual drag replaced with durable automation when cycles are at stake. Capacity gets evaluated with engineering fluency; architectural risk gets surfaced before it hits the roadmap.`

  const close =
    `A brief conversation on how that execution-first approach supports your ${role} priorities would be worth the time.`

  return [
    ...formatContactHeader(resume),
    '',
    'Dear Hiring Manager,',
    '',
    hook,
    '',
    proofOne,
    '',
    proofTwo,
    '',
    close,
    '',
    'Sincerely,',
    resume.contact.name,
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
  const coverLetter = buildLocalCoverLetter(
    tailoredResume,
    jobDescription,
    keywordReport.matchedKeywords
  )

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
  missingKeywords: string[]
): AiGenerationResult {
  return generateTailoredResumeLocally(jobDescription, sourceResumeText)
}
