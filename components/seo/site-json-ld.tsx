import { BRAND_NAME } from '@/lib/brand'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '@/lib/seo/site-metadata'

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
}

const webApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: BRAND_NAME,
  alternateName: 'cv2ats.ca ATS Resume Builder',
  url: SITE_URL,
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript',
  applicationCategory: 'BusinessApplication',
  inLanguage: 'en-CA',
  isAccessibleForFree: true,
  description: SITE_DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '4.99',
    priceCurrency: 'CAD',
    description: '24-Hour Job Pass with unlimited edits and re-downloads for one target role',
  },
  featureList: [
    'AI-powered ATS resume tailoring',
    'ATS resume scanner with anti-plagiarism guardrails',
    'Cover letter generation',
    'Keyword match and ATS compliance scoring',
    'Exact Phrasing Auditor',
    'Edmonton-area job search integration',
  ],
  creator: {
    '@type': 'Organization',
    name: BRAND_NAME,
    url: SITE_URL,
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/jobs?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

export function SiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  )
}

/** Home-page FAQ rich results — rendered only on `/`. */
export function HomePageJsonLd({ faqJsonLd }: { faqJsonLd: Record<string, unknown> }) {
  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: SITE_TITLE,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND_NAME,
      url: SITE_URL,
    },
    about: {
      '@type': 'WebApplication',
      name: BRAND_NAME,
      url: SITE_URL,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  )
}
