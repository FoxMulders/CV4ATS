const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ats-resume-builder-flax.vercel.app'

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ATS4CV',
  url: siteUrl,
  description:
    'Context-aware ATS resume tailoring with anti-plagiarism guardrails and 24-Hour Job Pass premium access.',
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ATS4CV',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  offers: {
    '@type': 'Offer',
    price: '4.99',
    priceCurrency: 'CAD',
    description: '24-Hour Job Pass with unlimited edits and re-downloads for one target role',
  },
  featureList: [
    'Context-aware resume tailoring',
    'Exact Phrasing Auditor anti-plagiarism checks',
    'Adaptive phrase diversification',
    '24-Hour Job Pass per role',
    'Square secure checkout',
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ATS4CV',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/jobs?q={search_term_string}`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  )
}
