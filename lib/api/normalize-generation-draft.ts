import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  extractBulletsFromSource,
  inferNameFromEmail,
  titleCaseName,
} from '@/lib/resume/contact-extraction'
import {
  isRealExperienceBullet,
  parseExperienceFromLines,
  scoreExperienceCompleteness,
} from '@/lib/resume/parse-experience-blocks'
import { mergeSourceExperienceDates } from '@/lib/ai/generation-hygiene'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'

function normalizeExperience(entry: Experience): Experience {
  return {
    title: entry.title.trim() || 'Consultant',
    company: entry.company.trim() || 'Independent',
    location: entry.location ?? '',
    startDate: entry.startDate.trim(),
    endDate: entry.endDate.trim() || 'Present',
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(isRealExperienceBullet),
  }
}

function hasPlaceholderExperience(experience: Experience[]): boolean {
  return experience.some(
    (entry) =>
      /previous employer|confidential|see resume|employer not listed|independent/i.test(entry.company) &&
      entry.title === 'Professional Experience'
  )
}

function resolveExperienceFromSource(
  experience: Experience[],
  sourceResumeText: string
): Experience[] {
  if (!sourceResumeText.trim()) return experience

  const lines = sourceResumeText.replace(/\r\n/g, '\n').split('\n')
  const reparsed = parseExperienceFromLines(lines)
  const reparsedFromParser = parseResumeTextToTailoredResume(sourceResumeText).experience

  const candidates = [reparsed, reparsedFromParser, experience].sort(
    (a, b) => scoreExperienceCompleteness(b) - scoreExperienceCompleteness(a)
  )

  const best = candidates[0] ?? experience
  if (best.some((entry) => entry.bullets.length > 0)) {
    return best.map(normalizeExperience).filter((entry) => entry.bullets.length > 0)
  }

  const bullets = extractBulletsFromSource(sourceResumeText)
  if (bullets.length === 0) return experience.map(normalizeExperience)

  return bullets.length > 0
    ? [
        normalizeExperience({
          title: 'Consultant',
          company: 'Independent',
          location: '',
          startDate: 'Recent',
          endDate: 'Present',
          bullets,
        }),
      ]
    : experience.map(normalizeExperience)
}

function fixContactName(resume: TailoredResume, sourceResumeText?: string): TailoredResume['contact'] {
  let name = resume.contact.name.trim()

  if (
    !name ||
    name === 'Professional Candidate' ||
    /^Bradmulder/i.test(name) ||
    name.split(/\s+/).some((part) => part.length === 1)
  ) {
    const fromEmail = inferNameFromEmail(resume.contact.email)
    if (fromEmail) name = fromEmail
  }

  if (sourceResumeText) {
    const caps = sourceResumeText
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) =>
          /^[A-Z][A-Z\s.'-]{2,40}$/.test(line) &&
          line.split(/\s+/).length <= 4 &&
          !line.includes('@')
      )
    if (caps) name = titleCaseName(caps)
  }

  return {
    ...resume.contact,
    name: name || 'Candidate',
    location: resume.contact.location.replace(/^[A-Z][A-Z\s.'-]+\s+(?=Edmonton|,)/i, '').trim(),
  }
}

function cleanSkills(skills: string[]): string[] {
  return dedupeSkills(
    skills.filter((skill) => {
      const lower = skill.toLowerCase()
      if (
        lower.split(/\s+/).length >= 3 &&
        /(?:program|project|engineering|technical)\s+manager|director|engineer$/i.test(lower)
      ) {
        return false
      }
      if (/^(internal tools|methodology|delivery|professional experience)$/i.test(skill.trim())) {
        return false
      }
      return skill.trim().length > 1
    })
  )
}

const DEFAULT_SUMMARY =
  'Technical program and delivery leader with experience coordinating cross-functional releases, stakeholder alignment, and operational workflow improvements.'

/** Ensures browser/local drafts satisfy strict API schemas before server review. */
export function normalizeGenerationDraftForApi(
  draft: AiGenerationResult,
  sourceResumeText?: string
): AiGenerationResult {
  let tailoredResume = draft.tailoredResume

  if (sourceResumeText?.trim()) {
    const reparsed = parseResumeTextToTailoredResume(sourceResumeText)
    const draftSummary = draft.tailoredResume.summary.trim()
    const reparsedSummary = reparsed.summary.trim()
    const useReparsedSummary =
      reparsedSummary.length >= 40 &&
      !reparsedSummary.includes('Analysis of') &&
      reparsedSummary !== DEFAULT_SUMMARY

    tailoredResume = {
      ...draft.tailoredResume,
      contact: reparsed.contact,
      skills: cleanSkills(
        [...new Set([...reparsed.skills, ...draft.tailoredResume.skills])]
      ),
      summary: useReparsedSummary ? reparsedSummary : draftSummary || reparsedSummary,
      education:
        reparsed.education.length > 0 ? reparsed.education : draft.tailoredResume.education,
      certifications:
        reparsed.certifications && reparsed.certifications.length > 0
          ? reparsed.certifications
          : draft.tailoredResume.certifications,
    }
  }

  const resolvedExperience = resolveExperienceFromSource(
    tailoredResume.experience,
    sourceResumeText ?? ''
  )

  tailoredResume = {
    ...tailoredResume,
    contact: fixContactName(tailoredResume, sourceResumeText),
    skills: cleanSkills(tailoredResume.skills.map((s) => s.trim()).filter(Boolean)),
    experience:
      resolvedExperience.length > 0
        ? resolvedExperience
        : hasPlaceholderExperience(tailoredResume.experience)
          ? []
          : tailoredResume.experience.map(normalizeExperience).filter((entry) => entry.bullets.length > 0),
    education: tailoredResume.education.map((entry) => ({
      degree: entry.degree.trim() || 'Education',
      school: entry.school.trim() || 'Institution not listed',
      graduationDate: entry.graduationDate ?? '',
      details: entry.details ?? '',
    })),
    certifications: (tailoredResume.certifications ?? []).map((c) => c.trim()).filter(Boolean),
  }

  if (tailoredResume.experience.length === 0 && sourceResumeText?.trim()) {
    tailoredResume.experience = resolveExperienceFromSource([], sourceResumeText)
  }

  if (sourceResumeText?.trim()) {
    tailoredResume = mergeSourceExperienceDates(tailoredResume, sourceResumeText)
  }

  if (tailoredResume.skills.length === 0) {
    tailoredResume.skills = ['Program Management', 'Release Management', 'Agile']
  }

  return {
    keywordReport: draft.keywordReport,
    tailoredResume,
    coverLetter: draft.coverLetter.trim() || 'Cover letter pending.',
  }
}
