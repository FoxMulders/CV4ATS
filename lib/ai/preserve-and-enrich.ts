import type { AiGenerationResult, TailoredResume } from '@/lib/ai/schemas'
import { buildFallbackCoverLetter } from '@/lib/ai/fallback-cover-letter'
import type { EnrichmentModelOutput } from '@/lib/ai/enrichment-schemas'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { isSummaryLikeLine } from '@/lib/resume/contact-extraction'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  allFrozenBlocks,
  lockResumeState,
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

/** Enforces zero data loss by merging AI bullet/skills enrichments onto frozen resume state. */
export function applyStructuralPreservation(
  source: TailoredResume | string,
  draft: AiGenerationResult,
  options: PreservationOptions = {}
): AiGenerationResult {
  const locked = resolveLockedState(source)
  const summary = chooseSummary(locked, draft.tailoredResume.summary)
  const skills = mergeSkills(locked, draft.tailoredResume.skills, options.missingKeywords)

  const bulletMap = new Map<string, string[]>()
  for (const block of draft.tailoredResume.experience) {
    const key = `${block.company}::${block.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    bulletMap.set(key, block.bullets)
  }
  for (const block of draft.tailoredResume.projects ?? []) {
    const key = `${block.company}::${block.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    bulletMap.set(key, block.bullets)
  }

  const mergeBlock = (block: (typeof locked.workExperience)[number]) => ({
    ...block,
    bullets: sanitizeEnrichedBullets(
      block.bullets,
      bulletMap.get(block.blockKey) ?? bulletMap.get(block.blockKey.slice(0, 8)),
      summary
    ),
  })

  const mergedState: StrictResumeState = {
    ...locked,
    summary,
    skills: skills.length > 0 ? skills : locked.skills,
    workExperience: locked.workExperience.map(mergeBlock),
    projects: locked.projects.map(mergeBlock),
    education: locked.education.length > 0 ? locked.education : draft.tailoredResume.education,
    certifications:
      locked.certifications.length > 0
        ? locked.certifications
        : (draft.tailoredResume.certifications ?? []),
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
  const bulletByKey = new Map(
    enrichment.experienceBullets.map((entry) => [entry.blockKey, entry.bullets])
  )

  const mergeBlock = (block: (typeof locked.workExperience)[number]) => ({
    ...block,
    bullets: sanitizeEnrichedBullets(
      block.bullets,
      bulletByKey.get(block.blockKey) ??
        [...bulletByKey.entries()].find(([key]) => key.startsWith(block.blockKey.slice(0, 6)))?.[1],
      enrichment.professionalSummary ?? locked.summary
    ),
  })

  const mergedState: StrictResumeState = {
    ...locked,
    summary: chooseSummary(locked, enrichment.professionalSummary),
    skills: mergeSkills(locked, enrichment.skills),
    workExperience: locked.workExperience.map(mergeBlock),
    projects: locked.projects.map(mergeBlock),
  }

  return {
    tailoredResume: strictStateToTailoredResume(mergedState),
    coverLetter: enrichment.coverLetter,
  }
}

export { allFrozenBlocks, lockResumeState, strictStateToTailoredResume }
