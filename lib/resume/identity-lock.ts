import type { Contact, TailoredResume } from '@/lib/ai/schemas'
import {
  resolveCandidateNameFromSource,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'

const NAME_PLACEHOLDER =
  /^(?:candidate name|your name|applicant name|professional candidate|name here|full name)$/i

function contactFromSource(sourceResumeText: string): Contact {
  const lines = sourceResumeText.replace(/\r\n/g, '\n').split('\n')
  const email =
    sourceResumeText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]?.trim() ?? ''
  const phone =
    sourceResumeText.match(
      /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
    )?.[0]?.trim() ?? ''
  const linkedin =
    sourceResumeText.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0]?.trim() ?? ''

  const locationLine = lines.find((line) =>
    /\b(?:AB|BC|ON|QC|Alberta|Edmonton|Calgary|Toronto|Canada)\b/i.test(line)
  )

  return {
    name: resolveCandidateNameFromSource(sourceResumeText, email),
    email,
    phone,
    location: locationLine?.trim() ?? '',
    linkedin,
  }
}

/** Immutable identity captured from the user's uploaded resume — never from LLM stream text. */
export function resolveLockedContactFromSource(sourceResumeText: string): Contact | null {
  const source = sourceResumeText.trim()
  if (!source) return null
  return contactFromSource(source)
}

export function applyLockedContactToResume(
  resume: TailoredResume,
  locked: Contact | null | undefined,
  sourceResumeText?: string
): TailoredResume {
  if (!locked) {
    if (!sourceResumeText?.trim()) return resume
    const resolved = resolveLockedContactFromSource(sourceResumeText)
    if (!resolved) return resume
    return mergeContact(resume, resolved, sourceResumeText)
  }

  return mergeContact(resume, locked, sourceResumeText)
}

function mergeContact(
  resume: TailoredResume,
  locked: Contact,
  sourceResumeText?: string
): TailoredResume {
  const streamedName = resume.contact.name.trim()
  const lockedName = sanitizeCandidateName(locked.name, sourceResumeText)
  const name =
    !streamedName || NAME_PLACEHOLDER.test(streamedName)
      ? lockedName
      : sanitizeCandidateName(streamedName, sourceResumeText)

  return {
    ...resume,
    contact: {
      name: NAME_PLACEHOLDER.test(name) ? lockedName : name,
      email: locked.email || resume.contact.email || '',
      phone: locked.phone || resume.contact.phone || '',
      location: locked.location || resume.contact.location || '',
      linkedin: locked.linkedin || resume.contact.linkedin || '',
    },
  }
}
