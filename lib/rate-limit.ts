const WINDOW_MS = 60 * 60 * 1000
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000)

export type RateLimitBucket = 'generate' | 'tailor' | 'parse' | 'export' | 'ingest' | 'search' | 'hiring-panel'

const BUCKET_LIMITS: Record<RateLimitBucket, number> = {
  generate: 5,
  tailor: 10,
  parse: 20,
  export: 30,
  ingest: 10,
  search: 60,
  'hiring-panel': 3,
}

type Entry = { count: number; resetAt: number }

const memoryStore = new Map<string, Entry>()

function hasKvEnv(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  )
}

function checkMemoryRateLimit(
  bucket: RateLimitBucket,
  ip: string
): { allowed: boolean; retryAfterSeconds?: number } {
  const maxRequests = BUCKET_LIMITS[bucket]
  const key = `ratelimit:${bucket}:${ip}`
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count += 1
  return { allowed: true }
}

async function checkKvRateLimit(
  bucket: RateLimitBucket,
  ip: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const maxRequests = BUCKET_LIMITS[bucket]
  const key = `ratelimit:${bucket}:${ip}`

  const { kv } = await import('@vercel/kv')
  const count = await kv.incr(key)

  if (count === 1) {
    await kv.expire(key, WINDOW_SECONDS)
  }

  if (count > maxRequests) {
    const ttl = await kv.ttl(key)
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
    }
  }

  return { allowed: true }
}

export async function checkRateLimit(
  bucket: RateLimitBucket,
  ip: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return checkMemoryRateLimit(bucket, ip)
  }

  if (hasKvEnv()) {
    try {
      return await checkKvRateLimit(bucket, ip)
    } catch (error) {
      console.error('KV rate limit fallback to memory:', error)
    }
  }

  return checkMemoryRateLimit(bucket, ip)
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function isKvRateLimitEnabled(): boolean {
  return hasKvEnv()
}
