import { createHmac, timingSafeEqual } from 'node:crypto'

export const PREMIUM_DOWNLOAD_PRICE_CENTS = 499
export const PREMIUM_DOWNLOAD_CURRENCY = 'CAD'
export const PREMIUM_DOWNLOAD_NOTE = 'cv2ats 24-Hour Job Pass'
export const PREMIUM_ACCESS_TTL_MS = 24 * 60 * 60 * 1000

export interface PremiumAccessPayload {
  paymentId: string
  jobDescriptionHash: string
  unlockedAt: number
  expiresAt: number
}

function getSigningSecret(): string {
  const secret =
    process.env.PREMIUM_ACCESS_SIGNING_SECRET?.trim() ||
    process.env.SQUARE_ACCESS_TOKEN?.trim()

  if (!secret) {
    throw new Error('Premium access signing secret is not configured.')
  }

  return secret
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8')
}

function signBody(body: string): string {
  return createHmac('sha256', getSigningSecret()).update(body).digest('base64url')
}

export function isPremiumDownloadsEnforced(): boolean {
  return Boolean(
    process.env.SQUARE_ACCESS_TOKEN?.trim() && process.env.SQUARE_LOCATION_ID?.trim()
  )
}

export function createPremiumAccessToken(
  paymentId: string,
  jobDescriptionHash: string
): { token: string; payload: PremiumAccessPayload } {
  const unlockedAt = Date.now()
  const payload: PremiumAccessPayload = {
    paymentId,
    jobDescriptionHash,
    unlockedAt,
    expiresAt: unlockedAt + PREMIUM_ACCESS_TTL_MS,
  }

  const body = toBase64Url(JSON.stringify(payload))
  const signature = signBody(body)
  return {
    token: `${body}.${signature}`,
    payload,
  }
}

export function verifyPremiumAccessToken(
  token: string | null | undefined,
  expectedJobDescriptionHash?: string
): PremiumAccessPayload | null {
  if (!token?.trim()) return null

  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expectedSignature = signBody(body)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (actualBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(fromBase64Url(body)) as PremiumAccessPayload
    if (!payload.paymentId || !payload.expiresAt || !payload.jobDescriptionHash) return null
    if (Date.now() > payload.expiresAt) return null
    if (
      expectedJobDescriptionHash &&
      payload.jobDescriptionHash !== expectedJobDescriptionHash
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function verifyExportAccess(
  request: Request
): { ok: true } | { ok: false; error: string } {
  if (!isPremiumDownloadsEnforced()) {
    return { ok: true }
  }

  const token = request.headers.get('x-premium-access-token')
  const jobDescriptionHash = request.headers.get('x-job-description-hash')?.trim()

  if (!jobDescriptionHash) {
    return {
      ok: false,
      error: 'A valid 24-Hour Job Pass is required for this role before exporting.',
    }
  }

  if (!verifyPremiumAccessToken(token, jobDescriptionHash)) {
    return {
      ok: false,
      error: 'Your 24-Hour Job Pass is missing, expired, or does not match this job description.',
    }
  }

  return { ok: true }
}

export function decodePremiumAccessPayloadClient(
  token: string
): PremiumAccessPayload | null {
  const [body] = token.split('.')
  if (!body) return null

  try {
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const payload = JSON.parse(atob(`${normalized}${padding}`)) as PremiumAccessPayload

    if (!payload.paymentId || !payload.expiresAt || !payload.jobDescriptionHash) return null
    if (Date.now() > payload.expiresAt) return null
    return payload
  } catch {
    return null
  }
}
