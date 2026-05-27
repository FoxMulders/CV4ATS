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

export type SkillsListFormat = {
  delimiter: string
  casing: 'preserve' | 'title' | 'lower' | 'upper'
}

function inferSkillCasingStyle(existingSkills: string[]): SkillsListFormat['casing'] {
  if (existingSkills.length === 0) return 'preserve'

  const sample = existingSkills.slice(0, 8)
  if (sample.every((skill) => skill === skill.toUpperCase() && /[A-Z]/.test(skill))) {
    return 'upper'
  }
  if (sample.every((skill) => skill === skill.toLowerCase())) {
    return 'lower'
  }
  if (
    sample.every((skill) =>
      skill
        .split(/\s+/)
        .every((word) => word.charAt(0) === word.charAt(0).toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())
    )
  ) {
    return 'title'
  }

  return 'preserve'
}

export function detectSkillsListFormat(
  resumeText: string,
  existingSkills: string[] = []
): SkillsListFormat {
  const lines = splitLines(resumeText)
  const section = extractSection(lines, /^skills|technical skills|core competencies|competencies/i)
  const skillsBlock = section.join('\n')
  const casing = inferSkillCasingStyle(existingSkills)

  if (skillsBlock.includes(' • ')) return { delimiter: ' • ', casing }
  if (/\s\|\s/.test(skillsBlock)) return { delimiter: ' | ', casing }
  if (skillsBlock.includes(';')) return { delimiter: '; ', casing }

  return { delimiter: ', ', casing }
}

function applySkillCasing(term: string, casing: SkillsListFormat['casing']): string {
  switch (casing) {
    case 'upper':
      return term.toUpperCase()
    case 'lower':
      return term.toLowerCase()
    case 'title':
      return term
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    default:
      return term
  }
}

/** Match a new skill's casing and wording to existing resume skills when possible. */
export function formatSkillLikeExisting(term: string, existingSkills: string[]): string {
  const trimmed = term.trim()
  if (!trimmed) return trimmed

  const existingMatch = existingSkills.find(
    (skill) => skill.toLowerCase() === trimmed.toLowerCase()
  )
  if (existingMatch) return existingMatch

  return applySkillCasing(trimmed, inferSkillCasingStyle(existingSkills))
}

export function formatSkillsLikeExisting(terms: string[], existingSkills: string[]): string[] {
  return terms.map((term) => formatSkillLikeExisting(term, existingSkills))
}

export function appendSkillsToResumeText(
  resumeText: string,
  skillsToAdd: string[],
  existingSkills: string[] = parseListedSkillTerms(resumeText)
): string {
  const format = detectSkillsListFormat(resumeText, existingSkills)
  const additions = [
    ...new Set(
      formatSkillsLikeExisting(
        skillsToAdd.map((skill) => skill.trim()).filter(Boolean),
        existingSkills
      )
    ),
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

    const additionLine = additions.join(format.delimiter)
    const nextLines = [...lines]
    nextLines.splice(insertAt, 0, additionLine)
    return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  const block = ['', 'SKILLS', additions.join(format.delimiter)]
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
