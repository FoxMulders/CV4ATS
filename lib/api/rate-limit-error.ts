/** Client-side rate limit error with server-provided cooldown window. */
export class ApiRateLimitError extends Error {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number, message?: string) {
    super(
      message ??
        `Rate limit exceeded. Retry available in ${Math.max(1, retryAfterSeconds)} second${retryAfterSeconds === 1 ? '' : 's'}.`
    )
    this.name = 'ApiRateLimitError'
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
  }
}

export function isApiRateLimitError(error: unknown): error is ApiRateLimitError {
  return error instanceof ApiRateLimitError
}

export function readRetryAfterSeconds(response: Response, body?: unknown): number {
  const header = Number(response.headers.get('Retry-After') ?? '')
  if (Number.isFinite(header) && header > 0) {
    return Math.ceil(header)
  }

  if (body && typeof body === 'object' && body !== null && 'retryAfterSeconds' in body) {
    const fromBody = Number((body as { retryAfterSeconds?: number }).retryAfterSeconds)
    if (Number.isFinite(fromBody) && fromBody > 0) {
      return Math.ceil(fromBody)
    }
  }

  return 60
}
