import type { Education, Experience, TailoredResume } from '@/lib/ai/schemas'

const SECTION_HEADING =
  /^(professional summary|summary|skills|technical skills|work experience|experience|employment|education|certifications?)\s*:?\s*$/i

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function isBulletLine(line: string): boolean {
  return /^[\s•\-*–—]\s*\S/.test(line.trim())
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s•\-*–—]+\s*/, '').trim()
}

function extractContact(text: string) {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? ''
  const phone = text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? ''
  const linkedin =
    text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? ''

  const lines = splitLines(text).map((line) => line.trim()).filter(Boolean)
  const name =
    lines.find(
      (line) =>
        !line.includes('@') &&
        !SECTION_HEADING.test(line) &&
        line.length <= 80 &&
        !/^https?:\/\//i.test(line)
    ) ?? 'Professional Candidate'

  return { name, email, phone, linkedin, location: '' }
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

function parseSkills(lines: string[]): string[] {
  const section = extractSection(lines, /^skills|technical skills/i)
  const source = section.length > 0 ? section : lines.filter((line) => /[,;|]/.test(line)).slice(0, 3)

  const skills = source
    .flatMap((line) => line.split(/[,;|•]/))
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1 && skill.length < 40)

  return skills.length > 0 ? [...new Set(skills)].slice(0, 24) : ['Project Management', 'Agile', 'SDLC']
}

function parseExperience(lines: string[]): Experience[] {
  const sectionStart = lines.findIndex((line) => /^(work experience|experience|employment)/i.test(line.trim()))
  const scanLines = sectionStart >= 0 ? lines.slice(sectionStart + 1) : lines

  const entries: Experience[] = []
  let current: Experience | null = null

  for (const rawLine of scanLines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^education/i.test(line)) break

    if (isBulletLine(line)) {
      if (!current) {
        current = {
          title: 'Professional Experience',
          company: 'Previous Employer',
          location: '',
          startDate: '',
          endDate: 'Present',
          bullets: [],
        }
      }
      const bullet = stripBullet(line)
      if (bullet) current.bullets.push(bullet)
      continue
    }

    if (current && current.bullets.length > 0) {
      entries.push(current)
      current = null
    }

    const roleMatch = line.match(/^(.+?)\s*(?:—|–|-|\|)\s*(.+?)(?:\s*\((.+)\))?$/i)
    if (roleMatch) {
      current = {
        title: roleMatch[1]!.trim(),
        company: roleMatch[2]!.trim(),
        location: roleMatch[3]?.trim() ?? '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
      continue
    }

    if (line.length < 100 && !line.includes('@')) {
      current = {
        title: line,
        company: 'Previous Employer',
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: [],
      }
    }
  }

  if (current && current.bullets.length > 0) {
    entries.push(current)
  }

  if (entries.length === 0) {
    const bullets = lines.filter(isBulletLine).map(stripBullet).filter(Boolean)
    return [
      {
        title: 'Professional Experience',
        company: 'Previous Employer',
        location: '',
        startDate: '',
        endDate: 'Present',
        bullets: bullets.length > 0 ? bullets.slice(0, 8) : ['Led cross-functional delivery initiatives with measurable business outcomes.'],
      },
    ]
  }

  return entries
}

function parseEducation(lines: string[]): Education[] {
  const section = extractSection(lines, /^education/i)
  if (section.length === 0) {
    return [{ degree: 'Degree', school: 'University', graduationDate: '', details: '' }]
  }

  return section.slice(0, 3).map((line) => ({
    degree: line,
    school: '',
    graduationDate: '',
    details: '',
  }))
}

function parseSummary(lines: string[]): string {
  const section = extractSection(lines, /^professional summary|^summary/i)
  if (section.length > 0) {
    return section.join(' ').trim()
  }

  const prose = lines
    .filter(
      (line) =>
        line.trim().length > 40 &&
        !isBulletLine(line) &&
        !SECTION_HEADING.test(line.trim()) &&
        !line.includes('@')
    )
    .slice(0, 2)

  return (
    prose.join(' ') ||
    'Senior technical leader with extensive experience delivering enterprise software, program management, and cross-functional IT initiatives.'
  )
}

/** Best-effort plain-text resume → structured TailoredResume for local fallback mode. */
export function parseResumeTextToTailoredResume(resumeText: string): TailoredResume {
  const lines = splitLines(resumeText)
  const contact = extractContact(resumeText)

  return {
    contact,
    summary: parseSummary(lines),
    skills: parseSkills(lines),
    experience: parseExperience(lines),
    education: parseEducation(lines),
    certifications: [],
  }
}
