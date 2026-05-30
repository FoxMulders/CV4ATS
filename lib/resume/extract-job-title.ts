const JUNK_LINE =
  /people you can reach|see who|promoted by|easy apply|reposted|verified hire|applicants?|linkedin|http|www\.|^\d+\s+(minute|hour|day|week)/i

const PERSON_NAME_LINE =
  /^(?:professional candidate|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}|BRAD\s+MULDERS|[A-Z][A-Z\s.'-]{2,40})$/

const JUNK_ROLE_LINE =
  /^as a\b|^you will\b|^we are\b|^about (the|this|us)\b|^what you|^responsibilities|^requirements|^qualifications|^who you|^in this role|^the ideal|^our team|^your role|^role overview|^job summary|^overview\b|^description\b/i

function cleanTitle(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function isPlausibleJobTitle(value: string): boolean {
  const trimmed = cleanTitle(value)
  if (trimmed.length < 8 || trimmed.length > 90) return false
  if (JUNK_LINE.test(trimmed) || JUNK_ROLE_LINE.test(trimmed)) return false
  if (/you will|as a technical program manager, you/i.test(trimmed)) return false
  if (!/(manager|engineer|director|program|developer|analyst|lead|specialist|coordinator|architect|consultant)/i.test(trimmed)) {
    return false
  }
  return true
}

/** Best-effort role title from a job posting — avoids LinkedIn chrome like "People you can reach out to". */
export function extractJobTitleFromDescription(jobDescription: string): string {
  const jd = jobDescription.trim()
  if (!jd) return 'this role'

  const labeled = jd.match(
    /(?:^|\n)\s*(?:job title|role|position)\s*[:\-–—]\s*(.+)/i
  )?.[1]
  if (labeled && isPlausibleJobTitle(labeled)) {
    return cleanTitle(labeled)
  }

  for (const line of jd.split('\n').slice(0, 8)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 90) continue
    if (/^technical program manager\b/i.test(trimmed) && trimmed.length < 80) {
      return cleanTitle(trimmed)
    }
    const dashTitle = trimmed.match(
      /^((?:Senior |Staff |Principal |Lead |Technical |Engineering )?[A-Za-z][A-Za-z0-9 /&]{2,55})\s*[-–—]\s*[A-Za-z0-9 /&-]{2,24}$/
    )
    if (dashTitle && isPlausibleJobTitle(trimmed)) {
      return cleanTitle(trimmed)
    }
  }

  const applicationFor = jd.match(
    /(?:application for|apply for|position of|role of|opening for)\s+(.+?)(?:\s+at\b|\s+with\b|[\n,|]|$)/i
  )?.[1]
  if (applicationFor && isPlausibleJobTitle(applicationFor)) {
    return cleanTitle(applicationFor)
  }

  const roleLine = jd.match(
    /(?:^|\n)\s*((?:Senior |Staff |Principal |Lead |Technical |Engineering )?[A-Za-z][A-Za-z0-9 /&\-–—]{4,70}(?:Manager|Engineer|Director|Lead|Analyst|Specialist|Coordinator|Developer|Architect|Consultant|Program Manager))\s*(?:\n|$)/i
  )?.[1]
  if (roleLine && isPlausibleJobTitle(roleLine)) {
    return cleanTitle(roleLine)
  }

  for (const line of jd.split('\n')) {
    const trimmed = line.trim()
    if (
      trimmed.length >= 12 &&
      trimmed.length <= 90 &&
      isPlausibleJobTitle(trimmed) &&
      !JUNK_ROLE_LINE.test(trimmed)
    ) {
      return cleanTitle(trimmed)
    }
  }

  return 'this role'
}

export function sanitizeJobTitleForProse(title: string): string {
  const cleaned = cleanTitle(title)
    .replace(/^as\s+a\s+/i, '')
    .replace(/\s*,?\s*you will.*$/i, '')
    .replace(/^the\s+/i, '')
    .trim()

  if (!isPlausibleJobTitle(cleaned) && cleaned !== 'this role') {
    const tpm = cleaned.match(/technical program manager[^,.]*/i)?.[0]
    if (tpm) return cleanTitle(tpm)
    return 'this role'
  }

  return cleaned || 'this role'
}

function looksLikeCompanyName(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 2 || trimmed.length > 48) return false
  if (JUNK_LINE.test(trimmed) || PERSON_NAME_LINE.test(trimmed)) return false
  if (/^(the|dear|opening|role|position)\b/i.test(trimmed)) return false
  if (/^(professional candidate|hiring manager)$/i.test(trimmed)) return false
  if (JUNK_ROLE_LINE.test(trimmed)) return false
  return true
}

export function extractCompanyFromDescription(jobDescription: string): string | null {
  const jd = jobDescription.trim()
  if (!jd) return null

  const atCompany = jd.match(
    /\bat\s+([A-Z][A-Za-z0-9&.\- ]{1,48})(?:\s*[\n,|]|$)/i
  )?.[1]
  if (atCompany && looksLikeCompanyName(atCompany)) {
    return cleanTitle(atCompany)
  }

  const firstLine = jd.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (
    firstLine &&
    firstLine.length <= 48 &&
    looksLikeCompanyName(firstLine) &&
    !/(manager|engineer|director|program)/i.test(firstLine)
  ) {
    return cleanTitle(firstLine)
  }

  return null
}

export function extractCleanJobContext(jobDescription: string): {
  jobTitle: string
  companyName: string | null
} {
  return {
    jobTitle: sanitizeJobTitleForProse(extractJobTitleFromDescription(jobDescription)),
    companyName: extractCompanyFromDescription(jobDescription),
  }
}
