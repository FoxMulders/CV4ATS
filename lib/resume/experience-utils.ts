import type { Experience, TailoredResume } from '@/lib/ai/schemas'

export function createEmptyExperience(): Experience {
  return {
    title: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    bullets: [''],
  }
}

export function parseBulletsFromText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
}

export function formatExperienceAsResumeText(experience: Experience): string {
  const header = [
    `${experience.title} — ${experience.company}`,
    experience.location ? experience.location : null,
    `${experience.startDate} – ${experience.endDate}`,
  ]
    .filter(Boolean)
    .join('\n')

  const bullets = experience.bullets.map((bullet) => `• ${bullet}`).join('\n')

  return `${header}\n${bullets}`
}

export function prependExperienceToResumeText(baseText: string, experience: Experience): string {
  const block = formatExperienceAsResumeText(experience)
  const trimmed = baseText.trim()
  return trimmed ? `${block}\n\n${trimmed}` : block
}

export function addExperienceToResume(resume: TailoredResume, experience: Experience): TailoredResume {
  return {
    ...resume,
    experience: [experience, ...resume.experience],
  }
}

export function isExperienceComplete(experience: Experience): boolean {
  return Boolean(
    experience.title.trim() &&
      experience.company.trim() &&
      experience.startDate.trim() &&
      experience.endDate.trim() &&
      experience.bullets.some((bullet) => bullet.trim())
  )
}

export function normalizeExperience(experience: Experience): Experience {
  return {
    title: experience.title.trim(),
    company: experience.company.trim(),
    location: experience.location.trim(),
    startDate: experience.startDate.trim(),
    endDate: experience.endDate.trim(),
    bullets: experience.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  }
}
