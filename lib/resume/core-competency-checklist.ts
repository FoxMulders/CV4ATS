import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { getScoringKeywordTargets } from '@/lib/resume/scoring-keyword-targets'
import type { TargetSkill } from '@/lib/resume/skill-extrapolation'
import { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'

/** Priority industry terms always evaluated for the Core Competency Checklist. */
export const PRIORITY_COMPETENCY_TERMS = [
  'kanban',
  'agile',
  'waterfall',
  'jira',
  'scope management',
  'scope',
  'program management',
  'workflows',
  'automation',
  'scrum',
  'sdlc',
  'devops',
  'ai agents',
  'internal tools',
  'strategy',
  'product owner',
  'backlog',
  'roadmap',
  'custom software',
] as const

export interface CoreCompetencyChecklist {
  allTerms: string[]
  missingTerms: string[]
  priorityTerms: string[]
}

export function buildCoreCompetencyChecklist(
  jobDescription: string,
  resumeText: string,
  extrapolatedSkills?: TargetSkill[]
): CoreCompetencyChecklist {
  const skills = extrapolatedSkills ?? extrapolateTargetSkills(jobDescription)
  const extractedTerms = skills.map((skill) => skill.term)
  const scoringTerms = getScoringKeywordTargets(jobDescription)

  const priorityFromJd = PRIORITY_COMPETENCY_TERMS.filter((term) =>
    keywordMatchesResume(jobDescription, term)
  )

  const allTerms = [...new Set([...scoringTerms, ...priorityFromJd, ...extractedTerms])]
  const missingTerms = allTerms.filter((term) => !keywordMatchesResume(resumeText, term))

  return {
    allTerms,
    missingTerms,
    priorityTerms: priorityFromJd,
  }
}

export function formatChecklistForPrompt(checklist: CoreCompetencyChecklist): string {
  if (checklist.allTerms.length === 0) {
    return 'No explicit competency checklist extracted — prioritize methodologies and tools from the job description.'
  }

  const lines = [
    'CORE COMPETENCY CHECKLIST (derived from job description — ignore conversational stop-words):',
    `All ATS targets: ${checklist.allTerms.join(', ')}`,
  ]

  if (checklist.priorityTerms.length > 0) {
    lines.push(`Priority terms: ${checklist.priorityTerms.join(', ')}`)
  }

  if (checklist.missingTerms.length > 0) {
    lines.push(
      `MANDATORY WEAVE (absent from source — each must appear verbatim or naturally in summary, skills, or bullets): ${checklist.missingTerms.join(', ')}`
    )
  }

  return lines.join('\n')
}
