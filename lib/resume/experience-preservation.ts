import type { Experience, TailoredResume } from '@/lib/ai/schemas'
import { scoreExperienceCompleteness } from '@/lib/resume/parse-experience-blocks'

export const EMPTY_WORK_EXPERIENCE_WARNING =
  'AI generation returned empty experience blocks. Aborting state overwrite to protect existing user history.'

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
    .sort((a, b) => {
      const countDiff = b.length - a.length
      if (countDiff !== 0) return countDiff
      return scoreExperienceCompleteness(b) - scoreExperienceCompleteness(a)
    })

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

function isExperienceEntry(entry: unknown): entry is Experience {
  return Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
}

/** Read workExperience / experience from AI payloads (structured, enrichment, or partial stream). */
export function extractWorkExperienceFromPayload(data: unknown): Experience[] | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined

  const record = data as Record<string, unknown>

  if (Array.isArray(record.workExperience)) {
    return record.workExperience.filter(isExperienceEntry)
  }

  const tailoredResume = record.tailoredResume
  if (tailoredResume && typeof tailoredResume === 'object' && !Array.isArray(tailoredResume)) {
    const experience = (tailoredResume as Record<string, unknown>).experience
    if (Array.isArray(experience)) {
      return experience.filter(isExperienceEntry)
    }
  }

  if (Array.isArray(record.experience)) {
    return record.experience.filter(isExperienceEntry)
  }

  return undefined
}

/** Sanity check — at least one employer/title block with identifiable content. */
export function hasSanityCheckedWorkExperience(
  experience: Experience[] | undefined | null
): boolean {
  if (!Array.isArray(experience) || experience.length === 0) return false

  return experience.some(
    (entry) =>
      isExperienceEntry(entry) &&
      (entry.company.trim().length > 0 || entry.title.trim().length > 0)
  )
}

export type ExperienceGuardOptions = {
  warn?: boolean
}

/**
 * Immutable fallback when AI output would wipe work experience.
 * Retains the existing timeline when incoming blocks fail validation or are empty.
 */
export function guardTailoredResumeExperience(
  incoming: TailoredResume,
  existing: TailoredResume | null | undefined,
  options: ExperienceGuardOptions = {}
): TailoredResume {
  const incomingOk = hasSanityCheckedWorkExperience(incoming.experience)
  const existingOk = hasSanityCheckedWorkExperience(existing?.experience)

  if (!incomingOk && existingOk) {
    if (options.warn !== false) {
      console.warn(EMPTY_WORK_EXPERIENCE_WARNING)
    }

    return {
      ...incoming,
      experience: existing!.experience,
      projects:
        hasSanityCheckedWorkExperience(incoming.projects) && (incoming.projects?.length ?? 0) > 0
          ? incoming.projects
          : (existing!.projects ?? incoming.projects ?? []),
    }
  }

  if (incomingOk && existingOk) {
    return {
      ...incoming,
      experience: mergeExperienceArraysNonDestructive(existing!.experience, incoming.experience),
      projects: mergeExperienceArraysNonDestructive(
        existing!.projects ?? [],
        incoming.projects ?? []
      ),
    }
  }

  return incoming
}

/** True when incoming AI data must not replace existing work experience state. */
export function shouldRejectWorkExperienceOverwrite(
  incoming: unknown,
  existingExperience: Experience[] | undefined | null
): boolean {
  const incomingExperience = extractWorkExperienceFromPayload(incoming)
  return (
    !hasSanityCheckedWorkExperience(incomingExperience) &&
    hasSanityCheckedWorkExperience(existingExperience)
  )
}

/** Apply generation-complete resume update with absolute experience preservation. */
export function applyGenerationCompleteResume(
  incoming: TailoredResume,
  existing: TailoredResume | null | undefined,
  options: ExperienceGuardOptions = {}
): TailoredResume {
  return guardTailoredResumeExperience(incoming, existing, options)
}
