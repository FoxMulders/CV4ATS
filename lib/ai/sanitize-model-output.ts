const COVER_LETTER_TAIL_MARKERS = [
  /\*\*Key Changes/i,
  /##\s*Key Changes/i,
  /^Key Changes and Explanations/im,
  /\*\*Before submitting/i,
  /^Before submitting,/im,
  /^---+\s*$/m,
  /^#{1,3}\s+Explanation/im,
  /^#{1,3}\s+Notes/im,
]

function stripMarkdownFences(text: string): string {
  const fenced = text.match(/```(?:markdown|md|text)?\s*\n?([\s\S]*?)```/i)
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim()
  }

  return text
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

function truncateAtExplanationTail(text: string): string {
  let earliest = text.length

  for (const marker of COVER_LETTER_TAIL_MARKERS) {
    const match = marker.exec(text)
    if (match && match.index >= 120 && match.index < earliest) {
      earliest = match.index
    }
  }

  return earliest < text.length ? text.slice(0, earliest).trim() : text
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^Subject:\s*/gim, '')
}

/** Keep only the cover letter body when a model adds markdown fences or change logs. */
export function extractCoverLetterFromModelOutput(text: string): string {
  if (!text.trim()) return text

  let cleaned = stripMarkdownFences(text.trim())
  cleaned = truncateAtExplanationTail(cleaned)
  cleaned = stripInlineMarkdown(cleaned)

  return cleaned.trim()
}

/** Keep only summary prose when a model adds markdown or commentary. */
export function extractSummaryFromModelOutput(text: string): string {
  if (!text.trim()) return text

  let cleaned = stripMarkdownFences(text.trim())
  cleaned = truncateAtExplanationTail(cleaned)
  cleaned = stripInlineMarkdown(cleaned)

  const firstParagraph = cleaned.split(/\n\n+/)[0]?.trim()
  return firstParagraph && firstParagraph.length >= 20 ? firstParagraph : cleaned.trim()
}

export function modelOutputLooksLikeCommentary(text: string): boolean {
  return COVER_LETTER_TAIL_MARKERS.some((marker) => marker.test(text))
}
