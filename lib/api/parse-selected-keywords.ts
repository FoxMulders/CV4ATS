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

export function parseAnchoredModifications(
  raw: FormDataEntryValue | null | undefined
): Array<{
  snippet: string
  originalBullet?: string
  bulletLineIndex?: number
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}> {
  if (typeof raw !== 'string' || !raw.trim()) return []

  type ModificationType = 'inline-bullet' | 'skills-section' | 'summary'

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        const modificationType = entry.modificationType
        const normalizedType: ModificationType | undefined =
          modificationType === 'inline-bullet' ||
          modificationType === 'skills-section' ||
          modificationType === 'summary'
            ? modificationType
            : undefined

        return {
          snippet: typeof entry.snippet === 'string' ? entry.snippet.trim() : '',
          originalBullet:
            typeof entry.originalBullet === 'string' ? entry.originalBullet.trim() : undefined,
          bulletLineIndex:
            typeof entry.bulletLineIndex === 'number' ? entry.bulletLineIndex : undefined,
          modificationType: normalizedType,
        }
      })
      .filter((entry) => entry.snippet.length > 0)
      .slice(0, 20)
  } catch {
    return []
  }
}
