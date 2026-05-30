import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'
import { aiGenerationResultSchema } from '@/lib/ai/schemas'
import { inferNameFromEmail, titleCaseName } from '@/lib/resume/contact-extraction'
import { isRealExperienceBullet } from '@/lib/resume/parse-experience-blocks'
import { scoreAtsCompliance } from '@/lib/resume/ats-score'
import { dedupeSkills } from '@/lib/resume/skill-dedupe'
import {
  lockSourceResumeStructure,
  lockedStructureToTailoredResume,
} from '@/lib/resume/source-resume-structure'

const DEFAULT_SUMMARY =
  'Technical program and delivery leader with experience coordinating cross-functional releases, stakeholder alignment, and operational workflow improvements.'

const FALLBACK_BULLET = 'Delivered measurable outcomes in this role.'

function resolveContactName(resume: TailoredResume, sourceResumeText?: string): string {
  let name = resume.contact.name?.trim() ?? ''
  if (name && name !== 'Professional Candidate') return name

  const fromEmail = inferNameFromEmail(resume.contact.email)
  if (fromEmail) return fromEmail

  if (sourceResumeText?.trim()) {
    const caps = sourceResumeText
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) =>
          /^[A-Z][A-Z\s.'-]{2,40}$/.test(line) &&
          line.split(/\s+/).length <= 4 &&
          !line.includes('@')
      )
    if (caps) return titleCaseName(caps)
  }

  return name || 'Candidate'
}

function ensureBullets(bullets: string[] | undefined, fallback: string[] = []): string[] {
  const cleaned = (bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .filter(isRealExperienceBullet)

  if (cleaned.length > 0) return cleaned

  const fromFallback = fallback.filter(isRealExperienceBullet)
  if (fromFallback.length > 0) return fromFallback

  return [FALLBACK_BULLET]
}

function ensureExperienceEntry(entry: Experience, lockedEntry?: Experience): Experience {
  return {
    title: entry.title?.trim() || lockedEntry?.title?.trim() || 'Consultant',
    company: entry.company?.trim() || lockedEntry?.company?.trim() || 'Independent',
    location: entry.location ?? lockedEntry?.location ?? '',
    startDate: entry.startDate?.trim() || lockedEntry?.startDate?.trim() || 'Recent',
    endDate: entry.endDate?.trim() || lockedEntry?.endDate?.trim() || 'Present',
    bullets: ensureBullets(entry.bullets, lockedEntry?.bullets),
  }
}

function ensureTailoredResume(
  resume: TailoredResume,
  sourceResumeText?: string
): TailoredResume {
  const locked = sourceResumeText?.trim() ? lockSourceResumeStructure(sourceResumeText) : null
  const lockedResume = locked ? lockedStructureToTailoredResume(locked) : null

  let experience = (resume.experience ?? []).map((entry, index) =>
    ensureExperienceEntry(entry, lockedResume?.experience[index])
  )

  if (experience.length === 0 && lockedResume?.experience.length) {
    experience = lockedResume.experience.map((entry) => ensureExperienceEntry(entry))
  }

  if (experience.length === 0) {
    experience = [
      ensureExperienceEntry({
        title: 'Consultant',
        company: 'Independent',
        location: '',
        startDate: 'Recent',
        endDate: 'Present',
        bullets: [FALLBACK_BULLET],
      }),
    ]
  }

  const summary = resume.summary?.trim() || locked?.summary?.trim() || DEFAULT_SUMMARY

  let skills = dedupeSkills((resume.skills ?? []).map((skill) => skill.trim()).filter(Boolean))
  if (skills.length === 0) {
    skills =
      locked?.skills?.length && locked.skills.length > 0
        ? locked.skills
        : ['Program Management', 'Release Management', 'Agile']
  }

  const education = (resume.education?.length ? resume.education : locked?.education ?? []).map(
    (entry) => ({
      degree: entry.degree?.trim() || 'Education',
      school: entry.school?.trim() || 'Institution not listed',
      graduationDate: entry.graduationDate ?? '',
      details: entry.details ?? '',
    })
  )

  return {
    contact: {
      name: resolveContactName(resume, sourceResumeText),
      email: resume.contact.email ?? '',
      phone: resume.contact.phone ?? '',
      location: resume.contact.location ?? '',
      linkedin: resume.contact.linkedin ?? '',
    },
    summary,
    skills,
    experience,
    education,
    certifications: (resume.certifications ?? locked?.certifications ?? [])
      .map((cert) => cert.trim())
      .filter(Boolean),
  }
}

/** Guarantees browser/local drafts satisfy strict API Zod schemas (hiring panel, exports). */
export function ensureApiSafeGenerationResult(
  draft: AiGenerationResult,
  sourceResumeText?: string,
  jobDescription?: string
): AiGenerationResult {
  const tailoredResume = ensureTailoredResume(draft.tailoredResume, sourceResumeText)
  const coverLetter = draft.coverLetter?.trim() || 'Cover letter pending.'

  const serialized = [
    tailoredResume.summary,
    tailoredResume.skills.join(' '),
    ...tailoredResume.experience.flatMap((entry) => entry.bullets),
  ].join('\n')

  const keywordReport =
    draft.keywordReport?.matchScore != null
      ? draft.keywordReport
      : jobDescription?.trim()
        ? scoreAtsCompliance(serialized, jobDescription)
        : {
            matchScore: 0,
            matchedKeywords: [],
            missingKeywords: [],
            suggestions: [],
          }

  const safe: AiGenerationResult = {
    keywordReport,
    tailoredResume,
    coverLetter,
  }

  return aiGenerationResultSchema.parse(safe)
}
