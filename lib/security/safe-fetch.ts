import dns from 'node:dns/promises'
import net from 'node:net'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 127 || a === 0) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    return false
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fe80:')) return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    return false
  }

  return true
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost') return true
  if (host.endsWith('.local')) return true
  if (host.endsWith('.internal')) return true
  if (host === 'metadata.google.internal') return true
  if (host === '169.254.169.254') return true
  return false
}

async function assertSafeUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https job links are supported.')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('That URL cannot be fetched for security reasons.')
  }

  if (net.isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) {
      throw new Error('That URL cannot be fetched for security reasons.')
    }
    return
  }

  const addresses = await dns.lookup(url.hostname, { all: true })
  if (!addresses.length) {
    throw new Error('Could not resolve job URL hostname.')
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error('That URL cannot be fetched for security reasons.')
    }
  }
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const decoder = new TextDecoder()
  let total = 0
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    total += value.byteLength
    if (total > maxBytes) {
      throw new Error('Job page response is too large to process.')
    }

    result += decoder.decode(value, { stream: true })
  }

  result += decoder.decode()
  return result
}

export async function safeFetchHtml(
  urlString: string,
  options?: { userAgent?: string }
): Promise<string> {
  let currentUrl = new URL(urlString.trim())
  let redirects = 0

  while (true) {
    await assertSafeUrl(currentUrl)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl.toString(), {
        headers: {
          'User-Agent':
            options?.userAgent ??
            'Mozilla/5.0 (compatible; ATS4CV/1.0; +https://ats4cv.vercel.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          throw new Error('Invalid redirect from job URL.')
        }

        redirects += 1
        if (redirects > MAX_REDIRECTS) {
          throw new Error('Too many redirects from job URL.')
        }

        currentUrl = new URL(location, currentUrl)
        continue
      }

      if (!response.ok) {
        throw new Error(
          `Could not read job page (HTTP ${response.status}). Open the link manually to verify it is still active.`
        )
      }

      return await readResponseText(response, MAX_RESPONSE_BYTES)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timed out reading job page. Try again or paste the job description text.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}
