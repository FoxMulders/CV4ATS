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

function buildLocalCoverLetter(
  resume: TailoredResume,
  jobDescription: string,
  matchedKeywords: string[]
): string {
  const role = extractJobTitle(jobDescription)
  const highlights = matchedKeywords.slice(0, 6).join(', ') || 'delivery leadership and technical program execution'

  return [
    `Dear Hiring Manager,`,
    '',
    `I am writing to express my interest in the ${role} opportunity. With a background spanning ${resume.experience[0]?.title ?? 'senior technical delivery'} at ${resume.experience[0]?.company ?? 'enterprise organizations'}, I bring proven experience aligning teams, scope, and outcomes to business priorities.`,
    '',
    `My recent work emphasizes ${highlights}. I am confident this experience maps directly to your requirements and would allow me to contribute quickly to delivery momentum, stakeholder alignment, and measurable results.`,
    '',
    `Thank you for your consideration. I welcome the opportunity to discuss how my background supports your team's goals.`,
    '',
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
