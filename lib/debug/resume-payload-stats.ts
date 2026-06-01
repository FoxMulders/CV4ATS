import { parseExperienceFromLines } from '@/lib/resume/parse-experience-blocks'

/** Summarize raw resume text for debug baseline logs. */
export function describeResumePayloadStats(resumeText: string): string {
  const trimmed = resumeText.trim()
  if (!trimmed) {
    return 'Parsed 0 Work Experience blocks, 0 initial bullets detected'
  }

  const lines = trimmed.replace(/\r\n/g, '\n').split('\n')
  const experience = parseExperienceFromLines(lines)
  const bulletCount = experience.reduce((sum, entry) => sum + (entry.bullets?.length ?? 0), 0)

  if (experience.length > 0) {
    return `Parsed ${experience.length} Work Experience block${experience.length === 1 ? '' : 's'}, ${bulletCount} initial bullet${bulletCount === 1 ? '' : 's'} detected`
  }

  const bulletLines = lines.filter((line) => /^[\s•\-*–—]\s*\S/.test(line.trim())).length
  return `Parsed 0 structured Work Experience blocks, ${bulletLines} bullet-line${bulletLines === 1 ? '' : 's'} detected in raw text`
}
