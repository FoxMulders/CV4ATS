const JUNK_LINE =
  /people you can reach|see who|promoted by|easy apply|reposted|verified hire|applicants?|linkedin|http|www\.|^\d+\s+(minute|hour|day|week)/i

function cleanTitle(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

/** Best-effort role title from a job posting — avoids LinkedIn chrome like "People you can reach out to". */
export function extractJobTitleFromDescription(jobDescription: string): string {
  const jd = jobDescription.trim()
  if (!jd) return 'this role'

  const labeled = jd.match(
    /(?:^|\n)\s*(?:job title|role|position)\s*[:\-–—]\s*(.+)/i
  )?.[1]
  if (labeled && !JUNK_LINE.test(labeled)) {
    return cleanTitle(labeled)
  }

  const applicationFor = jd.match(
    /(?:application for|apply for|position of|role of|opening for)\s+(.+?)(?:\s+at\b|\s+with\b|[\n,|]|$)/i
  )?.[1]
  if (applicationFor && !JUNK_LINE.test(applicationFor)) {
    return cleanTitle(applicationFor)
  }

  const roleLine = jd.match(
    /(?:^|\n)\s*((?:Senior |Staff |Principal |Lead |Technical |Engineering )?[A-Za-z][A-Za-z0-9 /&\-–—]{4,70}(?:Manager|Engineer|Director|Lead|Analyst|Specialist|Coordinator|Developer|Architect|Consultant|Program Manager))\s*(?:\n|$)/i
  )?.[1]
  if (roleLine && !JUNK_LINE.test(roleLine)) {
    return cleanTitle(roleLine)
  }

  for (const line of jd.split('\n')) {
    const trimmed = line.trim()
    if (
      trimmed.length >= 12 &&
      trimmed.length <= 90 &&
      !JUNK_LINE.test(trimmed) &&
      /(?:manager|engineer|director|program|developer|analyst|lead|specialist|coordinator)/i.test(
        trimmed
      )
    ) {
      return cleanTitle(trimmed)
    }
  }

  return 'this role'
}

export function extractCompanyFromDescription(jobDescription: string): string | null {
  const jd = jobDescription.trim()
  if (!jd) return null

  const atCompany = jd.match(
    /\bat\s+([A-Z][A-Za-z0-9&.\- ]{1,48})(?:\s*[\n,|]|$)/i
  )?.[1]
  if (atCompany && !JUNK_LINE.test(atCompany)) {
    return cleanTitle(atCompany)
  }

  const firstLine = jd.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (
    firstLine &&
    firstLine.length <= 48 &&
    !JUNK_LINE.test(firstLine) &&
    !/(manager|engineer|director|program)/i.test(firstLine)
  ) {
    return cleanTitle(firstLine)
  }

  return null
}
