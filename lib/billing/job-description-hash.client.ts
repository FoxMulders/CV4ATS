export function normalizeJobDescriptionForHash(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function hashJobDescription(text: string): Promise<string> {
  const normalized = normalizeJobDescriptionForHash(text)
  if (!normalized) return ''

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
