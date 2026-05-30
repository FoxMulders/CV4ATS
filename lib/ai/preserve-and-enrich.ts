import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { buildFallbackCoverLetter } from '@/lib/ai/fallback-cover-letter'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { isSummaryLikeLine } from '@/lib/resume/contact-extraction'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  lockSourceResumeStructure,
  lockedStructureToTailoredResume,
  type LockedExperienceBlock,
  type LockedResumeStructure,
} from '@/lib/resume/source-resume-structure'
import type { EnrichmentModelOutput } from '@/lib/ai/enrichment-schemas'
import { parseDatesField } from '@/lib/ai/enrichment-schemas'

const SUMMARY_IN_BULLET =
  /professional summary|technical program and delivery leader|years of experience|cross-functional releases, stakeholder alignment/i

const PLACEHOLDER_COVER =
  /\[(?:date|candidate|company|job title|role)\]|you will opening|as a technical program manager, you will/i

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function findMatchingAiBlock(
  block: LockedExperienceBlock,
  aiExperience: Experience[]
): Experience | undefined {
  const blockCompanyKey = normalizeKey(block.company)

  return (
    aiExperience.find((entry) => normalizeKey(entry.company) === blockCompanyKey) ??
    aiExperience.find(
      (entry) =>
        blockCompanyKey.length > 4 &&
        normalizeKey(entry.company).includes(blockCompanyKey.slice(0, Math.min(8, blockCompanyKey.length)))
    ) ??
    aiExperience.find(
      (entry) =>
        normalizeKey(entry.title) === normalizeKey(block.title) &&
        normalizeKey(entry.company).includes(normalizeKey(block.company).slice(0, 5))
    )
  )
}

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
  locked: LockedResumeStructure,
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

function mergeExperienceBlocks(
  locked: LockedResumeStructure,
  aiExperience: Experience[] | undefined,
  summary: string
): Experience[] {
  return locked.experience.map((block) => {
    const aiMatch = findMatchingAiBlock(block, aiExperience ?? [])

    return {
      company: block.company,
      title: block.title,
      location: aiMatch?.location?.trim() || block.location,
      startDate: block.startDate || 'Recent',
      endDate: block.endDate || 'Present',
      bullets: sanitizeEnrichedBullets(block.bullets, aiMatch?.bullets, summary),
    }
  })
}

function chooseSummary(locked: LockedResumeStructure, aiSummary?: string): string {
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

/** Enforces zero data loss by merging AI enrichments onto the locked source timeline. */
export function applyStructuralPreservation(
  sourceResumeText: string,
  draft: AiGenerationResult,
  options: PreservationOptions = {}
): AiGenerationResult {
  const locked = lockSourceResumeStructure(sourceResumeText)
  const summary = chooseSummary(locked, draft.tailoredResume.summary)
  const experience = mergeExperienceBlocks(locked, draft.tailoredResume.experience, summary)
  const skills = mergeSkills(locked, draft.tailoredResume.skills, options.missingKeywords)

  const tailoredResume: TailoredResume = {
    contact: {
      ...locked.contact,
      name: draft.tailoredResume.contact.name?.trim() || locked.contact.name,
      email: draft.tailoredResume.contact.email || locked.contact.email,
      phone: draft.tailoredResume.contact.phone || locked.contact.phone,
      location: draft.tailoredResume.contact.location || locked.contact.location,
      linkedin: draft.tailoredResume.contact.linkedin || locked.contact.linkedin,
    },
    summary,
    skills: skills.length > 0 ? skills : locked.skills,
    experience: experience.length > 0 ? experience : lockedStructureToTailoredResume(locked).experience,
    education: locked.education.length > 0 ? locked.education : draft.tailoredResume.education,
    certifications:
      locked.certifications.length > 0 ? locked.certifications : draft.tailoredResume.certifications,
  }

  const rawCover = draft.coverLetter.trim()
  const coverLetter =
    !rawCover || PLACEHOLDER_COVER.test(rawCover)
      ? buildFallbackCoverLetter(tailoredResume, options.jobDescription ?? '', sourceResumeText)
      : rawCover
  const serialized = [
    tailoredResume.summary,
    tailoredResume.skills.join(' '),
    ...tailoredResume.experience.flatMap((entry) => entry.bullets),
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

/** Converts enrichment-shaped model output into a draft before structural preservation. */
export function enrichmentOutputToDraft(
  enrichment: EnrichmentModelOutput,
  locked: LockedResumeStructure
): Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> {
  const experience: Experience[] = locked.experience.map((block) => {
    const blockCompanyKey = normalizeKey(block.company)
    const aiBlock =
      enrichment.workExperience.find((entry) => normalizeKey(entry.company) === blockCompanyKey) ??
      enrichment.workExperience.find((entry) =>
        normalizeKey(entry.company).includes(blockCompanyKey.slice(0, 6))
      )

    const dates = aiBlock?.dates ? parseDatesField(aiBlock.dates) : null

    return {
      company: block.company,
      title: block.title,
      location: block.location,
      startDate: dates?.startDate || block.startDate || 'Recent',
      endDate: dates?.endDate || block.endDate || 'Present',
      bullets: sanitizeEnrichedBullets(block.bullets, aiBlock?.bullets, enrichment.professionalSummary),
    }
  })

  return {
    tailoredResume: {
      contact: locked.contact,
      summary: enrichment.professionalSummary,
      skills: enrichment.skills,
      experience,
      education: locked.education,
      certifications: locked.certifications,
    },
    coverLetter: enrichment.coverLetter,
  }
}
