export function parseSelectedKeywords(raw: FormDataEntryValue | null | undefined): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20)
  } catch {
    return []
  }
}

export function parseCustomSnippets(raw: FormDataEntryValue | null | undefined): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20)
  } catch {
    return []
  }
}
