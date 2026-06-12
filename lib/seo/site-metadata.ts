import { BRAND_DOMAIN, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'

/** Canonical production origin — override with NEXT_PUBLIC_SITE_URL in deploy envs. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? `https://${BRAND_DOMAIN}`

/** ≤60 characters for SERP title display. */
export const SITE_TITLE = 'ATS Resume Builder & Cover Letter Tool | cv2ats'

/** ≤160 characters for SERP meta description. */
export const SITE_DESCRIPTION =
  'Free ATS resume builder at cv2ats.ca. Tailor resumes to job descriptions, scan keywords, and generate cover letters with AI career tools.'

export const SITE_KEYWORDS = [
  'ATS resume builder',
  'resume tailoring',
  'cover letter generator',
  'ATS resume scanner',
  'tailor resume to job description',
  'ATS-compliant resume',
  'AI resume optimization',
  'keyword match report',
  'career tools Canada',
  'cv2ats',
] as const

export const HOME_HERO = {
  eyebrow: BRAND_TAGLINE,
  title: 'Tailor your resume to beat the ATS',
  description:
    'Paste a job description and your resume to get ATS-optimized output, keyword scoring, and a role-specific cover letter — free to start at cv2ats.ca.',
} as const

export const siteOpenGraph = {
  type: 'website' as const,
  locale: 'en_CA',
  url: SITE_URL,
  siteName: BRAND_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
}
