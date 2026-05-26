export interface CareerContext {
  employers: string[]
  recentRoles: string[]
  achievementBullets: string[]
}

const ROLE_LINE =
  /^(.{4,80}?)\s*(?:—|–|-|\|)\s*(.{2,80}?)(?:\s*\((.+)\))?\s*$/

export function extractCareerContext(resumeText: string): CareerContext {
  const employers: string[] = []
  const recentRoles: string[] = []
  const achievementBullets: string[] = []

  for (const rawLine of resumeText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const roleMatch = line.match(ROLE_LINE)
    if (roleMatch) {
      const title = roleMatch[1]?.trim()
      const company = roleMatch[2]?.trim()
      if (title && title.length < 80) recentRoles.push(title)
      if (company && !employers.includes(company)) employers.push(company)
      continue
    }

    const bullet = line.replace(/^[\s•\-*–—]+\s*/, '').trim()
    if (bullet.length >= 20 && bullet.length <= 220) {
      achievementBullets.push(bullet)
    }
  }

  return {
    employers: employers.slice(0, 6),
    recentRoles: recentRoles.slice(0, 6),
    achievementBullets: achievementBullets.slice(0, 12),
  }
}

export function pickContextEmployer(context: CareerContext, seed: number): string | undefined {
  if (context.employers.length === 0) return undefined
  return context.employers[Math.abs(seed) % context.employers.length]
}

export function pickContextRole(context: CareerContext, seed: number): string | undefined {
  if (context.recentRoles.length === 0) return undefined
  return context.recentRoles[Math.abs(seed) % context.recentRoles.length]
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function variationSeedFor(term: string, variationIndex = 0): number {
  return hashString(`${term}:${variationIndex}`)
}
