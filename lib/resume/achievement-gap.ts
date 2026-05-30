import { QUANTIFIED_METRIC_PATTERN } from '@/lib/resume/cover-letter-compliance'

export interface AchievementGapQuestion {
  id: string
  context: string
  question: string
  bulletPreview: string
}

const ROLE_LINE =
  /^(.{4,100}?)\s*(?:—|–|-|\|)\s*(.{2,100}?)(?:\s*\|\s*(.+))?\s*$/

const BULLET_LINE = /^[•\-*–—]\s*/

function truncatePreview(text: string, maxLength = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

function bulletHasMetric(text: string): boolean {
  return QUANTIFIED_METRIC_PATTERN.test(text)
}

/**
 * Finds resume accomplishment lines without quantified outcomes and returns
 * targeted questions so the user can supply metrics before generation.
 */
export function detectAchievementGaps(
  resumeText: string,
  maxQuestions = 4
): AchievementGapQuestion[] {
  const questions: AchievementGapQuestion[] = []
  let currentRole = 'Recent role'
  let currentCompany = ''

  for (const rawLine of resumeText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const roleMatch = line.match(ROLE_LINE)
    if (roleMatch && !BULLET_LINE.test(line)) {
      currentRole = roleMatch[1]?.trim() || currentRole
      currentCompany = roleMatch[2]?.trim() || currentCompany
      continue
    }

    if (!BULLET_LINE.test(line)) continue

    const bullet = line.replace(BULLET_LINE, '').trim()
    if (bullet.length < 24 || bulletHasMetric(bullet)) continue

    const context =
      currentCompany && currentRole
        ? `${currentRole} at ${currentCompany}`
        : currentCompany || currentRole

    questions.push({
      id: `gap-${questions.length}-${context.slice(0, 24).replace(/\W+/g, '-')}`,
      context,
      bulletPreview: truncatePreview(bullet),
      question: `What measurable outcome supports this accomplishment? (e.g., hours saved per week, % faster releases, team size, budget, uptime, volume handled)`,
    })

    if (questions.length >= maxQuestions) break
  }

  return questions
}

export function formatAchievementSupplement(
  answers: Array<{ context: string; bulletPreview: string; answer: string }>
): string {
  const lines = answers
    .map(({ context, bulletPreview, answer }) => answer.trim())
    .filter(Boolean)
    .map(
      (answer, index) =>
        `${index + 1}. ${answers[index]!.context} — "${truncatePreview(answers[index]!.bulletPreview, 80)}": ${answer}`
    )

  return lines.join('\n')
}
