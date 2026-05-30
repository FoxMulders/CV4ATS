import type { AiGenerationResult, Experience, TailoredResume } from '@/lib/ai/schemas'

function normalizeExperience(entry: Experience): Experience {
  return {
    title: entry.title.trim() || 'Professional Experience',
    company: entry.company.trim() || 'Employer not listed',
    location: entry.location ?? '',
    startDate: entry.startDate.trim() || 'Recent',
    endDate: entry.endDate.trim() || 'Present',
    bullets: entry.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  }
}

/** Ensures browser/local drafts satisfy strict API schemas before server review. */
export function normalizeGenerationDraftForApi(draft: AiGenerationResult): AiGenerationResult {
  const tailoredResume: TailoredResume = {
    ...draft.tailoredResume,
    contact: {
      name: draft.tailoredResume.contact.name.trim() || 'Candidate',
      email: draft.tailoredResume.contact.email ?? '',
      phone: draft.tailoredResume.contact.phone ?? '',
      location: draft.tailoredResume.contact.location ?? '',
      linkedin: draft.tailoredResume.contact.linkedin ?? '',
    },
    summary: draft.tailoredResume.summary.trim() || 'Professional summary pending.',
    skills: draft.tailoredResume.skills.map((s) => s.trim()).filter(Boolean).slice(0, 32),
    experience: draft.tailoredResume.experience
      .map(normalizeExperience)
      .filter((entry) => entry.bullets.length > 0),
    education: draft.tailoredResume.education.map((entry) => ({
      degree: entry.degree.trim() || 'Education',
      school: entry.school.trim() || 'Institution not listed',
      graduationDate: entry.graduationDate ?? '',
      details: entry.details ?? '',
    })),
    certifications: (draft.tailoredResume.certifications ?? []).map((c) => c.trim()).filter(Boolean),
  }

  if (tailoredResume.experience.length === 0) {
    tailoredResume.experience = [
      {
        title: 'Professional Experience',
        company: 'Employer not listed',
        location: '',
        startDate: 'Recent',
        endDate: 'Present',
        bullets: ['Cross-functional delivery experience documented in source resume.'],
      },
    ]
  }

  if (tailoredResume.skills.length === 0) {
    tailoredResume.skills = ['Program Management', 'Cross-functional Delivery']
  }

  return {
    keywordReport: draft.keywordReport,
    tailoredResume,
    coverLetter: draft.coverLetter.trim() || 'Cover letter pending.',
  }
}
