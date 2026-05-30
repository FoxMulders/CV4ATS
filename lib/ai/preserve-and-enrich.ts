import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { buildFallbackCoverLetter } from '@/lib/ai/fallback-cover-letter'
import type { EnrichmentModelOutput } from '@/lib/ai/enrichment-schemas'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { isSummaryLikeLine } from '@/lib/resume/contact-extraction'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  allFrozenBlocks,
  lockResumeState,
  mergeBulletsOntoOriginalExperience,
  normalizeExperienceBlockKey,
  strictStateToTailoredResume,
  type StrictResumeState,
} from '@/lib/resume/strict-resume-state'

const SUMMARY_IN_BULLET =
  /professional summary|technical program and delivery leader|years of experience|cross-functional releases, stakeholder alignment/i

const PLACEHOLDER_COVER =
  /\[(?:date|candidate|company|job title|role)\]|you will opening|as a technical program manager, you will/i

function sanitizeEnrichedBullets(
  sourceBullets: string[],
  aiBullets: string[] | undefined,
  summary: string
): string[] {
  const candidates = (aiBullets?.length ? aiBullets : sourceBullets)
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .filter(isRealExperienceBullet)
    .filter((bullet) => !SUMMARY_IN_BULLET.test(bullet))
    .filter((bullet) => !isSummaryLikeLine(bullet, summary))

  if (candidates.length === 0) {
    return sourceBullets.filter(isRealExperienceBullet)
  }

  return candidates
}

function mergeSkills(
  locked: StrictResumeState,
  aiSkills: string[] | undefined,
  missingKeywords: string[] = []
): string[] {
  const merged = dedupeSkills([...(aiSkills ?? []), ...locked.skills])

  for (const keyword of missingKeywords) {
    const lower = keyword.toLowerCase()
    if (!merged.some((skill) => skill.toLowerCase().includes(lower))) {
      merged.push(keyword.charAt(0).toUpperCase() + keyword.slice(1))
    }
  }

  return dedupeSkills(merged).slice(0, 24)
}

function chooseSummary(locked: StrictResumeState, aiSummary?: string): string {
  const candidate = aiSummary?.trim() ?? ''
  if (
    candidate.length >= 40 &&
    !candidate.includes('Analysis of') &&
    !SUMMARY_IN_BULLET.test(candidate)
  ) {
    return candidate
  }
  return locked.summary
}

export type PreservationOptions = {
  missingKeywords?: string[]
  jobDescription?: string
}

function resolveLockedState(source: TailoredResume | string): StrictResumeState {
  return lockResumeState(source)
}

function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function buildBulletLookups(draftExperience: Experience[]) {
  const byBlockKey = new Map<string, string[]>()
  const byCompany = new Map<string, string[]>()
  const byIndex = new Map<number, string[]>()

  draftExperience.forEach((block, index) => {
    if (!block.bullets?.length) return
    const blockKey = normalizeExperienceBlockKey(block.company, block.title, index)
    byBlockKey.set(blockKey, block.bullets)
    byIndex.set(index, block.bullets)
    const companyKey = normalizeCompanyKey(block.company)
    if (companyKey) {
      byCompany.set(companyKey, block.bullets)
    }
  })

  return { byBlockKey, byCompany, byIndex }
}

function resolveAiBulletsForBlock(
  block: { blockKey: string; company: string },
  index: number,
  lookups: ReturnType<typeof buildBulletLookups>
): string[] | undefined {
  const companyKey = normalizeCompanyKey(block.company)
  return (
    lookups.byBlockKey.get(block.blockKey) ??
    (companyKey ? lookups.byCompany.get(companyKey) : undefined) ??
    lookups.byIndex.get(index)
  )
}

/** Enforces zero data loss by merging AI bullet/skills enrichments onto frozen resume state. */
export function applyStructuralPreservation(
  source: TailoredResume | string,
  draft: AiGenerationResult,
  options: PreservationOptions = {}
): AiGenerationResult {
  const locked = resolveLockedState(source)
  const summary = chooseSummary(locked, draft.tailoredResume.summary)
  const skills = mergeSkills(locked, draft.tailoredResume.skills, options.missingKeywords)

  const workLookups = buildBulletLookups(draft.tailoredResume.experience ?? [])
  const projectLookups = buildBulletLookups(draft.tailoredResume.projects ?? [])

  const mergeBlock = (
    block: (typeof locked.workExperience)[number],
    index: number,
    lookups: ReturnType<typeof buildBulletLookups>
  ) => ({
    ...block,
    bullets: sanitizeEnrichedBullets(
      block.bullets,
      resolveAiBulletsForBlock(block, index, lookups),
      summary
    ),
  })

  const mergedState: StrictResumeState = {
    ...locked,
    summary,
    skills: skills.length > 0 ? skills : locked.skills,
    workExperience: locked.workExperience.map((block, index) =>
      mergeBlock(block, index, workLookups)
    ),
    projects: locked.projects.map((block, index) => mergeBlock(block, index, projectLookups)),
    education: [...locked.education],
    certifications: [...locked.certifications],
  }

  const tailoredResume = strictStateToTailoredResume(mergedState)

  const sourceText = typeof source === 'string' ? source : ''
  const rawCover = draft.coverLetter.trim()
  const coverLetter =
    !rawCover || PLACEHOLDER_COVER.test(rawCover)
      ? buildFallbackCoverLetter(tailoredResume, options.jobDescription ?? '', sourceText)
      : rawCover

  const serialized = [
    tailoredResume.summary,
    tailoredResume.skills.join(' '),
    ...tailoredResume.experience.flatMap((entry) => entry.bullets),
    ...(tailoredResume.projects ?? []).flatMap((entry) => entry.bullets),
  ].join('\n')

  const keywordReport =
    options.jobDescription?.trim()
      ? scoreAtsCompliance(serialized, options.jobDescription)
      : draft.keywordReport

  return {
    ...draft,
    tailoredResume,
    coverLetter,
    keywordReport,
  }
}

/** Merges bullets-only AI output back onto frozen resume state. */
export function enrichmentOutputToDraft(
  enrichment: EnrichmentModelOutput,
  locked: StrictResumeState
): Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> {
  const originalWork = locked.workExperience.map((block) => ({
    company: block.company,
    title: block.title,
    location: block.location,
    startDate: block.startDate,
    endDate: block.endDate,
    bullets: block.bullets,
  }))
  const originalProjects = locked.projects.map((block) => ({
    company: block.company,
    title: block.title,
    location: block.location,
    startDate: block.startDate,
    endDate: block.endDate,
    bullets: block.bullets,
  }))

  const summary = chooseSummary(locked, enrichment.professionalSummary)
  const mergedWork = mergeBulletsOntoOriginalExperience(
    originalWork,
    undefined,
    enrichment.experienceBullets
  ).map((entry, index) => ({
    ...entry,
    bullets: sanitizeEnrichedBullets(
      originalWork[index]?.bullets ?? entry.bullets,
      entry.bullets,
      summary
    ),
  }))

  const projectBullets = enrichment.experienceBullets.filter((entry) =>
    locked.projects.some((block) => block.blockKey === entry.blockKey)
  )
  const mergedProjects = mergeBulletsOntoOriginalExperience(
    originalProjects,
    undefined,
    projectBullets
  ).map((entry, index) => ({
    ...entry,
    bullets: sanitizeEnrichedBullets(
      originalProjects[index]?.bullets ?? entry.bullets,
      entry.bullets,
      summary
    ),
  }))

  const mergedState: StrictResumeState = {
    ...locked,
    summary,
    skills: mergeSkills(locked, enrichment.skills),
    workExperience: locked.workExperience.map((block, index) => ({
      ...block,
      bullets: mergedWork[index]?.bullets ?? block.bullets,
    })),
    projects: locked.projects.map((block, index) => ({
      ...block,
      bullets: mergedProjects[index]?.bullets ?? block.bullets,
    })),
    education: [...locked.education],
    certifications: [...locked.certifications],
  }

  return {
    tailoredResume: strictStateToTailoredResume(mergedState),
    coverLetter: enrichment.coverLetter,
  }
}

export { allFrozenBlocks, lockResumeState, strictStateToTailoredResume }
