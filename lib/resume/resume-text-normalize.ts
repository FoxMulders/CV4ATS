/**
 * Line-preserving resume text normalization for parsers.
 * Never collapses newlines — unlike formatResumeFieldText used on single fields.
 */

const MERGED_WORD_FIXES: ReadonlyArray<[RegExp, string]> = [
  [/\bendtoend\b/gi, 'end-to-end'],
  [/\bcrossfunctional\b/gi, 'cross-functional'],
  [/\bprojectmanagement\b/gi, 'project management'],
  [/\bprogrammanagement\b/gi, 'program management'],
  [/\bstakeholdermanagement\b/gi, 'stakeholder management'],
]

function normalizeSpecialCharacters(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[•◦▪▫●○◆◇■□]/g, '•')
    .replace(/\t/g, ' ')
}

function fixMergedWords(text: string): string {
  let result = text
  for (const [pattern, replacement] of MERGED_WORD_FIXES) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/** Strip markdown heading markers without removing section title characters. */
export function stripResumeHeadingMarkers(line: string): string {
  let cleaned = line.trim()
  cleaned = cleaned.replace(/^#{1,6}\s+/, '')
  cleaned = cleaned.replace(/^\*{1,2}\s*/, '').replace(/\s*\*{1,2}$/, '')
  cleaned = cleaned.replace(/^_{1,2}\s*/, '').replace(/\s*_{1,2}$/, '')
  return cleaned.trim()
}

/** Per-line cleanup — preserves leading bullet markers for section parsers. */
export function normalizeResumeLine(line: string): string {
  if (!line.trim()) return ''

  let result = normalizeSpecialCharacters(line)
  result = fixMergedWords(result)
  result = result.replace(/([A-Za-z])•([A-Za-z])/g, '$1 • $2')
  result = result.replace(/\s+$/, '')
  return result
}

/** Document-level normalization that preserves line boundaries for section parsers. */
export function normalizeResumeDocumentText(text: string): string {
  if (!text.trim()) return ''

  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeResumeLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
