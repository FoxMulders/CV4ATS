import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'

export interface PanelExperienceQuestion {
  id: string
  skillOrTool: string
  panelSource: string
  panelExcerpt: string
  question: string
}

const KNOWN_TOOLS = [
  'GitHub Actions',
  'GitLab CI',
  'GitLab',
  'Azure DevOps',
  'Jenkins',
  'CircleCI',
  'TeamCity',
  'Bamboo',
  'Argo CD',
  'Spinnaker',
  'Terraform',
  'Kubernetes',
  'Docker',
  'Ansible',
  'Puppet',
  'Chef',
  'AWS',
  'Azure',
  'GCP',
  'Jira',
  'Confluence',
  'ServiceNow',
  'Splunk',
  'Datadog',
] as const

const TOPIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bCI\/CD\b/i, label: 'CI/CD pipelines' },
  { pattern: /\bcontinuous integration\b/i, label: 'Continuous integration' },
  { pattern: /\bcontinuous delivery\b/i, label: 'Continuous delivery' },
  { pattern: /\brelease automation\b/i, label: 'Release automation' },
  { pattern: /\bDevOps\b/i, label: 'DevOps' },
  { pattern: /\bplatform engineering\b/i, label: 'Platform engineering' },
  { pattern: /\bproduct ownership\b/i, label: 'Product ownership' },
  { pattern: /\bprogram management\b/i, label: 'Program management' },
]

const GAP_SIGNAL =
  /\b(lacking|lacks|lack|missing|without evidence|not supported|only shows|claims? .{0,80} but|no mention of|could not find|did not see|insufficient)\b/i

const LIKE_TOOLS_PATTERN = /\blike\s+([^.)]+)/i
const CLAIMED_SKILL_PATTERN = /claims?\s+['"]([^'"]+)['"]/i

function truncateExcerpt(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function extractToolsFromText(text: string): string[] {
  const found = new Set<string>()

  for (const tool of KNOWN_TOOLS) {
    if (new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      found.add(tool)
    }
  }

  const likeMatch = text.match(LIKE_TOOLS_PATTERN)
  if (likeMatch?.[1]) {
    for (const part of likeMatch[1].split(/,|\bor\b/)) {
      const trimmed = part.trim()
      if (trimmed.length >= 3) found.add(trimmed)
    }
  }

  return [...found]
}

function extractTopicsFromText(text: string): string[] {
  const topics: string[] = []
  for (const { pattern, label } of TOPIC_PATTERNS) {
    if (pattern.test(text)) topics.push(label)
  }
  return topics
}

function buildQuestion(skillOrTool: string): string {
  return `The hiring panel could not find evidence for "${skillOrTool}" in your work history. Describe a real project where you used it — include the employer/context, what you built or ran, and the outcome.`
}

function addQuestion(
  questions: PanelExperienceQuestion[],
  seen: Set<string>,
  input: { skillOrTool: string; panelSource: string; panelExcerpt: string }
) {
  const key = input.skillOrTool.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)

  questions.push({
    id: `panel-exp-${questions.length}-${key.replace(/\W+/g, '-')}`,
    skillOrTool: input.skillOrTool,
    panelSource: input.panelSource,
    panelExcerpt: truncateExcerpt(input.panelExcerpt),
    question: buildQuestion(input.skillOrTool),
  })
}

function parsePanelTextBlock(
  text: string,
  panelSource: string,
  questions: PanelExperienceQuestion[],
  seen: Set<string>
) {
  if (!GAP_SIGNAL.test(text)) return

  const claimed = text.match(CLAIMED_SKILL_PATTERN)?.[1]?.trim()
  if (claimed) {
    addQuestion(questions, seen, {
      skillOrTool: claimed,
      panelSource,
      panelExcerpt: text,
    })
  }

  for (const tool of extractToolsFromText(text)) {
    addQuestion(questions, seen, {
      skillOrTool: tool,
      panelSource,
      panelExcerpt: text,
    })
  }

  for (const topic of extractTopicsFromText(text)) {
    addQuestion(questions, seen, {
      skillOrTool: topic,
      panelSource,
      panelExcerpt: text,
    })
  }
}

/**
 * Builds follow-up questions when the hiring panel flags skills/tools that are not
 * evidenced in the resume (e.g. Jenkins CI/CD claimed in skills but not in bullets).
 */
export function detectPanelExperienceGaps(
  panel: HiringPanelSessionResult,
  maxQuestions = 4
): PanelExperienceQuestion[] {
  if (panel.reviewFailed || panel.unanimousApproval) return []

  const questions: PanelExperienceQuestion[] = []
  const seen = new Set<string>()

  for (const manager of panel.managers.filter((m) => !m.approved)) {
    parsePanelTextBlock(manager.comment, manager.managerRole, questions, seen)
    if (questions.length >= maxQuestions) return questions.slice(0, maxQuestions)
  }

  for (const recommendation of panel.revisionRecommendations) {
    parsePanelTextBlock(recommendation, 'Panel recommendation', questions, seen)
    if (questions.length >= maxQuestions) return questions.slice(0, maxQuestions)
  }

  return questions.slice(0, maxQuestions)
}

export function formatPanelExperienceSupplement(
  answers: Array<{ skillOrTool: string; panelSource: string; answer: string }>
): string {
  return answers
    .filter((entry) => entry.answer.trim().length >= 10)
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.skillOrTool} (flagged by ${entry.panelSource}): ${entry.answer.trim()}`
    )
    .join('\n')
}

export function mergeUserSupplements(
  achievementSupplement?: string,
  experienceSupplement?: string
): string {
  const blocks = [
    achievementSupplement?.trim()
      ? `ACHIEVEMENT METRICS:\n${achievementSupplement.trim()}`
      : '',
    experienceSupplement?.trim()
      ? `PANEL-VERIFIED EXPERIENCE (ground truth — weave into work history bullets and cover letter):\n${experienceSupplement.trim()}`
      : '',
  ].filter(Boolean)

  return blocks.join('\n\n')
}
