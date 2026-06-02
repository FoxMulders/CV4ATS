import type { Education } from '@/lib/ai/schemas'

const EDUCATION_SECTION = /^education\s*:?\s*$/i
const SECTION_STOP =
  /^(certifications?|skills|technical skills|work experience|experience|employment|personal ai projects?|personal projects?|references)\s*:?\s*$/i

function parseEducationLines(lines: string[]): Education[] {
  const start = lines.findIndex((line) => EDUCATION_SECTION.test(line.trim()))
  if (start < 0) return []

  const entries: Education[] = []

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (!line) continue
    if (SECTION_STOP.test(line)) break

    const yearMatch = line.match(/\b(19|20)\d{2}\b/)
    entries.push({
      degree: line,
      school: '',
      graduationDate: yearMatch?.[0] ?? '',
      details: '',
    })
  }

  return entries.slice(0, 6)
}

/** Recover education from raw source when model output is empty but source contains institutions/years. */
export function recoverEducationFromSource(
  modelEducation: Education[],
  sourceResumeText?: string
): Education[] {
  if (modelEducation.length > 0) {
    return modelEducation.map((entry) => ({
      degree: entry.degree.trim() || 'Degree',
      school: entry.school.trim() || 'Institution not listed',
      graduationDate: entry.graduationDate ?? '',
      details: entry.details ?? '',
    }))
  }

  if (!sourceResumeText?.trim()) return []

  const lines = sourceResumeText.replace(/\r\n/g, '\n').split('\n')
  const recovered = parseEducationLines(lines)
  if (recovered.length > 0) return recovered

  const fallback = sourceResumeText.match(
    /\b(?:bachelor|master|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?).{0,80}(?:university|college|institute|school)/i
  )?.[0]

  if (fallback) {
    return [
      {
        degree: fallback.trim(),
        school: '',
        graduationDate: fallback.match(/\b(19|20)\d{2}\b/)?.[0] ?? '',
        details: '',
      },
    ]
  }

  return []
}
