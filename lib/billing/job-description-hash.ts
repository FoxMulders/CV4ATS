import { createHash } from 'node:crypto'

import { normalizeJobDescriptionForHash } from '@/lib/billing/job-description-hash.client'

export { normalizeJobDescriptionForHash } from '@/lib/billing/job-description-hash.client'

export function hashJobDescriptionSync(text: string): string {
  const normalized = normalizeJobDescriptionForHash(text)
  if (!normalized) return ''

  return createHash('sha256').update(normalized).digest('hex')
}
