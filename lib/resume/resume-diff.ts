import type { TailoredResume } from '@/lib/ai/schemas'

export type ResumeChangeTarget =
  | { kind: 'skill'; index: number }
  | { kind: 'summary'; phrase: string }
  | { kind: 'bullet'; experienceIndex: number; bulletIndex: number; phrase: string }
  | { kind: 'certification'; index: number }

export interface HighlightSpan {
  text: string
  highlighted: boolean
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function phraseExistsInOriginal(phrase: string, originalText: string): boolean {
  const needle = normalizeForMatch(phrase)
  if (needle.length < 3) return true
  return normalizeForMatch(originalText).includes(needle)
}

export function buildHighlightSpans(text: string, originalText: string): HighlightSpan[] {
  const tokens = text.match(/\S+|\s+/g) ?? [text]
  const spans: HighlightSpan[] = []
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]!
    if (/^\s+$/.test(token)) {
      spans.push({ text: token, highlighted: false })
      index += 1
      continue
    }

    let highlightLength = 0
    for (let end = tokens.length; end > index; end -= 1) {
      const chunk = tokens.slice(index, end).join('')
      if (!phraseExistsInOriginal(chunk, originalText)) {
        highlightLength = end - index
        break
      }
    }

    if (highlightLength > 0) {
      spans.push({
        text: tokens.slice(index, index + highlightLength).join(''),
        highlighted: true,
      })
      index += highlightLength
      continue
    }

    spans.push({ text: token, highlighted: false })
    index += 1
  }

  return spans
}

export function removePhraseFromText(text: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\s*${escaped}\\s*`, 'i')
  return text.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function applyResumeChangeRemoval(
  resume: TailoredResume,
  target: ResumeChangeTarget
): TailoredResume {
  switch (target.kind) {
    case 'skill':
      return {
        ...resume,
        skills: resume.skills.filter((_, index) => index !== target.index),
      }
    case 'summary':
      return {
        ...resume,
        summary: removePhraseFromText(resume.summary, target.phrase),
      }
    case 'bullet': {
      const experience = resume.experience.map((entry, experienceIndex) => {
        if (experienceIndex !== target.experienceIndex) return entry

        const bullets = entry.bullets
          .map((bullet, bulletIndex) =>
            bulletIndex === target.bulletIndex
              ? removePhraseFromText(bullet, target.phrase)
              : bullet
          )
          .filter(Boolean)

        return { ...entry, bullets: bullets.length > 0 ? bullets : entry.bullets }
      })

      return { ...resume, experience }
    }
    case 'certification':
      return {
        ...resume,
        certifications: resume.certifications.filter((_, index) => index !== target.index),
      }
    default:
      return resume
  }
}

export function countHighlightedSpans(spans: HighlightSpan[]): number {
  return spans.filter((span) => span.highlighted).length
}
