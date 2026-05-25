export async function parseApiErrorResponse(response: Response, fallback: string): Promise<string> {
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? '3600')
    const minutes = Math.max(1, Math.ceil(retryAfter / 60))
    return `Rate limit exceeded. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`
  }

  try {
    const data = (await response.json()) as { error?: string }
    if (data.error?.trim()) {
      return data.error
    }
  } catch {
    // Response body was not JSON.
  }

  return fallback
}
