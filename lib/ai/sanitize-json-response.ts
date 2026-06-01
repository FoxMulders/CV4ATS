/** Strip markdown code fences LLMs wrap around JSON payloads. */
export function stripMarkdownJsonFences(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()
}

/** Best-effort JSON object extraction after fence stripping. */
export function parseJsonFromSanitizedText(text: string): unknown {
  const cleaned = stripMarkdownJsonFences(text.trim())
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const jsonSlice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(jsonSlice)
}
