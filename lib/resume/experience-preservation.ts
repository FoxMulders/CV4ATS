import type { Experience } from '@/lib/ai/schemas'
import { scoreExperienceCompleteness } from '@/lib/resume/parse-experience-blocks'

function companyKey(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function entryKey(entry: Experience): string {
  const company = companyKey(entry.company)
  const title = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${company}::${title}`
}

function mergeEntry(existing: Experience, incoming: Experience): Experience {
  return {
    title: existing.title.trim() || incoming.title.trim(),
    company: existing.company.trim() || incoming.company.trim(),
    location: existing.location.trim() || incoming.location.trim(),
    startDate: existing.startDate.trim() || incoming.startDate.trim(),
    endDate: existing.endDate.trim() || incoming.endDate.trim() || 'Present',
    bullets:
      existing.bullets.length >= incoming.bullets.length ? existing.bullets : incoming.bullets,
  }
}

/**
 * Non-destructive experience merge — never drops source employers when the model returns fewer entries.
 * Prefers the most complete bullet sets per company/title key.
 */
export function mergeExperienceArraysNonDestructive(...arrays: Experience[][]): Experience[] {
  const ranked = arrays
    .filter((entries) => entries.length > 0)
    .sort((a, b) => scoreExperienceCompleteness(b) - scoreExperienceCompleteness(a))

  const baseline = ranked[0] ?? []
  const merged = new Map<string, Experience>()

  for (const entries of ranked) {
    for (const entry of entries) {
      if (!entry.company.trim() && entry.bullets.length === 0) continue
      const key = entryKey(entry)
      const existing = merged.get(key)
      merged.set(key, existing ? mergeEntry(existing, entry) : entry)
    }
  }

  if (merged.size === 0) return baseline

  const orderedKeys: string[] = []
  for (const entry of baseline) {
    const key = entryKey(entry)
    if (!orderedKeys.includes(key) && merged.has(key)) {
      orderedKeys.push(key)
    }
  }

  for (const key of merged.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key)
  }

  return orderedKeys.map((key) => merged.get(key)!)
}
