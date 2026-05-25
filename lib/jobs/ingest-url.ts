import { safeFetchHtml } from '@/lib/security/safe-fetch'
import type { JobListing } from '@/lib/jobs/types'

const USER_AGENT =
  'Mozilla/5.0 (compatible; ATS4CV/1.0; +https://ats4cv.vercel.app)'

const DEADLINE_PATTERNS = [
  /\bcloses?\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  /\bclosing\s+date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-/]\w+[-/]\d{4})/i,
  /\bdeadline[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-/]\w+[-/]\d{4})/i,
  /\bposting\s+end\s+date[:\s]+(\d{1,2}[-/]\w+[-/]\d{4})/i,
  /\bapply\s+by[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
]

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function metaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i'
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtml(match[1].trim())
  }

  return undefined
}

function jsonLdJobPosting(html: string): Partial<JobListing> | null {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (!scripts) return null

  for (const script of scripts) {
    const body = script.replace(/<\/?script[^>]*>/gi, '').trim()
    try {
      const data = JSON.parse(body) as Record<string, unknown> | Record<string, unknown>[]
      const nodes = Array.isArray(data) ? data : [data]

      for (const node of nodes) {
        const type = String(node['@type'] ?? '')
        if (!type.toLowerCase().includes('jobposting')) continue

        const hiringOrg = node.hiringOrganization as { name?: string } | undefined
        const location = node.jobLocation as
          | { address?: { addressLocality?: string; addressRegion?: string } }
          | undefined

        const locality = location?.address?.addressLocality
        const region = location?.address?.addressRegion
        const locationLabel = [locality, region].filter(Boolean).join(', ') || 'Edmonton, AB'

        return {
          title: String(node.title ?? '').trim(),
          company: hiringOrg?.name?.trim() ?? 'Unknown employer',
          location: locationLabel,
          description: stripTags(String(node.description ?? '')),
          employmentType: String(node.employmentType ?? '').trim() || undefined,
          closingDate: String(node.validThrough ?? '').trim() || undefined,
          postedDate: String(node.datePosted ?? '').trim() || undefined,
        }
      }
    } catch {
      continue
    }
  }

  return null
}

function parseLinkedInTitle(rawTitle: string): { title: string; company: string } {
  const hiringMatch = rawTitle.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+/i)
  if (hiringMatch) {
    return { company: hiringMatch[1].trim(), title: hiringMatch[2].trim() }
  }

  const atMatch = rawTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+\||$)/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  return { title: rawTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim(), company: 'Unknown employer' }
}

function extractDeadline(text: string): string | undefined {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function extractMainDescription(html: string): string {
  const article =
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html

  const sections = article.match(/<section[^>]*>([\s\S]*?)<\/section>/gi) ?? [article]
  const longest = sections
    .map((section) => stripTags(section))
    .sort((a, b) => b.length - a.length)[0]

  return (longest ?? stripTags(article)).slice(0, 12000)
}

function sourceLabel(url: URL): string {
  const host = url.hostname.replace(/^www\./, '')
  if (host.includes('linkedin.com')) return 'LinkedIn'
  if (host.includes('workday')) return 'Workday'
  if (host.includes('greenhouse.io')) return 'Greenhouse'
  if (host.includes('lever.co')) return 'Lever'
  if (host.includes('smartrecruiters.com')) return 'SmartRecruiters'
  if (host.includes('randstad.com')) return 'Randstad'
  return host
}

export async function ingestJobFromUrl(rawUrl: string): Promise<JobListing> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error('Invalid job URL. Paste a full https:// link to the posting.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https job links are supported.')
  }

  const html = await safeFetchHtml(url.toString(), { userAgent: USER_AGENT })
  const structured = jsonLdJobPosting(html)

  const ogTitle = metaContent(html, 'og:title')
  const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  const rawTitle = structured?.title || ogTitle || pageTitle || 'Job posting'

  const linkedInParsed = url.hostname.includes('linkedin.com')
    ? parseLinkedInTitle(rawTitle)
    : null

  const title = linkedInParsed?.title || rawTitle.split('|')[0]?.trim() || 'Job posting'
  const company =
    structured?.company ||
    linkedInParsed?.company ||
    metaContent(html, 'og:site_name') ||
    'Unknown employer'

  const description =
    structured?.description ||
    metaContent(html, 'og:description') ||
    metaContent(html, 'description') ||
    extractMainDescription(html)

  if (description.length < 80) {
    throw new Error(
      'Could not extract enough job detail from that page. LinkedIn and some ATS sites may block automated reads — paste the job description text instead, or try the employer’s direct apply page.'
    )
  }

  const plain = stripTags(html)
  const closingDate = structured?.closingDate || extractDeadline(plain)

  const id = `manual-${Buffer.from(url.toString()).toString('base64url').slice(0, 24)}`

  return {
    id,
    title,
    company,
    location: structured?.location || 'Edmonton, AB',
    description,
    salary: undefined,
    closingDate,
    postedDate: structured?.postedDate,
    employmentType: structured?.employmentType,
    applyUrl: url.toString(),
    source: sourceLabel(url),
  }
}
