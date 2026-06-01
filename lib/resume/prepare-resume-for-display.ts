import type { TailoredResume } from '@/lib/ai/schemas'

import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'

const DANGLING_TAIL =
  /\s+(?:,|;|:|\band\b|\bor\b|\bwith\b|\bincluding\b|\bsuch as\b|\bmissing\b|\blike\b)\s*$/i

/** Remove incomplete trailing conjunctions/clauses from rendered resume text. */
export function finalizeDisplayText(text: string): string {
  let cleaned = text.replace(/\s+/g, ' ').trim()

  while (DANGLING_TAIL.test(cleaned)) {
    cleaned = cleaned.replace(DANGLING_TAIL, '').trim()
  }

  return cleaned.replace(/,\s*$/, '').trim()
}

/** Normalize list items for preview/export without dropping entries mid-sentence. */
export function finalizeDisplayList(items: string[]): string[] {
  return items.map(finalizeDisplayText).filter((item) => item.length > 0)
}

/** Full resume payload safe for live preview — no array slicing or mid-string clipping. */
export function prepareResumeForDisplay(resume: TailoredResume): TailoredResume {
  const formatted = formatTailoredResume(resume)

  return {
    ...formatted,
    summary: finalizeDisplayText(formatted.summary),
    skills: finalizeDisplayList(formatted.skills),
    experience: (formatted.experience ?? []).map((job) => ({
      ...job,
      title: finalizeDisplayText(job.title),
      company: finalizeDisplayText(job.company),
      location: finalizeDisplayText(job.location),
      bullets: finalizeDisplayList(job.bullets ?? []),
    })),
    projects: (formatted.projects ?? []).map((job) => ({
      ...job,
      bullets: finalizeDisplayList(job.bullets ?? []),
    })),
    education: (formatted.education ?? []).map((edu) => ({
      ...edu,
      degree: finalizeDisplayText(edu.degree),
      school: finalizeDisplayText(edu.school),
      details: edu.details ? finalizeDisplayText(edu.details) : edu.details,
    })),
    certifications: formatted.certifications
      ? finalizeDisplayList(formatted.certifications)
      : formatted.certifications,
  }
}
