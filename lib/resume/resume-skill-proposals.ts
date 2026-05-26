import { keywordMatchesResume } from '@/lib/resume/keyword-matcher'
import { extractCuratedSkillMatches } from '@/lib/resume/keyword-extraction'
import { filterProposableSkills } from '@/lib/resume/proposed-skill-filter'
import {
  extractExplicitTargetSkills,
  keywordsToTargetSkills,
  type TargetSkill,
} from '@/lib/resume/skill-extrapolation'
import { tokenize } from '@/lib/resume/stopwords'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|work experience|experience|employment|education|certifications?)\s*:?\s*$/i

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function extractSection(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((line) => heading.test(line.trim()))
  if (start < 0) return []

  const content: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    if (SECTION_HEADING.test(line)) break
    content.push(line)
  }

  return content
}

function normalizeTerm(term: string): string {
  return tokenize(term).join(' ')
}

export function parseListedSkillTerms(resumeText: string): string[] {
  const lines = splitLines(resumeText)
  const section = extractSection(lines, /^skills|technical skills|core competencies|competencies/i)
  const source =
    section.length > 0
      ? section
      : lines.filter((line) => /[,;|]/.test(line) && line.length < 120).slice(0, 2)

  return [
    ...new Set(
      source
        .flatMap((line) => line.split(/[,;|•]/))
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 1 && skill.length < 48)
    ),
  ]
}

function splitSkillsAndBody(resumeText: string): { skillsText: string; bodyText: string } {
  const lines = splitLines(resumeText)
  const skillsStart = lines.findIndex((line) =>
    /^skills|technical skills|core competencies|competencies/i.test(line.trim())
  )

  if (skillsStart < 0) {
    return { skillsText: '', bodyText: resumeText }
  }

  const skillsLines: string[] = []
  let sectionEnd = skillsStart + 1
  for (; sectionEnd < lines.length; sectionEnd += 1) {
    const line = lines[sectionEnd]?.trim() ?? ''
    if (!line) continue
    if (SECTION_HEADING.test(line)) break
    skillsLines.push(lines[sectionEnd]!)
  }

  const bodyLines = [...lines.slice(0, skillsStart), ...lines.slice(sectionEnd)]

  return {
    skillsText: skillsLines.join('\n'),
    bodyText: bodyLines.join('\n'),
  }
}

function isListedSkill(term: string, listedTerms: string[], skillsText: string): boolean {
  const normalized = normalizeTerm(term)
  if (!normalized) return true

  for (const listed of listedTerms) {
    if (normalizeTerm(listed) === normalized) return true
  }

  return skillsText.trim().length > 0 && keywordMatchesResume(skillsText, term)
}

function extractDemonstratedSkills(bodyText: string, resumeText: string): TargetSkill[] {
  const rawTerms = [
    ...extractCuratedSkillMatches(bodyText),
    ...extractExplicitTargetSkills(bodyText).map((skill) => skill.term),
  ]
  const filtered = filterProposableSkills(rawTerms, resumeText)
  return keywordsToTargetSkills(filtered)
}

/**
 * Infer skills demonstrated in experience/summary that are not yet listed
 * in the resume's skills section.
 */
export function extrapolateProposedSkillsFromResume(resumeText: string): TargetSkill[] {
  const trimmed = resumeText.trim()
  if (!trimmed) return []

  const { skillsText, bodyText } = splitSkillsAndBody(trimmed)
  const listedTerms = parseListedSkillTerms(trimmed)
  const implied = extractDemonstratedSkills(bodyText, trimmed)

  return implied.filter(
    (skill) => !isListedSkill(skill.term, listedTerms, skillsText)
  )
}

export function appendSkillsToResumeText(resumeText: string, skillsToAdd: string[]): string {
  const additions = [
    ...new Set(skillsToAdd.map((skill) => skill.trim()).filter(Boolean)),
  ]
  if (additions.length === 0) return resumeText

  const lines = splitLines(resumeText)
  const skillsIndex = lines.findIndex((line) =>
    /^skills|technical skills|core competencies|competencies/i.test(line.trim())
  )

  if (skillsIndex >= 0) {
    let insertAt = skillsIndex + 1
    while (insertAt < lines.length) {
      const line = lines[insertAt]?.trim() ?? ''
      if (!line) {
        insertAt += 1
        continue
      }
      if (SECTION_HEADING.test(line)) break
      insertAt += 1
    }

    const additionLine = additions.join(', ')
    const nextLines = [...lines]
    nextLines.splice(insertAt, 0, additionLine)
    return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  const block = ['', 'SKILLS', additions.join(', ')]
  return `${resumeText.trim()}${block.join('\n')}`
}

export function formatProposedSkillsField(skills: string[]): string {
  return skills.join(', ')
}

export function parseProposedSkillsField(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;\n|]/)
        .map((skill) => skill.trim())
        .filter(Boolean)
    ),
  ]
}
