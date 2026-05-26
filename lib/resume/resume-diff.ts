import type { TailoredResume } from '@/lib/ai/schemas'

export type ResumeChangeTarget =
  | { kind: 'skill'; index: number }
  | { kind: 'summary'; phrase: string }
  | { kind: 'summary-revert' }
  | { kind: 'bullet'; experienceIndex: number; bulletIndex: number; phrase: string }
  | { kind: 'bullet-revert'; experienceIndex: number; bulletIndex: number }
  | { kind: 'certification'; index: number }

export interface HighlightSpan {
  text: string
  highlighted: boolean
}

const MIN_PHRASE_LENGTH = 3
const BULLET_CHANGE_THRESHOLD = 0.45

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenizeWords(value: string): string[] {
  return normalizeForMatch(value)
    .split(' ')
    .filter((word) => word.length > 2)
}

export function originalLines(originalText: string): string[] {
  return originalText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
}

export function findBestOriginalMatch(text: string, originalText: string): string {
  const targetWords = new Set(tokenizeWords(text))
  if (targetWords.size === 0) return ''

  let bestLine = ''
  let bestScore = 0

  for (const line of originalLines(originalText)) {
    const lineWords = tokenizeWords(line)
    if (lineWords.length === 0) continue

    let shared = 0
    for (const word of lineWords) {
      if (targetWords.has(word)) shared += 1
    }

    const score = shared / lineWords.length
    if (score > bestScore) {
      bestScore = score
      bestLine = line
    }
  }

  return bestScore >= 0.25 ? bestLine : ''
}

export function extractOriginalSummary(originalText: string): string {
  const paragraphs = originalText
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\n+/g, ' ').trim())
    .filter((block) => block.length >= 40)

  if (paragraphs.length === 0) {
    return originalLines(originalText).slice(0, 2).join(' ')
  }

  const summaryLike = paragraphs.find((block) =>
    /summary|profile|objective|overview/i.test(block.slice(0, 40))
  )
  return summaryLike ?? paragraphs[0] ?? ''
}

export function phraseExistsInCorpus(phrase: string, corpus: string): boolean {
  const needle = normalizeForMatch(phrase)
  if (needle.length < MIN_PHRASE_LENGTH) return true
  if (!corpus.trim()) return false
  return normalizeForMatch(corpus).includes(needle)
}

export function phraseExistsInOriginal(phrase: string, originalText: string): boolean {
  return phraseExistsInCorpus(phrase, originalText)
}

export function isSubstantiallyChanged(text: string, originalText: string): boolean {
  const baseline = findBestOriginalMatch(text, originalText)
  if (!baseline) return normalizeForMatch(text).length > 0

  const targetWords = tokenizeWords(text)
  const baselineWords = new Set(tokenizeWords(baseline))
  if (targetWords.length === 0) return false

  let shared = 0
  for (const word of targetWords) {
    if (baselineWords.has(word)) shared += 1
  }

  return shared / targetWords.length < BULLET_CHANGE_THRESHOLD
}

export function buildHighlightSpans(text: string, comparisonCorpus: string): HighlightSpan[] {
  if (!comparisonCorpus.trim()) {
    return [{ text, highlighted: true }]
  }

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
      if (!phraseExistsInCorpus(chunk, comparisonCorpus)) {
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

export function hasHighlightedChanges(spans: HighlightSpan[]): boolean {
  return spans.some((span) => span.highlighted)
}

export function removePhraseFromText(text: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\s*${escaped}\\s*`, 'i')
  return text.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function applyResumeChangeRevert(
  resume: TailoredResume,
  target: ResumeChangeTarget,
  originalText: string
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
    case 'summary-revert':
      return {
        ...resume,
        summary: extractOriginalSummary(originalText) || resume.summary,
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
    case 'bullet-revert': {
      const experience = resume.experience.map((entry, experienceIndex) => {
        if (experienceIndex !== target.experienceIndex) return entry

        const currentBullet = entry.bullets[target.bulletIndex]
        if (!currentBullet) return entry

        const originalLine = findBestOriginalMatch(currentBullet, originalText)
        const bullets = [...entry.bullets]

        if (originalLine) {
          bullets[target.bulletIndex] = originalLine
        } else {
          bullets.splice(target.bulletIndex, 1)
        }

        return { ...entry, bullets }
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

/** @deprecated Use applyResumeChangeRevert */
export function applyResumeChangeRemoval(
  resume: TailoredResume,
  target: ResumeChangeTarget,
  originalText: string
): TailoredResume {
  return applyResumeChangeRevert(resume, target, originalText)
}
